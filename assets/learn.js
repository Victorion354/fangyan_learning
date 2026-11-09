/* 我的学习：本机收藏、错题、测验记录与个人数据汇总
 *
 * 学习数据只写入 localStorage；账号名下的留言与举报通过 /api/me/export 读取。
 * main.js 通过 window.FANGYAN_LEARN 记录翻面、收藏与答题结果。
 */
(function () {
  'use strict';

  var KEY = 'fangyan-learning-v1';
  var COMMUNITY_KEY = 'fangyan-community-v1';
  var MAX_WRONG = 30;
  var MAX_ATTEMPTS = 20;
  var mine = { mode: 'idle', loading: false, data: null, error: '' };
  var accountListeners = false;

  function now() { return Date.now(); }

  function emptyState() {
    return { version: 1, favorites: {}, learned: {}, quiz: { attempts: [], wrong: [] }, updatedAt: 0 };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return emptyState();
      var state = emptyState();
      state.favorites = parsed.favorites && typeof parsed.favorites === 'object' ? parsed.favorites : {};
      state.learned = parsed.learned && typeof parsed.learned === 'object' ? parsed.learned : {};
      state.quiz = parsed.quiz && typeof parsed.quiz === 'object' ? parsed.quiz : { attempts: [], wrong: [] };
      state.quiz.attempts = Array.isArray(state.quiz.attempts) ? state.quiz.attempts.slice(-MAX_ATTEMPTS) : [];
      state.quiz.wrong = Array.isArray(state.quiz.wrong) ? state.quiz.wrong.slice(-MAX_WRONG) : [];
      state.updatedAt = Number(parsed.updatedAt) || 0;
      return state;
    } catch (e) {
      return emptyState();
    }
  }

  var state = load();

  function save() {
    state.updatedAt = now();
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function key(dialect, index) { return String(dialect) + ':' + String(index); }

  function dialectName(id) {
    var data = window.FANGYAN_DATA;
    var item = data && data.byId ? data.byId[id] : null;
    return item ? item.name : (id || '');
  }

  function emit() {
    try {
      window.dispatchEvent(new CustomEvent('fangyan:learning', { detail: { state: state } }));
    } catch (e) {}
  }

  function isFavorite(dialect, index) {
    return !!state.favorites[key(dialect, index)];
  }

  function toggleFavorite(dialect, index, word, std, py) {
    var id = key(dialect, index);
    if (state.favorites[id]) delete state.favorites[id];
    else {
      state.favorites[id] = {
        dialect: dialect,
        index: index,
        word: word || '',
        std: std || '',
        py: py || '',
        addedAt: now()
      };
    }
    save();
    emit();
    return !!state.favorites[id];
  }

  function markLearned(dialect, index, word, std) {
    var id = key(dialect, index);
    if (state.learned[id]) return;
    state.learned[id] = { dialect: dialect, index: index, word: word || '', std: std || '', at: now() };
    save();
    emit();
  }

  function recordAnswer(record) {
    if (!record || typeof record.quizIndex !== 'number') return;
    if (record.correct) return;
    state.quiz.wrong.push({
      quizIndex: record.quizIndex,
      choice: typeof record.choice === 'number' ? record.choice : -1,
      at: Number(record.at) || now()
    });
    state.quiz.wrong = state.quiz.wrong.slice(-MAX_WRONG);
    save();
    emit();
  }

  function recordAttempt(record) {
    if (!record || typeof record.score !== 'number' || typeof record.total !== 'number') return;
    state.quiz.attempts.push({ score: record.score, total: record.total, at: Number(record.at) || now() });
    state.quiz.attempts = state.quiz.attempts.slice(-MAX_ATTEMPTS);
    save();
    emit();
  }

  function clearLearning() {
    state = emptyState();
    try { localStorage.removeItem(KEY); } catch (e) {}
    emit();
  }

  function summary() {
    var learned = Object.keys(state.learned).length;
    var favorites = Object.keys(state.favorites).length;
    var best = 0;
    state.quiz.attempts.forEach(function (a) {
      if (a && a.total && a.score > best) best = a.score;
    });
    return {
      learned: learned,
      favorites: favorites,
      best: best,
      attempts: state.quiz.attempts.length,
      wrong: state.quiz.wrong.length
    };
  }

  function apiBase() {
    var c = window.FANGYAN_CONFIG || {};
    if (c.apiBase) return String(c.apiBase).replace(/\/$/, '');
    if (location.protocol === 'http:' || location.protocol === 'https:') return '';
    return 'http://localhost:8787';
  }

  function accountToken() {
    try {
      var a = window.FANGYAN_ACCOUNT;
      return a && typeof a.token === 'function' ? (a.token() || '') : '';
    } catch (e) { return ''; }
  }

  function accountUser() {
    try {
      var a = window.FANGYAN_ACCOUNT;
      return a && typeof a.user === 'function' ? a.user() : null;
    } catch (e) { return null; }
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function time(ts) {
    var diff = now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    var d = new Date(ts);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function localPosts() {
    try {
      var raw = localStorage.getItem(COMMUNITY_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function fetchMine() {
    var token = accountToken();
    if (!token) {
      mine = { mode: 'guest', loading: false, data: null, error: '' };
      renderMine();
      return;
    }
    if (mine.loading) return;
    mine.loading = true;
    mine.error = '';
    renderMine();
    fetch(apiBase() + '/api/me/export', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
        return j;
      });
    }).then(function (data) {
      mine = { mode: 'account', loading: false, data: data, error: '' };
      renderMine();
    }).catch(function (err) {
      mine = { mode: 'account', loading: false, data: null, error: (err && err.message) || '暂时无法读取账号数据' };
      renderMine();
    });
  }

  function favoriteList() {
    var items = Object.keys(state.favorites).map(function (id) { return state.favorites[id]; });
    items.sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });
    return items;
  }

  function renderFavorites() {
    var items = favoriteList();
    if (!items.length) {
      return '<p class="learn-empty">还没有收藏词汇。去<a href="#words">词汇课堂</a>点卡片左上角的收藏按钮，把想复习的词留下来。</p>';
    }
    return '<ul class="learn-list">' + items.map(function (f) {
      return '<li class="learn-item">' +
        '<div class="learn-item-main"><b>' + esc(f.word) + ' <small style="display:inline;font-family:var(--fk);font-weight:400">' + esc(f.py) + '</small></b>' +
        '<small>' + esc(f.std) + ' · ' + esc(dialectName(f.dialect)) + '</small></div>' +
        '<div class="learn-item-actions">' +
        '<button type="button" class="learn-mini" data-learn-review="' + esc(f.dialect) + '|' + esc(f.index) + '">复习</button>' +
        '<button type="button" class="learn-mini danger" data-learn-unfav="' + esc(f.dialect) + '|' + esc(f.index) + '">取消收藏</button>' +
        '</div></li>';
    }).join('') + '</ul>';
  }

  function quizByIndex(index) {
    var quiz = window.QUIZ;
    return Array.isArray(quiz) ? quiz[index] : null;
  }

  function renderWrong() {
    var wrong = state.quiz.wrong.slice().reverse().slice(0, 6);
    if (!wrong.length) {
      return '<p class="learn-empty">还没有错题。去<a href="#quiz">方言辨识</a>做一轮测验，答错的题会自动记在这里。</p>';
    }
    return '<ul class="learn-list">' + wrong.map(function (w) {
      var q = quizByIndex(w.quizIndex);
      if (!q) return '';
      var picked = q.options && q.options[w.choice] ? q.options[w.choice] : '未选择';
      return '<li class="learn-item">' +
        '<div class="learn-item-main"><b>“' + esc(q.ph) + '”</b>' +
        '<small>你选了「' + esc(picked) + '」，正确答案是「' + esc(q.options[q.answer]) + '」 · ' + time(w.at) + '</small></div>' +
        '<div class="learn-item-actions"><button type="button" class="learn-mini" data-learn-quiz>再测一次</button></div>' +
        '</li>';
    }).join('') + '</ul>';
  }

  function statusLabel(status) {
    var labels = { visible: '公开', pending: '待审', hidden: '已隐藏', removed: '已移除' };
    var label = labels[status] || status || '公开';
    return '<span class="learn-tag ' + esc(status || 'visible') + '">' + esc(label) + '</span>';
  }

  function renderMine() {
    var el = document.getElementById('learn-mine');
    if (!el) return;
    if (mine.loading) {
      el.innerHTML = '<p class="learn-empty">正在读取账号数据…</p>';
      return;
    }
    if (mine.mode === 'guest') {
      var posts = localPosts().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      var latest = posts.slice(0, 3);
      el.innerHTML = '<p class="learn-empty">当前是游客模式。登录后可以在这里汇总账号名下的服务端留言与举报；本机模式下你发布过的留言会显示在这里。</p>' +
        (latest.length ? '<ul class="learn-list">' + latest.map(function (p) {
          return '<li class="learn-item"><div class="learn-item-main"><b>' + esc(p.text || '') + '</b>' +
            '<small>' + esc(p.board || '') + ' · ' + time(Number(p.createdAt) || now()) + ' · 本机留言</small></div></li>';
        }).join('') + '</ul>' : '<p class="learn-empty">本机还没有留言。</p>');
      return;
    }
    if (mine.error) {
      el.innerHTML = '<p class="learn-empty">' + esc(mine.error) + '。如果登录已过期，请重新登录后再试。</p>';
      return;
    }
    var data = mine.data || {};
    var posts = Array.isArray(data.posts) ? data.posts : [];
    var reports = Array.isArray(data.reports) ? data.reports : [];
    var user = data.user || {};
    var latestPosts = posts.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }).slice(0, 3);
    var latestReports = reports.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }).slice(0, 2);
    el.innerHTML = '<p class="learn-empty">账号 <b>' + esc(user.displayName || user.username || '') + '</b>：共 ' + posts.length + ' 条留言、' + reports.length + ' 条举报。' +
      '完整数据可在社区账号栏点击「导出数据」下载。</p>' +
      (latestPosts.length ? '<ul class="learn-list">' + latestPosts.map(function (p) {
        return '<li class="learn-item"><div class="learn-item-main"><b>' + esc(p.text || '') + statusLabel(p.status) + '</b>' +
          '<small>' + esc(p.board || '') + ' · ' + time(Number(p.createdAt) || now()) + '</small></div></li>';
      }).join('') + '</ul>' : '<p class="learn-empty">账号名下还没有留言。</p>') +
      (latestReports.length ? '<ul class="learn-list" style="margin-top:9px">' + latestReports.map(function (r) {
        return '<li class="learn-item"><div class="learn-item-main"><b>举报：' + esc(r.reason || '未填写原因') + '</b>' +
          '<small>' + time(Number(r.createdAt) || now()) + ' · ' + esc(r.status || 'open') + '</small></div></li>';
      }).join('') + '</ul>' : '');
  }

  function render() {
    var panel = document.getElementById('learn-panel');
    if (!panel) return;
    var s = summary();
    var pct = Math.min(100, Math.round(s.learned / 100 * 100));
    panel.innerHTML =
      '<div class="learn-summary">' +
        '<div class="learn-stat"><b>' + s.learned + '<span class="unit"> / 100</span></b><span>已翻面词汇 · ' + pct + '%</span></div>' +
        '<div class="learn-stat"><b>' + s.favorites + '</b><span>收藏词汇</span></div>' +
        '<div class="learn-stat"><b>' + s.best + '<span class="unit"> / 10</span></b><span>测验最佳成绩</span></div>' +
        '<div class="learn-stat"><b>' + s.attempts + '</b><span>完成测验次数 · ' + s.wrong + ' 道错题</span></div>' +
      '</div>' +
      '<div class="learn-grid">' +
        '<section class="learn-card" aria-labelledby="learn-fav-title">' +
          '<div class="learn-card-head"><h3 id="learn-fav-title">收藏词汇</h3><span>' + s.favorites + ' 个</span></div>' +
          renderFavorites() +
        '</section>' +
        '<section class="learn-card" aria-labelledby="learn-wrong-title">' +
          '<div class="learn-card-head"><h3 id="learn-wrong-title">辨识错题</h3><span>最近 ' + Math.min(6, s.wrong) + ' 条</span></div>' +
          renderWrong() +
        '</section>' +
        '<section class="learn-card wide" aria-labelledby="learn-mine-title">' +
          '<div class="learn-card-head"><h3 id="learn-mine-title">我的留言与举报</h3><span>账号数据</span></div>' +
          '<div id="learn-mine"></div>' +
        '</section>' +
      '</div>' +
      '<div class="learn-actions">' +
        '<button type="button" data-learn-export>导出学习记录</button>' +
        '<button type="button" class="danger" data-learn-clear>清空学习记录</button>' +
      '</div>' +
      '<p class="learn-note">学习记录保存在本机浏览器（localStorage），不会上传。换设备或清除浏览器数据后需要重新积累；账号留言与举报以服务端数据为准。</p>';
    renderMine();
  }

  function download(data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'fangyan-learning-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function toast(message) {
    if (typeof window.toast === 'function') window.toast(message);
  }

  function reviewFavorite(value) {
    var parts = String(value || '').split('|');
    var dialect = parts[0];
    var index = Number(parts[1]);
    if (!dialect) return;
    if (typeof window.selectDialect === 'function') window.selectDialect(dialect);
    var words = document.getElementById('words');
    if (words && words.scrollIntoView) words.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () {
      var card = document.querySelector('#v-cards .vcard[data-i="' + index + '"]');
      if (!card) return;
      card.classList.add('learn-target');
      if (typeof card.focus === 'function') card.focus({ preventScroll: true });
      setTimeout(function () { card.classList.remove('learn-target'); }, 1800);
    }, 80);
  }

  function bind() {
    var panel = document.getElementById('learn-panel');
    if (!panel) return;
    panel.addEventListener('click', function (event) {
      var review = event.target.closest('[data-learn-review]');
      if (review) { reviewFavorite(review.getAttribute('data-learn-review')); return; }
      var unfav = event.target.closest('[data-learn-unfav]');
      if (unfav) {
        var parts = String(unfav.getAttribute('data-learn-unfav') || '').split('|');
        if (parts[0]) {
          toggleFavorite(parts[0], Number(parts[1]));
          render();
          toast('已取消收藏');
        }
        return;
      }
      var quiz = event.target.closest('[data-learn-quiz]');
      if (quiz) {
        var section = document.getElementById('quiz');
        if (section && section.scrollIntoView) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      var exportBtn = event.target.closest('[data-learn-export]');
      if (exportBtn) {
        download({
          exportedAt: new Date().toISOString(),
          note: '本文件只包含本机学习记录，不包含账号密码或服务端会话令牌。',
          learning: state
        });
        toast('已导出本机学习记录');
        return;
      }
      var clear = event.target.closest('[data-learn-clear]');
      if (clear) {
        if (!window.confirm('清空本机的收藏、翻面记录和测验错题？此操作无法恢复。')) return;
        clearLearning();
        render();
        toast('已清空本机学习记录');
      }
    });

    if (!accountListeners) {
      accountListeners = true;
      window.addEventListener('fangyan:account', function () {
        mine = { mode: 'idle', loading: false, data: null, error: '' };
        fetchMine();
      });
      window.addEventListener('fangyan:learning', render);
    }
  }

  window.FANGYAN_LEARN = {
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    markLearned: markLearned,
    recordAnswer: recordAnswer,
    recordAttempt: recordAttempt,
    summary: summary,
    getState: function () { return state; },
    clear: clearLearning,
    refresh: render
  };

  function init() {
    bind();
    render();
    fetchMine();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
