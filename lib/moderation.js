'use strict';

/* 轻量内容审核
 *
 * 只针对垃圾广告、诈骗、色情交易、违禁品等社区治理问题，不做观点审查。
 * 命中关键词或明显广告特征的留言不会直接拒绝，而是进入 pending 待审队列，
 * 由管理员在后台决定公开、隐藏还是删除——先发后审，避免正常用户被误伤。
 *
 * 环境变量：
 *   MODERATION_ENABLED=false   关闭关键词过滤（举报队列仍然可用）
 *   MODERATION_KEYWORDS=词1,词2  追加自定义关键词
 */

const DEFAULT_KEYWORDS = [
  '加微信', '加v信', '加vx', '加qq', '私聊', '扫码领取', '扫码加', '点击链接',
  '免费领取', '限时领取', '兼职日结', '高薪兼职', '网络兼职', '刷单', '刷信誉',
  '返利', '博彩', '赌场', '网络赌', '棋牌代理', '色情', '裸聊', '约炮', '一夜情',
  '迷药', '催情', '办证', '假证', '代开发票', '发票代开', '贷款秒批', '无抵押贷款',
  '套现', '洗钱', '传销', '非法集资', '枪支', '毒品', '出售账号', '回收账号',
  '微信转账', '支付宝转账', '银行卡号', '验证码发我', '外挂', '私服', '黑客',
  '木马', '钓鱼网站'
];

function compact(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[\s\u3000._\-*·|/\\'"“”‘’]+/g, '');
}

function parseKeywords(raw) {
  return String(raw || '')
    .split(/[,，;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createModerator(options) {
  const opts = options || {};
  const enabled = opts.enabled !== false;
  const extra = Array.isArray(opts.extraKeywords) ? opts.extraKeywords : [];
  const keywords = Array.from(new Set(DEFAULT_KEYWORDS.concat(extra).map(compact).filter(Boolean)));

  function check(text) {
    if (!enabled) return { ok: true, reason: '', matched: '' };
    const raw = String(text == null ? '' : text);
    const normalized = compact(raw);

    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return { ok: false, reason: '命中关键词「' + keyword + '」', matched: keyword };
      }
    }

    /* 明显广告特征：多个链接、手机号、连续重复字符堆砌 */
    const links = raw.match(/https?:\/\/|www\./gi) || [];
    if (links.length >= 2) {
      return { ok: false, reason: '包含多个外部链接', matched: 'links' };
    }
    if (/(?:^|[^\d])(?:\+?86[\s-]?)?1[3-9]\d(?:[\s-]?\d){8}(?:[^\d]|$)/.test(raw)) {
      return { ok: false, reason: '包含疑似手机号', matched: 'phone' };
    }
    if (/(.)\1{9,}/.test(raw)) {
      return { ok: false, reason: '重复字符过多', matched: 'repeat' };
    }

    return { ok: true, reason: '', matched: '' };
  }

  return {
    enabled: enabled,
    keywordCount: keywords.length,
    check: check
  };
}

module.exports = { createModerator, DEFAULT_KEYWORDS, parseKeywords };
