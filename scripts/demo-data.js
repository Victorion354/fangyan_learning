#!/usr/bin/env node
'use strict';

/* 演示数据：一键播种 / 清空
 *
 *   npm run demo:seed    清空当前社区数据，写入游客、普通用户与管理员账号，以及留言、待审和举报样本
 *   npm run demo:reset   只清空社区数据，不写入任何样本
 *
 * 数据层与 server.js 保持一致：
 *   - 默认 SQLite（data/community.sqlite）
 *   - 设置 DATABASE_URL 或 DB_DRIVER=postgres 时使用 PostgreSQL
 *
 * 注意：seed 会删除现有留言、账号、登录会话与举报，请勿在正式环境运行。
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');

function loadEnvFile() {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  try {
    if (typeof process.loadEnvFile === 'function') process.loadEnvFile(file);
  } catch (err) {
    console.warn('读取 .env 失败，继续使用当前环境变量：' + err.message);
  }
}

loadEnvFile();

const { createStore } = require(path.join(root, 'lib/store.js'));
const { hashPassword, normalizeUsername, newUserId } = require(path.join(root, 'lib/accounts.js'));

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const DB_DRIVER = String(process.env.DB_DRIVER || (DATABASE_URL ? 'postgres' : 'sqlite')).toLowerCase();
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');
const COMMUNITY_DB = process.env.COMMUNITY_DB
  ? path.resolve(process.env.COMMUNITY_DB)
  : path.join(DATA_DIR, 'community.sqlite');

const DEMO_USERS = [
  {
    username: 'xiangyin',
    password: 'xiangyin2026',
    displayName: '乡音用户'
  },
  {
    username: 'guanli',
    password: 'guanli2026',
    displayName: '管理员'
  }
];

function now() {
  return Date.now();
}

function id(prefix) {
  return prefix + '-' + crypto.randomBytes(6).toString('hex');
}

function iso(offsetMs) {
  return new Date(now() - (offsetMs || 0)).toISOString();
}

async function openStore() {
  return createStore({
    driver: DB_DRIVER,
    connectionString: DATABASE_URL,
    dbFile: COMMUNITY_DB,
    maxPosts: 500
  });
}

async function reset(store) {
  if (typeof store.reset !== 'function') {
    throw new Error('当前数据层没有 reset()，请升级 lib/community-store.js 或 lib/postgres-store.js');
  }
  await store.reset();
}

async function seed(store) {
  await reset(store);

  const createdAt = now();
  const consentAt = createdAt;

  /* 三个角色：
   * - 游客：匿名留言，不创建账号
   * - 普通用户 xiangyin：可以登录、发帖、举报、导出与注销
   * - 管理员 guanli：账号用于演示登录；管理面板仍需 COMMUNITY_ADMIN_TOKEN
   */
  const accounts = {};
  for (const demo of DEMO_USERS) {
    const passwordHash = await hashPassword(demo.password);
    const user = await store.createUser({
      id: newUserId(),
      username: demo.username,
      usernameKey: normalizeUsername(demo.username),
      displayName: demo.displayName,
      passwordHash,
      createdAt,
      consentAt
    });
    accounts[demo.username] = user;
  }

  const guestPost = await store.create({
    id: id('demo-post'),
    board: 'beijing',
    province: '北京',
    name: '匿名乡音',
    type: 'dialect',
    text: '我是游客身份留的言：小时候胡同里一喊“吃了吗您呐”，整条巷子都有人应。现在回去，听见的还是这句，就是应的人少了。',
    createdAt: createdAt - 1000 * 60 * 32,
    ownerId: 'demo-guest-owner',
    consentAt
  });

  const userPost = await store.create({
    id: id('demo-post'),
    board: 'guangzhou',
    province: '广东',
    name: '乡音用户',
    type: 'dialect',
    text: '普通用户账号发的样本：得闲饮茶。四个字里有一整套慢慢坐下来的生活方式，希望它不要只剩下菜单上的一句翻译。',
    createdAt: createdAt - 1000 * 60 * 18,
    userId: accounts.xiangyin.id,
    consentAt
  });

  /* 待审样本：模拟命中关键词或人工转入待审 */
  await store.create({
    id: id('demo-post'),
    board: 'shanghai',
    province: '上海',
    name: '匿名乡音',
    type: 'dialect',
    text: '这是一条待审留言样本：内容本身没有敏感信息，仅用于演示管理员在待审队列中执行“公开 / 隐藏 / 删除”的流程。',
    createdAt: createdAt - 1000 * 60 * 9,
    ownerId: 'demo-pending-owner',
    consentAt,
    status: 'pending'
  });

  /* 举报样本：给普通用户可见留言加两条未处理举报，低于默认阈值 3 */
  await store.createReport({
    id: id('demo-report'),
    postId: userPost.id,
    reporterId: 'demo-reporter-a1',
    reason: '这是举报队列样本 A：演示举报原因、举报时间与处理按钮。',
    createdAt: createdAt - 1000 * 60 * 6
  });
  await store.createReport({
    id: id('demo-report'),
    postId: userPost.id,
    reporterId: 'demo-reporter-b2',
    reason: '这是举报队列样本 B：同一留言收到多条举报时，管理员可以逐条标记已处理或驳回。',
    createdAt: createdAt - 1000 * 60 * 4
  });

  /* 再放一条干净的公开留言，方便演示公开列表 */
  await store.create({
    id: id('demo-post'),
    board: 'meizhou',
    province: '广东',
    name: '匿名乡音',
    type: 'dialect',
    text: '公开列表样本：阿婆讲，山歌唔係唱畀人听，係唱畀山听。现在录音方便了，反而更要把人请出来唱。',
    createdAt: createdAt - 1000 * 60 * 2,
    ownerId: 'demo-meizhou-owner',
    consentAt
  });

  return {
    guestPostId: guestPost.id,
    userPostId: userPost.id,
    accounts
  };
}

async function main() {
  const command = (process.argv[2] || '').trim();
  if (command !== 'seed' && command !== 'reset') {
    console.error('用法：node scripts/demo-data.js <seed|reset>');
    process.exitCode = 1;
    return;
  }

  const store = await openStore();
  try {
    if (command === 'reset') {
      await reset(store);
      console.log('已清空社区数据（留言、点赞、账号、登录会话、举报与导入标记）。');
      console.log('数据库：' + (store.driver === 'postgres' ? 'PostgreSQL' : COMMUNITY_DB));
      return;
    }

    const result = await seed(store);
    console.log('演示数据已写入：');
    console.log('  数据库：' + (store.driver === 'postgres' ? 'PostgreSQL' : COMMUNITY_DB));
    console.log('  游客：无需登录，直接匿名发帖（公开列表已有游客留言）');
    console.log('  普通用户：xiangyin / xiangyin2026（显示名：乡音用户）');
    console.log('  管理员账号：guanli / guanli2026（显示名：管理员）');
    console.log('  待审样本：1 条（管理员面板可见）');
    console.log('  举报样本：2 条未处理举报（挂在普通用户的留言上）');
    console.log('  公开留言：3 条');
    console.log('  普通用户留言 ID：' + result.userPostId);
    console.log('');
    console.log('管理员面板还需要服务端令牌。请在启动服务时设置：');
    console.log('  COMMUNITY_ADMIN_TOKEN=demo-admin-token-2026 node server.js');
    console.log('然后在页面「管理员面板」中填入同一个令牌。');
    console.log('');
    console.log('演示结束后运行 npm run demo:reset 清空数据。');
  } finally {
    await store.close();
  }
}

main().catch((err) => {
  console.error('演示数据脚本失败：' + (err && err.stack ? err.stack : err));
  process.exitCode = 1;
});
