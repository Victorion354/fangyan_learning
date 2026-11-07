#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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
const main = read('方言学习页.html');
const detail = read('fangyan-detail.html');
const community = read('assets/community.js');
const server = read('server.js');

if (!main.includes('var DIALECTS=FANGYAN_DATA.dialects;')) fail('主页没有使用 FANGYAN_DATA.dialects');
if (!detail.includes('var DET=FANGYAN_DATA.byId;')) fail('详情页没有使用 FANGYAN_DATA.byId');
if (!main.includes('src="assets/data/dialects.js')) fail('主页没有加载共享数据脚本');
if (!detail.includes('src="assets/data/dialects.js')) fail('详情页没有加载共享数据脚本');
if (main.includes('var DIALECTS=[')) fail('主页仍保留旧 DIALECTS 数据');
if (detail.includes('var DET={')) fail('详情页仍保留旧 DET 数据');
if (community.includes('CM_PROVINCES')) fail('社区仍保留重复的 CM_PROVINCES');
if (!community.includes('FANGYAN_DATA')) fail('社区没有读取共享数据');
if (!server.includes("require('./assets/data/dialects.js')")) fail('服务端没有读取共享数据');

/* 3. 脚本语法 */
for (const file of ['server.js', 'assets/community.js', 'assets/data/dialects.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) fail(file + ' 语法错误：' + (result.stderr || '').trim());
}

for (const [file, html] of [['方言学习页.html', main], ['fangyan-detail.html', detail]]) {
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
  notes.push(file + '：' + index + ' 段内联脚本');
}

/* 4. 页面静态引用的本地资源是否存在 */
for (const [file, html] of [['方言学习页.html', main], ['fangyan-detail.html', detail]]) {
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
