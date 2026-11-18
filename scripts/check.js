#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const errors = [];
const notes = [];

function fail(message) {
  errors.push(message);
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

/* 1. 共享方言数据 */
const data = require(path.join(root, 'assets/data/dialects.js'));
const required = [
  'id', 'name', 'full', 'region', 'color', 'phrase', 'pinyin', 'mean', 'desc',
  'hi', 'hipy', 'fullName', 'area', 'lbl', 'tag', 'sample', 'title', 'sub',
  'histLead', 'history', 'provinces', 'geos', 'regions'
];

if (data.dialects.length !== 10) fail('方言数量应为 10，实际为 ' + data.dialects.length);
if (Object.keys(data.byId).length !== data.dialects.length) fail('byId 数量与 dialects 不一致');

const ids = new Set();
for (const d of data.dialects) {
  if (!d.id || ids.has(d.id)) fail('方言 ID 缺失或重复：' + d.id);
  ids.add(d.id);
  for (const key of required) {
    if (d[key] === undefined || d[key] === null || d[key] === '') fail(d.id + ' 缺少字段 ' + key);
  }
  if (!Array.isArray(d.provinces) || !d.provinces.length) fail(d.id + ' 省份为空');
  if (!Array.isArray(d.history) || d.history.length !== 8) fail(d.id + ' 历史阶段应为 8 段');
  if (!Array.isArray(d.geos) || !d.geos.length) fail(d.id + ' 缺少地图示意范围');
  if (!Array.isArray(d.regions) || !d.regions.length) fail(d.id + ' 缺少风俗地区');
  if (data.byId[d.id] !== d) fail(d.id + ' 的 byId 引用不一致');
}
notes.push('共享方言数据：' + data.dialects.length + ' 个方言');

/* 2. 页面是否使用共享数据 */
const index = read('index.html');
const main = read('方言学习页.html');
const detail = read('fangyan-detail.html');
const privacy = read('privacy.html');
const dataPage = read('data.html');
const actionPage = read('action.html');
const methodsPage = read('methods.html');
const pages = [
  ['index.html', index],
  ['方言学习页.html', main],
  ['fangyan-detail.html', detail],
  ['privacy.html', privacy],
  ['data.html', dataPage],
  ['action.html', actionPage],
  ['methods.html', methodsPage]
];
const mainJs = read('assets/main.js');
const detailJs = read('assets/detail.js');
const community = read('assets/community.js');
const server = read('server.js');

if (!mainJs.includes('var DIALECTS=FANGYAN_DATA.dialects;')) fail('主页脚本没有使用 FANGYAN_DATA.dialects');
if (!detailJs.includes('var DET=FANGYAN_DATA.byId;')) fail('详情页脚本没有使用 FANGYAN_DATA.byId');
if (!main.includes('src="assets/main.js')) fail('主页没有加载 assets/main.js');
if (!detail.includes('src="assets/detail.js')) fail('详情页没有加载 assets/detail.js');
if (!main.includes('src="assets/data/dialects.js')) fail('主页没有加载共享数据脚本');
if (!detail.includes('src="assets/data/dialects.js')) fail('详情页没有加载共享数据脚本');
if (mainJs.includes('var DIALECTS=[')) fail('主页脚本仍保留旧 DIALECTS 数据');
if (detailJs.includes('var DET={')) fail('详情页脚本仍保留旧 DET 数据');
if (community.includes('CM_PROVINCES')) fail('社区仍保留重复的 CM_PROVINCES');
if (!community.includes('FANGYAN_DATA')) fail('社区没有读取共享数据');
if (!server.includes("require('./assets/data/dialects.js')")) fail('服务端没有读取共享数据');
if (!server.includes("require('./lib/store.js')")) fail('服务端没有使用数据层工厂');
if (!read('lib/store.js').includes("require('./community-store.js')")) fail('数据层工厂没有 SQLite 实现');
if (!read('lib/store.js').includes("require('./postgres-store.js')")) fail('数据层工厂没有 PostgreSQL 实现');
if (!read('lib/community-store.js').includes("require('node:sqlite')")) fail('SQLite 数据层没有使用 node:sqlite');
if (!read('lib/postgres-store.js').includes("requireOptional('pg')")) fail('PostgreSQL 数据层没有按需加载 pg');
if (!read('lib/redis.js').includes("requireOptional('redis')")) fail('Redis 适配层没有按需加载 redis');
if (!read('lib/object-store.js').includes("requireOptional('@aws-sdk/client-s3')")) fail('对象存储适配层没有按需加载 S3 SDK');
if (!community.includes('/api/uploads/sign')) fail('社区前端没有接入对象存储预签名上传');
if (!server.includes('/audio$/')) fail('服务端没有提供社区语音按需读取接口');
if (!community.includes('preload="none"')) fail('社区语音播放器没有使用 preload="none" 按需加载');
if (!privacy.includes('src="assets/site-info.js')) fail('隐私政策页没有加载 assets/site-info.js');
if (!privacy.includes('id="site-operator-name"')) fail('隐私政策页缺少运营主体信息占位');
if (!server.includes("pathname === '/api/site-info'")) fail('服务端没有提供 /api/site-info');
if (!server.includes("'/site-info.json'")) fail('服务端没有屏蔽 site-info.json');
const siteInfoExample = JSON.parse(read('site-info.example.json'));
for (const key of ['operatorName', 'operatorAddress', 'privacyEmail']) {
  if (!(key in siteInfoExample)) fail('site-info.example.json 缺少字段 ' + key);
  if (siteInfoExample[key]) fail('site-info.example.json 的 ' + key + ' 不应预置真实值');
}
/* 生产部署时静态文件由 Caddy / Nginx 直接托管，必须与 Node 一样屏蔽运营主体配置 */
const caddyfile = read('deploy/Caddyfile');
const nginxConf = read('deploy/nginx.conf');
const dockerignore = read('.dockerignore');
for (const file of ['/site-info.json', '/site-info.example.json']) {
  if (!caddyfile.includes(file)) fail('deploy/Caddyfile 没有屏蔽 ' + file);
}
if (!nginxConf.includes('site-info\\.json')) fail('deploy/nginx.conf 没有屏蔽 site-info.json');
if (!nginxConf.includes('site-info\\.example\\.json')) fail('deploy/nginx.conf 没有屏蔽 site-info.example.json');
if (!dockerignore.includes('site-info.json')) fail('.dockerignore 没有排除 site-info.json');

/* 3. 脚本语法 */
const scriptFiles = new Set([
  'server.js',
  'lib/community-store.js',
  'lib/postgres-store.js',
  'lib/redis.js',
  'lib/object-store.js',
  'lib/optional.js',
  'lib/store.js',
  'lib/accounts.js',
  'lib/moderation.js',
  'lib/mailer.js',
  'lib/site-info.js',
  'lib/public-url.js',
  'scripts/init-s3.js',
  'scripts/demo-data.js',
  'scripts/mail-test.js',
  'scripts/verify-deploy.js'
]);
for (const html of pages.map((entry) => entry[1])) {
  const re = /<script[^>]+src="(assets\/[^"?#]+\.js)(?:[?#][^"]*)?"/g;
  let match;
  while ((match = re.exec(html))) scriptFiles.add(match[1]);
}
for (const file of scriptFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) fail(file + ' 语法错误：' + (result.stderr || '').trim());
}
notes.push('脚本语法：' + scriptFiles.size + ' 个文件');

for (const [file, html] of pages) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let index = 0;
  while ((match = re.exec(html))) {
    const openTag = match[0].slice(0, match[0].indexOf('>') + 1);
    if (/type=["'](?!text\/javascript|application\/javascript|module)/i.test(openTag)) continue;
    index += 1;
    try {
      new vm.Script(match[1], { filename: file + '#inline-' + index });
    } catch (err) {
      fail(file + ' 第 ' + index + ' 段内联脚本语法错误：' + err.message);
    }
  }
  if (index > 0) fail(file + ' 仍包含 ' + index + ' 段可执行内联脚本，会与 CSP script-src 冲突');
  notes.push(file + '：' + index + ' 段可执行内联脚本');
}

/* 3.1 样式外置与 CSP style-src 兼容 */
if (!index.includes('href="assets/index.css')) fail('入口页没有加载 assets/index.css');
if (!main.includes('href="assets/main.css')) fail('主页没有加载 assets/main.css');
if (!detail.includes('href="assets/detail.css')) fail('详情页没有加载 assets/detail.css');
if (!privacy.includes('href="assets/privacy.css')) fail('隐私政策页没有加载 assets/privacy.css');
if (!dataPage.includes('href="assets/insight.css')) fail('数据观察页没有加载 assets/insight.css');
if (!actionPage.includes('href="assets/insight.css')) fail('保护行动页没有加载 assets/insight.css');
if (!methodsPage.includes('href="assets/insight.css')) fail('数据与方法页没有加载 assets/insight.css');
for (const [file, html] of pages) {
  if (/<style[\s>]/i.test(html)) fail(file + ' 仍包含内联 <style>，会与 CSP style-src 冲突');
}
for (const file of ['assets/index.css', 'assets/main.css', 'assets/detail.css', 'assets/community.css', 'assets/privacy.css', 'assets/nav.css', 'assets/learn.css', 'assets/insight.css']) {
  const css = read(file);
  const open = (css.match(/{/g) || []).length;
  const close = (css.match(/}/g) || []).length;
  if (open !== close) fail(file + ' 花括号不配对：' + open + ' / ' + close);
}
notes.push('页面样式：8 个外置 CSS，无内联 <style>');

/* 3.2 版本号必须与文件内容哈希一致，避免 immutable 缓存拿到旧资源 */
for (const [file, html] of pages) {
  const re = /(?:src|href)="(assets\/[^"?#]+\.(?:js|css))(?:\?v=([^"#]*))?"/g;
  let match;
  while ((match = re.exec(html))) {
    const asset = match[1];
    const actual = match[2];
    const full = path.join(root, decodeURIComponent(asset));
    if (!fs.existsSync(full)) continue;
    const expected = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex').slice(0, 10);
    if (!actual) {
      fail(file + ' 的资源缺少版本号：' + asset + '（运行 npm run build）');
    } else if (actual !== expected) {
      fail(file + ' 的资源版本号已过期：' + asset + '（运行 npm run build）');
    }
  }
}
notes.push('资源版本：JS/CSS 版本号与内容哈希一致');

/* 4. 页面静态引用的本地资源是否存在 */
for (const [file, html] of pages) {
  const re = /(?:src|href)="(assets\/[^"?#]+)(?:[?#][^"]*)?"/g;
  let match;
  while ((match = re.exec(html))) {
    const asset = path.join(root, decodeURIComponent(match[1]));
    if (!fs.existsSync(asset)) fail(file + ' 引用了不存在的资源：' + match[1]);
  }

  const srcsetRe = /srcset="([^"]+)"/g;
  while ((match = srcsetRe.exec(html))) {
    for (const candidate of match[1].split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (!url || /^(https?:)?\/\//.test(url) || url.startsWith('data:')) continue;
      const asset = path.join(root, decodeURIComponent(url));
      if (!fs.existsSync(asset)) fail(file + ' srcset 引用了不存在的资源：' + url);
    }
  }
}

if (errors.length) {
  console.error('检查失败：');
  for (const error of errors) console.error('  - ' + error);
  process.exitCode = 1;
} else {
  for (const note of notes) console.log('✓ ' + note);
  console.log('✓ 共享数据、页面引用、脚本语法与本地资源检查通过');
}
