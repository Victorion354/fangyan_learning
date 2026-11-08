'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createStore } = require('../lib/store.js');
const { createRedis } = require('../lib/redis.js');
const { createObjectStore, audioExtension, derivePublicBase } = require('../lib/object-store.js');

test('默认创建 SQLite 数据层并可用', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fangyan-adapter-'));
  const store = await createStore({
    driver: 'sqlite',
    dbFile: path.join(dir, 'community.sqlite'),
    maxPosts: 10
  });
  try {
    assert.equal(store.driver, 'sqlite');
    assert.equal(await store.count(), 0);
    assert.deepEqual(await store.list(null, null), []);
  } finally {
    await store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('未配置 Redis 与对象存储时返回 null', async () => {
  assert.equal(await createRedis({ url: '' }), null);
  assert.equal(createObjectStore({}), null);
});

test('对象存储公开地址与音频扩展名推导', () => {
  assert.equal(
    derivePublicBase({ bucket: 'b', region: 'ap-east-1' }),
    'https://b.s3.ap-east-1.amazonaws.com'
  );
  assert.equal(
    derivePublicBase({ bucket: 'b', endpoint: 'http://minio:9000/' }),
    'http://minio:9000/b'
  );
  assert.equal(
    derivePublicBase({
      bucket: 'b',
      endpoint: 'http://minio:9000',
      publicBaseUrl: 'https://cdn.example.com/audio/'
    }),
    'https://cdn.example.com/audio'
  );
  assert.equal(audioExtension('audio/webm'), '.webm');
  assert.equal(audioExtension('audio/webm; codecs=opus'), '.webm');
  assert.equal(audioExtension('audio/mpeg'), '.mp3');
  assert.equal(audioExtension('text/plain'), '');
});
