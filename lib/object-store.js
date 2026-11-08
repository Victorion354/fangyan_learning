'use strict';

/* S3 兼容对象存储适配层
 *
 * 生产环境使用预签名 PUT，让浏览器把语音直接上传到对象存储，
 * 避免音频经过 Node 进程。开发环境不配置 S3_BUCKET 时返回 null，
 * 社区继续使用内联 data URI，保持零依赖。
 */

const { requireOptional } = require('./optional.js');

const AUDIO_EXTENSIONS = {
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav'
};

function audioExtension(contentType) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  return AUDIO_EXTENSIONS[type] || '';
}

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function derivePublicBase(options) {
  const explicit = trimSlash(options.publicBaseUrl);
  if (explicit) return explicit;
  const bucket = options.bucket;
  const endpoint = trimSlash(options.endpoint);
  if (endpoint) return endpoint + '/' + bucket;
  const region = options.region || 'us-east-1';
  return 'https://' + bucket + '.s3.' + region + '.amazonaws.com';
}

function encodeKey(key) {
  return String(key).split('/').map(encodeURIComponent).join('/');
}

function createObjectStore(options) {
  const bucket = String((options && options.bucket) || '').trim();
  if (!bucket) return null;

  let sdk;
  let presigner;
  try {
    sdk = requireOptional('@aws-sdk/client-s3');
    presigner = requireOptional('@aws-sdk/s3-request-presigner');
  } catch (err) {
    err.message = '已配置 S3_BUCKET，但' + err.message;
    throw err;
  }

  const region = String((options && options.region) || 'us-east-1');
  const endpoint = trimSlash(options.endpoint);
  /* 预签名 URL 要给浏览器用，必须指向浏览器可达的地址。
   * 自建对象存储常出现「服务端用内网域名、浏览器用公网域名」的情况，
   * 所以签名客户端可以和内部客户端使用不同端点。 */
  const publicEndpoint = trimSlash(options.publicEndpoint) || endpoint;
  const forcePathStyle = options.forcePathStyle !== false && !!endpoint;
  const accessKeyId = String(options.accessKeyId || '');
  const secretAccessKey = String(options.secretAccessKey || '');
  const publicBase = derivePublicBase({
    bucket: bucket,
    endpoint: endpoint,
    region: region,
    publicBaseUrl: options.publicBaseUrl
  });

  const clientOptions = {
    region: region,
    forcePathStyle: forcePathStyle,
    credentials: accessKeyId && secretAccessKey
      ? { accessKeyId: accessKeyId, secretAccessKey: secretAccessKey }
      : undefined
  };

  const client = new sdk.S3Client(Object.assign({}, clientOptions, {
    endpoint: endpoint || undefined
  }));
  const signClient = publicEndpoint === endpoint
    ? client
    : new sdk.S3Client(Object.assign({}, clientOptions, {
      endpoint: publicEndpoint,
      forcePathStyle: true
    }));

  return {
    driver: 's3',
    bucket: bucket,
    publicBase: publicBase,
    publicUrl(key) {
      return publicBase + '/' + encodeKey(key);
    },
    async signUpload(input) {
      const contentType = input.contentType;
      const command = new sdk.PutObjectCommand({
        Bucket: bucket,
        Key: input.key,
        ContentType: contentType
      });
      const url = await presigner.getSignedUrl(signClient, command, { expiresIn: input.expiresIn });
      return {
        url: url,
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        expiresAt: Date.now() + input.expiresIn * 1000
      };
    },
    async remove(key) {
      if (!key) return;
      await client.send(new sdk.DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    close() {
      try { client.destroy(); } catch (_) {}
      if (signClient !== client) {
        try { signClient.destroy(); } catch (_) {}
      }
    }
  };
}

module.exports = {
  createObjectStore,
  audioExtension,
  derivePublicBase,
  AUDIO_EXTENSIONS
};
