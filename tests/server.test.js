'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const ADMIN_TOKEN = 'test-admin-token-20261107';
const CLIENT_TOKEN_SECRET = 'test-client-token-secret-20261107';

let child = null;
let port = 0;
let base = '';
let tempDir = '';
let communityFile = '';
let communityDb = '';
let childOutput = '';
let childError = '';
let childExitCode = null;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const value = server.address().port;
      server.close(() => resolve(value));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (childExitCode !== null) {
      throw new Error('服务进程提前退出，代码 ' + childExitCode + '\n' + childOutput + childError);
    }
    try {
      const res = await fetch(base + '/api/health');
      if (res.ok) return;
    } catch (_) {}
    await sleep(100);
  }
  throw new Error('等待服务启动超时\n' + childOutput + childError);
}

async function jsonFetch(pathname, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  let body;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    body = JSON.stringify(options.body);
  }
  const res = await fetch(base + pathname, {
    method: options.method || 'GET',
    headers,
    body
  });
  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { status: res.status, headers: res.headers, data };
}

function rawRequest(pathname, method = 'GET', extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: pathname,
        method,
        headers: Object.assign({ Host: '127.0.0.1:' + port }, extraHeaders)
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8')
        }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function createSession(existingToken) {
  const headers = {};
  if (existingToken) headers['X-Client-Token'] = existingToken;
  const { status, data } = await jsonFetch('/api/session', { method: 'POST', headers });
  assert.equal(status, 200, '会话接口应返回 200');
  return data;
}

function createPost(session, overrides = {}) {
  return jsonFetch('/api/community', {
    method: 'POST',
    headers: { 'X-Client-Token': session.token },
    body: Object.assign({
      board: 'guangzhou',
      province: '广东省',
      name: '测试乡音',
      type: 'dialect',
      text: '自动化测试留言'
    }, overrides)
  });
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', CLIENT_TOKEN_SECRET)
    .update('v1.' + body)
    .digest('base64url');
  return 'v1.' + body + '.' + signature;
}

before(async () => {
  port = await freePort();
  base = 'http://127.0.0.1:' + port;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fangyan-test-'));
  communityFile = path.join(tempDir, 'community.json');
  communityDb = path.join(tempDir, 'community.sqlite');

  child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      HOST: '127.0.0.1',
      COMMUNITY_FILE: communityFile,
      COMMUNITY_DB: communityDb,
      POPULATION_FILE: path.join(root, 'data', 'population.json'),
      COMMUNITY_ADMIN_TOKEN: ADMIN_TOKEN,
      CLIENT_TOKEN_SECRET: CLIENT_TOKEN_SECRET,
      ALLOWED_ORIGINS: 'http://allowed.example'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => { childOutput += chunk.toString(); });
  child.stderr.on('data', (chunk) => { childError += chunk.toString(); });
  child.on('exit', (code) => { childExitCode = code; });

  await waitForHealth();
});

after(async () => {
  if (child && childExitCode === null) {
    child.kill();
    const deadline = Date.now() + 5000;
    while (childExitCode === null && Date.now() < deadline) await sleep(50);
  }
  if (tempDir) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
});

test('健康检查返回服务状态与十个板块', async () => {
  const { status, data } = await jsonFetch('/api/health');
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.mode, 'server');
  assert.equal(data.posts, 0);
  assert.equal(data.boards.length, 10);
  assert.ok(data.boards.includes('guangzhou'));
  assert.ok(Number.isFinite(data.uptime));
});

test('静态页面与共享数据可正常访问', async () => {
  const home = await rawRequest('/');
  assert.equal(home.status, 200);
  assert.match(home.headers['content-type'], /text\/html/);
  assert.match(home.body, /一声一味/);
  assert.match(home.body, /src="assets\/index\.js\?v=/);
  assert.match(home.body, /href="assets\/index\.css\?v=/);
  assert.doesNotMatch(home.body, /<script(?![^>]*\bsrc=)[^>]*>/i, '入口页不应包含内联脚本');
  assert.doesNotMatch(home.body, /<style[\s>]/i, '入口页不应包含内联样式');

  const detail = await rawRequest('/fangyan-detail.html?d=guangzhou');
  assert.equal(detail.status, 200);
  assert.match(detail.body, /src="assets\/detail\.js/);

  const detailScript = await rawRequest('/assets/detail.js');
  assert.equal(detailScript.status, 200);
  assert.match(detailScript.headers['content-type'], /javascript/);
  assert.match(detailScript.body, /FANGYAN_DATA/);

  const shared = await rawRequest('/assets/data/dialects.js');
  assert.equal(shared.status, 200);
  assert.match(shared.headers['content-type'], /javascript/);
  assert.match(shared.body, /FANGYAN_DATA/);
});

test('静态资源按版本缓存并支持条件请求', async () => {
  const css = await rawRequest('/assets/main.css?v=20261107');
  assert.equal(css.status, 200);
  assert.match(css.headers['cache-control'], /max-age=31536000/);
  assert.match(css.headers['cache-control'], /immutable/);
  assert.ok(css.headers.etag, '应返回 ETag');
  assert.ok(css.headers['last-modified'], '应返回 Last-Modified');

  const cached = await rawRequest('/assets/main.css?v=20261107', 'GET', {
    'If-None-Match': css.headers.etag
  });
  assert.equal(cached.status, 304);
  assert.equal(cached.body, '');

  const modified = await rawRequest('/assets/main.css?v=20261107', 'GET', {
    'If-Modified-Since': css.headers['last-modified']
  });
  assert.equal(modified.status, 304);

  const unversioned = await rawRequest('/assets/main.css');
  assert.match(unversioned.headers['cache-control'], /no-cache/);

  const html = await rawRequest('/');
  assert.match(html.headers['cache-control'], /no-cache/);
  assert.ok(html.headers.etag, 'HTML 也应支持条件请求');

  const image = await rawRequest('/assets/beijing-800.webp');
  assert.match(image.headers['cache-control'], /max-age=604800/);

  const head = await rawRequest('/assets/main.css?v=20261107', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.ok(Number(head.headers['content-length']) > 0);

  const range = await rawRequest('/assets/main.css?v=20261107', 'GET', { Range: 'bytes=0-99' });
  assert.equal(range.status, 206);
  assert.equal(range.body.length, 100);
  assert.match(range.headers['content-range'], /^bytes 0-99\//);
});

test('文本资源支持 gzip 压缩并区分 ETag', async () => {
  const plain = await rawRequest('/assets/main.css?v=20261107', 'GET', {
    'Accept-Encoding': 'identity'
  });
  assert.equal(plain.headers['content-encoding'], undefined);
  assert.match(plain.headers['vary'], /Accept-Encoding/);

  const gz = await rawRequest('/assets/main.css?v=20261107', 'GET', {
    'Accept-Encoding': 'gzip'
  });
  assert.equal(gz.headers['content-encoding'], 'gzip');
  assert.match(gz.headers['vary'], /Accept-Encoding/);
  assert.notEqual(gz.headers.etag, plain.headers.etag);
  assert.ok(Number(gz.headers['content-length']) < Number(plain.headers['content-length']), 'gzip 应更小');

  const cached = await rawRequest('/assets/main.css?v=20261107', 'GET', {
    'Accept-Encoding': 'gzip',
    'If-None-Match': gz.headers.etag
  });
  assert.equal(cached.status, 304);

  const rejected = await rawRequest('/assets/main.css?v=20261107', 'GET', {
    'Accept-Encoding': 'gzip;q=0'
  });
  assert.equal(rejected.headers['content-encoding'], undefined);

  const res = await fetch(base + '/assets/main.css?v=20261107');
  assert.equal(res.headers.get('content-encoding'), 'gzip');
  assert.match(await res.text(), /--paper/);
});

test('敏感文件与路径绕过均返回 404', async () => {
  const blocked = [
    '/server.js',
    '/README.md',
    '/package.json',
    '/_genmap.py',
    '/data/community.json',
    '/data/population.json',
    '/.git/config',
    '/assets/../server.js',
    '/%2e%2e/server.js',
    '/%5Cserver.js',
    '/data/../server.js',
    '/./server.js'
  ];

  for (const pathname of blocked) {
    const res = await rawRequest(pathname);
    assert.equal(res.status, 404, pathname + ' 应返回 404，实际为 ' + res.status);
    assert.doesNotMatch(res.body, /createServer\(/, pathname + ' 泄漏了服务端源码');
  }
});

test('所有响应带有基础安全响应头', async () => {
  for (const pathname of ['/', '/api/health', '/server.js']) {
    const res = await rawRequest(pathname);
    assert.equal(res.headers['x-content-type-options'], 'nosniff', pathname);
    assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin', pathname);
    assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN', pathname);
    assert.match(res.headers['permissions-policy'], /camera=\(\)/, pathname);
  }
});

test('CSP 限制资源来源并保留地图与 CDN 白名单', async () => {
  const res = await rawRequest('/');
  const csp = res.headers['content-security-policy'] || '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /script-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
  assert.match(csp, /script-src[^;]*https:\/\/unpkg\.com/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/, "script-src 不应再允许内联脚本");
  assert.match(csp, /script-src-attr 'none'/, "内联事件处理器应被禁止");
  assert.doesNotMatch(csp, /style-src\s[^;]*'unsafe-inline'/, "style-src 不应再允许内联样式块");
  assert.match(csp, /style-src-attr 'unsafe-inline'/, "样式属性仍需保留内联白名单");
  assert.match(csp, /img-src[^;]*https:\/\/\*\.tianditu\.gov\.cn/);
  assert.match(csp, /media-src[^;]*data: blob:/);
  assert.equal(res.headers['strict-transport-security'], undefined, 'HTTP 下不应发送 HSTS');
  assert.equal(res.headers['cross-origin-opener-policy'], undefined, 'HTTP 下不发送会被忽略的 COOP');
});

test('CORS 仅允许同源与白名单来源', async () => {
  const same = await jsonFetch('/api/health', { headers: { Origin: base } });
  assert.equal(same.status, 200);
  assert.equal(same.headers.get('access-control-allow-origin'), base);
  const vary = same.headers.get('vary') || '';
  assert.match(vary, /Origin/);
  assert.match(vary, /Accept-Encoding/);

  const allowed = await jsonFetch('/api/community', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://allowed.example',
      'Access-Control-Request-Method': 'DELETE',
      'Access-Control-Request-Headers': 'X-Delete-Token'
    }
  });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://allowed.example');
  const allowedHeaders = allowed.headers.get('access-control-allow-headers') || '';
  assert.match(allowedHeaders, /X-Delete-Token/i);
  assert.match(allowedHeaders, /X-Admin-Token/i);
  assert.match(allowedHeaders, /X-Client-Token/i);
  assert.match(allowedHeaders, /Authorization/i);
  assert.match(allowed.headers.get('access-control-allow-methods') || '', /DELETE/);

  const blockedPreflight = await jsonFetch('/api/community', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://example.com',
      'Access-Control-Request-Method': 'DELETE'
    }
  });
  assert.equal(blockedPreflight.status, 403);
  assert.equal(blockedPreflight.headers.get('access-control-allow-origin'), null);

  const blockedSimple = await jsonFetch('/api/health', {
    headers: { Origin: 'http://example.com' }
  });
  assert.equal(blockedSimple.status, 200);
  assert.equal(blockedSimple.headers.get('access-control-allow-origin'), null);

  const nullOrigin = await jsonFetch('/api/health', {
    headers: { Origin: 'null' }
  });
  assert.equal(nullOrigin.status, 200);
  assert.equal(nullOrigin.headers.get('access-control-allow-origin'), null);
});

test('匿名会话接口签发可验证令牌', async () => {
  const session = await createSession();
  assert.match(session.token, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.match(session.clientId, /^[A-Za-z0-9_-]{6,64}$/);
  assert.ok(Number(session.expiresAt) > Date.now(), '会话应有未来过期时间');

  const refreshed = await createSession(session.token);
  assert.equal(refreshed.clientId, session.clientId, '刷新会话应保留同一客户端 ID');
  assert.ok(Number(refreshed.expiresAt) > Date.now());

  const read = await jsonFetch('/api/community', {
    headers: { Authorization: 'Bearer ' + session.token }
  });
  assert.equal(read.status, 200);
});

test('写入需要会话令牌，读取兼容 X-Client-Id', async () => {
  const session = await createSession();
  const created = await createPost(session, { text: '会话写入测试' });
  assert.equal(created.status, 201);
  assert.equal(created.data.post.mine, true);

  const legacyRead = await jsonFetch('/api/community', {
    headers: { 'X-Client-Id': session.clientId }
  });
  assert.equal(legacyRead.status, 200);
  const found = legacyRead.data.posts.find((p) => p.id === created.data.post.id);
  assert.ok(found);
  assert.equal(found.mine, true, '读取仍可用 X-Client-Id 识别本人留言');

  const legacyWrite = await jsonFetch('/api/community', {
    method: 'POST',
    headers: { 'X-Client-Id': session.clientId },
    body: { board: 'guangzhou', text: '旧版标识不应能写入' }
  });
  assert.equal(legacyWrite.status, 401);
  assert.match(legacyWrite.data.error, /会话令牌/);

  const bearerWrite = await jsonFetch('/api/community', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + session.token },
    body: { board: 'guangzhou', text: 'Bearer 令牌写入' }
  });
  assert.equal(bearerWrite.status, 201);

  for (const id of [created.data.post.id, bearerWrite.data.post.id]) {
    const removed = await jsonFetch('/api/community/' + id, {
      method: 'DELETE',
      headers: { 'X-Admin-Token': ADMIN_TOKEN }
    });
    assert.equal(removed.status, 200);
  }
});

test('篡改或过期的会话令牌会被拒绝', async () => {
  const session = await createSession();
  const tampered = session.token.slice(0, -1) + (session.token.endsWith('A') ? 'B' : 'A');
  const tamperedRes = await jsonFetch('/api/community', {
    method: 'POST',
    headers: { 'X-Client-Token': tampered },
    body: { board: 'guangzhou', text: '篡改令牌不应写入' }
  });
  assert.equal(tamperedRes.status, 401);
  assert.match(tamperedRes.data.error, /无效或已过期/);

  const expired = signToken({
    cid: 'cexpired000000000000',
    iat: Date.now() - 7200000,
    exp: Date.now() - 3600000
  });
  const expiredRes = await jsonFetch('/api/community', {
    method: 'POST',
    headers: { 'X-Client-Token': expired },
    body: { board: 'guangzhou', text: '过期令牌不应写入' }
  });
  assert.equal(expiredRes.status, 401);
  assert.match(expiredRes.data.error, /无效或已过期/);
});

test('发布留言需要匿名会话令牌', async () => {
  const { status, data } = await jsonFetch('/api/community', {
    method: 'POST',
    body: {
      board: 'guangzhou',
      province: '广东省',
      name: '无标识',
      type: 'dialect',
      text: '这条留言不应被创建'
    }
  });
  assert.equal(status, 401);
  assert.match(data.error, /会话令牌/);
});

test('发布留言返回一次性删除令牌且不泄漏哈希', async () => {
  const session = await createSession();
  const { status, data } = await createPost(session, { text: '发布令牌测试' });
  assert.equal(status, 201);
  assert.ok(data.post);
  assert.match(data.post.id, /^p[A-Za-z0-9]+$/);
  assert.equal(data.post.text, '发布令牌测试');
  assert.equal(data.post.mine, true);
  assert.equal(data.post.likes, 0);
  assert.match(data.deleteToken, /^[a-f0-9]{48}$/);
  assert.equal('deleteTokenHash' in data.post, false);
  assert.equal('ownerId' in data.post, false);

  const other = await createSession();
  const listForOther = await jsonFetch('/api/community', {
    headers: { 'X-Client-Token': other.token }
  });
  assert.equal(listForOther.status, 200);
  const found = listForOther.data.posts.find((p) => p.id === data.post.id);
  assert.ok(found);
  assert.equal(found.mine, false);
  assert.equal('deleteTokenHash' in found, false);

  const db = new DatabaseSync(communityDb, { readOnly: true });
  try {
    const storedPost = db.prepare('SELECT * FROM posts WHERE id = ?').get(data.post.id);
    assert.ok(storedPost);
    assert.match(storedPost.delete_token_hash, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(storedPost).includes(data.deleteToken), false, '数据库不应保存明文删除令牌');
    const likeCount = db.prepare('SELECT COUNT(*) AS count FROM post_likes WHERE post_id = ?').get(data.post.id);
    assert.equal(likeCount.count, 0);
  } finally {
    db.close();
  }

  // 清理，供后续用例从空列表开始
  const removed = await jsonFetch('/api/community/' + data.post.id, {
    method: 'DELETE',
    headers: { 'X-Delete-Token': data.deleteToken }
  });
  assert.equal(removed.status, 200);
});

test('删除留言需要发布令牌', async () => {
  const session = await createSession();
  const created = await createPost(session, { text: '删除鉴权测试' });
  assert.equal(created.status, 201);
  const id = created.data.post.id;
  const token = created.data.deleteToken;

  const noToken = await jsonFetch('/api/community/' + id, {
    method: 'DELETE'
  });
  assert.equal(noToken.status, 403);
  assert.match(noToken.data.error, /删除权限/);

  const wrongToken = await jsonFetch('/api/community/' + id, {
    method: 'DELETE',
    headers: { 'X-Delete-Token': 'deadbeef' }
  });
  assert.equal(wrongToken.status, 403);

  const correct = await jsonFetch('/api/community/' + id, {
    method: 'DELETE',
    headers: { 'X-Delete-Token': token }
  });
  assert.equal(correct.status, 200);
  assert.deepEqual(correct.data, { ok: true, id });

  const missing = await jsonFetch('/api/community/' + id, {
    method: 'DELETE',
    headers: { 'X-Delete-Token': token }
  });
  assert.equal(missing.status, 404);
});

test('管理员令牌可以删除任意留言', async () => {
  const session = await createSession();
  const created = await createPost(session, { text: '管理员删除测试' });
  assert.equal(created.status, 201);
  const id = created.data.post.id;

  const wrong = await jsonFetch('/api/community/' + id, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': 'wrong-admin-token' }
  });
  assert.equal(wrong.status, 403);

  const correct = await jsonFetch('/api/community/' + id, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': ADMIN_TOKEN }
  });
  assert.equal(correct.status, 200);
  assert.deepEqual(correct.data, { ok: true, id });
});

test('点赞按客户端去重并返回最新计数', async () => {
  const author = await createSession();
  const created = await createPost(author, { text: '点赞测试' });
  assert.equal(created.status, 201);
  const id = created.data.post.id;
  const liker = await createSession();

  const liked = await jsonFetch('/api/community/' + id + '/like', {
    method: 'POST',
    headers: { 'X-Client-Token': liker.token },
    body: { liked: true }
  });
  assert.equal(liked.status, 200);
  assert.equal(liked.data.post.likes, 1);
  assert.equal(liked.data.post.liked, true);

  const again = await jsonFetch('/api/community/' + id + '/like', {
    method: 'POST',
    headers: { 'X-Client-Token': liker.token },
    body: { liked: true }
  });
  assert.equal(again.data.post.likes, 1);

  const unliked = await jsonFetch('/api/community/' + id + '/like', {
    method: 'POST',
    headers: { 'X-Client-Token': liker.token },
    body: { liked: false }
  });
  assert.equal(unliked.data.post.likes, 0);
  assert.equal(unliked.data.post.liked, false);

  const removed = await jsonFetch('/api/community/' + id, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': ADMIN_TOKEN }
  });
  assert.equal(removed.status, 200);
});

test('非法板块、空内容与错误 JSON 被拒绝', async () => {
  const session = await createSession();
  const badBoard = await createPost(session, { board: 'not-a-board' });
  assert.equal(badBoard.status, 400);

  const emptyText = await createPost(session, { text: '   ' });
  assert.equal(emptyText.status, 400);

  const badJson = await jsonFetch('/api/community', {
    method: 'POST',
    headers: { 'X-Client-Token': session.token },
    rawBody: '{not json'
  });
  assert.equal(badJson.status, 400);

  const badAudio = await createPost(session, { audio: 'data:text/plain;base64,AAAA' });
  assert.equal(badAudio.status, 400);

  const missingClient = await jsonFetch('/api/community/none/like', {
    method: 'POST',
    body: { liked: true }
  });
  assert.equal(missingClient.status, 401);
});

test('人口接口返回公开统计与校验时间', async () => {
  const { status, headers, data } = await jsonFetch('/api/population');
  assert.equal(status, 200);
  assert.equal(headers.get('cache-control'), 'no-store');
  assert.ok(Array.isArray(data.items));
  assert.equal(data.items.length, 10);
  assert.ok(data.source);
  assert.ok(data.note);
  assert.ok(data.checkedAt);
  assert.ok(!Number.isNaN(Date.parse(data.checkedAt)));

  const ids = data.items.map((item) => item.id);
  assert.equal(new Set(ids).size, 10);
  for (const item of data.items) {
    assert.ok(item.name);
    assert.ok(Number.isFinite(item.value) && item.value > 0);
  }
});

test('较大的 JSON 接口响应支持 gzip', async () => {
  const res = await fetch(base + '/api/population', {
    headers: { 'Accept-Encoding': 'gzip' }
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-encoding'), 'gzip');
  assert.match(res.headers.get('vary'), /Accept-Encoding/);
  const data = await res.json();
  assert.equal(data.items.length, 10);
});

test('未知接口返回 404 JSON', async () => {
  const { status, data } = await jsonFetch('/api/not-found');
  assert.equal(status, 404);
  assert.match(data.error, /接口不存在/);
});

test('发布接口触发限流并返回 Retry-After', async () => {
  const session = await createSession();
  const created = [];
  let limited = null;
  for (let i = 0; i < 30; i += 1) {
    const res = await createPost(session, { text: '限流测试 ' + i });
    if (res.status === 429) {
      limited = res;
      break;
    }
    assert.equal(res.status, 201);
    created.push(res.data.post.id);
  }
  assert.ok(limited, '连续发布应触发 429');
  assert.match(limited.data.error, /太频繁/);
  assert.ok(Number(limited.headers.get('retry-after')) > 0, '应返回 Retry-After');

  for (const id of created) {
    const removed = await jsonFetch('/api/community/' + id, {
      method: 'DELETE',
      headers: { 'X-Admin-Token': ADMIN_TOKEN }
    });
    assert.equal(removed.status, 200);
  }
});

test('测试结束后社区数据库为空', () => {
  const db = new DatabaseSync(communityDb, { readOnly: true });
  try {
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM posts').get().count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM post_likes').get().count, 0);
  } finally {
    db.close();
  }
});
