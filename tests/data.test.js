'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const data = require(path.join(root, 'assets/data/dialects.js'));

const REQUIRED_FIELDS = [
  'id', 'name', 'full', 'region', 'color', 'phrase', 'pinyin', 'mean', 'desc',
  'hi', 'hipy', 'fullName', 'area', 'lbl', 'tag', 'sample', 'title', 'sub',
  'histLead', 'history', 'provinces', 'geos', 'regions'
];

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

test('共享数据包含十个互不重复的方言', () => {
  assert.equal(data.dialects.length, 10);
  const ids = data.dialects.map((d) => d.id);
  assert.equal(new Set(ids).size, 10);
  assert.deepEqual(ids, [
    'beijing', 'guangzhou', 'shanghai', 'xiamen', 'meizhou',
    'changsha', 'nanchang', 'taiyuan', 'huizhou', 'nanning'
  ]);
});

test('每个方言的必填字段完整且类型正确', () => {
  for (const dialect of data.dialects) {
    for (const field of REQUIRED_FIELDS) {
      assert.notEqual(dialect[field], undefined, dialect.id + ' 缺少 ' + field);
      assert.notEqual(dialect[field], null, dialect.id + ' 的 ' + field + ' 为 null');
      assert.notEqual(dialect[field], '', dialect.id + ' 的 ' + field + ' 为空');
    }
    assert.match(dialect.color, /^#[0-9A-Fa-f]{6}$/, dialect.id + ' 颜色格式不正确');
    assert.equal(typeof dialect.name, 'string');
    assert.equal(typeof dialect.title, 'string');
  }
});

test('历史、省份、地图范围与风俗数据齐全', () => {
  for (const dialect of data.dialects) {
    assert.ok(Array.isArray(dialect.history), dialect.id + ' history 不是数组');
    assert.equal(dialect.history.length, 8, dialect.id + ' 历史阶段应为 8 段');
    for (const stage of dialect.history) {
      assert.ok(Array.isArray(stage), dialect.id + ' 历史阶段不是数组');
      assert.ok(stage.length >= 2, dialect.id + ' 历史阶段缺少标题或正文');
      assert.ok(stage[0] && stage[1], dialect.id + ' 历史阶段标题或正文为空');
    }

    assert.ok(Array.isArray(dialect.provinces), dialect.id + ' provinces 不是数组');
    assert.ok(dialect.provinces.length > 0, dialect.id + ' 省份为空');
    assert.equal(new Set(dialect.provinces).size, dialect.provinces.length, dialect.id + ' 省份重复');

    assert.ok(Array.isArray(dialect.geos), dialect.id + ' geos 不是数组');
    assert.ok(dialect.geos.length > 0, dialect.id + ' 地图范围为空');
    for (const geo of dialect.geos) {
      assert.equal(typeof geo.name, 'string');
      assert.ok(Array.isArray(geo.points) && geo.points.length >= 3, dialect.id + ' 地图多边形点数不足');
      for (const point of geo.points) {
        assert.ok(Array.isArray(point) && point.length === 2, dialect.id + ' 地图坐标格式不正确');
        assert.ok(Number.isFinite(point[0]) && Number.isFinite(point[1]));
        assert.ok(point[0] >= -180 && point[0] <= 180, dialect.id + ' 经度越界');
        assert.ok(point[1] >= -90 && point[1] <= 90, dialect.id + ' 纬度越界');
      }
    }

    assert.ok(Array.isArray(dialect.regions), dialect.id + ' regions 不是数组');
    assert.ok(dialect.regions.length > 0, dialect.id + ' 风俗地区为空');
    for (const region of dialect.regions) {
      assert.equal(typeof region.name, 'string');
      assert.equal(typeof region.cities, 'string');
      assert.ok(Array.isArray(region.items) && region.items.length > 0, dialect.id + ' 风俗条目为空');
    }
  }
});

test('byId 与 dialects 一一对应', () => {
  assert.equal(Object.keys(data.byId).length, data.dialects.length);
  for (const dialect of data.dialects) {
    assert.equal(data.byId[dialect.id], dialect);
  }
});

test('主页、详情页、社区与服务端都读取共享数据', () => {
  const main = read('方言学习页.html');
  const detail = read('fangyan-detail.html');
  const community = read('assets/community.js');
  const server = read('server.js');

  assert.match(main, /var DIALECTS=FANGYAN_DATA\.dialects;/);
  assert.match(detail, /var DET=FANGYAN_DATA\.byId;/);
  assert.match(main, /src="assets\/data\/dialects\.js[^"]*"/);
  assert.match(detail, /src="assets\/data\/dialects\.js[^"]*"/);
  assert.doesNotMatch(main, /var DIALECTS=\[/);
  assert.doesNotMatch(detail, /var DET=\{/);

  assert.match(community, /FANGYAN_DATA/);
  assert.doesNotMatch(community, /CM_PROVINCES/);
  assert.match(server, /require\('\.\/assets\/data\/dialects\.js'\)/);
});

test('页面中的详情字段使用合并后的命名', () => {
  const detail = read('fangyan-detail.html');
  assert.doesNotMatch(detail, /\bd\.full\b/);
  assert.doesNotMatch(detail, /\bd\.region\b/);
  assert.match(detail, /\bd\.fullName\b/);
  assert.match(detail, /\bd\.area\b/);
});

test('主页图片使用响应式 srcset，并补充分享与结构化数据', () => {
  const main = read('方言学习页.html');
  for (const dialect of data.dialects) {
    const expected = 'assets/' + dialect.id + '-800.webp 800w, assets/' + dialect.id + '-1600.webp 1600w';
    assert.ok(main.includes(expected), dialect.id + ' 缺少 800w/1600w srcset');
  }
  assert.match(main, /sizes="\(min-width:1080px\) 220px/);
  assert.match(main, /name="twitter:card"/);
  assert.match(main, /property="og:image:alt"/);
  assert.match(main, /'@type':'ItemList'/);
  assert.match(main, /application\/ld\+json/);
});

test('详情页预连接地图依赖并输出页面结构化数据', () => {
  const detail = read('fangyan-detail.html');
  assert.match(detail, /rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net"/);
  assert.match(detail, /rel="preconnect" href="https:\/\/t0\.tianditu\.gov\.cn"/);
  assert.match(detail, /width="1600" height="1067"/);
  assert.match(detail, /function renderSeo\(d\)/);
  assert.match(detail, /'@type':'WebPage'/);
  assert.match(detail, /name="twitter:card"/);
});

test('试听按钮与音频标题保持可访问结构', () => {
  const main = read('方言学习页.html');
  assert.match(main, /<span class="sr-only">试听示例（普通话合成音）<\/span>/);
  assert.doesNotMatch(main, /class="bub"[^>]*aria-label=/);

  const detail = read('fangyan-detail.html');
  assert.doesNotMatch(detail, /aria-label="试听示例/);
  assert.match(detail, /<span class="sr-only">（普通话合成音，非方言真实发音）<\/span>/);
  assert.match(detail, /'<h3>'\+esc\(a\.title/);
  assert.match(detail, /title:g\.name\+'核心区'/);
});
