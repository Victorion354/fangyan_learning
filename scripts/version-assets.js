#!/usr/bin/env node
'use strict';

/* 把页面引用的本地 JS/CSS 版本号更新为内容哈希。
 * 静态服务对带 ?v= 的资源使用一年期 immutable 缓存，
 * 因此资源内容变化后必须重新运行本脚本。
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const pages = [
  'index.html',
  '方言学习页.html',
  'fangyan-detail.html',
  'privacy.html',
  'data.html',
  'action.html',
  'methods.html'
];
const assetRe = /((?:src|href)=")(assets\/[^"?#]+\.(?:js|css))(?:\?v=[^"#]*)?(")/g;
const hashes = new Map();

function hashAsset(asset) {
  if (hashes.has(asset)) return hashes.get(asset);
  const file = path.join(root, decodeURIComponent(asset));
  if (!fs.existsSync(file)) throw new Error('资源不存在：' + asset);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
  hashes.set(asset, hash);
  return hash;
}

let changedPages = 0;
for (const page of pages) {
  const file = path.join(root, page);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(assetRe, (match, prefix, asset, suffix) => {
    return prefix + asset + '?v=' + hashAsset(asset) + suffix;
  });
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    changedPages += 1;
    console.log('已更新 ' + page);
  } else {
    console.log('无需更新 ' + page);
  }
}

console.log('资源版本：' + hashes.size + ' 个文件，' + changedPages + ' 个页面有变化');
