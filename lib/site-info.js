'use strict';

/* 运营主体与隐私联系信息
 *
 * 真实主体名称、注册地址与专用邮箱属于上线前必须由运营方提供的信息，
 * 项目本身不预置任何虚构值。配置来源按优先级：
 *   1. 环境变量（适合 Docker Compose / 云平台）
 *   2. SITE_INFO_FILE 指向的 JSON 文件（默认 <root>/site-info.json）
 *
 * JSON 结构见 site-info.example.json；该文件默认被 .gitignore 忽略。
 */

const fs = require('node:fs');
const path = require('node:path');
const { normalizeEmail, validEmail } = require('./accounts.js');

const FIELD_KEYS = [
  'operatorName',
  'operatorAddress',
  'privacyEmail',
  'privacyContactName',
  'complaintContact',
  'supervisorContact',
  'dataRegion'
];

const ENV_KEYS = {
  operatorName: 'OPERATOR_NAME',
  operatorAddress: 'OPERATOR_ADDRESS',
  privacyEmail: 'PRIVACY_EMAIL',
  privacyContactName: 'PRIVACY_CONTACT_NAME',
  complaintContact: 'COMPLAINT_CONTACT',
  supervisorContact: 'SUPERVISOR_CONTACT',
  dataRegion: 'DATA_REGION'
};

const REQUIRED_KEYS = ['operatorName', 'operatorAddress', 'privacyEmail'];

const MAX_LENGTH = {
  operatorName: 120,
  operatorAddress: 300,
  privacyEmail: 254,
  privacyContactName: 120,
  complaintContact: 300,
  supervisorContact: 300,
  dataRegion: 200
};

function cleanText(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function readJsonFile(file) {
  if (!file) return null;
  try {
    /* Windows 记事本等编辑器可能写入 UTF-8 BOM，JSON.parse 不接受 */
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error('读取运营主体配置失败（' + file + '）：' + err.message);
  }
}

function loadSiteInfo(options) {
  const opts = options || {};
  const env = opts.env || process.env;
  const root = opts.root || process.cwd();
  const file = opts.file || String(env.SITE_INFO_FILE || '').trim() ||
    path.join(root, 'site-info.json');
  const fromFile = readJsonFile(file) || {};
  const fields = {};
  for (const key of FIELD_KEYS) {
    const envKey = ENV_KEYS[key];
    const envValue = envKey ? env[envKey] : '';
    const raw = envValue != null && String(envValue).trim() !== ''
      ? envValue
      : fromFile[key];
    fields[key] = cleanText(raw, MAX_LENGTH[key] || 300);
  }

  fields.privacyEmail = normalizeEmail(fields.privacyEmail);

  const missing = [];
  for (const key of REQUIRED_KEYS) {
    if (!fields[key]) missing.push(key);
  }
  if (fields.privacyEmail && !validEmail(fields.privacyEmail)) {
    if (!missing.includes('privacyEmail')) missing.push('privacyEmail');
  }

  return {
    configured: missing.length === 0,
    fields: fields,
    missing: missing
  };
}

module.exports = {
  FIELD_KEYS,
  REQUIRED_KEYS,
  loadSiteInfo
};
