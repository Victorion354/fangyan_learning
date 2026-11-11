'use strict';

/* 邮件发送适配层
 *
 * 默认 console 模式只在服务端控制台打印邮件内容，适合本地开发；
 * 生产环境可配置 Resend 或 SendGrid 的 HTTPS API，无需额外依赖。
 *
 * 环境变量：
 *   MAIL_PROVIDER=console|resend|sendgrid|disabled
 *   MAIL_FROM=no-reply@example.com
 *   MAIL_FROM_NAME=一声一味
 *   RESEND_API_KEY=...
 *   SENDGRID_API_KEY=...
 *   MAIL_TIMEOUT_MS=10000
 */

function formatFrom(name, email) {
  const safeName = String(name || '').replace(/[\r\n"]/g, ' ').trim();
  return safeName ? safeName + ' <' + email + '>' : email;
}

function createMailer(options) {
  const opts = options || {};
  const configured = String(opts.provider || '').trim().toLowerCase();
  const resendApiKey = String(opts.resendApiKey || '').trim();
  const sendgridApiKey = String(opts.sendgridApiKey || '').trim();
  const from = String(opts.from || 'no-reply@localhost').trim();
  const fromName = String(opts.fromName || '一声一味').trim();
  const replyTo = String(opts.replyTo || '').trim();
  const timeoutMs = Math.min(30000, Math.max(1000, Number(opts.timeoutMs) || 10000));

  let provider = configured;
  let reason = '';
  if (!provider) {
    if (resendApiKey) provider = 'resend';
    else if (sendgridApiKey) provider = 'sendgrid';
    else provider = 'console';
  }
  if (provider === 'resend' && !resendApiKey) {
    reason = '缺少 RESEND_API_KEY';
    provider = 'disabled';
  } else if (provider === 'sendgrid' && !sendgridApiKey) {
    reason = '缺少 SENDGRID_API_KEY';
    provider = 'disabled';
  } else if (!['console', 'resend', 'sendgrid', 'disabled'].includes(provider)) {
    reason = '不支持的 MAIL_PROVIDER：' + provider;
    provider = 'disabled';
  }

  async function sendResend(message) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + resendApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: formatFrom(fromName, from),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html || undefined,
        reply_to: replyTo || undefined
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error('Resend 返回 ' + res.status + '：' + text.slice(0, 300));
    }
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) {}
    return { id: data.id || '', provider: 'resend' };
  }

  async function sendSendgrid(message) {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + sendgridApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: from, name: fromName },
        reply_to: replyTo ? { email: replyTo } : undefined,
        subject: message.subject,
        content: [
          { type: 'text/plain', value: message.text },
          ...(message.html ? [{ type: 'text/html', value: message.html }] : [])
        ]
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error('SendGrid 返回 ' + res.status + '：' + text.slice(0, 300));
    }
    return { id: res.headers.get('x-message-id') || '', provider: 'sendgrid' };
  }

  async function send(message) {
    const to = String(message && message.to || '').trim();
    if (!to) throw new Error('邮件收件人不能为空');
    if (provider === 'disabled') throw new Error('邮件服务未配置：' + (reason || 'MAIL_PROVIDER=disabled'));
    if (provider === 'console') {
      console.log('[mail:console] to=' + to + ' subject=' + message.subject + '\n' + message.text);
      return { id: 'console-' + Date.now().toString(36), provider: 'console' };
    }
    if (provider === 'resend') return sendResend(message);
    return sendSendgrid(message);
  }

  return {
    provider: provider,
    enabled: provider !== 'disabled',
    reason: reason,
    from: from,
    fromName: fromName,
    replyTo: replyTo,
    send: send
  };
}

module.exports = { createMailer };
