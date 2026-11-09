/* 数据观察 / 保护行动 / 数据与方法页面渲染
 *
 * 不引入图表库：用原生 SVG 生成城市青年、代际趋势与活力排序图，
 * 同时输出可展开的数据表，保证无图形环境也能读取数值。
 */
(function () {
  'use strict';

  var CHECK_KEY = 'fangyan-actions-v1';
  var trendSelection = [];

  function D() { return window.FANGYAN_INSIGHT || null; }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmt(n, digits) {
    return Number(n).toFixed(digits == null ? 1 : digits);
  }

  function levelClass(level) {
    if (level === '安全') return 'safe';
    if (level === '脆弱') return 'fragile';
    if (level === '严重濒危') return 'severe';
    return 'endangered';
  }

  function dialectBySlug(slug) {
    var d = D();
    return d ? d.dialects.filter(function (x) { return x.slug === slug; })[0] : null;
  }

  function svgText(x, y, text, attrs) {
    return '<text x="' + x + '" y="' + y + '" ' + (attrs || '') + '>' + esc(text) + '</text>';
  }

  function renderStats() {
    var el = document.getElementById('data-stats');
    var d = D();
    if (!el || !d) return;
    var n = d.national;
    el.innerHTML =
      '<div class="insight-stat"><b>' + fmt(n.putonghuaRate2020, 2) + '%</b><span>2020 年全国普通话普及率<br>2000 年为 ' + fmt(n.putonghuaRate2000, 2) + '%</span></div>' +
      '<div class="insight-stat"><b>2.2%</b><span>苏州样本中 6–20 岁<br>能熟练使用方言的比例</span></div>' +
      '<div class="insight-stat"><b>' + n.surveyPoints.toLocaleString('zh-CN') + '</b><span>语保工程一期调查点<br>覆盖 ' + n.languages + ' 种语言及主要方言</span></div>' +
      '<div class="insight-stat"><b>' + n.totalSpeakersText + '</b><span>十大方言使用人口合计<br>2004 年人口基数</span></div>';
  }

  function renderInsights() {
    var el = document.getElementById('data-insights');
    var d = D();
    if (!el || !d) return;
    el.innerHTML = d.insights.map(function (item) {
      return '<article class="insight-card">' +
        '<div class="mini-stat">' + esc(item.stat) + '</div>' +
        '<h3>' + esc(item.title) + '</h3>' +
        '<p>' + esc(item.text) + '</p>' +
        '<span class="src">来源：' + esc(item.source) + '</span>' +
        '</article>';
    }).join('');
  }

  function renderCityChart() {
    var chart = document.getElementById('city-chart');
    var table = document.getElementById('city-table');
    var d = D();
    if (!chart || !d) return;
    var cities = d.cities;
    var W = 760;
    var H = 320;
    var left = 92;
    var right = 46;
    var top = 26;
    var row = 48;
    var max = 35;
    var plotW = W - left - right;
    var bars = cities.map(function (c, i) {
      var y = top + i * row;
      var w = Math.max(2, c.rate / max * plotW);
      var color = c.dialect === '赣语' ? '#3A7BA0' : c.dialect === '闽语' ? '#2A5C8A' : '#2E726E';
      return '<g>' +
        svgText(left - 12, y + 19, c.city, 'text-anchor="end" font-size="13" fill="#2B2C35" font-weight="700"') +
        '<rect x="' + left + '" y="' + (y + 5) + '" width="' + plotW + '" height="20" rx="4" fill="#EFE7D9"/>' +
        '<rect x="' + left + '" y="' + (y + 5) + '" width="' + w.toFixed(1) + '" height="20" rx="4" fill="' + color + '"/>' +
        svgText(left + w + 8, y + 20, c.rate.toFixed(1) + '%', 'font-size="12.5" fill="' + color + '" font-weight="700"') +
        '</g>';
    }).join('');
    var grid = [0, 10, 20, 30].map(function (v) {
      var x = left + v / max * plotW;
      return '<line x1="' + x.toFixed(1) + '" y1="' + (top - 4) + '" x2="' + x.toFixed(1) + '" y2="' + (top + cities.length * row - 6) + '" stroke="#D9D0BF" stroke-dasharray="3 4"/>' +
        svgText(x, H - 12, v + '%', 'text-anchor="middle" font-size="11" fill="#5C5E6B"');
    }).join('');
    chart.innerHTML =
      '<title id="city-chart-title">城市 6–20 岁青少年方言熟练使用率</title>' +
      '<desc id="city-chart-desc">南昌 31.8%，上海 22.4%，厦门 19.3%，杭州 9.2%，苏州 2.2%。数据来自城市样本调查，不能外推整个方言区。</desc>' +
      grid + bars;
    chart.setAttribute('aria-labelledby', 'city-chart-title city-chart-desc');

    if (table) {
      table.innerHTML = '<table class="data-table"><caption class="sr-only">城市青年方言熟练使用率数据表</caption><thead><tr><th>城市</th><th>相关方言</th><th class="num">6–20 岁熟练使用率</th></tr></thead><tbody>' +
        cities.map(function (c) {
          return '<tr><td class="name">' + esc(c.city) + '</td><td>' + esc(c.dialect) + '</td><td class="num">' + c.rate.toFixed(1) + '%</td></tr>';
        }).join('') + '</tbody></table>';
    }
  }

  function renderTrendChips() {
    var el = document.getElementById('trend-chips');
    var d = D();
    if (!el || !d) return;
    el.innerHTML = d.dialects.map(function (x) {
      var on = trendSelection.indexOf(x.slug) !== -1;
      return '<button type="button" class="c-chip' + (on ? ' on' : '') + '" data-trend="' + esc(x.slug) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(x.name) + '</button>';
    }).join('');
  }

  function renderTrendChart() {
    var chart = document.getElementById('trend-chart');
    var legend = document.getElementById('trend-legend');
    var table = document.getElementById('trend-table');
    var d = D();
    if (!chart || !d) return;
    var W = 760;
    var H = 360;
    var left = 52;
    var right = 26;
    var top = 24;
    var bottom = 48;
    var plotW = W - left - right;
    var plotH = H - top - bottom;
    var periods = d.periods;
    var lines = d.dialects.filter(function (x) { return trendSelection.indexOf(x.slug) !== -1; });
    var grid = [0, 25, 50, 75, 100].map(function (v) {
      var y = top + (100 - v) / 100 * plotH;
      return '<line x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' + (left + plotW) + '" y2="' + y.toFixed(1) + '" stroke="#D9D0BF" stroke-dasharray="' + (v === 0 ? '0' : '3 4') + '"/>' +
        svgText(left - 10, y + 4, v + '%', 'text-anchor="end" font-size="11" fill="#5C5E6B"');
    }).join('');
    var xLabels = periods.map(function (p, i) {
      var x = left + i / (periods.length - 1) * plotW;
      return '<line x1="' + x + '" y1="' + (top + plotH) + '" x2="' + x + '" y2="' + (top + plotH + 5) + '" stroke="#B9AA91"/>' +
        svgText(x, top + plotH + 22, p, 'text-anchor="middle" font-size="11.5" fill="#5C5E6B"');
    }).join('');
    var paths = lines.map(function (x) {
      var points = x.trend.map(function (rate, i) {
        var px = left + i / (periods.length - 1) * plotW;
        var py = top + (100 - rate) / 100 * plotH;
        return px.toFixed(1) + ',' + py.toFixed(1);
      }).join(' ');
      var dots = x.trend.map(function (rate, i) {
        var px = left + i / (periods.length - 1) * plotW;
        var py = top + (100 - rate) / 100 * plotH;
        return '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="4" fill="' + x.color + '" stroke="#fff" stroke-width="1.5"><title>' + esc(x.name + ' ' + periods[i] + '：' + rate + '%') + '</title></circle>';
      }).join('');
      return '<polyline points="' + points + '" fill="none" stroke="' + x.color + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>' + dots;
    }).join('');
    chart.innerHTML =
      '<title id="trend-chart-title">代表方言代际使用率趋势</title>' +
      '<desc id="trend-chart-desc">按 1950s、1980s、2000s、2020s 四个时期展示代表方言的使用率估算。数值为综合估算，用于呈现趋势方向，不是普查数据。</desc>' +
      grid + xLabels + paths;
    chart.setAttribute('aria-labelledby', 'trend-chart-title trend-chart-desc');

    if (legend) {
      legend.innerHTML = lines.map(function (x) {
        return '<span><i style="background:' + esc(x.color) + '"></i>' + esc(x.name) + '</span>';
      }).join('');
    }
    if (table) {
      table.innerHTML = '<table class="data-table"><caption class="sr-only">代表方言代际使用率数据表</caption><thead><tr><th>方言</th>' +
        periods.map(function (p) { return '<th class="num">' + esc(p) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        lines.map(function (x) {
          return '<tr><td class="name">' + esc(x.name) + '</td>' + x.trend.map(function (v) { return '<td class="num">' + v + '%</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table>';
    }
  }

  function renderVitalityChart() {
    var chart = document.getElementById('vitality-chart');
    var table = document.getElementById('vitality-table');
    var d = D();
    if (!chart || !d) return;
    var items = d.dialects.slice().sort(function (a, b) { return b.vitality - a.vitality; });
    var W = 760;
    var row = 42;
    var top = 22;
    var left = 78;
    var right = 58;
    var H = top + items.length * row + 10;
    var plotW = W - left - right;
    var bars = items.map(function (x, i) {
      var y = top + i * row;
      var w = Math.max(2, x.vitality / 100 * plotW);
      var color = x.vitality >= 70 ? '#5E8A54' : x.vitality >= 50 ? '#B07C2A' : x.vitality >= 35 ? '#C24A5A' : '#8F241B';
      return '<g>' +
        svgText(left - 12, y + 19, x.name, 'text-anchor="end" font-size="13" fill="#2B2C35" font-weight="700"') +
        '<rect x="' + left + '" y="' + (y + 6) + '" width="' + plotW + '" height="18" rx="4" fill="#EFE7D9"/>' +
        '<rect x="' + left + '" y="' + (y + 6) + '" width="' + w.toFixed(1) + '" height="18" rx="4" fill="' + color + '"/>' +
        svgText(left + w + 8, y + 20, String(x.vitality), 'font-size="12.5" fill="' + color + '" font-weight="700"') +
        svgText(W - 4, y + 20, x.level, 'text-anchor="end" font-size="10.5" fill="#5C5E6B"') +
        '</g>';
    }).join('');
    chart.innerHTML =
      '<title id="vitality-chart-title">十大方言活力指数排序</title>' +
      '<desc id="vitality-chart-desc">官话 83、粤语 68、晋语 51、闽南语 51、湘语 44、赣语 43、吴语 41、客家话 38、徽语 28、平话 25。活力指数为编辑评分。</desc>' +
      bars;
    chart.setAttribute('aria-labelledby', 'vitality-chart-title vitality-chart-desc');

    if (table) {
      table.innerHTML = '<table class="data-table"><caption class="sr-only">十大方言活力指数数据表</caption><thead><tr><th>方言</th><th class="num">青少年熟练度</th><th class="num">代际传承</th><th class="num">公共场景</th><th class="num">记录完备度</th><th class="num">活力指数</th><th>等级</th></tr></thead><tbody>' +
        items.map(function (x) {
          return '<tr><td class="name">' + esc(x.name) + '</td><td class="num">' + x.youth + '</td><td class="num">' + x.transmission + '</td><td class="num">' + x.publicUse + '</td><td class="num">' + x.documentation + '</td><td class="num"><b>' + x.vitality + '</b></td><td><span class="level ' + levelClass(x.level) + '">' + esc(x.level) + '</span></td></tr>';
        }).join('') + '</tbody></table>';
    }
  }

  function renderDialectTable() {
    var el = document.getElementById('dialect-table');
    var d = D();
    if (!el || !d) return;
    var items = d.dialects.slice().sort(function (a, b) { return b.speakersWan - a.speakersWan; });
    el.innerHTML = '<table class="data-table"><caption class="sr-only">十大方言使用人口与活力关键指标</caption><thead><tr>' +
      '<th>方言</th><th class="num">使用人口（万）</th><th class="num">占十大方言</th><th class="num">青少年熟练度</th><th class="num">活力指数</th><th>等级</th><th>详情</th>' +
      '</tr></thead><tbody>' +
      items.map(function (x) {
        return '<tr><td class="name">' + esc(x.name) + '</td>' +
          '<td class="num">' + x.speakersWan.toLocaleString('zh-CN') + '</td>' +
          '<td class="num">' + x.share.toFixed(1) + '%</td>' +
          '<td class="num">' + x.youth + '</td>' +
          '<td class="num"><b>' + x.vitality + '</b></td>' +
          '<td><span class="level ' + levelClass(x.level) + '">' + esc(x.level) + '</span></td>' +
          '<td><a href="' + esc(x.detail) + '">查看</a></td></tr>';
      }).join('') + '</tbody></table>';
  }

  function bindTrendChips() {
    var el = document.getElementById('trend-chips');
    if (!el) return;
    el.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-trend]');
      if (!btn) return;
      var slug = btn.getAttribute('data-trend');
      var i = trendSelection.indexOf(slug);
      if (i === -1) trendSelection.push(slug);
      else if (trendSelection.length > 1) trendSelection.splice(i, 1);
      renderTrendChips();
      renderTrendChart();
    });
  }

  function renderDataPage() {
    var d = D();
    if (!d) return;
    trendSelection = d.defaultTrend.slice();
    renderStats();
    renderInsights();
    renderCityChart();
    renderTrendChips();
    renderTrendChart();
    renderVitalityChart();
    renderDialectTable();
    bindTrendChips();
  }

  function renderActionPage() {
    var d = D();
    if (!d) return;
    var values = document.getElementById('value-grid');
    if (values) {
      values.innerHTML = d.researchValues.map(function (x, i) {
        return '<article class="action-card"><span class="k">' + String(i + 1) + '</span><h3>' + esc(x.title) + '</h3><p>' + esc(x.text) + '</p><span class="example">例：' + esc(x.example) + '</span></article>';
      }).join('');
    }
    var challenges = document.getElementById('challenge-grid');
    if (challenges) {
      challenges.innerHTML = d.challenges.map(function (x, i) {
        return '<article class="action-card"><span class="k">' + String(i + 1) + '</span><h3>' + esc(x.title) + '</h3><p>' + esc(x.text) + '</p><span class="example">' + esc(x.evidence) + '</span></article>';
      }).join('');
    }
    var principles = document.getElementById('principle-grid');
    if (principles) {
      principles.innerHTML = d.principles.map(function (x) {
        return '<article class="principle"><div class="n">' + esc(x.number) + '</div><h3>' + esc(x.title) + '</h3><p>' + esc(x.text) + '</p></article>';
      }).join('');
    }
    var paths = document.getElementById('path-list');
    if (paths) {
      paths.innerHTML = d.paths.map(function (x) {
        return '<article class="path-card"><h3>' + esc(x.title) + '</h3><p class="claim">' + esc(x.claim) + '</p><ul>' +
          x.actions.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') +
          '</ul><div class="meta"><span>适合主体：' + esc(x.actors) + '</span><span>案例：' + esc(x.example) + '</span></div></article>';
      }).join('');
    }
    var cases = document.getElementById('case-grid');
    if (cases) {
      cases.innerHTML = d.cases.map(function (x) {
        return '<article class="case-card"><div class="place"><b>' + esc(x.place) + '</b><span>' + esc(x.dialect) + '</span></div>' +
          '<h3>' + esc(x.title) + '</h3><p>' + esc(x.text) + '</p>' +
          '<a class="entry" href="' + esc(x.detail) + '">' + esc(x.entry) + ' →</a></article>';
      }).join('');
    }
    var timeline = document.getElementById('timeline');
    if (timeline) {
      timeline.innerHTML = d.timeline.map(function (x) {
        return '<li><span class="year">' + esc(x.year) + '</span><b>' + esc(x.title) + '</b><p>' + esc(x.text) + '</p></li>';
      }).join('');
    }
    renderChecklist();
  }

  function loadChecklist() {
    try {
      var raw = localStorage.getItem(CHECK_KEY);
      var obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
    } catch (e) { return {}; }
  }

  function saveChecklist(obj) {
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(obj)); } catch (e) {}
  }

  function renderChecklist() {
    var list = document.getElementById('action-list');
    var d = D();
    if (!list || !d) return;
    var checked = loadChecklist();
    list.innerHTML = d.checklist.map(function (x) {
      var on = !!checked[x.id];
      return '<label class="' + (on ? 'done' : '') + '"><input type="checkbox" data-action-id="' + esc(x.id) + '"' + (on ? ' checked' : '') + '><span>' + esc(x.text) + '<small>' + esc(x.hint) + '</small></span></label>';
    }).join('');
    updateChecklistProgress(checked);
    list.onchange = function (event) {
      var input = event.target.closest('[data-action-id]');
      if (!input) return;
      var state = loadChecklist();
      if (input.checked) state[input.getAttribute('data-action-id')] = true;
      else delete state[input.getAttribute('data-action-id')];
      saveChecklist(state);
      input.closest('label').classList.toggle('done', input.checked);
      updateChecklistProgress(state);
    };
    var reset = document.getElementById('action-reset');
    if (reset) {
      reset.onclick = function () {
        if (!window.confirm('清空这份行动清单的勾选记录？')) return;
        saveChecklist({});
        renderChecklist();
      };
    }
  }

  function updateChecklistProgress(state) {
    var d = D();
    if (!d) return;
    var total = d.checklist.length;
    var done = d.checklist.filter(function (x) { return !!state[x.id]; }).length;
    var text = document.getElementById('action-count');
    var bar = document.getElementById('action-bar');
    if (text) text.innerHTML = '已完成 <b>' + done + '</b> / ' + total + ' 件';
    if (bar) bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
  }

  function renderMethodsPage() {
    var d = D();
    if (!d) return;
    var sources = document.getElementById('source-list');
    if (sources) {
      sources.innerHTML = d.sources.map(function (x) {
        return '<li class="source-item"><b>' + esc(x.title) + '</b><span class="meta">' + esc(x.publisher) + ' · ' + esc(x.year) + '</span>' +
          '<p>' + esc(x.note) + '</p>' +
          (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">查看来源 →</a>' : '') +
          '</li>';
      }).join('');
    }
    var methods = document.getElementById('method-grid');
    if (methods) {
      var labels = {
        speakers: '使用人口',
        share: '占比计算',
        youth: '青少年熟练度',
        trend: '代际趋势',
        vitality: '活力指数',
        places: '坐标与位置',
        suggestions: '社区留言'
      };
      methods.innerHTML = Object.keys(labels).map(function (key) {
        return '<article class="method-card"><h3>' + labels[key] + '</h3><p>' + esc(d.methods[key]) + '</p></article>';
      }).join('');
    }
  }

  function init() {
    renderDataPage();
    renderActionPage();
    renderMethodsPage();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
