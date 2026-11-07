/* 一声一味 · 本地实时服务
 *
 * 零依赖 Node.js 服务：
 *   - 静态托管本目录（含中文文件名）
 *   - 乡音社区 REST API + SSE 实时推送
 *   - 人口公开统计数据 API（带版本与校验时间）
 *
 * 启动：
 *   node server.js
 * 然后打开：
 *   http://localhost:8787/
 *
 * 环境变量：
 *   PORT=8787 HOST=0.0.0.0 node server.js
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FANGYAN_DATA = require('./assets/data/dialects.js');

const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const COMMUNITY_FILE = process.env.COMMUNITY_FILE ? path.resolve(process.env.COMMUNITY_FILE) : path.join(DATA_DIR, 'community.json');
const POPULATION_FILE = process.env.POPULATION_FILE ? path.resolve(process.env.POPULATION_FILE) : path.join(DATA_DIR, 'population.json');
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_POSTS = 500;
const MAX_AUDIO_CHARS = 2400000;
const MAX_BODY_BYTES = 3200000;
const ADMIN_TOKEN = (process.env.COMMUNITY_ADMIN_TOKEN || '').trim();

const BOARDS = new Set(FANGYAN_DATA.dialects.map((d) => d.id));
const TYPES = new Set(['dialect', 'suggest']);

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

let posts = loadCommunity();
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

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
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
    if (err.code === 'ENOENT') {
      writeJsonAtomic(COMMUNITY_FILE, []);
      return [];
    }
    const backup = COMMUNITY_FILE + '.corrupt-' + Date.now();
    try { fs.renameSync(COMMUNITY_FILE, backup); } catch (_) {}
    console.warn('community.json 读取失败，已备份到 ' + backup + '：' + err.message);
    return [];
  }
}

function saveCommunity() {
  writeJsonAtomic(COMMUNITY_FILE, posts);
}

function publicPost(post, clientId) {
  const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
  return {
    id: post.id,
    board: post.board,
    province: post.province,
    name: post.name,
    type: post.type,
    text: post.text,
    audio: post.audio,
    audioName: post.audioName,
    likes: likedBy.length || Math.max(0, Number(post.likes) || 0),
    liked: clientId ? likedBy.includes(clientId) : false,
    mine: !!(clientId && post.ownerId === clientId),
    createdAt: post.createdAt,
    replyTo: post.replyTo
  };
}

function clientIdFrom(req, url) {
  const raw = (req.headers['x-client-id'] || url.searchParams.get('clientId') || '').trim();
  return /^[A-Za-z0-9_-]{6,64}$/.test(raw) ? raw : null;
}

function normalizeNewPost(input, clientId) {
  const board = clean(input.board, 32);
  if (!BOARDS.has(board)) throw httpError(400, '方言板块不合法');
  const text = clean(input.text, 200);
  if (!text) throw httpError(400, '留言内容不能为空');
  let audio = null;
  if (input.audio != null && input.audio !== '') {
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
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-Id, X-Delete-Token, X-Admin-Token');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function rateLimit(req, bucket, max, windowMs) {
  const ip = (req.socket && req.socket.remoteAddress) || 'unknown';
  const key = bucket + ':' + ip;
  const now = Date.now();
  let entry = rateBuckets.get(key);
  if (!entry || now - entry.start > windowMs) {
    entry = { start: now, count: 0 };
    rateBuckets.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > max) throw httpError(429, '操作太频繁，请稍后再试');
}

function sseSend(res, event, data) {
  try {
    res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n');
  } catch (_) {}
}

function broadcastRefresh() {
  const payload = { at: Date.now(), count: posts.length };
  for (const client of sseClients) sseSend(client, 'refresh', payload);
}

function openStream(req, res, url) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 3000\n\n');
  sseSend(res, 'hello', { time: Date.now(), count: posts.length });
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
  const clientId = clientIdFrom(req, url);

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/health' && method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      mode: 'server',
      boards: Array.from(BOARDS),
      posts: posts.length,
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString()
    });
    return;
  }

  if (pathname === '/api/community' && method === 'GET') {
    const board = url.searchParams.get('board');
    const list = board && BOARDS.has(board) ? posts.filter((p) => p.board === board) : posts;
    sendJson(res, 200, {
      posts: list.slice().sort((a, b) => b.createdAt - a.createdAt).map((p) => publicPost(p, clientId)),
      serverTime: Date.now()
    });
    return;
  }

  if (pathname === '/api/community/stream' && method === 'GET') {
    openStream(req, res, url);
    return;
  }

  if (pathname === '/api/community' && method === 'POST') {
    rateLimit(req, 'post', 20, 60000);
    const body = await readBody(req);
    const post = normalizeNewPost(body, clientId);
    const deleteToken = crypto.randomBytes(24).toString('hex');
    post.deleteTokenHash = hashToken(deleteToken);
    posts.push(post);
    if (posts.length > MAX_POSTS) posts = posts.slice(-MAX_POSTS);
    saveCommunity();
    broadcastRefresh();
    sendJson(res, 201, { post: publicPost(post, clientId), deleteToken });
    return;
  }

  const likeMatch = pathname.match(/^\/api\/community\/([A-Za-z0-9_-]{1,64})\/like$/);
  if (likeMatch && method === 'POST') {
    rateLimit(req, 'like', 120, 60000);
    if (!clientId) throw httpError(400, '缺少客户端标识');
    const body = await readBody(req);
    const post = posts.find((p) => p.id === likeMatch[1]);
    if (!post) throw httpError(404, '留言不存在');
    const liked = body.liked === true;
    const set = new Set(Array.isArray(post.likedBy) ? post.likedBy : []);
    if (liked) set.add(clientId);
    else set.delete(clientId);
    post.likedBy = Array.from(set);
    post.likes = post.likedBy.length;
    saveCommunity();
    broadcastRefresh();
    sendJson(res, 200, { post: publicPost(post, clientId) });
    return;
  }

  const deleteMatch = pathname.match(/^\/api\/community\/([A-Za-z0-9_-]{1,64})$/);
  if (deleteMatch && method === 'DELETE') {
    rateLimit(req, 'delete', 30, 60000);
    const index = posts.findIndex((p) => p.id === deleteMatch[1]);
    if (index < 0) throw httpError(404, '留言不存在');
    const deleteToken = String(req.headers['x-delete-token'] || '').trim();
    const adminToken = String(req.headers['x-admin-token'] || '').trim();
    const allowed = tokenMatches(deleteToken, posts[index].deleteTokenHash) || adminMatches(adminToken);
    if (!allowed) throw httpError(403, '没有删除权限：需要发布时保存的删除令牌');
    posts.splice(index, 1);
    saveCommunity();
    broadcastRefresh();
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
    const noCache = ext === '.html' || ext === '.js' || ext === '.json' || ext === '.css';
    const headers = {
      'Content-Type': type,
      'Cache-Control': noCache ? 'no-cache' : 'public, max-age=3600'
    };

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
      headers['Accept-Ranges'] = 'bytes';
      res.writeHead(206, headers);
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(file, { start: start, end: safeEnd }).pipe(res);
      return;
    }

    headers['Content-Length'] = stat.size;
    headers['Accept-Ranges'] = 'bytes';
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'));
  setSecurityHeaders(res);
  setCors(res);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((err) => {
      if (res.headersSent) {
        try { res.end(); } catch (_) {}
        return;
      }
      const status = err.status || 500;
      if (status >= 500) console.error(err);
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
  console.log('一声一味 · 本地实时服务已启动');
  console.log('  页面：http://localhost:' + PORT + '/');
  console.log('  天地图白名单不接受 localhost；本地调试可用 http://lvh.me:' + PORT + '/');
  console.log('  健康检查：http://localhost:' + PORT + '/api/health');
  console.log('  社区数据：' + COMMUNITY_FILE);
  console.log('  人口数据：' + POPULATION_FILE);
  console.log('  按 Ctrl+C 停止。');
});

function shutdown(signal) {
  console.log('\n收到 ' + signal + '，正在保存社区数据…');
  try { saveCommunity(); } catch (err) { console.error('保存失败：' + err.message); }
  for (const client of sseClients) {
    try { client.end(); } catch (_) {}
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
