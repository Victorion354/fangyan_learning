'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const ADMIN_TOKEN = 'test-admin-token-20261107';

let child = null;
let port = 0;
let base = '';
let tempDir = '';
let communityFile = '';
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

function rawRequest(pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: pathname, method, headers: { Host: '127.0.0.1:' + port } },
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

function createPost(clientId, overrides = {}) {
  return jsonFetch('/api/community', {
    method: 'POST',
    headers: { 'X-Client-Id': clientId },
    body: Object.assign({
      board: 'guangzhou',
      province: '广东省',
      name: '测试乡音',
      type: 'dialect',
      text: '自动化测试留言'
    }, overrides)
  });
}

before(async () => {
  port = await freePort();
  base = 'http://127.0.0.1:' + port;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fangyan-test-'));
  communityFile = path.join(tempDir, 'community.json');

  child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      HOST: '127.0.0.1',
      COMMUNITY_FILE: communityFile,
      POPULATION_FILE: path.join(root, 'data', 'population.json'),
      COMMUNITY_ADMIN_TOKEN: ADMIN_TOKEN
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

  const detail = await rawRequest('/fangyan-detail.html?d=guangzhou');
  assert.equal(detail.status, 200);
  assert.match(detail.body, /FANGYAN_DATA/);

  const shared = await rawRequest('/assets/data/dialects.js');
  assert.equal(shared.status, 200);
  assert.match(shared.headers['content-type'], /javascript/);
  assert.match(shared.body, /FANGYAN_DATA/);
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
  assert.match(csp, /img-src[^;]*https:\/\/\*\.tianditu\.gov\.cn/);
  assert.match(csp, /media-src[^;]*data: blob:/);
  assert.equal(res.headers['strict-transport-security'], undefined, 'HTTP 下不应发送 HSTS');
  assert.equal(res.headers['cross-origin-opener-policy'], undefined, 'HTTP 下不发送会被忽略的 COOP');
});

test('CORS 预检允许删除令牌请求头', async () => {
  const { status, headers } = await jsonFetch('/api/community', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://example.com',
      'Access-Control-Request-Method': 'DELETE',
      'Access-Control-Request-Headers': 'X-Delete-Token'
    }
  });
  assert.equal(status, 204);
  assert.equal(headers.get('access-control-allow-origin'), '*');
  const allowed = headers.get('access-control-allow-headers') || '';
  assert.match(allowed, /X-Delete-Token/i);
  assert.match(allowed, /X-Admin-Token/i);
  assert.match(headers.get('access-control-allow-methods') || '', /DELETE/);
});

test('发布留言返回一次性删除令牌且不泄漏哈希', async () => {
  const client = 'client-create-aaaaaa';
  const { status, data } = await createPost(client, { text: '发布令牌测试' });
  assert.equal(status, 201);
  assert.ok(data.post);
  assert.match(data.post.id, /^p[A-Za-z0-9]+$/);
  assert.equal(data.post.text, '发布令牌测试');
  assert.equal(data.post.mine, true);
  assert.equal(data.post.likes, 0);
  assert.match(data.deleteToken, /^[a-f0-9]{48}$/);
  assert.equal('deleteTokenHash' in data.post, false);
  assert.equal('ownerId' in data.post, false);

  const listForOther = await jsonFetch('/api/community', {
    headers: { 'X-Client-Id': 'client-other-bbbbbb' }
  });
  assert.equal(listForOther.status, 200);
  const found = listForOther.data.posts.find((p) => p.id === data.post.id);
  assert.ok(found);
  assert.equal(found.mine, false);
  assert.equal('deleteTokenHash' in found, false);

  const stored = JSON.parse(fs.readFileSync(communityFile, 'utf8'));
  const storedPost = stored.find((p) => p.id === data.post.id);
  assert.ok(storedPost);
  assert.match(storedPost.deleteTokenHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(stored).includes(data.deleteToken), false, '社区文件不应保存明文删除令牌');

  // 清理，供后续用例从空列表开始
  const removed = await jsonFetch('/api/community/' + data.post.id, {
    method: 'DELETE',
    headers: { 'X-Client-Id': client, 'X-Delete-Token': data.deleteToken }
  });
  assert.equal(removed.status, 200);
});

test('删除留言需要发布令牌', async () => {
  const client = 'client-delete-cccccc';
  const created = await createPost(client, { text: '删除鉴权测试' });
  assert.equal(created.status, 201);
  const id = created.data.post.id;
  const token = created.data.deleteToken;

  const noToken = await jsonFetch('/api/community/' + id, {
    method: 'DELETE',
    headers: { 'X-Client-Id': client }
  });
  assert.equal(noToken.status, 403);
  assert.match(noToken.data.error, /删除权限/);

  const wrongToken = await jsonFetch('/api/community/' + id, {
    method: 'DELETE',
    headers: { 'X-Client-Id': client, 'X-Delete-Token': 'deadbeef' }
  });
  assert.equal(wrongToken.status, 403);

  const correct = await jsonFetch('/api/community/' + id, {
    method: 'DELETE',
    headers: { 'X-Client-Id': client, 'X-Delete-Token': token }
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
  const created = await createPost('client-admin-dddddd', { text: '管理员删除测试' });
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
  const created = await createPost('client-like-eeeeee', { text: '点赞测试' });
  assert.equal(created.status, 201);
  const id = created.data.post.id;

  const liked = await jsonFetch('/api/community/' + id + '/like', {
    method: 'POST',
    headers: { 'X-Client-Id': 'client-like-ffffff' },
    body: { liked: true }
  });
  assert.equal(liked.status, 200);
  assert.equal(liked.data.post.likes, 1);
  assert.equal(liked.data.post.liked, true);

  const again = await jsonFetch('/api/community/' + id + '/like', {
    method: 'POST',
    headers: { 'X-Client-Id': 'client-like-ffffff' },
    body: { liked: true }
  });
  assert.equal(again.data.post.likes, 1);

  const unliked = await jsonFetch('/api/community/' + id + '/like', {
    method: 'POST',
    headers: { 'X-Client-Id': 'client-like-ffffff' },
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
  const badBoard = await createPost('client-invalid-gggggg', { board: 'not-a-board' });
  assert.equal(badBoard.status, 400);

  const emptyText = await createPost('client-invalid-gggggg', { text: '   ' });
  assert.equal(emptyText.status, 400);

  const badJson = await jsonFetch('/api/community', {
    method: 'POST',
    headers: { 'X-Client-Id': 'client-invalid-gggggg' },
    rawBody: '{not json'
  });
  assert.equal(badJson.status, 400);

  const badAudio = await createPost('client-invalid-gggggg', { audio: 'data:text/plain;base64,AAAA' });
  assert.equal(badAudio.status, 400);

  const missingClient = await jsonFetch('/api/community/none/like', {
    method: 'POST',
    body: { liked: true }
  });
  assert.equal(missingClient.status, 400);
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

test('未知接口返回 404 JSON', async () => {
  const { status, data } = await jsonFetch('/api/not-found');
  assert.equal(status, 404);
  assert.match(data.error, /接口不存在/);
});

test('发布接口触发限流并返回 Retry-After', async () => {
  const created = [];
  let limited = null;
  for (let i = 0; i < 30; i += 1) {
    const res = await createPost('client-rate-hhhhhh', { text: '限流测试 ' + i });
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

test('测试结束后社区文件为空数组', () => {
  const stored = JSON.parse(fs.readFileSync(communityFile, 'utf8'));
  assert.ok(Array.isArray(stored));
  assert.equal(stored.length, 0);
});
