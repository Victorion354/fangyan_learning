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

  function markInvalid(el, on) {
    if (!el) return;
    if (on) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
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
    var emailRow = document.getElementById('cm-account-email-row');
    var forgot = document.getElementById('cm-account-forgot');
    if (submit) submit.textContent = register ? '注册并登录' : '登录';
    if (switcher) switcher.textContent = register ? '已有账号？去登录' : '没有账号？注册';
    if (consent) consent.hidden = !register;
    if (display) display.hidden = !register;
    if (emailRow) emailRow.hidden = !register;
    if (forgot) forgot.hidden = register;
    setStatus('');
  }

  function openForm() {
    var form = document.getElementById('cm-account-form');
    if (!form) return;
    closeForgot();
    closeReset();
    form.hidden = false;
    setMode(mode);
    markInvalid(document.getElementById('cm-account-username'), false);
    markInvalid(document.getElementById('cm-account-password'), false);
    markInvalid(document.getElementById('cm-account-consent'), false);
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
    var resendBtn = document.getElementById('cm-account-resend');
    var exportBtn = document.getElementById('cm-account-export');
    var logoutBtn = document.getElementById('cm-account-logout');
    var deleteBtn = document.getElementById('cm-account-delete');
    if (!badge) return;

    if (u) {
      badge.textContent = '已登录';
      badge.className = 'cm-account-badge on';
      name.textContent = u.displayName || u.username;
      if (u.email) {
        note.textContent = '@' + u.username + ' · ' +
          (u.emailVerified ? '邮箱已验证' : '邮箱待验证') + ' · ' + u.email;
      } else {
        note.textContent = '@' + u.username + ' · 留言归属账号，可导出与注销';
      }
      if (toggle) toggle.hidden = true;
      if (resendBtn) resendBtn.hidden = !(u.email && !u.emailVerified);
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
      if (resendBtn) resendBtn.hidden = true;
      if (exportBtn) exportBtn.hidden = true;
      if (logoutBtn) logoutBtn.hidden = true;
      if (deleteBtn) deleteBtn.hidden = true;
      closeDelete();
    }
  }

  function submit(event) {
    event.preventDefault();
    if (busy) return;
    var usernameInput = document.getElementById('cm-account-username');
    var passwordInput = document.getElementById('cm-account-password');
    var consentInput = document.getElementById('cm-account-consent');
    var username = (usernameInput.value || '').trim();
    var password = passwordInput.value || '';
    var displayName = (document.getElementById('cm-account-display').value || '').trim();
    var emailInput = document.getElementById('cm-account-email');
    var email = emailInput ? (emailInput.value || '').trim() : '';
    var consent = consentInput.checked;
    if (!username) { markInvalid(usernameInput, true); setStatus('请填写用户名', 'bad'); usernameInput.focus(); return; }
    markInvalid(usernameInput, false);
    if (!password) { markInvalid(passwordInput, true); setStatus('请填写密码', 'bad'); passwordInput.focus(); return; }
    markInvalid(passwordInput, false);
    if (mode === 'register' && email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      markInvalid(emailInput, true);
      setStatus('邮箱格式不正确', 'bad');
      emailInput.focus();
      return;
    }
    markInvalid(emailInput, false);
    if (mode === 'register' && !consent) { markInvalid(consentInput, true); setStatus('注册前请勾选同意隐私政策', 'bad'); consentInput.focus(); return; }
    markInvalid(consentInput, false);

    var submitBtn = document.getElementById('cm-account-submit');
    busy = true;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '请稍候…'; }
    setStatus('');

    var body = { username: username, password: password };
    if (mode === 'register') {
      body.consent = true;
      body.displayName = displayName;
      if (email) body.email = email;
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
      if (mode === 'register' && j.emailNotice) {
        toast(j.emailSent ? '注册成功，验证邮件已发送' : '注册成功，验证邮件暂时未发出');
      } else {
        toast(mode === 'register' ? '注册成功，已登录' : '已登录');
      }
    }).catch(function (err) {
      setStatus((err && err.message) || '操作失败，请稍后重试', 'bad');
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

  /* ===== 邮箱验证 / 找回密码 ===== */

  function formStatus(id, text, tone) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || '';
    el.className = 'cm-status' + (tone ? ' ' + tone : '');
  }

  function stripParam(name) {
    try {
      var url = new URL(location.href);
      if (!url.searchParams.has(name)) return;
      url.searchParams.delete(name);
      history.replaceState(null, '', url.toString());
    } catch (e) {}
  }

  function openForgot() {
    closeForm();
    closeDelete();
    closeReset();
    var form = document.getElementById('cm-account-forgot-form');
    if (!form) return;
    form.hidden = false;
    var input = document.getElementById('cm-account-forgot-email');
    var u = user();
    if (input && u && u.email) input.value = u.email;
    formStatus('cm-account-forgot-status', '');
    if (input) input.focus();
  }

  function closeForgot() {
    var form = document.getElementById('cm-account-forgot-form');
    if (form) form.hidden = true;
    formStatus('cm-account-forgot-status', '');
  }

  function submitForgot(event) {
    if (event) event.preventDefault();
    if (busy) return;
    var input = document.getElementById('cm-account-forgot-email');
    var email = input ? (input.value || '').trim() : '';
    if (!email) {
      if (input) { markInvalid(input, true); input.focus(); }
      formStatus('cm-account-forgot-status', '请填写邮箱', 'bad');
      return;
    }
    if (input) markInvalid(input, false);
    var btn = document.getElementById('cm-account-forgot-submit');
    busy = true;
    if (btn) { btn.disabled = true; btn.textContent = '发送中…'; }
    formStatus('cm-account-forgot-status', '');
    fetch(api('/api/auth/forgot-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }),
      cache: 'no-store'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
        return j;
      });
    }).then(function (j) {
      formStatus('cm-account-forgot-status', (j && j.notice) || '如果该邮箱对应账号，我们已发送重置邮件。', 'good');
      toast('请检查邮箱中的重置链接');
    }).catch(function (err) {
      formStatus('cm-account-forgot-status', (err && err.message) || '发送失败，请稍后重试', 'bad');
    }).then(function () {
      busy = false;
      if (btn) { btn.disabled = false; btn.textContent = '发送重置邮件'; }
    });
  }

  var resetToken = '';

  function openReset(value) {
    resetToken = String(value || '');
    closeForm();
    closeForgot();
    closeDelete();
    var form = document.getElementById('cm-account-reset-form');
    if (!form) return;
    form.hidden = false;
    var input = document.getElementById('cm-account-reset-password');
    if (input) { input.value = ''; input.focus(); }
    formStatus('cm-account-reset-status', '');
  }

  function closeReset() {
    resetToken = '';
    var form = document.getElementById('cm-account-reset-form');
    if (form) form.hidden = true;
    var input = document.getElementById('cm-account-reset-password');
    if (input) input.value = '';
    formStatus('cm-account-reset-status', '');
  }

  function submitReset(event) {
    if (event) event.preventDefault();
    if (busy) return;
    var input = document.getElementById('cm-account-reset-password');
    var password = input ? input.value : '';
    if (!password) {
      if (input) { markInvalid(input, true); input.focus(); }
      formStatus('cm-account-reset-status', '请填写新密码', 'bad');
      return;
    }
    if (input) markInvalid(input, false);
    if (!resetToken) {
      formStatus('cm-account-reset-status', '重置链接不完整，请重新申请', 'bad');
      return;
    }
    var btn = document.getElementById('cm-account-reset-submit');
    busy = true;
    if (btn) { btn.disabled = true; btn.textContent = '重置中…'; }
    formStatus('cm-account-reset-status', '');
    fetch(api('/api/auth/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, password: password }),
      cache: 'no-store'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
        return j;
      });
    }).then(function (j) {
      save(null);
      render();
      notify();
      closeReset();
      stripParam('resetPassword');
      setMode('login');
      openForm();
      setStatus((j && j.notice) || '密码已重置，请使用新密码登录。', 'good');
      toast('密码已重置');
    }).catch(function (err) {
      formStatus('cm-account-reset-status', (err && err.message) || '重置失败，请稍后重试', 'bad');
    }).then(function () {
      busy = false;
      if (btn) { btn.disabled = false; btn.textContent = '重置密码'; }
    });
  }

  function resendVerification() {
    var u = user();
    if (!u) { toast('请先登录账号'); return; }
    var btn = document.getElementById('cm-account-resend');
    if (btn) btn.disabled = true;
    request('/api/auth/resend-verification', { method: 'POST' }).then(function (j) {
      toast((j && j.notice) || '验证邮件已发送');
    }).catch(function (err) {
      toast((err && err.message) || '验证邮件发送失败');
    }).then(function () {
      if (btn) btn.disabled = false;
    });
  }

  function verifyEmail(value) {
    var tokenValue = String(value || '');
    if (!tokenValue) return;
    fetch(api('/api/auth/verify-email'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenValue }),
      cache: 'no-store'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
        return j;
      });
    }).then(function (j) {
      stripParam('verifyEmail');
      var u = user();
      if (u && j.user && j.user.id === u.id) {
        state.user = j.user;
        save(state);
        render();
        notify();
      }
      toast('邮箱已验证');
    }).catch(function (err) {
      stripParam('verifyEmail');
      toast((err && err.message) || '邮箱验证失败');
    });
  }

  function bind() {
    var toggle = document.getElementById('cm-account-toggle');
    var close = document.getElementById('cm-account-close');
    var form = document.getElementById('cm-account-form');
    var switcher = document.getElementById('cm-account-switch');
    var forgotBtn = document.getElementById('cm-account-forgot');
    var forgotForm = document.getElementById('cm-account-forgot-form');
    var forgotClose = document.getElementById('cm-account-forgot-close');
    var forgotCancel = document.getElementById('cm-account-forgot-cancel');
    var resetForm = document.getElementById('cm-account-reset-form');
    var resetClose = document.getElementById('cm-account-reset-close');
    var resetCancel = document.getElementById('cm-account-reset-cancel');
    var resendBtn = document.getElementById('cm-account-resend');
    var logoutBtn = document.getElementById('cm-account-logout');
    var exportBtn = document.getElementById('cm-account-export');
    var deleteBtn = document.getElementById('cm-account-delete');
    var deleteForm = document.getElementById('cm-account-delete-form');
    var deleteCancel = document.getElementById('cm-account-delete-cancel');
    var deleteCancel2 = document.getElementById('cm-account-delete-cancel-2');
    if (toggle) toggle.addEventListener('click', openForm);
    if (close) close.addEventListener('click', closeForm);
    if (form) form.addEventListener('submit', submit);
    var usernameInput = document.getElementById('cm-account-username');
    var passwordInput = document.getElementById('cm-account-password');
    var emailInput = document.getElementById('cm-account-email');
    var consentInput = document.getElementById('cm-account-consent');
    if (usernameInput) usernameInput.addEventListener('input', function () { markInvalid(usernameInput, false); });
    if (passwordInput) passwordInput.addEventListener('input', function () { markInvalid(passwordInput, false); });
    if (emailInput) emailInput.addEventListener('input', function () { markInvalid(emailInput, false); });
    if (consentInput) consentInput.addEventListener('change', function () { markInvalid(consentInput, false); });
    if (switcher) switcher.addEventListener('click', function () {
      setMode(mode === 'register' ? 'login' : 'register');
    });
    if (forgotBtn) forgotBtn.addEventListener('click', openForgot);
    if (forgotForm) forgotForm.addEventListener('submit', submitForgot);
    if (forgotClose) forgotClose.addEventListener('click', closeForgot);
    if (forgotCancel) forgotCancel.addEventListener('click', closeForgot);
    if (resetForm) resetForm.addEventListener('submit', submitReset);
    if (resetClose) resetClose.addEventListener('click', closeReset);
    if (resetCancel) resetCancel.addEventListener('click', closeReset);
    if (resendBtn) resendBtn.addEventListener('click', resendVerification);
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
    try {
      var params = new URLSearchParams(location.search);
      var verifyToken = params.get('verifyEmail');
      var resetValue = params.get('resetPassword');
      if (resetValue) openReset(resetValue);
      if (verifyToken) verifyEmail(verifyToken);
    } catch (e) {}
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
