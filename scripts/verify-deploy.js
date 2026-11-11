#!/usr/bin/env node
'use strict';

/* 部署环境自检
 *
 *   npm run deploy:check                         开发/预发布配置检查
 *   npm run deploy:check:prod                    按正式上线要求检查
 *   npm run deploy:check -- --base-url https://example.com
 *   npm run deploy:check -- --send-mail-to you@example.com
 *
 * 会读取 .env（如果存在）与当前环境变量，检查密钥、邮件、运营主体信息、
 * 数据库、Redis、对象存储与可选的线上 HTTP 响应。不会打印任何密钥明文。
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn('读取 .env 失败，继续使用当前环境变量：' + err.message);
  }
}

const { loadSiteInfo } = require(path.join(root, 'lib/site-info.js'));
const { createMailer } = require(path.join(root, 'lib/mailer.js'));
const { requireOptional } = require(path.join(root, 'lib/optional.js'));
const { normalizeEmail, validEmail } = require(path.join(root, 'lib/accounts.js'));

const args = process.argv.slice(2);
const production = args.includes('--production') || args.includes('--prod');
const json = args.includes('--json');
const skipNetwork = args.includes('--skip-network');

function argValue(name) {
  const index = args.indexOf(name);
  if (index < 0) return '';
  return String(args[index + 1] || '').trim();
}

if (args.includes('--help') || args.includes('-h')) {
  console.log('用法：node scripts/verify-deploy.js [--production] [--json] [--skip-network]');
  console.log('       [--base-url https://example.com] [--send-mail-to you@example.com]');
  console.log('');
  console.log('  --production        按正式上线要求检查（缺失关键配置会返回非零退出码）');
  console.log('  --base-url <url>    额外检查线上健康接口、隐私页、CSP 与敏感文件屏蔽');
  console.log('  --send-mail-to <邮箱> 使用当前邮件配置发送一封测试邮件');
  console.log('  --skip-network      跳过数据库、Redis 与 HTTP 网络检查');
  console.log('  --json              输出机器可读的 JSON');
  process.exit(0);
}

const results = [];
function add(name, status, detail) {
  results.push({ name: name, status: status, detail: detail || '' });
}

function versionAtLeast(current, minimum) {
  const a = String(current).split('.').map((n) => Number(n) || 0);
  const b = String(minimum).split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label + '超时（' + ms + 'ms）')), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

function hasOwnEnv(name) {
  return Object.prototype.hasOwnProperty.call(process.env, name) &&
    String(process.env[name] || '').trim() !== '';
}

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' ||
    hostname.endsWith('.local');
}

function isPlaceholderEmail(email) {
  const value = normalizeEmail(email);
  return /@(example\.(com|org|net)|localhost|test\.local)$/i.test(value) ||
    /^(no-?reply|test)@/i.test(value);
}

/* ===== 1. 运行时 ===== */
const nodeVersion = process.versions.node;
add('Node.js 版本', versionAtLeast(nodeVersion, '22.13.0') ? 'ok' : 'fail',
  nodeVersion + '（要求 >= 22.13.0，node:sqlite 需要）');

/* ===== 2. 会话与管理员密钥 ===== */
const clientSecret = String(process.env.CLIENT_TOKEN_SECRET || '').trim();
if (clientSecret.length >= 32) {
  add('匿名会话密钥', 'ok', '已设置（长度 ' + clientSecret.length + '）');
} else if (clientSecret) {
  add('匿名会话密钥', production ? 'fail' : 'warn',
    '长度不足 32，建议使用至少 32 字节的随机字符串');
} else {
  add('匿名会话密钥', production ? 'fail' : 'warn',
    '未设置；服务启动时会生成临时密钥，重启后匿名令牌失效');
}

const adminToken = String(process.env.COMMUNITY_ADMIN_TOKEN || '').trim();
if (!adminToken) {
  add('管理员令牌', production ? 'fail' : 'warn', '未设置，管理面板不可用');
} else if (adminToken === 'demo-admin-token-2026') {
  add('管理员令牌', production ? 'fail' : 'warn', '仍在使用演示令牌，正式环境必须更换');
} else if (adminToken.length < 16) {
  add('管理员令牌', production ? 'fail' : 'warn', '长度不足 16，建议使用更长的随机字符串');
} else {
  add('管理员令牌', 'ok', '已设置（长度 ' + adminToken.length + '）');
}

/* ===== 3. 对外地址 ===== */
const publicBase = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
if (!publicBase) {
  add('对外访问地址', production ? 'fail' : 'warn',
    '未设置 PUBLIC_BASE_URL；邮件链接会按请求 Host 推断，反向代理后可能不正确');
} else {
  try {
    const url = new URL(publicBase);
    if (url.protocol !== 'https:' && !isLocalHost(url.hostname)) {
      add('对外访问地址', production ? 'fail' : 'warn', publicBase + '（正式环境应使用 HTTPS）');
    } else if (url.pathname !== '/' && url.pathname !== '') {
      add('对外访问地址', 'warn', publicBase + '（建议只填写站点根地址，不带路径）');
    } else {
      add('对外访问地址', 'ok', publicBase);
    }
  } catch (_) {
    add('对外访问地址', 'fail', 'PUBLIC_BASE_URL 不是合法 URL：' + publicBase);
  }
}

/* ===== 4. 邮件服务 ===== */
const mailer = createMailer({
  provider: process.env.MAIL_PROVIDER,
  from: process.env.MAIL_FROM || 'no-reply@localhost',
  fromName: process.env.MAIL_FROM_NAME || '一声一味',
  replyTo: process.env.MAIL_REPLY_TO,
  resendApiKey: process.env.RESEND_API_KEY,
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  timeoutMs: process.env.MAIL_TIMEOUT_MS
});

if (mailer.provider === 'console') {
  add('邮件服务', production ? 'fail' : 'warn',
    'console 模式只把邮件打印到控制台，不会真实发信');
} else if (mailer.provider === 'disabled') {
  add('邮件服务', 'fail', mailer.reason || '邮件服务未配置');
} else {
  add('邮件服务', 'ok', mailer.provider + ' / 发件人 ' + mailer.from);
}

if (!validEmail(mailer.from)) {
  /* console 模式下不会真实投递，默认占位地址不应阻塞本地自检 */
  const consoleOnly = mailer.provider === 'console' || mailer.provider === 'disabled';
  add('发件人地址', production || !consoleOnly ? 'fail' : 'warn',
    (consoleOnly && !production ? 'console 模式下占位地址可接受：' : 'MAIL_FROM 不是合法邮箱：') + mailer.from);
} else if (production && isPlaceholderEmail(mailer.from)) {
  add('发件人地址', 'fail', '仍在使用示例或本地地址：' + mailer.from);
} else {
  add('发件人地址', 'ok', mailer.from);
}

if (mailer.replyTo) {
  add('回复地址', validEmail(mailer.replyTo) ? 'ok' : 'fail', mailer.replyTo);
}

/* ===== 5. 运营主体与隐私联系信息 ===== */
const siteInfo = loadSiteInfo({ root: root, env: process.env });
const SITE_LABELS = {
  operatorName: '运营主体名称',
  operatorAddress: '注册地址',
  privacyEmail: '隐私事务专用邮箱'
};
if (siteInfo.configured) {
  add('运营主体信息', 'ok',
    siteInfo.fields.operatorName + ' / ' + siteInfo.fields.privacyEmail);
} else {
  const missing = siteInfo.missing.map((key) => SITE_LABELS[key] || key).join('、');
  add('运营主体信息', production ? 'fail' : 'warn',
    '缺少：' + missing + '（填写 site-info.json 或 OPERATOR_* / PRIVACY_EMAIL 环境变量）');
}

/* ===== 6. 数据库 ===== */
async function checkDatabase() {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (databaseUrl) {
    let client = null;
    try {
      const { Client } = requireOptional('pg');
      client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
      await withTimeout(client.connect(), 6000, 'PostgreSQL 连接');
      await client.query('SELECT 1');
      add('数据库', 'ok', 'PostgreSQL 连接成功');
    } catch (err) {
      add('数据库', 'fail', 'PostgreSQL 连接失败：' + err.message);
    } finally {
      if (client) {
        try { await client.end(); } catch (_) {}
      }
    }
    return;
  }

  const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.accessSync(dataDir, fs.constants.W_OK);
    add('数据库', production ? 'warn' : 'ok',
      'SQLite：' + path.join(dataDir, 'community.sqlite') +
      (production ? '（正式环境建议 PostgreSQL）' : ''));
  } catch (err) {
    add('数据库', 'fail', 'SQLite 数据目录不可写：' + err.message);
  }
}

/* ===== 7. Redis ===== */
async function checkRedis() {
  const redisUrl = String(process.env.REDIS_URL || '').trim();
  if (!redisUrl) {
    add('Redis', production ? 'warn' : 'ok', '未配置，使用单实例内存限流与 SSE 广播');
    return;
  }
  let redis = null;
  try {
    const { createRedis } = require(path.join(root, 'lib/redis.js'));
    redis = await withTimeout(createRedis({
      url: redisUrl,
      logger: { warn() {}, error() {}, log() {} }
    }), 8000, 'Redis 连接');
    add('Redis', redis ? 'ok' : 'warn', redis ? '连接成功' : '未启用');
  } catch (err) {
    add('Redis', 'fail', '连接失败：' + err.message);
  } finally {
    if (redis) {
      try { await redis.close(); } catch (_) {}
    }
  }
}

/* ===== 8. 对象存储 ===== */
function checkObjectStorage() {
  const bucket = String(process.env.S3_BUCKET || '').trim();
  if (!bucket) {
    add('对象存储', production ? 'warn' : 'ok', '未配置，语音使用内联 data URI');
    return;
  }
  const notes = [];
  if (!process.env.S3_PUBLIC_BASE_URL && !process.env.S3_PUBLIC_ENDPOINT && !process.env.S3_ENDPOINT) {
    notes.push('缺少浏览器可达的公开地址');
  }
  if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    notes.push('未显式配置访问密钥（如使用实例角色可忽略）');
  }
  add('对象存储', notes.length ? 'warn' : 'ok',
    'bucket=' + bucket + (notes.length ? '；' + notes.join('；') : ''));
}

/* ===== 9. 线上 HTTP 检查 ===== */
async function fetchWithTimeout(url, options) {
  return fetch(url, Object.assign({ signal: AbortSignal.timeout(8000) }, options || {}));
}

async function checkHttp(baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  if (!base) return;

  try {
    const res = await fetchWithTimeout(base + '/api/health');
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.ok) {
      add('线上健康接口', 'ok',
        'store=' + (data.features && data.features.store) +
        ' / email=' + (data.features && data.features.email) +
        ' / siteInfo=' + (data.features && data.features.siteInfo));
      if (data.features && data.features.siteInfo === false) {
        add('线上运营主体信息', production ? 'fail' : 'warn', '/api/health 显示尚未配置');
      }
    } else {
      add('线上健康接口', 'fail', 'HTTP ' + res.status);
    }
  } catch (err) {
    add('线上健康接口', 'fail', '请求失败：' + err.message);
  }

  try {
    const res = await fetchWithTimeout(base + '/privacy.html');
    const html = await res.text();
    if (res.ok && html.includes('site-info.js') && html.includes('site-operator-name')) {
      add('线上隐私页', 'ok', '可访问且包含运营主体信息占位');
    } else {
      add('线上隐私页', 'fail', '页面缺少 site-info.js 或运营主体信息占位');
    }
  } catch (err) {
    add('线上隐私页', 'fail', '请求失败：' + err.message);
  }

  try {
    const res = await fetchWithTimeout(base + '/api/site-info');
    const data = await res.json().catch(() => null);
    if (res.ok && data && typeof data.configured === 'boolean') {
      add('线上运营主体接口', data.configured ? 'ok' : (production ? 'fail' : 'warn'),
        data.configured ? '已配置' : '未配置（缺少：' + (data.missing || []).join('、') + '）');
    } else {
      add('线上运营主体接口', 'fail', 'HTTP ' + res.status);
    }
  } catch (err) {
    add('线上运营主体接口', 'fail', '请求失败：' + err.message);
  }

  try {
    const res = await fetchWithTimeout(base + '/');
    const csp = res.headers.get('content-security-policy') || '';
    const scriptSrc = (csp.match(/script-src[^;]*/i) || [''])[0];
    if (!csp) {
      add('线上安全响应头', 'fail', '缺少 Content-Security-Policy');
    } else if (!scriptSrc || /unsafe-inline/i.test(scriptSrc)) {
      add('线上安全响应头', 'fail', 'script-src 缺失或允许 unsafe-inline');
    } else {
      add('线上安全响应头', 'ok', 'CSP 已启用且 script-src 不含 unsafe-inline');
    }
  } catch (err) {
    add('线上安全响应头', 'fail', '请求失败：' + err.message);
  }

  for (const pathname of ['/server.js', '/.env', '/site-info.json', '/data/community.sqlite']) {
    try {
      const res = await fetchWithTimeout(base + pathname);
      if (res.status === 404 || res.status === 403) {
        add('敏感文件屏蔽 ' + pathname, 'ok', 'HTTP ' + res.status);
      } else {
        add('敏感文件屏蔽 ' + pathname, 'fail', 'HTTP ' + res.status + '（不应公开）');
      }
    } catch (err) {
      add('敏感文件屏蔽 ' + pathname, 'fail', '请求失败：' + err.message);
    }
  }
}

/* ===== 10. 可选：真实发送测试邮件 ===== */
async function checkMailDelivery(to) {
  const address = normalizeEmail(to);
  if (!address) return;
  if (!validEmail(address)) {
    add('测试邮件', 'fail', '收件地址不合法：' + address);
    return;
  }
  try {
    const result = await withTimeout(mailer.send({
      to: address,
      subject: '一声一味 · 部署环境测试邮件',
      text: '这是一封来自一声一味部署环境自检的测试邮件。发送时间：' + new Date().toISOString(),
      html: '<p>这是一封来自一声一味部署环境自检的测试邮件。</p><p>发送时间：' +
        new Date().toISOString() + '</p>'
    }), Math.max(5000, Number(process.env.MAIL_TIMEOUT_MS) || 10000) + 2000, '测试邮件发送');
    if (mailer.provider === 'console') {
      add('测试邮件', 'warn', 'console 模式已打印邮件，但未真实投递到 ' + address);
    } else {
      add('测试邮件', 'ok', '已提交到 ' + mailer.provider + '：' + (result.id || '(无编号)'));
    }
  } catch (err) {
    add('测试邮件', 'fail', '发送失败：' + err.message);
  }
}

async function main() {
  if (!skipNetwork) {
    await checkDatabase();
    await checkRedis();
  } else {
    add('数据库', 'skip', '已跳过网络检查');
    add('Redis', 'skip', '已跳过网络检查');
  }
  checkObjectStorage();

  const baseUrl = argValue('--base-url') || String(process.env.VERIFY_BASE_URL || '').trim();
  if (baseUrl && !skipNetwork) {
    await checkHttp(baseUrl);
  } else if (baseUrl && skipNetwork) {
    add('线上 HTTP 检查', 'skip', '已跳过网络检查');
  }

  const mailTo = argValue('--send-mail-to') || String(process.env.MAIL_TEST_TO || '').trim();
  if (mailTo) await checkMailDelivery(mailTo);

  const failed = results.filter((item) => item.status === 'fail');
  const warned = results.filter((item) => item.status === 'warn');

  if (json) {
    console.log(JSON.stringify({
      ok: failed.length === 0,
      production: production,
      failed: failed.length,
      warned: warned.length,
      results: results
    }, null, 2));
  } else {
    const icons = { ok: '✓', warn: '⚠', fail: '✗', skip: '–' };
    for (const item of results) {
      console.log((icons[item.status] || '·') + ' ' + item.name + '：' + item.detail);
    }
    console.log('');
    console.log((production ? '正式上线检查' : '部署自检') + '：' +
      (failed.length ? failed.length + ' 项失败，' : '') +
      (warned.length ? warned.length + ' 项警告，' : '') +
      '共 ' + results.length + ' 项。');
    if (failed.length) {
      console.log('请先修复失败项再公开服务。');
    } else if (production && warned.length) {
      console.log('没有失败项，但仍有警告；请确认这些警告是否可以接受。');
    } else {
      console.log('未发现阻塞性问题。');
    }
  }

  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('自检脚本异常：' + err.message);
  process.exitCode = 1;
});
