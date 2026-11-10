/* 乡音社区 · 管理员面板
 *
 * 管理员令牌只保存在 sessionStorage，关闭标签页即失效。
 * 提供待审队列、举报队列与全部留言的公开/隐藏/删除操作。
 */
(function () {
  var TOKEN_KEY = 'fangyan-admin-token-v1';
  var tab = 'pending';
  var loaded = false;

  function apiBase() {
    var c = window.FANGYAN_CONFIG || {};
    if (c.apiBase) return String(c.apiBase).replace(/\/$/, '');
    if (location.protocol === 'http:' || location.protocol === 'https:') return '';
    return 'http://localhost:8787';
  }

  function api(path) { return apiBase() + path; }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function time(ts) {
    var diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    var d = new Date(ts);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function adminToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  function setToken(value) {
    try {
      if (value) sessionStorage.setItem(TOKEN_KEY, value);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function status(text, tone) {
    var el = document.getElementById('cm-admin-status');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'cm-status' + (tone ? ' ' + tone : '');
  }

  function adminFetch(path, options) {
    var opts = Object.assign({}, options || {});
    opts.headers = Object.assign({}, opts.headers || {});
    opts.headers['X-Admin-Token'] = adminToken();
    opts.cache = 'no-store';
    return fetch(api(path), opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var err = new Error((j && j.error) || ('HTTP ' + r.status));
          err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  }

  function showTokenBox(show) {
    var box = document.getElementById('cm-admin-token-box');
    var body = document.getElementById('cm-admin-body');
    if (box) box.hidden = !show;
    if (body) body.hidden = show;
  }

  function openPanel() {
    var panel = document.getElementById('cm-admin');
    if (!panel) return;
    panel.hidden = false;
    if (adminToken()) {
      showTokenBox(false);
      refresh();
    } else {
      showTokenBox(true);
      var input = document.getElementById('cm-admin-token');
      if (input) input.focus();
    }
  }

  function closePanel() {
    var panel = document.getElementById('cm-admin');
    if (panel) panel.hidden = true;
  }

  function renderStats(overview) {
    var el = document.getElementById('cm-admin-stats');
    if (!el) return;
    var by = overview.byStatus || {};
    el.innerHTML =
      '<span><b>' + (overview.users || 0) + '</b> 用户</span>' +
      '<span><b>' + (overview.posts || 0) + '</b> 留言</span>' +
      '<span><b>' + (by.pending || 0) + '</b> 待审</span>' +
      '<span><b>' + (by.hidden || 0) + '</b> 隐藏</span>' +
      '<span><b>' + (overview.openReports || 0) + '</b> 未处理举报</span>';
  }

  function postCard(post) {
    var labels = { visible: '公开', pending: '待审', hidden: '已隐藏', removed: '已移除' };
    var label = labels[post.status] || post.status;
    var actions = '';
    if (post.status !== 'visible') {
      actions += '<button type="button" data-admin-action="visible" data-id="' + esc(post.id) + '">公开</button>';
    }
    if (post.status !== 'hidden') {
      actions += '<button type="button" data-admin-action="hidden" data-id="' + esc(post.id) + '">隐藏</button>';
    }
    actions += '<button type="button" class="danger" data-admin-delete="' + esc(post.id) + '">删除</button>';
    return '<article class="cm-admin-item">' +
      '<div class="cm-admin-item-head">' +
      '<span class="cm-admin-tag ' + esc(post.status) + '">' + esc(label) + '</span>' +
      '<b>' + esc(post.name || '匿名乡音') + '</b>' +
      '<span class="cm-admin-meta">' + esc(post.board) + ' · ' + time(post.createdAt) +
      (post.reportCount ? ' · ' + post.reportCount + ' 条举报' : '') + '</span>' +
      '</div>' +
      '<p class="cm-admin-text">' + esc(post.text) + '</p>' +
      '<div class="cm-admin-actions">' + actions + '</div>' +
      '</article>';
  }

  function renderPosts(posts) {
    var el = document.getElementById('cm-admin-list');
    if (!el) return;
    if (!posts.length) {
      el.innerHTML = '<div class="cm-admin-empty">这个队列是空的。</div>';
      return;
    }
    el.innerHTML = posts.map(postCard).join('');
  }

  function reportCard(report) {
    var post = report.post || {};
    return '<article class="cm-admin-item">' +
      '<div class="cm-admin-item-head">' +
      '<span class="cm-admin-tag open">举报</span>' +
      '<b>' + esc(post.name || '匿名乡音') + '</b>' +
      '<span class="cm-admin-meta">' + time(report.createdAt) + '</span>' +
      '</div>' +
      '<p class="cm-admin-text">' + esc(post.text || '（留言已删除）') + '</p>' +
      '<p class="cm-admin-reason">原因：' + esc(report.reason || '未填写') + '</p>' +
      '<div class="cm-admin-actions">' +
      '<button type="button" data-report-resolve="' + esc(report.id) + '">处理并隐藏留言</button>' +
      '<button type="button" data-report-dismiss="' + esc(report.id) + '">忽略举报</button>' +
      '</div></article>';
  }

  function renderReports(reports) {
    var el = document.getElementById('cm-admin-list');
    if (!el) return;
    if (!reports.length) {
      el.innerHTML = '<div class="cm-admin-empty">没有未处理的举报。</div>';
      return;
    }
    el.innerHTML = reports.map(reportCard).join('');
  }

  var ACTION_LABELS = {
    'admin.login': '管理员登录',
    'post.status': '修改留言状态',
    'post.delete': '删除留言',
    'report.resolve': '处理举报',
    'report.dismiss': '忽略举报',
    'audit.export': '导出审计日志'
  };

  function auditCard(log) {
    var detail = '';
    if (log.detail) {
      try { detail = JSON.stringify(JSON.parse(log.detail)); } catch (e) { detail = log.detail; }
    }
    return '<article class="cm-audit-item">' +
      '<div class="cm-audit-item-head">' +
      '<span class="cm-admin-tag pending">' + esc(ACTION_LABELS[log.action] || log.action) + '</span>' +
      '<b>' + esc(log.actorLabel || '管理员') + '</b>' +
      '<span class="cm-admin-meta">' + esc(new Date(log.createdAt).toLocaleString()) + '</span>' +
      '</div>' +
      '<div class="cm-audit-detail">' +
      (log.targetType || log.targetId
        ? '目标：' + esc(log.targetType || '—') + ' / ' + esc(log.targetId || '—') + '<br>'
        : '') +
      'IP：' + esc(log.ip || '—') + ' · UA：' + esc(log.userAgent || '—') +
      (detail ? '<br>详情：' + esc(detail) : '') +
      '</div></article>';
  }

  function renderAudit(logs) {
    var el = document.getElementById('cm-admin-list');
    if (!el) return;
    if (!logs.length) {
      el.innerHTML = '<div class="cm-admin-empty">还没有审计记录。管理员登录、修改留言状态、删除留言、处理举报或导出日志后会出现在这里。</div>';
      return;
    }
    el.innerHTML = logs.map(auditCard).join('');
  }

  function markTab(next) {
    tab = next;
    Array.prototype.forEach.call(document.querySelectorAll('.cm-admin-tab'), function (btn) {
      var on = btn.getAttribute('data-admin-tab') === next;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var bar = document.getElementById('cm-admin-audit-bar');
    var note = document.getElementById('cm-admin-audit-note');
    if (bar) bar.hidden = next !== 'audit';
    if (note) note.hidden = next !== 'audit';
  }

  function refresh() {
    if (!adminToken()) {
      showTokenBox(true);
      return Promise.resolve();
    }
    status('正在加载…');
    var overview = adminFetch('/api/admin/overview');
    var list;
    if (tab === 'audit') {
      var action = document.getElementById('cm-admin-audit-action');
      var actionValue = action ? action.value : '';
      list = adminFetch('/api/admin/audit?limit=100' +
        (actionValue ? '&action=' + encodeURIComponent(actionValue) : ''));
    } else if (tab === 'reports') {
      list = adminFetch('/api/admin/reports?status=open');
    } else {
      list = adminFetch('/api/admin/posts?status=' + (tab === 'all' ? 'all' : 'pending'));
    }
    return Promise.all([overview, list]).then(function (results) {
      loaded = true;
      showTokenBox(false);
      renderStats(results[0]);
      if (tab === 'audit') renderAudit(results[1].logs || []);
      else if (tab === 'reports') renderReports(results[1].reports || []);
      else renderPosts(results[1].posts || []);
      status('');
    }).catch(function (err) {
      if (err && (err.status === 403 || err.status === 503)) {
        setToken('');
        showTokenBox(true);
        status((err.message || '管理员令牌无效') + '，请重新输入', 'bad');
      } else {
        status((err && err.message) || '加载失败，请稍后重试', 'bad');
      }
    });
  }

  function enter() {
    var input = document.getElementById('cm-admin-token');
    var value = input ? input.value.trim() : '';
    if (!value) {
      if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
      status('请输入管理员令牌', 'bad');
      return;
    }
    if (input) input.removeAttribute('aria-invalid');
    setToken(value);
    if (input) input.value = '';
    status('正在验证令牌…');
    adminFetch('/api/admin/session', { method: 'POST' }).then(function () {
      markTab('pending');
      refresh();
    }).catch(function (err) {
      setToken('');
      showTokenBox(true);
      status((err && err.message) || '管理员令牌无效', 'bad');
    });
  }

  function act(path, options, done) {
    return adminFetch(path, options).then(function () {
      if (typeof done === 'function') done();
      status('操作已生效');
      refresh();
      try { window.dispatchEvent(new CustomEvent('fangyan:community-refresh')); } catch (e) {}
    }).catch(function (err) {
      status((err && err.message) || '操作失败，请稍后重试', 'bad');
    });
  }

  function downloadAudit(format) {
    if (!adminToken()) return;
    status('正在导出…');
    var url = api('/api/admin/audit/export?format=' + encodeURIComponent(format));
    fetch(url, {
      headers: { 'X-Admin-Token': adminToken() },
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          throw new Error((j && j.error) || ('HTTP ' + r.status));
        });
      }
      return r.blob().then(function (blob) {
        var stamp = new Date().toISOString().slice(0, 10);
        var objectUrl = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = objectUrl;
        a.download = 'fangyan-audit-' + stamp + '.' + (format === 'json' ? 'json' : 'csv');
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 2000);
        status('审计日志已导出');
        if (tab === 'audit') refresh();
      });
    }).catch(function (err) {
      status((err && err.message) || '导出失败，请稍后重试', 'bad');
    });
  }

  function bind() {
    var toggle = document.getElementById('cm-admin-toggle');
    var close = document.getElementById('cm-admin-close');
    var enterBtn = document.getElementById('cm-admin-enter');
    var tokenInput = document.getElementById('cm-admin-token');
    var list = document.getElementById('cm-admin-list');
    var auditAction = document.getElementById('cm-admin-audit-action');
    var auditRefresh = document.getElementById('cm-admin-audit-refresh');
    var auditCsv = document.getElementById('cm-admin-audit-csv');
    var auditJson = document.getElementById('cm-admin-audit-json');
    if (toggle) toggle.addEventListener('click', openPanel);
    if (close) close.addEventListener('click', closePanel);
    if (enterBtn) enterBtn.addEventListener('click', enter);
    if (tokenInput) {
      tokenInput.addEventListener('input', function () { tokenInput.removeAttribute('aria-invalid'); });
      tokenInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); enter(); }
      });
    }
    Array.prototype.forEach.call(document.querySelectorAll('.cm-admin-tab'), function (btn) {
      btn.addEventListener('click', function () {
        markTab(btn.getAttribute('data-admin-tab'));
        refresh();
      });
    });
    if (auditAction) auditAction.addEventListener('change', function () { if (tab === 'audit') refresh(); });
    if (auditRefresh) auditRefresh.addEventListener('click', function () { if (tab === 'audit') refresh(); });
    if (auditCsv) auditCsv.addEventListener('click', function () { downloadAudit('csv'); });
    if (auditJson) auditJson.addEventListener('click', function () { downloadAudit('json'); });
    if (!list) return;
    list.addEventListener('click', function (e) {
      var action = e.target.closest('[data-admin-action]');
      if (action) {
        var id = action.getAttribute('data-id');
        var next = action.getAttribute('data-admin-action');
        act('/api/admin/posts/' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next })
        });
        return;
      }
      var del = e.target.closest('[data-admin-delete]');
      if (del) {
        var delId = del.getAttribute('data-admin-delete');
        if (!window.confirm('确定删除这条留言？删除后无法恢复。')) return;
        act('/api/community/' + encodeURIComponent(delId), { method: 'DELETE' });
        return;
      }
      var resolve = e.target.closest('[data-report-resolve]');
      if (resolve) {
        act('/api/admin/reports/' + encodeURIComponent(resolve.getAttribute('data-report-resolve')), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resolve', hidePost: true })
        });
        return;
      }
      var dismiss = e.target.closest('[data-report-dismiss]');
      if (dismiss) {
        act('/api/admin/reports/' + encodeURIComponent(dismiss.getAttribute('data-report-dismiss')), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'dismiss' })
        });
      }
    });
  }

  function init() {
    bind();
    if (adminToken()) {
      var panel = document.getElementById('cm-admin');
      if (panel && !panel.hidden) refresh();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
