'use strict';

/* 账号与会话工具（零依赖，只用 Node 内置 crypto）
 *
 * 密码使用 scrypt 加盐哈希；会话令牌是随机串，数据库只保存 SHA-256 哈希，
 * 这样即使数据库泄漏也无法直接冒用登录态。
 */

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 64 * 1024 * 1024;

const USERNAME_RE = /^[A-Za-z0-9_\-\u4e00-\u9fa5]{2,24}$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

function normalizeUsername(username) {
  return String(username == null ? '' : username).trim().toLowerCase();
}

function validUsername(username) {
  return USERNAME_RE.test(String(username == null ? '' : username).trim());
}

function passwordProblem(password) {
  const value = String(password == null ? '' : password);
  if (value.length < MIN_PASSWORD) return '密码至少 ' + MIN_PASSWORD + ' 位';
  if (value.length > MAX_PASSWORD) return '密码不能超过 ' + MAX_PASSWORD + ' 位';
  return null;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(String(password), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEM
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derived.toString('base64url')
  ].join('$');
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (N < 2 || N > 1048576 || r < 1 || r > 32 || p < 1 || p > 16) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[4], 'base64url');
    expected = Buffer.from(parts[5], 'base64url');
  } catch (_) {
    return false;
  }
  if (!salt.length || !expected.length) return false;
  let actual;
  try {
    actual = await scrypt(String(password), salt, expected.length, {
      N: N,
      r: r,
      p: p,
      maxmem: MAX_MEM
    });
  } catch (_) {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/* 用户名不存在时也跑一次 scrypt，避免通过响应时间枚举账号。
 * 这里用同步版本，只在模块加载时计算一次。 */
const DUMMY_PASSWORD_HASH = (() => {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync('dummy-password-for-timing', salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEM
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derived.toString('base64url')
  ].join('$');
})();

function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function newUserId() {
  return 'u' + crypto.randomBytes(12).toString('hex');
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.displayName || row.username,
    createdAt: Number(row.created_at || row.createdAt) || 0
  };
}

module.exports = {
  normalizeUsername,
  validUsername,
  passwordProblem,
  hashPassword,
  verifyPassword,
  createSessionToken,
  hashSessionToken,
  newUserId,
  publicUser,
  DUMMY_PASSWORD_HASH
};
