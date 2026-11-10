/* 共享导航：移动端汉堡菜单与聚焦跳转
 *
 * - 自动插入汉堡按钮，不改动页面原有的导航结构
 * - 支持 Esc 关闭、点击外部关闭、窗口放大自动关闭
 * - 打开时把键盘焦点限制在菜单内，关闭后回到汉堡按钮
 * - 带 ?from=action|methods 打开时进入聚焦模式：只保留返回按钮，并即时定位锚点
 */
(function () {
  'use strict';

  var FOCUS_FALLBACK = { action: 'action.html', methods: 'methods.html' };

  function initFocusMode() {
    var params = new URLSearchParams(window.location.search);
    var from = params.get('from');
    if (!from || !Object.prototype.hasOwnProperty.call(FOCUS_FALLBACK, from)) return false;

    document.body.classList.add('focus-mode');

    var root = document.documentElement;
    root.style.scrollBehavior = 'auto';

    function jump() {
      var hash = window.location.hash;
      if (!hash || hash.length < 2) return;
      var id = hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch (_) {}
      var target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    jump();
    window.addEventListener('load', jump);
    if (window.requestAnimationFrame) window.requestAnimationFrame(jump);

    var bar = document.querySelector('.nav .nav-in');
    if (!bar) return true;

    var fallback = FOCUS_FALLBACK[from];
    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'focus-back';
    back.textContent = '← 返回';
    back.setAttribute('aria-label', '返回到上一页');
    back.addEventListener('click', function () {
      var ref = document.referrer;
      var sameOrigin = ref && ref.indexOf(window.location.origin) === 0;
      if (sameOrigin && window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = fallback;
      }
    });
    bar.appendChild(back);
    return true;
  }

  var focusMode = initFocusMode();

  function init() {
    if (focusMode) return;
    var nav = document.querySelector('.nav');
    if (!nav || nav.getAttribute('data-nav-ready') === 'true') return;
    var menu = nav.querySelector('.nav-links') || nav.querySelector('.nav-right');
    var bar = nav.querySelector('.nav-in');
    if (!menu || !bar) return;

    if (!menu.id) menu.id = 'site-nav-menu';
    nav.setAttribute('data-nav-ready', 'true');

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', menu.id);
    toggle.setAttribute('aria-label', '打开导航菜单');
    toggle.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
    bar.appendChild(toggle);

    var open = false;
    var lastFocus = null;

    function focusables() {
      return Array.prototype.slice.call(
        menu.querySelectorAll('a[href],button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')
      ).filter(function (el) {
        return el.offsetParent !== null;
      });
    }

    function setOpen(next) {
      open = next;
      nav.classList.toggle('nav-open', open);
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
      if (open) {
        lastFocus = document.activeElement;
        var items = focusables();
        if (items.length) items[0].focus();
      } else if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
      }
    }

    toggle.addEventListener('click', function () {
      setOpen(!open);
    });

    menu.addEventListener('click', function (event) {
      var link = event.target.closest('a[href]');
      if (link) setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (!open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      var items = focusables();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    document.addEventListener('click', function (event) {
      if (!open || nav.contains(event.target)) return;
      setOpen(false);
    });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!open) return;
        var visible = window.getComputedStyle(toggle).display !== 'none';
        if (!visible) setOpen(false);
      }, 120);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
