/* 一声一味 · 社区服务
 *
 * 默认零依赖 Node.js 服务：
 *   - 静态托管本目录（含中文文件名）
 *   - 乡音社区 REST API + SSE 实时推送
 *   - 人口公开统计数据 API（带版本与校验时间）
 *
 * 生产环境可通过环境变量启用可选适配层：
 *   - DATABASE_URL / DB_DRIVER=postgres  → PostgreSQL
 *   - REDIS_URL                           → 跨实例限流与 SSE 广播
 *   - S3_BUCKET 等                        → S3 兼容对象存储（语音直传）
 *
 * 启动：
 *   node server.js
 * 然后打开：
 *   http://localhost:8787/
 *
 * 环境变量：
 *   PORT=8787 HOST=0.0.0.0 node server.js
 *   CLIENT_TOKEN_SECRET=随机长字符串  # 不设置时每个进程随机生成
 *   CLIENT_TOKEN_TTL_MS=86400000      # 匿名会话有效期，默认 24 小时
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const FANGYAN_DATA = require('./assets/data/dialects.js');
const { createStore } = require('./lib/store.js');
const { createRedis } = require('./lib/redis.js');
const { createObjectStore, audioExtension } = require('./lib/object-store.js');

const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const COMMUNITY_FILE = process.env.COMMUNITY_FILE ? path.resolve(process.env.COMMUNITY_FILE) : path.join(DATA_DIR, 'community.json');
const COMMUNITY_DB = process.env.COMMUNITY_DB ? path.resolve(process.env.COMMUNITY_DB) : path.join(DATA_DIR, 'community.sqlite');
const POPULATION_FILE = process.env.POPULATION_FILE ? path.resolve(process.env.POPULATION_FILE) : path.join(DATA_DIR, 'population.json');
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_POSTS = 500;
const MAX_AUDIO_CHARS = 2400000;
const MAX_AUDIO_BYTES = Math.floor(1.5 * 1024 * 1024);
const MAX_BODY_BYTES = 3200000;
const ADMIN_TOKEN = (process.env.COMMUNITY_ADMIN_TOKEN || '').trim();
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const DB_DRIVER = String(process.env.DB_DRIVER || (DATABASE_URL ? 'postgres' : 'sqlite')).toLowerCase();
const REDIS_URL = String(process.env.REDIS_URL || '').trim();
const S3_BUCKET = String(process.env.S3_BUCKET || '').trim();
const S3_REGION = String(process.env.S3_REGION || 'us-east-1').trim();
const S3_ENDPOINT = String(process.env.S3_ENDPOINT || '').trim();
const S3_PUBLIC_ENDPOINT = String(process.env.S3_PUBLIC_ENDPOINT || '').trim();
const S3_PUBLIC_BASE_URL = String(process.env.S3_PUBLIC_BASE_URL || '').trim();
const S3_ACCESS_KEY_ID = String(process.env.S3_ACCESS_KEY_ID || '').trim();
const S3_SECRET_ACCESS_KEY = String(process.env.S3_SECRET_ACCESS_KEY || '').trim();
const S3_FORCE_PATH_STYLE = String(process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() !== 'false';
const UPLOAD_TTL_SECONDS = Math.min(900, Math.max(60, Number(process.env.UPLOAD_TTL_SECONDS) || 300));
const TRUST_PROXY = String(process.env.TRUST_PROXY || '').toLowerCase() === 'true';
const ALLOWED_ORIGINS = new Set(
  String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean)
);
const CLIENT_TOKEN_SECRET =
  (process.env.CLIENT_TOKEN_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');
const CLIENT_TOKEN_TTL_MS = (() => {
  const value = Number(process.env.CLIENT_TOKEN_TTL_MS);
  if (!Number.isFinite(value) || value < 60000) return 24 * 60 * 60 * 1000;
  return Math.min(value, 30 * 24 * 60 * 60 * 1000);
})();

const BOARDS = new Set(FANGYAN_DATA.dialects.map((d) => d.id));
const TYPES = new Set(['dialect', 'suggest']);

/* CSP 允许的额外来源：对象存储直传与跨域 API */
const EXTRA_ORIGINS = new Set();
function rememberOrigin(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol === 'http:' || url.protocol === 'https:') EXTRA_ORIGINS.add(url.origin);
  } catch (_) {}
}
rememberOrigin(process.env.PUBLIC_API_ORIGIN);
rememberOrigin(S3_ENDPOINT);
rememberOrigin(S3_PUBLIC_ENDPOINT);
rememberOrigin(S3_PUBLIC_BASE_URL);
const EXTRA_ORIGIN_TEXT = Array.from(EXTRA_ORIGINS).join(' ');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const COMPRESSIBLE = /^(?:text\/|application\/(?:javascript|json|xml)|image\/svg\+xml)/i;
const GZIP_CACHE = new Map();
const GZIP_CACHE_LIMIT = 64;

function acceptsGzip(header) {
  if (!header) return false;
  return header.split(',').some((part) => {
    const [name, ...params] = part.trim().toLowerCase().split(';');
    if (name !== 'gzip' && name !== '*') return false;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    return !q || Number(q.slice(2)) > 0;
  });
}

function gzipBuffer(key, buffer) {
  const cached = GZIP_CACHE.get(key);
  if (cached) return cached;
  const out = zlib.gzipSync(buffer, { level: 6 });
  if (GZIP_CACHE.size >= GZIP_CACHE_LIMIT) GZIP_CACHE.delete(GZIP_CACHE.keys().next().value);
  GZIP_CACHE.set(key, out);
  return out;
}

let store = null;
let redis = null;
let objectStore = null;
let server = null;
let shuttingDown = false;
const sseClients = new Set();
const rateBuckets = new Map();

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

function clean(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function newId() {
  return 'p' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function tokenMatches(token, hash) {
  if (typeof token !== 'string' || typeof hash !== 'string') return false;
  if (!/^[a-f0-9]{64}$/.test(hash)) return false;
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function adminMatches(token) {
  if (!ADMIN_TOKEN || typeof token !== 'string') return false;
  const a = Buffer.from(token);
  const b = Buffer.from(ADMIN_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signClientToken(clientId, expiresAt) {
  const payload = base64url(JSON.stringify({
    cid: clientId,
    iat: Date.now(),
    exp: expiresAt
  }));
  const signature = crypto
    .createHmac('sha256', CLIENT_TOKEN_SECRET)
    .update('v1.' + payload)
    .digest('base64url');
  return 'v1.' + payload + '.' + signature;
}

function verifyClientToken(token) {
  if (typeof token !== 'string' || token.length > 1024) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const expected = crypto
    .createHmac('sha256', CLIENT_TOKEN_SECRET)
    .update('v1.' + parts[1])
    .digest('base64url');
  const actual = Buffer.from(parts[2]);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (_) {
    return null;
  }
  if (!payload || typeof payload.cid !== 'string') return null;
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(payload.cid)) return null;
  if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
  return payload;
}

function clientTokenFrom(req) {
  const header = String(req.headers['x-client-token'] || '').trim();
  if (header) return header;
  const auth = String(req.headers.authorization || '').trim();
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match ? match[1].trim() : '';
}

function newClientId() {
  return 'c' + crypto.randomBytes(16).toString('hex');
}

function normalizeStoredPost(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!BOARDS.has(raw.board)) return null;
  const text = clean(raw.text, 200);
  if (!text) return null;
  const likedBy = Array.isArray(raw.likedBy)
    ? raw.likedBy.filter((id) => typeof id === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(id))
    : [];
  const likes = Math.max(0, Number(raw.likes) || likedBy.length || 0);
  return {
    id: clean(raw.id, 64) || newId(),
    board: raw.board,
    province: clean(raw.province, 30),
    name: clean(raw.name, 20) || '匿名乡音',
    type: TYPES.has(raw.type) ? raw.type : 'dialect',
    text: text,
    audio: typeof raw.audio === 'string' && /^data:audio\//i.test(raw.audio) && raw.audio.length <= MAX_AUDIO_CHARS ? raw.audio : null,
    audioName: clean(raw.audioName, 80),
    likes: likes,
    likedBy: likedBy,
    createdAt: Math.max(0, Number(raw.createdAt) || Date.now()),
    replyTo: clean(raw.replyTo, 40) || null,
    ownerId: typeof raw.ownerId === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(raw.ownerId) ? raw.ownerId : null,
    deleteTokenHash: typeof raw.deleteTokenHash === 'string' && /^[a-f0-9]{64}$/.test(raw.deleteTokenHash) ? raw.deleteTokenHash : null
  };
}

function loadCommunity() {
  try {
    const raw = readJson(COMMUNITY_FILE, []);
    if (!Array.isArray(raw)) throw new Error('community.json 不是数组');
    return raw.map(normalizeStoredPost).filter(Boolean).slice(-MAX_POSTS);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    const backup = COMMUNITY_FILE + '.corrupt-' + Date.now();
    try { fs.renameSync(COMMUNITY_FILE, backup); } catch (_) {}
    console.warn('community.json 读取失败，已备份到 ' + backup + '：' + err.message);
    return [];
  }
}

function publicPost(post, clientId) {
  if (!post) return null;
  const audio = post.audio || (
    post.audioKey && objectStore ? objectStore.publicUrl(post.audioKey) : null
  );
  return {
    id: post.id,
    board: post.board,
    province: post.province,
    name: post.name,
    type: post.type,
    text: post.text,
    audio: audio,
    audioName: post.audioName,
    likes: Math.max(0, Number(post.likes) || 0),
    liked: !!post.liked,
    mine: !!(clientId && post.ownerId === clientId),
    createdAt: post.createdAt,
    replyTo: post.replyTo
  };
}

function clientIdFrom(req, url) {
  const raw = (req.headers['x-client-id'] || url.searchParams.get('clientId') || '').trim();
  return /^[A-Za-z0-9_-]{6,64}$/.test(raw) ? raw : null;
}

function viewerIdFrom(req, url) {
  const payload = verifyClientToken(clientTokenFrom(req));
  if (payload) return payload.cid;
  return clientIdFrom(req, url);
}

function requireClientId(req) {
  const token = clientTokenFrom(req);
  if (!token) throw httpError(401, '需要匿名会话令牌，请先请求 /api/session');
  const payload = verifyClientToken(token);
  if (!payload) throw httpError(401, '匿名会话令牌无效或已过期');
  return payload.cid;
}

function normalizeNewPost(input, clientId) {
  const board = clean(input.board, 32);
  if (!BOARDS.has(board)) throw httpError(400, '方言板块不合法');
  const text = clean(input.text, 200);
  if (!text) throw httpError(400, '留言内容不能为空');
  let audio = null;
  let audioKey = null;
  if (input.audioKey != null && input.audioKey !== '') {
    if (!objectStore) throw httpError(503, '对象存储未配置，当前只支持内联语音');
    const key = clean(input.audioKey, 200);
    if (!/^audio\/[A-Za-z0-9_-]{6,64}\/[A-Za-z0-9._-]{1,80}$/.test(key)) {
      throw httpError(400, '语音标识不合法');
    }
    if (!key.startsWith('audio/' + clientId + '/')) {
      throw httpError(403, '语音不属于当前会话');
    }
    audioKey = key;
  } else if (input.audio != null && input.audio !== '') {
    if (typeof input.audio !== 'string' || !/^data:audio\/[a-z0-9.+-]+;base64,/i.test(input.audio)) {
      throw httpError(400, '语音格式不支持');
    }
    if (input.audio.length > MAX_AUDIO_CHARS) throw httpError(413, '语音太大，请控制在 1.5MB 以内');
    audio = input.audio;
  }
  return {
    id: newId(),
    board: board,
    province: clean(input.province, 30),
    name: clean(input.name, 20) || '匿名乡音',
    type: TYPES.has(input.type) ? input.type : 'dialect',
    text: text,
    audio: audio,
    audioKey: audioKey,
    audioName: clean(input.audioName, 80),
    likes: 0,
    likedBy: [],
    createdAt: Date.now(),
    replyTo: clean(input.replyTo, 40) || null,
    ownerId: clientId || null,
    deleteTokenHash: null
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let done = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        done = true;
        reject(httpError(413, '请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      try {
        const text = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(text));
      } catch (_) {
        reject(httpError(400, 'JSON 格式错误'));
      }
    });
    req.on('error', (err) => {
      if (done) return;
      done = true;
      reject(err);
    });
  });
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  const raw = Buffer.from(body);
  const req = res.req;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
  addVary(res, 'Accept-Encoding');
  const isHead = req && req.method === 'HEAD';
  if (!isHead && raw.length >= 1024 && req && acceptsGzip(req.headers['accept-encoding'])) {
    const compressed = zlib.gzipSync(raw, { level: 6 });
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = compressed.length;
    res.writeHead(status, headers);
    res.end(compressed);
    return;
  }
  headers['Content-Length'] = raw.length;
  res.writeHead(status, headers);
  res.end(isHead ? undefined : body);
}

function setSecurityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const isHttps = (req.socket && req.socket.encrypted) || proto === 'https';
  if (isHttps) {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "script-src 'self' https://cdn.jsdelivr.net https://unpkg.com",
    "script-src-attr 'none'",
    "style-src 'self' https://cdn.jsdelivr.net https://unpkg.com",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tianditu.gov.cn https://cdn.jsdelivr.net https://unpkg.com" + (EXTRA_ORIGIN_TEXT ? ' ' + EXTRA_ORIGIN_TEXT : ''),
    "font-src 'self' data:",
    "media-src 'self' data: blob:" + (EXTRA_ORIGIN_TEXT ? ' ' + EXTRA_ORIGIN_TEXT : ''),
    "connect-src 'self' https://*.tianditu.gov.cn" + (EXTRA_ORIGIN_TEXT ? ' ' + EXTRA_ORIGIN_TEXT : ''),
    "worker-src 'self' blob:",
    "manifest-src 'self'"
  ].join('; '));
}

function addVary(res, value) {
  const current = String(res.getHeader('Vary') || '');
  const values = new Set(current.split(',').map((item) => item.trim()).filter(Boolean));
  values.add(value);
  res.setHeader('Vary', Array.from(values).join(', '));
}

function requestOrigin(req) {
  const host = req.headers.host;
  if (!host) return null;
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const proto = forwarded || ((req.socket && req.socket.encrypted) ? 'https' : 'http');
  return proto + '://' + host;
}

function resolveCorsOrigin(req) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return null;
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  if (origin === requestOrigin(req)) return origin;
  return null;
}

function setCors(req, res) {
  const origin = resolveCorsOrigin(req);
  if (!origin) return null;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Client-Id, X-Client-Token, X-Delete-Token, X-Admin-Token');
  res.setHeader('Access-Control-Max-Age', '86400');
  addVary(res, 'Origin');
  return origin;
}

function memoryRateLimit(key, max, windowMs) {
  const now = Date.now();
  if (rateBuckets.size > 2000) {
    for (const [oldKey, oldEntry] of rateBuckets) {
      if (now - oldEntry.start > 10 * 60 * 1000) rateBuckets.delete(oldKey);
    }
  }
  let entry = rateBuckets.get(key);
  if (!entry || now - entry.start > windowMs) {
    entry = { start: now, count: 0 };
    rateBuckets.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > max) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.start + windowMs - now) / 1000)) };
  }
  return { allowed: true };
}

async function rateLimit(req, bucket, max, windowMs) {
  const forwarded = TRUST_PROXY
    ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    : '';
  const ip = forwarded || (req.socket && req.socket.remoteAddress) || 'unknown';
  const key = 'fangyan:rl:' + bucket + ':' + ip;
  let result = null;
  if (redis) {
    try {
      result = await redis.hit(key, max, windowMs);
    } catch (err) {
      console.warn('Redis 限流失败，回退内存模式：' + err.message);
      redis = null;
    }
  }
  if (!result) result = memoryRateLimit(key, max, windowMs);
  if (!result.allowed) {
    const err = httpError(429, '操作太频繁，请稍后再试');
    err.retryAfter = result.retryAfter;
    throw err;
  }
}

function sseSend(res, event, data) {
  try {
    res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n');
  } catch (_) {}
}

async function broadcastRefresh() {
  let count = 0;
  try { count = await store.count(); } catch (_) {}
  const payload = { at: Date.now(), count: count };
  if (redis) {
    try {
      await redis.publish('refresh', payload);
      return;
    } catch (err) {
      console.warn('Redis 广播失败，回退本实例推送：' + err.message);
      redis = null;
    }
  }
  for (const client of sseClients) sseSend(client, 'refresh', payload);
}

async function openStream(req, res, url) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 3000\n\n');
  let count = 0;
  try { count = await store.count(); } catch (_) {}
  sseSend(res, 'hello', { time: Date.now(), count: count });
  sseClients.add(res);
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 25000);
  const close = () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  };
  req.on('close', close);
  req.on('error', close);
}

function loadPopulation() {
  let payload;
  try {
    payload = readJson(POPULATION_FILE, null);
  } catch (err) {
    throw httpError(500, 'population.json 读取失败');
  }
  if (!payload || !Array.isArray(payload.items)) {
    throw httpError(500, 'population.json 缺少 items');
  }
  return Object.assign({}, payload, { checkedAt: new Date().toISOString() });
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method || 'GET';
  const clientId = viewerIdFrom(req, url);

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/session' && method === 'POST') {
    await rateLimit(req, 'session', 60, 60000);
    const existing = verifyClientToken(clientTokenFrom(req));
    const sessionClientId = existing ? existing.cid : newClientId();
    const expiresAt = Date.now() + CLIENT_TOKEN_TTL_MS;
    sendJson(res, 200, {
      token: signClientToken(sessionClientId, expiresAt),
      clientId: sessionClientId,
      expiresAt: expiresAt
    });
    return;
  }

  if (pathname === '/api/health' && method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      mode: 'server',
      boards: Array.from(BOARDS),
      posts: await store.count(),
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString(),
      features: {
        store: store.driver || 'sqlite',
        redis: !!redis,
        objectStorage: !!objectStore,
        uploads: objectStore ? 'presigned' : 'inline'
      }
    });
    return;
  }

  if (pathname === '/api/community' && method === 'GET') {
    const board = url.searchParams.get('board');
    const list = await store.list(board && BOARDS.has(board) ? board : null, clientId);
    sendJson(res, 200, {
      posts: list.map((p) => publicPost(p, clientId)),
      serverTime: Date.now()
    });
    return;
  }

  if (pathname === '/api/community/stream' && method === 'GET') {
    await openStream(req, res, url);
    return;
  }

  if (pathname === '/api/uploads/sign' && method === 'POST') {
    await rateLimit(req, 'upload', 30, 60000);
    const uploaderId = requireClientId(req);
    if (!objectStore) throw httpError(503, '对象存储未配置，当前使用内联语音');
    const body = await readBody(req);
    const contentType = String(body.contentType || '').split(';')[0].trim().toLowerCase();
    const ext = audioExtension(contentType);
    if (!ext) throw httpError(400, '不支持的语音类型');
    const size = Number(body.size);
    if (!Number.isFinite(size) || size <= 0) throw httpError(400, '语音大小不合法');
    if (size > MAX_AUDIO_BYTES) throw httpError(413, '语音太大，请控制在 1.5MB 以内');
    const key = 'audio/' + uploaderId + '/' + Date.now().toString(36) +
      '-' + crypto.randomBytes(8).toString('hex') + ext;
    const signed = await objectStore.signUpload({
      key: key,
      contentType: contentType,
      expiresIn: UPLOAD_TTL_SECONDS
    });
    sendJson(res, 200, {
      key: key,
      uploadUrl: signed.url,
      method: signed.method,
      headers: signed.headers,
      publicUrl: objectStore.publicUrl(key),
      expiresAt: signed.expiresAt
    });
    return;
  }

  if (pathname === '/api/community' && method === 'POST') {
    await rateLimit(req, 'post', 20, 60000);
    const authorId = requireClientId(req);
    const body = await readBody(req);
    const post = normalizeNewPost(body, authorId);
    const deleteToken = crypto.randomBytes(24).toString('hex');
    post.deleteTokenHash = hashToken(deleteToken);
    const saved = await store.create(post);
    await broadcastRefresh();
    sendJson(res, 201, { post: publicPost(saved, authorId), deleteToken });
    return;
  }

  const likeMatch = pathname.match(/^\/api\/community\/([A-Za-z0-9_-]{1,64})\/like$/);
  if (likeMatch && method === 'POST') {
    await rateLimit(req, 'like', 120, 60000);
    const likerId = requireClientId(req);
    const body = await readBody(req);
    const post = await store.setLike(likeMatch[1], likerId, body.liked === true);
    if (!post) throw httpError(404, '留言不存在');
    await broadcastRefresh();
    sendJson(res, 200, { post: publicPost(post, likerId) });
    return;
  }

  const deleteMatch = pathname.match(/^\/api\/community\/([A-Za-z0-9_-]{1,64})$/);
  if (deleteMatch && method === 'DELETE') {
    await rateLimit(req, 'delete', 30, 60000);
    const post = await store.get(deleteMatch[1], null);
    if (!post) throw httpError(404, '留言不存在');
    const deleteToken = String(req.headers['x-delete-token'] || '').trim();
    const adminToken = String(req.headers['x-admin-token'] || '').trim();
    const allowed = tokenMatches(deleteToken, post.deleteTokenHash) || adminMatches(adminToken);
    if (!allowed) throw httpError(403, '没有删除权限：需要发布时保存的删除令牌');
    await store.remove(post.id);
    if (post.audioKey && objectStore) {
      objectStore.remove(post.audioKey).catch((err) => {
        console.warn('删除语音对象失败：' + err.message);
      });
    }
    await broadcastRefresh();
    sendJson(res, 200, { ok: true, id: deleteMatch[1] });
    return;
  }

  if (pathname === '/api/population' && method === 'GET') {
    sendJson(res, 200, loadPopulation());
    return;
  }

  throw httpError(404, '接口不存在');
}

const PRIVATE_FILES = new Set(['/server.js', '/readme.md', '/package.json', '/package-lock.json', '/.gitignore', '/.env']);
const PRIVATE_DIRS = ['/data', '/.git', '/_backup', '/_shots', '/node_modules'];

function isPrivatePath(pathname) {
  const p = pathname.toLowerCase();
  if (PRIVATE_FILES.has(p)) return true;
  if (PRIVATE_DIRS.some((dir) => p === dir || p.startsWith(dir + '/'))) return true;
  if (/\.(py|md|env|log|bak|tmp|sql|db)$/i.test(p)) return true;
  if (p.split('/').some((seg) => seg.startsWith('.'))) return true;
  return false;
}

function serveStatic(req, res, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
    pathname = path.posix.normalize(pathname.replace(/\\/g, '/'));
    if (pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }
  if (pathname === '/') pathname = '/index.html';
  if (pathname.endsWith('/')) pathname += 'index.html';

  if (isPrivatePath(pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const file = path.resolve(ROOT, '.' + pathname);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const versioned = url.searchParams.has('v');
    const cacheControl = ext === '.html'
      ? 'no-cache'
      : (ext === '.js' || ext === '.css')
        ? (versioned ? 'public, max-age=31536000, immutable' : 'no-cache')
        : ext === '.json'
          ? 'no-cache'
          : 'public, max-age=604800';
    const compressible = COMPRESSIBLE.test(type);
    const useGzip = !req.headers.range && stat.size >= 1024 && compressible && acceptsGzip(req.headers['accept-encoding']);
    const etag = '"' + stat.size.toString(16) + '-' + Math.floor(stat.mtimeMs).toString(16) + (useGzip ? '-gzip' : '') + '"';
    const headers = {
      'Content-Type': type,
      'Cache-Control': cacheControl,
      'ETag': etag,
      'Last-Modified': stat.mtime.toUTCString(),
      'Accept-Ranges': 'bytes'
    };
    if (compressible) headers['Vary'] = 'Accept-Encoding';

    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];
    let notModified = false;
    if (ifNoneMatch) {
      notModified = ifNoneMatch.split(',').some((tag) => tag.trim() === etag || tag.trim() === '*');
    } else if (ifModifiedSince) {
      const since = Date.parse(ifModifiedSince);
      notModified = Number.isFinite(since) && Math.floor(stat.mtimeMs / 1000) <= Math.floor(since / 1000);
    }
    if (notModified) {
      delete headers['Content-Type'];
      if (useGzip) headers['Content-Encoding'] = 'gzip';
      res.writeHead(304, headers);
      res.end();
      return;
    }

    const range = req.headers.range;
    if (range && /^bytes=\d*-\d*$/.test(range)) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parts[0] ? Number(parts[0]) : 0;
      const end = parts[1] ? Number(parts[1]) : stat.size - 1;
      if (start >= stat.size || end < start) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size });
        res.end();
        return;
      }
      const safeEnd = Math.min(end, stat.size - 1);
      headers['Content-Range'] = 'bytes ' + start + '-' + safeEnd + '/' + stat.size;
      headers['Content-Length'] = safeEnd - start + 1;
      res.writeHead(206, headers);
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(file, { start: start, end: safeEnd }).pipe(res);
      return;
    }

    if (useGzip) {
      fs.readFile(file, (readErr, buffer) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Internal Server Error');
          return;
        }
        const compressed = gzipBuffer(file + ':' + stat.mtimeMs + ':' + stat.size, buffer);
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = compressed.length;
        res.writeHead(200, headers);
        if (req.method === 'HEAD') { res.end(); return; }
        res.end(compressed);
      });
      return;
    }

    headers['Content-Length'] = stat.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

function createHttpServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'));
    setSecurityHeaders(req, res);
    if (url.pathname.startsWith('/api/')) {
      const corsOrigin = setCors(req, res);
      if (req.method === 'OPTIONS' && req.headers.origin && !corsOrigin) {
        sendJson(res, 403, { error: '来源不在 CORS 允许列表' });
        return;
      }
      handleApi(req, res, url).catch((err) => {
        if (res.headersSent) {
          try { res.end(); } catch (_) {}
          return;
        }
        const status = err.status || 500;
        if (status >= 500) console.error(err);
        if (err.retryAfter) res.setHeader('Retry-After', String(err.retryAfter));
        sendJson(res, status, { error: err.message || '服务器错误' });
      });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', 'Allow': 'GET, HEAD' });
      res.end('Method Not Allowed');
      return;
    }
    serveStatic(req, res, url);
  });
}

async function start() {
  objectStore = createObjectStore({
    bucket: S3_BUCKET,
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    publicEndpoint: S3_PUBLIC_ENDPOINT,
    publicBaseUrl: S3_PUBLIC_BASE_URL,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    forcePathStyle: S3_FORCE_PATH_STYLE
  });

  store = await createStore({
    driver: DB_DRIVER,
    connectionString: DATABASE_URL,
    dbFile: COMMUNITY_DB,
    maxPosts: MAX_POSTS
  });

  if (REDIS_URL) {
    try {
      redis = await createRedis({
        url: REDIS_URL,
        channel: 'fangyan:community:refresh',
        logger: console
      });
      redis.onMessage((message) => {
        if (!message || message.event !== 'refresh') return;
        for (const client of sseClients) sseSend(client, 'refresh', message.payload || {});
      });
    } catch (err) {
      console.warn('Redis 初始化失败，回退单实例模式：' + err.message);
      redis = null;
    }
  }

  const imported = await store.importLegacy(loadCommunity());
  if (imported > 0) {
    console.log('已从 community.json 导入 ' + imported + ' 条留言到 ' + (store.driver === 'postgres' ? 'PostgreSQL' : 'SQLite'));
  }

  server = createHttpServer();
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('端口 ' + PORT + ' 已被占用。可以换一个端口：');
      console.error('  Windows CMD:  set PORT=8788 && node server.js');
      console.error('  PowerShell:   $env:PORT=8788; node server.js');
      console.error('  macOS/Linux:  PORT=8788 node server.js');
    } else {
      console.error(err);
    }
    process.exitCode = 1;
  });

  server.listen(PORT, HOST, () => {
    console.log('一声一味 · 社区服务已启动');
    console.log('  页面：http://localhost:' + PORT + '/');
    console.log('  天地图白名单不接受 localhost；本地调试可用 http://lvh.me:' + PORT + '/');
    console.log('  健康检查：http://localhost:' + PORT + '/api/health');
    console.log('  社区数据层：' + (store.driver === 'postgres' ? 'PostgreSQL' : 'SQLite ' + COMMUNITY_DB));
    console.log('  Redis：' + (redis ? '已连接（限流 + SSE 广播）' : '未启用（单实例内存模式）'));
    console.log('  对象存储：' + (objectStore ? 'S3 兼容 / ' + objectStore.bucket : '未启用（语音内联存储）'));
    console.log('  旧社区 JSON：' + COMMUNITY_FILE + '（仅首次导入）');
    console.log('  人口数据：' + POPULATION_FILE);
    console.log('  按 Ctrl+C 停止。');
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n收到 ' + signal + '，正在关闭服务…');
  for (const client of sseClients) {
    try { client.end(); } catch (_) {}
  }
  try { if (store) await store.close(); } catch (err) { console.error('关闭数据库失败：' + err.message); }
  try { if (redis) await redis.close(); } catch (err) { console.error('关闭 Redis 失败：' + err.message); }
  try { if (objectStore) objectStore.close(); } catch (_) {}
  if (server) {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((err) => {
  console.error('启动失败：' + err.message);
  if (err.code === 'OPTIONAL_DEPENDENCY_MISSING') {
    console.error('提示：开发模式不需要这些包；生产部署请先运行 npm install。');
  }
  process.exitCode = 1;
});
