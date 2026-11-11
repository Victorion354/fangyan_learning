#!/usr/bin/env node
'use strict';

/* 邮件服务连通性测试
 *
 *   npm run mail:test -- you@example.com
 *
 * 读取 .env 与当前环境变量，使用与 server.js 相同的邮件适配层发送一封测试邮件。
 * console 模式不会真实发信，只把内容打印到控制台；生产环境请配置 resend 或 sendgrid。
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn('读取 .env 失败，继续使用当前环境变量：' + err.message);
  }
}

const { createMailer } = require(path.join(root, 'lib/mailer.js'));
const { normalizeEmail, validEmail } = require(path.join(root, 'lib/accounts.js'));

const args = process.argv.slice(2).filter((item) => !item.startsWith('--'));
const to = normalizeEmail(args[0] || process.env.MAIL_TEST_TO || '');

if (!validEmail(to)) {
  console.error('用法：npm run mail:test -- you@example.com');
  console.error('也可以设置 MAIL_TEST_TO 环境变量。');
  process.exit(1);
}

const mailer = createMailer({
  provider: process.env.MAIL_PROVIDER,
  from: process.env.MAIL_FROM || 'no-reply@localhost',
  fromName: process.env.MAIL_FROM_NAME || '一声一味',
  replyTo: process.env.MAIL_REPLY_TO,
  resendApiKey: process.env.RESEND_API_KEY,
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  timeoutMs: process.env.MAIL_TIMEOUT_MS
});

console.log('邮件服务：' + mailer.provider + (mailer.enabled ? '' : '（' + (mailer.reason || '未启用') + '）'));
console.log('发件人：' + mailer.from + (mailer.replyTo ? ' / 回复至 ' + mailer.replyTo : ''));
if (mailer.provider === 'console') {
  console.log('提示：console 模式不会真实发信，只把邮件内容打印到控制台。');
}

const sentAt = new Date().toISOString();
mailer.send({
  to: to,
  subject: '一声一味 · 邮件服务测试',
  text: [
    '这是一封来自一声一味部署环境的测试邮件。',
    '',
    '发送时间：' + sentAt,
    '邮件服务：' + mailer.provider,
    '',
    '收到这封邮件说明当前部署的邮件配置可以正常发信。'
  ].join('\n'),
  html: '<p>这是一封来自一声一味部署环境的测试邮件。</p>' +
    '<p>发送时间：' + sentAt + '<br>邮件服务：' + mailer.provider + '</p>' +
    '<p>收到这封邮件说明当前部署的邮件配置可以正常发信。</p>'
}).then((result) => {
  console.log('已提交发送：' + (result.id || '(服务商未返回编号)'));
  if (mailer.provider === 'console') {
    console.log('请配置 MAIL_PROVIDER=resend 或 sendgrid 后重新测试真实投递。');
  }
}).catch((err) => {
  console.error('发送失败：' + err.message);
  process.exitCode = 1;
});
