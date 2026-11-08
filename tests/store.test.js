'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { CommunityStore } = require('../lib/community-store');

function makeStore(options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fangyan-store-'));
  const store = new CommunityStore({
    dbFile: path.join(dir, 'community.sqlite'),
    maxPosts: options.maxPosts || 500
  });
  return { dir, store };
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
}

function samplePost(id, overrides = {}) {
  return Object.assign({
    id,
    board: 'guangzhou',
    province: '广东省',
    name: '测试乡音',
    type: 'dialect',
    text: '测试留言 ' + id,
    audio: null,
    audioName: '',
    createdAt: Date.now(),
    replyTo: null,
    ownerId: 'client-owner-aaaaaa',
    deleteTokenHash: 'a'.repeat(64)
  }, overrides);
}

test('SQLite 存储支持创建、点赞、取消点赞与删除', () => {
  const { dir, store } = makeStore();
  try {
    const post = store.create(samplePost('p1'));
    assert.equal(post.id, 'p1');
    assert.equal(post.likes, 0);
    assert.equal(post.liked, false);
    assert.equal(post.mine, true);
    assert.equal(store.count(), 1);

    const list = store.list(null, 'client-owner-aaaaaa');
    assert.equal(list.length, 1);
    assert.equal(list[0].mine, true);
    assert.equal(list[0].deleteTokenHash, 'a'.repeat(64));

    const liked = store.setLike('p1', 'client-like-bbbbbb', true);
    assert.equal(liked.likes, 1);
    assert.equal(liked.liked, true);

    const again = store.setLike('p1', 'client-like-bbbbbb', true);
    assert.equal(again.likes, 1, '重复点赞不应增加计数');

    const unliked = store.setLike('p1', 'client-like-bbbbbb', false);
    assert.equal(unliked.likes, 0);
    assert.equal(unliked.liked, false);

    assert.equal(store.remove('p1'), true);
    assert.equal(store.count(), 0);
    assert.equal(store.remove('p1'), false);
  } finally {
    store.close();
    cleanup(dir);
  }
});

test('从旧 community.json 导入留言、点赞和删除令牌', () => {
  const { dir, store } = makeStore();
  try {
    const imported = store.importLegacy([
      {
        id: 'p-old-1',
        board: 'guangzhou',
        province: '广东省',
        name: '旧留言',
        type: 'dialect',
        text: '旧数据',
        likes: 3,
        likedBy: ['client-like-aaaaaa', 'client-like-bbbbbb'],
        createdAt: 1000,
        ownerId: 'client-owner-aaaaaa',
        deleteTokenHash: 'b'.repeat(64)
      },
      {
        id: 'p-old-2',
        board: 'beijing',
        province: '北京市',
        name: '匿名乡音',
        type: 'dialect',
        text: '只有总数没有点赞明细',
        likes: 2,
        likedBy: [],
        createdAt: 2000
      }
    ]);
    assert.equal(imported, 2);
    assert.equal(store.count(), 2);

    const list = store.list(null, 'client-like-aaaaaa');
    const first = list.find((p) => p.id === 'p-old-1');
    assert.ok(first);
    assert.equal(first.likes, 3, '旧点赞总数应保留');
    assert.equal(first.liked, true);
    assert.equal(first.mine, false);

    const second = list.find((p) => p.id === 'p-old-2');
    assert.ok(second);
    assert.equal(second.likes, 2, '没有点赞明细的旧计数应保留');
    assert.equal(second.liked, false);

    assert.equal(store.importLegacy([samplePost('p-new')]), 0, '重复导入应直接跳过');
    assert.equal(store.count(), 2);
  } finally {
    store.close();
    cleanup(dir);
  }
});

test('超过上限时裁剪最旧留言', () => {
  const { dir, store } = makeStore({ maxPosts: 3 });
  try {
    for (let i = 0; i < 5; i += 1) {
      store.create(samplePost('p' + i, { createdAt: i }));
    }
    const list = store.list(null, null);
    assert.equal(list.length, 3);
    assert.deepEqual(list.map((p) => p.id), ['p4', 'p3', 'p2']);
  } finally {
    store.close();
    cleanup(dir);
  }
});

test('关闭后重新打开仍保留数据', () => {
  const { dir, store } = makeStore();
  const dbFile = store.dbFile;
  let reopened = null;
  let primaryClosed = false;
  try {
    store.create(samplePost('p-persist'));
    store.close();
    primaryClosed = true;
    reopened = new CommunityStore({ dbFile, maxPosts: 500 });
    assert.equal(reopened.count(), 1);
    const post = reopened.get('p-persist', 'client-owner-aaaaaa');
    assert.equal(post.text, '测试留言 p-persist');
    assert.equal(post.mine, true);
  } finally {
    if (!primaryClosed) store.close();
    if (reopened) reopened.close();
    cleanup(dir);
  }
});
