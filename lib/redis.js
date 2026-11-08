'use strict';

/* Redis 适配层（可选）
 *
 * 只负责两件事：
 *   1. 跨实例限流（INCR + PEXPIRE，Lua 保证原子性）
 *   2. 跨实例 SSE 广播（PUBLISH / SUBSCRIBE）
 *
 * 未配置 REDIS_URL 时返回 null，服务回退到单实例内存限流。
 */

const { requireOptional } = require('./optional.js');

const RATE_SCRIPT = [
  "local c = redis.call('INCR', KEYS[1])",
  "if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  'return c'
].join('\n');

async function createRedis(options) {
  const url = String((options && options.url) || '').trim();
  if (!url) return null;

  const channel = (options && options.channel) || 'fangyan:community:refresh';
  const logger = (options && options.logger) || console;
  const { createClient } = requireOptional('redis');

  const client = createClient({ url: url });
  const subscriber = client.duplicate();
  const handlers = [];

  client.on('error', (err) => logger.warn('Redis 客户端错误：' + err.message));
  subscriber.on('error', (err) => logger.warn('Redis 订阅错误：' + err.message));

  await client.connect();
  await subscriber.connect();
  await subscriber.subscribe(channel, (message) => {
    let parsed;
    try {
      parsed = JSON.parse(message);
    } catch (_) {
      return;
    }
    for (const handler of handlers) {
      try { handler(parsed); } catch (_) {}
    }
  });

  return {
    driver: 'redis',
    async hit(key, max, windowMs) {
      const count = Number(await client.eval(RATE_SCRIPT, {
        keys: [key],
        arguments: [String(windowMs)]
      }));
      if (count <= max) return { allowed: true, count: count };
      const ttl = await client.pTTL(key);
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((ttl > 0 ? ttl : windowMs) / 1000))
      };
    },
    async publish(event, payload) {
      await client.publish(channel, JSON.stringify({ event: event, payload: payload }));
    },
    onMessage(handler) {
      if (typeof handler === 'function') handlers.push(handler);
    },
    async close() {
      try { await subscriber.unsubscribe(channel); } catch (_) {}
      try { subscriber.disconnect(); } catch (_) {}
      try { await client.quit(); } catch (_) {
        try { client.disconnect(); } catch (_) {}
      }
    }
  };
}

module.exports = { createRedis };
