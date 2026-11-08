'use strict';

/* 数据层工厂
 *
 * 默认使用 SQLite（零依赖、单实例）；
 * 设置 DATABASE_URL 或 DB_DRIVER=postgres 时切换到 PostgreSQL。
 */

async function createStore(options) {
  const driver = String((options && options.driver) || '').toLowerCase();
  if (driver === 'postgres' || driver === 'postgresql') {
    const { PostgresCommunityStore } = require('./postgres-store.js');
    return PostgresCommunityStore.create(options);
  }
  const { CommunityStore } = require('./community-store.js');
  return new CommunityStore(options);
}

module.exports = { createStore };
