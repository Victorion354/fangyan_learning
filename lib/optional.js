'use strict';

/* 可选运行时依赖加载器
 *
 * 开发模式（SQLite + 内存限流 + 内联语音）不需要任何 npm 依赖。
 * 只有启用 PostgreSQL / Redis / S3 时，才按需加载对应的可选包。
 */
function requireOptional(name) {
  try {
    return require(name);
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && String(err.message).includes(name)) {
      const missing = new Error('缺少可选依赖 ' + name + '，请在部署环境运行 npm install');
      missing.code = 'OPTIONAL_DEPENDENCY_MISSING';
      missing.dependency = name;
      throw missing;
    }
    throw err;
  }
}

module.exports = { requireOptional };
