/* 乡音社区 · 账号面板
 *
 * 用户名 + 密码登录；令牌保存在 localStorage，注销时同时通知服务端吊销。
 * 对社区脚本暴露 window.FANGYAN_ACCOUNT，供写入留言时附带 Authorization。
 */
(function () {
  var ACCOUNT_KEY = 'fangyan-account-v1';
  var state = null;
  var mode = 'login';
  var busy = false;

  function apiBase() {
    var c = window.FANGYAN_CONFIG || {};
    if (c.apiBase) return String(c.apiBase).replace(/\/$/, '');
    if (location.protocol === 'http:' || location.protocol === 'https:') return '';
    return 'http://localhost:8787';
  }

  function api(path) { return apiBase() + path; }

  function valid(session) {
    return !!(session &&
      typeof session.token === 'string' &&
      session.token.length > 20 &&
      Number(session.expiresAt) > Date.now() + 60000 &&
      session.user && typeof session.user.username === 'string');
  }

  function load() {
    try {
      var raw = localStorage.getItem(ACCOUNT_KEY);
      var obj = raw ? JSON.parse(raw) : null;
      return valid(obj) ? obj : null;
    } catch (e) { return null; }
  }

  function save(session) {
    state = session;
    try {
      if (session) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(session));
      else localStorage.removeItem(ACCOUNT_KEY);
    } catch (e) {}
  }

  function token() {
    if (!state) state = load();
    return valid(state) ? state.token : '';
  }

  function user() {
    if (!state) state = load();
    return valid(state) ? state.user : null;
  }

  function notify() {
    try {
      window.dispatchEvent(new CustomEvent('fangyan:account', {
        detail: { user: user(), token: token() }
      }));
    } catch (e) {}
  }

  function request(path, options) {
    var opts = Object.assign({}, options || {});
    opts.headers = Object.assign({}, opts.headers || {});
    opts.cache = 'no-store';
    var t = token();
    if (t) opts.headers.Authorization = 'Bearer ' + t;
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

  function setStatus(text, tone) {
    var el = document.getElementById('cm-account-status');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'cm-status' + (tone ? ' ' + tone : '');
  }

  function setMode(next) {
    mode = next;
    var form = document.getElementById('cm-account-form');
    if (!form) return;
    var register = mode === 'register';
    form.setAttribute('data-mode', mode);
    var submit = document.getElementById('cm-account-submit');
    var switcher = document.getElementById('cm-account-switch');
    var consent = document.getElementById('cm-account-consent-row');
    var display = document.getElementById('cm-account-display-row');
    if (submit) submit.textContent = register ? '注册并登录' : '登录';
    if (switcher) switcher.textContent = register ? '已有账号？去登录' : '没有账号？注册';
    if (consent) consent.hidden = !register;
    if (display) display.hidden = !register;
    setStatus('');
  }

  function openForm() {
    var form = document.getElementById('cm-account-form');
    if (!form) return;
    form.hidden = false;
    setMode(mode);
    var input = document.getElementById('cm-account-username');
    if (input) input.focus();
  }

  function closeForm() {
    var form = document.getElementById('cm-account-form');
    if (form) form.hidden = true;
    setStatus('');
  }

  function render() {
    var u = user();
    var badge = document.getElementById('cm-account-badge');
    var name = document.getElementById('cm-account-name');
    var note = document.getElementById('cm-account-note');
    var toggle = document.getElementById('cm-account-toggle');
    var exportBtn = document.getElementById('cm-account-export');
    var logoutBtn = document.getElementById('cm-account-logout');
    var deleteBtn = document.getElementById('cm-account-delete');
    if (!badge) return;

    if (u) {
      badge.textContent = '已登录';
      badge.className = 'cm-account-badge on';
      name.textContent = u.displayName || u.username;
      note.textContent = '@' + u.username + ' · 留言归属账号，可导出与注销';
      if (toggle) toggle.hidden = true;
      if (exportBtn) exportBtn.hidden = false;
      if (logoutBtn) logoutBtn.hidden = false;
      if (deleteBtn) deleteBtn.hidden = false;
      closeForm();
    } else {
      badge.textContent = '游客';
      badge.className = 'cm-account-badge';
      name.textContent = '未登录';
      note.textContent = '登录后留言归属账号；也可以继续匿名留言';
      if (toggle) toggle.hidden = false;
      if (exportBtn) exportBtn.hidden = true;
      if (logoutBtn) logoutBtn.hidden = true;
      if (deleteBtn) deleteBtn.hidden = true;
      closeDelete();
    }
  }

  function submit(event) {
    event.preventDefault();
    if (busy) return;
    var username = (document.getElementById('cm-account-username').value || '').trim();
    var password = document.getElementById('cm-account-password').value || '';
    var displayName = (document.getElementById('cm-account-display').value || '').trim();
    var consent = document.getElementById('cm-account-consent').checked;
    if (!username) { setStatus('请填写用户名'); return; }
    if (!password) { setStatus('请填写密码'); return; }
    if (mode === 'register' && !consent) { setStatus('注册前请勾选同意隐私政策'); return; }

    var submitBtn = document.getElementById('cm-account-submit');
    busy = true;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '请稍候…'; }
    setStatus('');

    var body = { username: username, password: password };
    if (mode === 'register') {
      body.consent = true;
      body.displayName = displayName;
    }
    fetch(api(mode === 'register' ? '/api/auth/register' : '/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
        return j;
      });
    }).then(function (j) {
      if (!j || !j.token || !j.user) throw new Error('登录响应无效');
      save({ token: j.token, expiresAt: Number(j.expiresAt) || 0, user: j.user });
      render();
      notify();
      document.getElementById('cm-account-password').value = '';
      toast(mode === 'register' ? '注册成功，已登录' : '已登录');
    }).catch(function (err) {
      setStatus((err && err.message) || '操作失败，请稍后重试');
    }).then(function () {
      busy = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'register' ? '注册并登录' : '登录';
      }
    });
  }

  function logout() {
    request('/api/auth/logout', { method: 'POST' }).catch(function () {}).then(function () {
      save(null);
      render();
      notify();
      toast('已退出登录');
    });
  }

  function exportData() {
    var exportBtn = document.getElementById('cm-account-export');
    if (exportBtn) exportBtn.disabled = true;
    request('/api/me/export').then(function (data) {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = 'fangyan-export-' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toast('已导出你的账号数据');
    }).catch(function (err) {
      toast((err && err.message) || '导出失败，请稍后重试');
    }).then(function () {
      if (exportBtn) exportBtn.disabled = false;
    });
  }

  function deleteStatus(text, tone) {
    var el = document.getElementById('cm-account-delete-status');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'cm-status' + (tone ? ' ' + tone : '');
  }

  function openDelete() {
    var form = document.getElementById('cm-account-form');
    if (form) form.hidden = true;
    setStatus('');
    var del = document.getElementById('cm-account-delete-form');
    if (!del) return;
    del.hidden = false;
    deleteStatus('');
    var input = document.getElementById('cm-account-delete-password');
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  function closeDelete() {
    var form = document.getElementById('cm-account-delete-form');
    if (form) form.hidden = true;
    var input = document.getElementById('cm-account-delete-password');
    if (input) input.value = '';
    deleteStatus('');
  }

  function deleteAccount(event) {
    if (event) event.preventDefault();
    if (busy) return;
    var input = document.getElementById('cm-account-delete-password');
    var password = input ? input.value : '';
    if (!password) { deleteStatus('请输入当前密码'); if (input) input.focus(); return; }

    var submitBtn = document.getElementById('cm-account-delete-submit');
    busy = true;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '注销中…'; }
    deleteStatus('');

    request('/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    }).then(function (j) {
      save(null);
      render();
      notify();
      closeDelete();
      toast('账号已注销，共删除 ' + (j.deletedPosts || 0) + ' 条留言');
    }).catch(function (err) {
      deleteStatus((err && err.message) || '注销失败，请稍后重试', 'bad');
    }).then(function () {
      busy = false;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '确认注销'; }
    });
  }

  function bind() {
    var toggle = document.getElementById('cm-account-toggle');
    var close = document.getElementById('cm-account-close');
    var form = document.getElementById('cm-account-form');
    var switcher = document.getElementById('cm-account-switch');
    var logoutBtn = document.getElementById('cm-account-logout');
    var exportBtn = document.getElementById('cm-account-export');
    var deleteBtn = document.getElementById('cm-account-delete');
    var deleteForm = document.getElementById('cm-account-delete-form');
    var deleteCancel = document.getElementById('cm-account-delete-cancel');
    var deleteCancel2 = document.getElementById('cm-account-delete-cancel-2');
    if (toggle) toggle.addEventListener('click', openForm);
    if (close) close.addEventListener('click', closeForm);
    if (form) form.addEventListener('submit', submit);
    if (switcher) switcher.addEventListener('click', function () {
      setMode(mode === 'register' ? 'login' : 'register');
    });
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (deleteBtn) deleteBtn.addEventListener('click', openDelete);
    if (deleteForm) deleteForm.addEventListener('submit', deleteAccount);
    if (deleteCancel) deleteCancel.addEventListener('click', closeDelete);
    if (deleteCancel2) deleteCancel2.addEventListener('click', closeDelete);
  }

  function init() {
    state = load();
    render();
    bind();
    if (!state) return;
    /* 后台校验本地令牌，只在服务端明确返回 401 时清除 */
    request('/api/auth/me').then(function (j) {
      if (j && j.user) {
        state.user = j.user;
        save(state);
        render();
        notify();
      }
    }).catch(function (err) {
      if (err && err.status === 401) {
        save(null);
        render();
        notify();
      }
    });
  }

  window.FANGYAN_ACCOUNT = {
    token: token,
    user: user
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
