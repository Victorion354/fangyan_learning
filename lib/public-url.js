'use strict';

/* 生成邮件链接等对外地址。
 *
 * 只有显式配置 PUBLIC_BASE_URL，或显式声明位于可信反向代理之后
 * （TRUST_PROXY=true），才使用转发头。否则使用请求自身的 Host，
 * 避免攻击者伪造 X-Forwarded-Host 把密码重置链接指向自己的域名。
 */

const HOST_RE = /^[A-Za-z0-9.\-:\[\]]{1,255}$/;

function resolvePublicBaseUrl(options) {
  const opts = options || {};
  if (opts.publicBaseUrl) return opts.publicBaseUrl;

  const trustProxy = opts.trustProxy === true;
  const forwardedProto = trustProxy
    ? String(opts.forwardedProto || '').split(',')[0].trim()
    : '';
  const proto = forwardedProto === 'https' || forwardedProto === 'http'
    ? forwardedProto
    : (opts.encrypted ? 'https' : 'http');

  const rawHost = String(
    (trustProxy ? opts.forwardedHost : '') || opts.host || ''
  ).split(',')[0].trim();
  const host = HOST_RE.test(rawHost) ? rawHost : 'localhost:' + (opts.port || 8787);
  return proto + '://' + host;
}

module.exports = { resolvePublicBaseUrl };
