/* 隐私政策 · 运营主体信息
 *
 * 真实主体名称、注册地址与专用邮箱由部署方通过 site-info.json 或环境变量提供。
 * 本脚本只负责把 /api/site-info 的公开字段填入页面；未配置或离线打开时保留
 * 页面原有的“上线前补充”提示，不生成任何虚构信息。
 */
(function () {
  'use strict';

  function apiBase() {
    var c = window.FANGYAN_CONFIG || {};
    if (c.apiBase) return String(c.apiBase).replace(/\/$/, '');
    if (location.protocol === 'http:' || location.protocol === 'https:') return '';
    return 'http://localhost:8787';
  }

  function setText(id, value, fallback) {
    var el = document.getElementById(id);
    if (!el) return;
    if (value) {
      el.textContent = value;
      el.classList.remove('site-missing');
    } else {
      el.textContent = fallback;
      el.classList.add('site-missing');
    }
  }

  function setEmail(id, value, fallback) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = '';
    if (!value) {
      el.textContent = fallback;
      el.classList.add('site-missing');
      return;
    }
    el.classList.remove('site-missing');
    var link = document.createElement('a');
    link.href = 'mailto:' + value;
    link.textContent = value;
    el.appendChild(link);
  }

  function apply(data) {
    if (!data || !data.fields) return;
    var f = data.fields;
    setText('site-operator-name', f.operatorName,
      '一声一味项目组（注册主体全称上线前补充）');
    setText('site-operator-address', f.operatorAddress, '上线前补充');
    setText('site-privacy-contact-name', f.privacyContactName,
      '可通过乡音社区的留言或举报入口联系项目组（联系人上线前补充）');
    setEmail('site-privacy-email', f.privacyEmail, '专用邮箱上线前补充');
    setText('site-data-region', f.dataRegion,
      '开发环境默认使用本机 SQLite；生产环境按部署配置确定，具体区域上线前补充');
    setText('site-complaint-contact', f.complaintContact,
      '社区留言与举报入口由管理员处理；专用投诉渠道上线前补充');
    setText('site-supervisor-contact', f.supervisorContact, '上线前补充');

    var warning = document.getElementById('site-config-warning');
    if (!warning) return;
    if (data.configured) {
      warning.textContent = '以上运营与联系信息由当前部署配置提供。如需行使数据权利或投诉，请通过上述邮箱或渠道联系。';
      warning.classList.remove('pp-warn');
      warning.classList.add('pp-ok');
    } else {
      warning.textContent = '在运营主体、注册地址、专用邮箱与合规审查完成前，本服务不面向公众正式运营。';
      warning.classList.remove('pp-ok');
      warning.classList.add('pp-warn');
    }
  }

  function init() {
    fetch(apiBase() + '/api/site-info', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(apply).catch(function () {
      /* 离线打开或静态托管时保留页面默认占位，不报错打扰读者 */
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
