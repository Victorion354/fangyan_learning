#!/usr/bin/env node
'use strict';

/* 自建 S3 兼容对象存储初始化脚本
 *
 * 用途：在本地 / 单机部署时创建语音桶、开放匿名读取、写入 CORS 规则。
 * 生产环境（AWS S3 / R2 / OSS）通常由云控制台完成同样的事，可以不跑这个脚本。
 *
 * 依赖可选包 @aws-sdk/client-s3（npm install 会按 optionalDependencies 安装）。
 *
 * 环境变量：
 *   S3_ENDPOINT           对象存储地址，例如 http://rustfs:9000
 *   S3_REGION             默认 us-east-1
 *   S3_BUCKET             桶名，例如 fangyan-audio
 *   S3_ACCESS_KEY_ID
 *   S3_SECRET_ACCESS_KEY
 *   S3_FORCE_PATH_STYLE   默认 true
 *   S3_CORS_ORIGINS       逗号分隔的允许来源，默认 http://localhost
 */

const { requireOptional } = require('../lib/optional.js');

const ENDPOINT = String(process.env.S3_ENDPOINT || '').trim();
const REGION = String(process.env.S3_REGION || 'us-east-1').trim();
const BUCKET = String(process.env.S3_BUCKET || '').trim();
const ACCESS_KEY = String(process.env.S3_ACCESS_KEY_ID || '').trim();
const SECRET_KEY = String(process.env.S3_SECRET_ACCESS_KEY || '').trim();
const FORCE_PATH_STYLE = String(process.env.S3_FORCE_PATH_STYLE || 'true').toLowerCase() !== 'false';
const CORS_ORIGINS = String(process.env.S3_CORS_ORIGINS || 'http://localhost')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const RETRIES = Math.max(1, Number(process.env.S3_INIT_RETRIES) || 30);
const RETRY_DELAY_MS = Math.max(200, Number(process.env.S3_INIT_RETRY_DELAY_MS) || 2000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
  console.error('对象存储初始化失败：' + message);
  process.exit(1);
}

function isMissingBucket(err) {
  const code = err && (err.name || err.Code || err.code);
  const status = err && err.$metadata && err.$metadata.httpStatusCode;
  return code === 'NoSuchBucket' || code === 'NotFound' || status === 404;
}

function isAlreadyExists(err) {
  const code = err && (err.name || err.Code || err.code);
  return code === 'BucketAlreadyOwnedByYou' || code === 'BucketAlreadyExists';
}

function publicReadPolicy(bucket) {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadForVoice',
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: ['arn:aws:s3:::' + bucket + '/*']
      }
    ]
  });
}

async function main() {
  if (!BUCKET) fail('缺少 S3_BUCKET');
  if (!ACCESS_KEY || !SECRET_KEY) fail('缺少 S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY');

  const sdk = requireOptional('@aws-sdk/client-s3');
  const client = new sdk.S3Client({
    region: REGION,
    endpoint: ENDPOINT || undefined,
    forcePathStyle: FORCE_PATH_STYLE,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY }
  });

  let ready = false;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      await client.send(new sdk.HeadBucketCommand({ Bucket: BUCKET }));
      ready = true;
      console.log('桶已存在：' + BUCKET);
      break;
    } catch (err) {
      if (isMissingBucket(err)) {
        ready = true;
        break;
      }
      if (attempt === RETRIES) {
        fail('无法连接 ' + (ENDPOINT || '默认 S3 端点') + '：' + (err && err.message));
      }
      await sleep(RETRY_DELAY_MS);
    }
  }
  if (!ready) fail('对象存储未就绪');

  try {
    await client.send(new sdk.CreateBucketCommand({ Bucket: BUCKET }));
    console.log('已创建桶：' + BUCKET);
  } catch (err) {
    if (!isAlreadyExists(err)) fail('创建桶失败：' + (err && err.message));
  }

  try {
    await client.send(new sdk.PutBucketPolicyCommand({
      Bucket: BUCKET,
      Policy: publicReadPolicy(BUCKET)
    }));
    console.log('已设置匿名读取策略');
  } catch (err) {
    console.warn('设置桶策略失败（语音将无法匿名播放）：' + (err && err.message));
  }

  try {
    await client.send(new sdk.PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: CORS_ORIGINS,
            AllowedMethods: ['GET', 'HEAD', 'PUT'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600
          }
        ]
      }
    }));
    console.log('已写入 CORS：' + CORS_ORIGINS.join(', '));
  } catch (err) {
    console.warn('写入桶 CORS 失败（可能需要用服务端环境变量配置）：' + (err && err.message));
  }

  client.destroy();
  console.log('对象存储初始化完成');
}

main().catch((err) => fail((err && err.message) || String(err)));
