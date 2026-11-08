'use strict';

/* 账号、内容审核、举报、隐私数据权利测试
 *
 * 单独启动一个服务进程，避免与 server.test.js 共用发布限流计数。
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { createModerator } = require('../lib/moderation.js');

const root = path.resolve(__dirname, '..');
const ADMIN_TOKEN = 'test-admin-token-accounts';
const CLIENT_TOKEN_SECRET = 'test-client-token-secret-accounts';

let child = null;
let port = 0;
let base = '';
let tempDir = '';
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

async function createSession() {
  const { status, data } = await jsonFetch('/api/session', { method: 'POST' });
  assert.equal(status, 200);
  return data;
}

function authHeaders(token) {
  return { Authorization: 'Bearer ' + token };
}

async function register(overrides = {}) {
  const username = overrides.username || ('user' + Math.random().toString(36).slice(2, 10));
  return jsonFetch('/api/auth/register', {
    method: 'POST',
    body: Object.assign({
      username: username,
      password: 'correct-horse-2026',
      displayName: '测试用户',
      consent: true
    }, overrides, { username: overrides.username === undefined ? username : overrides.username })
  });
}

async function createPost(session, token, overrides = {}) {
  const headers = { 'X-Client-Token': session.token };
  if (token) headers.Authorization = 'Bearer ' + token;
  return jsonFetch('/api/community', {
    method: 'POST',
    headers: headers,
    body: Object.assign({
      board: 'guangzhou',
      province: '广东省',
      type: 'dialect',
      text: '账号与审核测试留言',
      consent: true
    }, overrides)
  });
}

before(async () => {
  port = await freePort();
  base = 'http://127.0.0.1:' + port;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fangyan-accounts-'));

  child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      HOST: '127.0.0.1',
      COMMUNITY_FILE: path.join(tempDir, 'community.json'),
      COMMUNITY_DB: path.join(tempDir, 'community.sqlite'),
      POPULATION_FILE: path.join(root, 'data', 'population.json'),
      COMMUNITY_ADMIN_TOKEN: ADMIN_TOKEN,
      CLIENT_TOKEN_SECRET: CLIENT_TOKEN_SECRET,
      DATABASE_URL: '',
      DB_DRIVER: 'sqlite',
      REDIS_URL: '',
      S3_BUCKET: '',
      REPORT_HIDE_THRESHOLD: '3'
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
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
});

test('审核关键词与手机号边界', () => {
  const moderator = createModerator({});
  assert.equal(moderator.check('端到端验证留言 1794128663999').ok, true);
  assert.equal(moderator.check('联系电话 138 0013 8000').ok, false);
  assert.equal(moderator.check('加微信了解高薪兼职').ok, false);
  assert.equal(moderator.check('这是一句正常的家乡话').ok, true);
});

test('健康检查暴露账号、审核与举报能力', async () => {
  const { status, data } = await jsonFetch('/api/health');
  assert.equal(status, 200);
  assert.equal(data.features.accounts, true);
  assert.equal(data.features.moderation, true);
  assert.equal(data.features.reports, true);
});

test('注册校验：用户名、密码与隐私同意', async () => {
  const noConsent = await register({ consent: false });
  assert.equal(noConsent.status, 400);
  assert.match(noConsent.data.error, /隐私政策/);

  const shortPassword = await register({ password: '123' });
  assert.equal(shortPassword.status, 400);
  assert.match(shortPassword.data.error, /密码至少/);

  const badName = await register({ username: 'a' });
  assert.equal(badName.status, 400);
  assert.match(badName.data.error, /用户名/);
});

test('注册、大小写不敏感重名、登录、当前用户与退出', async () => {
  const name = 'XiangYin' + Math.random().toString(36).slice(2, 7);
  const created = await register({ username: name, displayName: '乡音用户' });
  assert.equal(created.status, 201);
  assert.equal(created.data.user.username, name);
  assert.equal(created.data.user.displayName, '乡音用户');
  assert.match(created.data.token, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal('passwordHash' in created.data.user, false);

  const duplicate = await register({ username: name.toLowerCase() });
  assert.equal(duplicate.status, 409);
  assert.match(duplicate.data.error, /已被占用/);

  const wrong = await jsonFetch('/api/auth/login', {
    method: 'POST',
    body: { username: name, password: 'wrong-password' }
  });
  assert.equal(wrong.status, 401);

  const login = await jsonFetch('/api/auth/login', {
    method: 'POST',
    body: { username: name.toLowerCase(), password: 'correct-horse-2026' }
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.id, created.data.user.id);

  const me = await jsonFetch('/api/auth/me', { headers: authHeaders(login.data.token) });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.username, name);

  const logout = await jsonFetch('/api/auth/logout', {
    method: 'POST',
    headers: authHeaders(login.data.token)
  });
  assert.equal(logout.status, 200);

  const afterLogout = await jsonFetch('/api/auth/me', {
    headers: authHeaders(login.data.token)
  });
  assert.equal(afterLogout.status, 401);
});

test('匿名发布必须勾选隐私同意', async () => {
  const session = await createSession();
  const { status, data } = await jsonFetch('/api/community', {
    method: 'POST',
    headers: { 'X-Client-Token': session.token },
    body: { board: 'guangzhou', text: '没有同意隐私政策' }
  });
  assert.equal(status, 400);
  assert.match(data.error, /隐私政策/);
});

test('登录后留言归属账号，账号可直接删除自己的留言', async () => {
  const session = await createSession();
  const account = await register({ displayName: '归属测试' });
  assert.equal(account.status, 201);

  const created = await createPost(session, account.data.token, { text: '登录后的留言' });
  assert.equal(created.status, 201);
  assert.equal(created.data.post.mine, true);
  assert.equal(created.data.post.name, '归属测试');

  const otherSession = await createSession();
  const other = await register();
  const forbidden = await jsonFetch('/api/community/' + created.data.post.id, {
    method: 'DELETE',
    headers: authHeaders(other.data.token)
  });
  assert.equal(forbidden.status, 403);

  const removed = await jsonFetch('/api/community/' + created.data.post.id, {
    method: 'DELETE',
    headers: authHeaders(account.data.token)
  });
  assert.equal(removed.status, 200);
});

test('命中关键词的留言进入待审队列，管理员可恢复公开', async () => {
  const session = await createSession();
  const created = await createPost(session, null, {
    text: '加微信了解高薪兼职，日结'
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.pending, true);
  assert.equal(created.data.post.status, 'pending');

  const publicList = await jsonFetch('/api/community');
  assert.equal(publicList.data.posts.some((p) => p.id === created.data.post.id), false);

  const adminList = await jsonFetch('/api/admin/posts?status=pending', {
    headers: { 'X-Admin-Token': ADMIN_TOKEN }
  });
  assert.equal(adminList.status, 200);
  assert.ok(adminList.data.posts.some((p) => p.id === created.data.post.id));

  const restore = await jsonFetch('/api/admin/posts/' + created.data.post.id, {
    method: 'PATCH',
    headers: { 'X-Admin-Token': ADMIN_TOKEN },
    body: { status: 'visible' }
  });
  assert.equal(restore.status, 200);
  assert.equal(restore.data.post.status, 'visible');

  const after = await jsonFetch('/api/community');
  assert.ok(after.data.posts.some((p) => p.id === created.data.post.id));

  await jsonFetch('/api/community/' + created.data.post.id, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': ADMIN_TOKEN }
  });
});

test('举报去重，达到阈值后自动转入待审', async () => {
  const author = await createSession();
  const created = await createPost(author, null, { text: '举报阈值测试留言' });
  assert.equal(created.status, 201);
  const id = created.data.post.id;

  const reporters = [await createSession(), await createSession(), await createSession()];
  const first = await jsonFetch('/api/community/' + id + '/report', {
    method: 'POST',
    headers: { 'X-Client-Token': reporters[0].token },
    body: { reason: '垃圾广告' }
  });
  assert.equal(first.status, 201);
  assert.equal(first.data.openReports, 1);
  assert.equal(first.data.hidden, false);

  const duplicate = await jsonFetch('/api/community/' + id + '/report', {
    method: 'POST',
    headers: { 'X-Client-Token': reporters[0].token },
    body: { reason: '再举报一次' }
  });
  assert.equal(duplicate.status, 409);

  for (const reporter of reporters.slice(1)) {
    const res = await jsonFetch('/api/community/' + id + '/report', {
      method: 'POST',
      headers: { 'X-Client-Token': reporter.token },
      body: { reason: '垃圾广告' }
    });
    assert.equal(res.status, 201);
  }

  const hidden = await jsonFetch('/api/community/' + id + '/report', {
    method: 'POST',
    headers: { 'X-Client-Token': (await createSession()).token },
    body: { reason: '再次确认' }
  });
  assert.equal(hidden.status, 409, '留言已转待审后不应继续接收举报');

  const publicList = await jsonFetch('/api/community');
  assert.equal(publicList.data.posts.some((p) => p.id === id), false);

  const reports = await jsonFetch('/api/admin/reports?status=open', {
    headers: { 'X-Admin-Token': ADMIN_TOKEN }
  });
  assert.equal(reports.status, 200);
  const mine = reports.data.reports.filter((r) => r.postId === id);
  assert.equal(mine.length, 3);

  const resolve = await jsonFetch('/api/admin/reports/' + mine[0].id, {
    method: 'POST',
    headers: { 'X-Admin-Token': ADMIN_TOKEN },
    body: { action: 'resolve', hidePost: true }
  });
  assert.equal(resolve.status, 200);
  assert.equal(resolve.data.hidden, true);

  const overview = await jsonFetch('/api/admin/overview', {
    headers: { 'X-Admin-Token': ADMIN_TOKEN }
  });
  assert.equal(overview.status, 200);
  assert.ok(overview.data.users >= 1);
  assert.ok(overview.data.byStatus.hidden >= 1);

  await jsonFetch('/api/community/' + id, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': ADMIN_TOKEN }
  });
});

test('管理员接口拒绝无效令牌', async () => {
  const wrong = await jsonFetch('/api/admin/overview', {
    headers: { 'X-Admin-Token': 'not-the-token' }
  });
  assert.equal(wrong.status, 403);
});

test('导出个人数据不包含密码哈希，注销后账号与留言一起删除', async () => {
  const session = await createSession();
  const account = await register({ displayName: '导出测试' });
  assert.equal(account.status, 201);
  const token = account.data.token;

  const created = await createPost(session, token, { text: '导出用的留言' });
  assert.equal(created.status, 201);

  const exported = await jsonFetch('/api/me/export', { headers: authHeaders(token) });
  assert.equal(exported.status, 200);
  assert.equal(exported.data.user.displayName, '导出测试');
  assert.ok(exported.data.posts.some((p) => p.id === created.data.post.id));
  assert.equal(JSON.stringify(exported.data).includes('passwordHash'), false);
  assert.equal(JSON.stringify(exported.data).includes('password_hash'), false);

  const wrongPassword = await jsonFetch('/api/account', {
    method: 'DELETE',
    headers: authHeaders(token),
    body: { password: 'not-the-password' }
  });
  assert.equal(wrongPassword.status, 403);

  const deleted = await jsonFetch('/api/account', {
    method: 'DELETE',
    headers: authHeaders(token),
    body: { password: 'correct-horse-2026' }
  });
  assert.equal(deleted.status, 200);
  assert.ok(deleted.data.deletedPosts >= 1);

  const login = await jsonFetch('/api/auth/login', {
    method: 'POST',
    body: { username: account.data.user.username, password: 'correct-horse-2026' }
  });
  assert.equal(login.status, 401);

  const publicList = await jsonFetch('/api/community');
  assert.equal(publicList.data.posts.some((p) => p.id === created.data.post.id), false);
});
