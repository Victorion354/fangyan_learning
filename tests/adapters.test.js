'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createStore } = require('../lib/store.js');
const { createRedis } = require('../lib/redis.js');
const { createObjectStore, audioExtension, derivePublicBase } = require('../lib/object-store.js');
const { loadSiteInfo } = require('../lib/site-info.js');
const { createMailer } = require('../lib/mailer.js');

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

test('运营主体信息从带 BOM 的 JSON 读取并由环境变量覆盖', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fangyan-site-'));
  const file = path.join(dir, 'site-info.json');
  try {
    fs.writeFileSync(file, '\uFEFF' + JSON.stringify({
      operatorName: '示例主体',
      operatorAddress: '示例地址',
      privacyEmail: 'Privacy@Example.com',
      privacyContactName: '隐私联系人',
      complaintContact: '投诉渠道',
      supervisorContact: '监管渠道',
      dataRegion: '中国境内'
    }), 'utf8');

    const fromFile = loadSiteInfo({ root: dir, env: {} });
    assert.equal(fromFile.configured, true);
    assert.equal(fromFile.fields.operatorName, '示例主体');
    assert.equal(fromFile.fields.privacyEmail, 'privacy@example.com', '邮箱应统一小写');
    assert.equal(fromFile.fields.dataRegion, '中国境内');

    const fromEnv = loadSiteInfo({
      root: dir,
      env: {
        OPERATOR_NAME: '环境变量主体',
        PRIVACY_EMAIL: 'privacy@example.org',
        DATA_REGION: '境外区域'
      }
    });
    assert.equal(fromEnv.fields.operatorName, '环境变量主体');
    assert.equal(fromEnv.fields.privacyEmail, 'privacy@example.org');
    assert.equal(fromEnv.fields.dataRegion, '境外区域');
    assert.equal(fromEnv.fields.operatorAddress, '示例地址', '未覆盖的字段仍读取 JSON');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('运营主体信息缺失或邮箱非法时标记为未配置', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fangyan-site-'));
  try {
    const empty = loadSiteInfo({ root: dir, env: {} });
    assert.equal(empty.configured, false);
    assert.deepEqual(empty.missing.sort(), ['operatorAddress', 'operatorName', 'privacyEmail']);

    const invalid = loadSiteInfo({
      root: dir,
      env: {
        OPERATOR_NAME: '主体',
        OPERATOR_ADDRESS: '地址',
        PRIVACY_EMAIL: 'not-an-email'
      }
    });
    assert.equal(invalid.configured, false);
    assert.ok(invalid.missing.includes('privacyEmail'));

    const valid = loadSiteInfo({
      root: dir,
      env: {
        OPERATOR_NAME: '主体',
        OPERATOR_ADDRESS: '地址',
        PRIVACY_EMAIL: 'privacy@example.com'
      }
    });
    assert.equal(valid.configured, true);
    assert.deepEqual(valid.missing, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('邮件适配层按配置选择服务商并报告缺失密钥', () => {
  assert.equal(createMailer({ provider: '' }).provider, 'console');
  assert.equal(createMailer({ provider: '' }).enabled, true);

  const missingResend = createMailer({ provider: 'resend' });
  assert.equal(missingResend.provider, 'disabled');
  assert.equal(missingResend.enabled, false);
  assert.match(missingResend.reason, /RESEND_API_KEY/);

  const missingSendgrid = createMailer({ provider: 'sendgrid' });
  assert.equal(missingSendgrid.provider, 'disabled');
  assert.match(missingSendgrid.reason, /SENDGRID_API_KEY/);

  const resend = createMailer({ provider: 'resend', resendApiKey: 'k', replyTo: 'reply@example.com' });
  assert.equal(resend.provider, 'resend');
  assert.equal(resend.enabled, true);
  assert.equal(resend.replyTo, 'reply@example.com');

  const sendgrid = createMailer({ provider: 'sendgrid', sendgridApiKey: 'k' });
  assert.equal(sendgrid.provider, 'sendgrid');
  assert.equal(sendgrid.enabled, true);

  const unknown = createMailer({ provider: 'smtp' });
  assert.equal(unknown.provider, 'disabled');
  assert.match(unknown.reason, /不支持的 MAIL_PROVIDER/);
});
