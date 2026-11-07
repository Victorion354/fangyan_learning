/* 一声一味 · 十大方言图鉴 */
var DET=FANGYAN_DATA.byId;
function $(s,c){return (c||document).querySelector(s)}
function $$(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))}
function toast(t){var d=$('#toast');d.textContent=t;d.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(function(){d.classList.remove('show')},2200)}
function speak(text,btn){
  if(btn){btn.classList.add('playing');clearTimeout(btn._t);btn._t=setTimeout(function(){btn.classList.remove('playing')},1800)}
  if(!('speechSynthesis' in window)){toast('当前浏览器不支持语音朗读');return}
  try{window.speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';u.rate=.88;window.speechSynthesis.speak(u);toast('正在朗读（普通话合成音，非方言发音）：'+text)}catch(e){toast('语音朗读暂不可用')}
}
/* ---- 方言切换 ---- */
function initSwitch(d){
  var sel=$('#d-switch');
  if(!sel)return;
  if(!sel.options.length){
    sel.innerHTML=Object.keys(DET).map(function(k){return '<option value="'+k+'">'+DET[k].name+'</option>'}).join('');
    sel.addEventListener('change',function(){if(sel.value===d.id)return;location.href='fangyan-detail.html?d='+encodeURIComponent(sel.value)});
  }
  sel.value=d.id;
}

/* ---- 基础工具 ---- */
function params(){
  var m=location.search.match(/[?&]d=([^&]+)/);
  return m?decodeURIComponent(m[1]):'beijing';
}
function apiBase(){
  var c=window.FANGYAN_CONFIG||{};
  if(c.apiBase)return String(c.apiBase).replace(/\/$/,'');
  if(location.protocol==='http:'||location.protocol==='https:')return '';
  return 'http://localhost:8787';
}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

/* ---- 离线 SVG 地图 ---- */
function drawMap(d){
  var host=$('#cnmap'),svg=$('#cnmap-svg'),prov=$('#cnmap-prov'),geo=$('#cnmap-geo');
  if(!window.CNPROV||!window.CNMAP_SCALE){
    host.innerHTML='<p style="padding:40px;text-align:center;color:#8a7f6d">地图数据未加载，请确认 assets/mapdata.js 存在。</p>';
    return;
  }
  var on={};
  (d.provinces||[]).forEach(function(n){on[n]=1});
  prov.innerHTML=Object.keys(window.CNPROV).map(function(n){
    return '<path class="prov'+(on[n]?' on':'')+'" d="'+window.CNPROV[n]+'"><title>'+esc(n)+'</title></path>';
  }).join('');
  var S=window.CNMAP_SCALE,minx=window.CNMAP_MINX,maxy=window.CNMAP_MAXY;
  geo.innerHTML=(d.geos||[]).map(function(g){
    var pts=g.points.map(function(p){return ((p[0]-minx)*S).toFixed(1)+','+((maxy-p[1])*S).toFixed(1)}).join(' ');
    return '<polygon class="geo" points="'+pts+'"><title>'+esc(g.name)+'</title></polygon>';
  }).join('');
  svg.setAttribute('viewBox','0 0 '+window.CNMAP_W+' '+window.CNMAP_H);
  svg.setAttribute('aria-label',d.name+'主要分布示意地图');
  $('#map-provinces').innerHTML='<b>涉及地区：</b>'+esc((d.provinces||[]).join('、'));
}

/* ---- 实时地图（Leaflet + 天地图，失败自动回退离线） ---- */
var FYCFG=window.FANGYAN_CONFIG||{};
function tdtKey(){return String((FYCFG.tiandituKey||'')).trim()}
function tdtAttribution(){
  return (FYCFG.map&&FYCFG.map.attribution)||'&copy; <a href="https://www.tianditu.gov.cn/" target="_blank" rel="noopener">天地图</a> · 标准地图数据审图号 GS(2024)0650号';
}
function tdtTileUrl(layer){
  return 'https://t{s}.tianditu.gov.cn/'+layer+'_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER='+layer+'&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk='+encodeURIComponent(tdtKey());
}
function tdtProbe(){
  var url=tdtTileUrl('vec').replace('{s}','0').replace('{z}','4').replace('{y}','6').replace('{x}','13');
  return fetch(url,{cache:'no-store'}).then(function(r){
    if(r.ok)return null;
    return r.text().then(function(t){
      try{return JSON.parse(t)}catch(e){return null}
    });
  }).catch(function(){return null});
}
function tdtFailure(err){
  var msg='天地图底图加载失败，已切换为离线示意';
  var note='* 天地图底图未能加载，已显示离线示意。离线边界来自 DataV GeoJSON（简化），非标准地图，不作为国界或行政区划依据；方言区界线为近似勾勒。';
  if(err&&err.code===301007){
    msg='天地图拒绝访问（301007 域名不匹配）：请把 lvh.me 加入白名单，改用 http://lvh.me:8787/ 访问';
    note='* 天地图拒绝访问（<strong>301007 域名不匹配</strong>）：Key 本身有效，但当前域名不在白名单。天地图控制台不接受 <code>localhost</code> / <code>127.0.0.1</code>；本地调试请把 <code>lvh.me</code>（或 <code>127.0.0.1.nip.io</code>）加入白名单，再改用 <a href="http://lvh.me:8787/fangyan-detail.html">http://lvh.me:8787/</a> 访问。保存后等待几分钟并强制刷新。当前显示离线示意，不作为国界或行政区划依据。';
  }else if(err&&err.code===301012){
    msg='天地图 Key 类型错误（301012）：请使用浏览器端 Key';
    note='* 天地图 Key 类型错误（<strong>301012</strong>）：请改用浏览器端 Key。当前显示离线示意，不作为国界或行政区划依据。';
  }else if(err&&err.code===301013){
    msg='天地图 Key 无效或已停用（301013）';
    note='* 天地图 Key 无效或已停用（<strong>301013</strong>）：请到天地图控制台检查 Key 状态。当前显示离线示意，不作为国界或行政区划依据。';
  }else if(err&&err.msg){
    msg='天地图加载失败：'+err.msg+'（'+(err.code||'未知')+'）';
  }
  var el=$('#map-note');
  if(el)el.innerHTML=note;
  var st=$('#map-status');
  if(st)st.textContent='离线示意 · 天地图不可用';
  toast(msg);
}
function tdtFallback(){
  if(tdtFallbackStarted)return;
  tdtFallbackStarted=true;
  setMapMode('offline');
  tdtProbe().then(tdtFailure);
}
var liveMap=null,liveProvinceLayer=null,liveGeoLayer=[],liveTileLayer=null,liveAnnotationLayer=null;
var leafletPromise=null,mapMode='live',mapDialect=null,tileErrors=0,mapInitialized=false,mapTilesOk=false,liveFallbackTimer=null,tdtFallbackStarted=false;

function loadLeaflet(){
  if(window.L&&window.L.map)return Promise.resolve(window.L);
  if(leafletPromise)return leafletPromise;
  leafletPromise=new Promise(function(resolve,reject){
    function addCss(list,i){
      if(i>=list.length)return;
      var css=document.createElement('link');
      css.rel='stylesheet';css.href=list[i];
      css.onerror=function(){if(css.parentNode)css.parentNode.removeChild(css);addCss(list,i+1)};
      document.head.appendChild(css);
    }
    addCss([
      'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    ],0);
    var urls=[
      'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    ];
    var i=0;
    function next(){
      if(i>=urls.length){reject(new Error('leaflet load failed'));return}
      var s=document.createElement('script');
      s.src=urls[i++];s.async=true;
      var done=false;
      var timer=setTimeout(function(){if(done)return;done=true;if(s.parentNode)s.parentNode.removeChild(s);next()},7000);
      s.onload=function(){
        if(done)return;done=true;clearTimeout(timer);
        if(window.L&&window.L.map)resolve(window.L);else next();
      };
      s.onerror=function(){
        if(done)return;done=true;clearTimeout(timer);
        if(s.parentNode)s.parentNode.removeChild(s);
        next();
      };
      document.head.appendChild(s);
    }
    next();
  });
  leafletPromise.catch(function(){leafletPromise=null});
  return leafletPromise;
}

function setMapStatus(kind,text){
  var el=$('#map-status');
  if(!el)return;
  el.className='map-status '+(kind||'');
  el.textContent=text;
}

function noKeyNote(){
  $('#map-note').innerHTML='* 未配置天地图 Web Key，当前显示离线示意。请编辑 <code>assets/config.js</code> 填入浏览器端 Key；方言区界线为近似示意，不作为国界或行政区划依据。';
  setMapStatus('offline','离线示意 · 未配置 Key');
}

function setMapMode(mode){
  mapMode=mode;
  var liveEl=$('#live-map'),offEl=$('#cnmap'),loading=$('#map-loading');
  $$('.map-tab').forEach(function(t){
    var on=t.getAttribute('data-mode')===mode;
    t.classList.toggle('on',on);
    t.setAttribute('aria-selected',on?'true':'false');
  });
  if(mode==='offline'){
    liveEl.hidden=true;offEl.hidden=false;loading.hidden=true;
    setMapStatus('offline','离线示意 · 无需联网');
    if(mapDialect){
      $('#map-lead').textContent='离线示意：高亮省份为「'+mapDialect.name+'」的主要分布区，色块为核心区域，悬停或点按可查看省名。';
      $('#map-range').textContent='高亮省份为涉及地区，色块为核心分布区（示意）';
      $('#map-note').innerHTML='* 离线示意：行政边界数据来自 DataV GeoJSON（简化），非标准地图，不作为国界或行政区划依据；方言区界线为近似勾勒。';
    }
    if(!tdtKey())noKeyNote();
  }else{
    offEl.hidden=true;liveEl.hidden=false;
    if(liveMap){
      loading.hidden=true;
      setMapStatus('live','天地图 · 可缩放拖动');
      setTimeout(function(){liveMap.invalidateSize()},80);
    }else{
      loading.hidden=false;
      setMapStatus('','正在连接…');
    }
    if(mapDialect){
      $('#map-lead').textContent='天地图底图可缩放、拖动；高亮省份为「'+mapDialect.name+'」的主要分布区，虚线圈和脉冲点为核心区，点击省份可查看名称。';
      $('#map-range').textContent='高亮省份为涉及地区，虚线圈与脉冲点为核心分布区';
      $('#map-note').innerHTML='* 在线底图来自 <strong>天地图</strong>（国家地理信息公共服务平台），标准地图数据审图号 GS(2024)0650号；方言区范围与核心区为近似示意，不作为国界或行政区划依据。';
    }
  }
}

function renderLiveMap(d,retried){
  if(!window.L||!window.CNGEO)throw new Error('map data missing');
  var host=$('#live-map');
  host.hidden=false;
  $('#cnmap').hidden=true;
  $('#map-loading').hidden=false;
  if(!liveMap){
    liveMap=L.map(host,{zoomControl:true,scrollWheelZoom:false,minZoom:2,maxZoom:18,worldCopyJump:true});
    liveMap.attributionControl.setPrefix('');
    liveMap.setView([35,105],4);
  }else{
    liveMap.invalidateSize();
  }
  try{
  if(liveTileLayer){liveMap.removeLayer(liveTileLayer);liveTileLayer=null}
  if(liveAnnotationLayer){liveMap.removeLayer(liveAnnotationLayer);liveAnnotationLayer=null}
  tileErrors=0;
  tdtFallbackStarted=false;
  mapTilesOk=false;
  if(!tdtKey())throw new Error('tianditu key missing');
  if(!liveMap.getPane('tdtBase')){
    liveMap.createPane('tdtBase');
    liveMap.getPane('tdtBase').style.zIndex=200;
  }
  if(!liveMap.getPane('tdtAnno')){
    liveMap.createPane('tdtAnno');
    liveMap.getPane('tdtAnno').style.zIndex=250;
  }
  var tileOpts={
    subdomains:'01234567',
    maxZoom:18,
    maxNativeZoom:18
  };
  liveTileLayer=L.tileLayer(tdtTileUrl('vec'),Object.assign({pane:'tdtBase',attribution:tdtAttribution()},tileOpts)).addTo(liveMap);
  liveAnnotationLayer=L.tileLayer(tdtTileUrl('cva'),Object.assign({pane:'tdtAnno',attribution:''},tileOpts)).addTo(liveMap);
  var tileLoaded=0;
  function tileOk(){tileLoaded++;mapTilesOk=true;setMapStatus('live','天地图 · 可缩放拖动')}
  function tileFail(){
    tileErrors++;
    if(!tileLoaded&&tileErrors>=6&&mapMode==='live'){
      tdtFallback();
    }
  }
  liveTileLayer.on('tileload',tileOk);
  liveAnnotationLayer.on('tileload',tileOk);
  liveTileLayer.on('tileerror',tileFail);
  liveAnnotationLayer.on('tileerror',tileFail);
  clearTimeout(liveFallbackTimer);
  liveFallbackTimer=setTimeout(function(){
    if(mapMode==='live'&&!tileLoaded){
      tdtFallback();
    }
  },12000);

  var on={};
  (d.provinces||[]).forEach(function(n){on[n]=1});
  var bounds=L.latLngBounds([]);
  if(liveProvinceLayer){liveMap.removeLayer(liveProvinceLayer)}
  liveProvinceLayer=L.geoJSON(window.CNGEO,{
    style:function(f){
      var n=(f.properties||{}).name||'';
      return {color:'#fbf7ee',weight:1,fillColor:on[n]?d.color:'#ded2ba',fillOpacity:on[n]?0.55:0.3};
    },
    onEachFeature:function(f,layer){
      var n=(f.properties||{}).name||'';
      if(on[n]){
        var b=layer.getBounds();
        if(b.isValid())bounds.extend(b);
      }
      if(n)layer.bindTooltip(n+(on[n]?' · '+d.name+'主要分布区':''),{sticky:true,className:'map-tip'});
      layer.on('mouseover',function(){layer.setStyle({fillOpacity:on[n]?0.76:0.46})});
      layer.on('mouseout',function(){layer.setStyle({fillOpacity:on[n]?0.55:0.3})});
    }
  }).addTo(liveMap);

  liveGeoLayer.forEach(function(layer){liveMap.removeLayer(layer)});
  liveGeoLayer=[];
  (d.geos||[]).forEach(function(g){
    var pts=g.points.map(function(p){return [p[1],p[0]]});
    var poly=L.polygon(pts,{color:d.color,weight:2,opacity:.92,dashArray:'6 5',fillColor:d.color,fillOpacity:.18,interactive:true}).addTo(liveMap);
    poly.bindTooltip(g.name,{sticky:true,className:'map-tip'});
    liveGeoLayer.push(poly);
    var c=g.points.reduce(function(a,p){return [a[0]+p[0],a[1]+p[1]]},[0,0]);
    c=[c[0]/g.points.length,c[1]/g.points.length];
    var marker=L.marker([c[1],c[0]],{
      icon:L.divIcon({className:'geo-pulse',html:'<span></span>',iconSize:[14,14],iconAnchor:[7,7]}),
      interactive:false,
      keyboard:false,
      title:g.name+'核心区'
    }).addTo(liveMap);
    liveGeoLayer.push(marker);
  });

  var china=L.latLngBounds([[17.5,73],[54.5,135.5]]);
  if(bounds.isValid())liveMap.fitBounds(bounds,{padding:[26,26],maxZoom:6});
  else liveMap.fitBounds(china,{padding:[20,20]});
  setTimeout(function(){liveMap.invalidateSize()},100);
  $('#map-loading').hidden=true;
  mapTilesOk=false;
  setTimeout(function(){mapTilesOk=true},1800);
  setMapMode('live');
  }catch(e){
    if(retried)throw e;
    try{liveMap.remove()}catch(_){}
    liveMap=null;liveProvinceLayer=null;liveGeoLayer=[];liveTileLayer=null;liveAnnotationLayer=null;
    return renderLiveMap(d,true);
  }
}

function initLiveMap(d){
  mapDialect=d;
  mapMode='live';
  if(!tdtKey()){
    setMapMode('offline');
    noKeyNote();
    if(!mapInitialized){toast('未配置天地图 Key，已显示离线示意');mapInitialized=true}
    return;
  }
  setMapStatus('','正在连接…');
  loadLeaflet().then(function(){
    if(mapMode==='offline')return;
    renderLiveMap(d);
  }).catch(function(){
    if(!mapInitialized)toast('在线地图暂时不可用，已显示离线示意');
    mapInitialized=true;
    setMapMode('offline');
  });
}

function bindMapTabs(){
  $$('.map-tab').forEach(function(t){
    t.addEventListener('click',function(){
      var mode=t.getAttribute('data-mode');
      if(mode==='offline'){setMapMode('offline');return}
      if(!tdtKey()){
        toast('请先在 assets/config.js 填写天地图 Web Key');
        setMapMode('offline');
        noKeyNote();
        return;
      }
      if(liveMap&&window.L&&window.CNGEO){
        setMapMode('live');
        renderLiveMap(mapDialect);
        return;
      }
      setMapMode('live');
      initLiveMap(mapDialect);
    });
  });
}

/* ---- 人口数据与折线图 ---- */
var POP=[
  {id:'beijing',name:'官话',chart:'官话',value:79858,color:'#B07C2A'},
  {id:'xiamen',name:'闽南语',chart:'闽语*',value:7500,color:'#2A5C8A'},
  {id:'shanghai',name:'吴语',chart:'吴语',value:7379,color:'#2E726E'},
  {id:'taiyuan',name:'晋语',chart:'晋语',value:6305,color:'#6E5B8A'},
  {id:'guangzhou',name:'粤语',chart:'粤语',value:5882,color:'#C23E33'},
  {id:'nanchang',name:'赣语',chart:'赣语',value:4800,color:'#3A7BA0'},
  {id:'meizhou',name:'客家话',chart:'客家话',value:4220,color:'#8A6A40'},
  {id:'changsha',name:'湘语',chart:'湘语',value:3637,color:'#C24A5A'},
  {id:'nanning',name:'平话',chart:'平话',value:778,color:'#5E8A54'},
  {id:'huizhou',name:'徽语',chart:'徽语',value:330,color:'#2E5A48'}
];
var POP_TOTAL=POP.reduce(function(a,p){return a+p.value},0);
var POP_KV={
  beijing:[['覆盖','北方·西南约28个省级行政区'],['地位','普通话的基础方言'],['特点','汉语最大方言区']],
  guangzhou:[['覆盖','粤桂港澳琼'],['代表音','广州话'],['特点','保留入声·九声调']],
  shanghai:[['覆盖','沪苏浙皖赣'],['代表音','苏州话·上海话'],['特点','保留全浊声母']],
  xiamen:[['覆盖','闽台粤浙琼'],['代表音','厦门话·泉州话'],['特点','保留较多古汉语词']],
  meizhou:[['覆盖','粤闽赣桂川台'],['代表音','梅州话'],['特点','分布广·迁徙印记']],
  changsha:[['覆盖','湖南大部·桂北'],['代表音','长沙话'],['特点','老湘语保留浊音']],
  nanchang:[['覆盖','赣湘鄂皖闽'],['代表音','南昌话'],['特点','江右商帮·古词丰富']],
  taiyuan:[['覆盖','晋蒙陕冀豫'],['代表音','太原话'],['特点','北方方言中保留入声']],
  huizhou:[['覆盖','皖南·浙西·赣东北'],['代表音','歙县话·绩溪话'],['特点','内部差异大']],
  nanning:[['分布','桂南·湘南·滇东·粤西'],['归属','粤语支系'],['别名','桂南平话·土官话']]
};
var POP_SRC='数据来源：中国社会科学院语言研究所等《中国语言地图集》第 2 版（2012），各方言区人口依据 2004 年《中国行政区划简册》；官话为官话大区合计，闽语为闽语大区合计（含闽东、莆仙等，图中标为“闽语*”），平话为“平话和土话”合计。';
var POP_META={source:'中国社会科学院语言研究所等《中国语言地图集》第 2 版（2012）',basis:'人口数字依据 2004 年《中国行政区划简册》',publishedAt:'2012',basisYear:2004,checkedAt:null,mode:'static'};
var popLoaded=false,popFetching=false;

function popUpdatedText(){
  var bits=[];
  bits.push(POP_META.mode==='server'?'服务端读取':'内置公开统计');
  if(POP_META.publishedAt)bits.push('数据版本 '+POP_META.publishedAt);
  if(POP_META.basisYear)bits.push(POP_META.basisYear+' 年人口口径');
  if(POP_META.checkedAt)bits.push('校验于 '+new Date(POP_META.checkedAt).toLocaleString('zh-CN',{hour12:false}));
  bits.push('非实时人口');
  return bits.join(' · ');
}
function updatePopUpdated(){
  var el=$('#pop-updated');
  if(el)el.textContent=popUpdatedText();
}
function applyPopulationPayload(payload){
  if(!payload||!Array.isArray(payload.items))return false;
  payload.items.forEach(function(item){
    for(var i=0;i<POP.length;i++){
      if(POP[i].id===item.id){
        POP[i].value=+item.value||POP[i].value;
        if(item.chart)POP[i].chart=item.chart;
        if(item.color)POP[i].color=item.color;
        if(item.name)POP[i].name=item.name;
      }
    }
  });
  POP_TOTAL=POP.reduce(function(a,p){return a+p.value},0);
  POP_META={
    source:payload.source||POP_META.source,
    basis:payload.basis||POP_META.basis,
    publishedAt:payload.publishedAt||POP_META.publishedAt,
    basisYear:payload.basisYear||POP_META.basisYear,
    checkedAt:payload.checkedAt||null,
    mode:'server'
  };
  POP_SRC='数据来源：'+POP_META.source+(POP_META.basis?'；'+POP_META.basis:'')+'。';
  return true;
}
function loadPopulation(force){
  if(popFetching)return Promise.resolve(false);
  if(popLoaded&&!force)return Promise.resolve(true);
  popFetching=true;
  var ctrl=window.AbortController?new AbortController():null;
  var timer=setTimeout(function(){if(ctrl)ctrl.abort()},3500);
  return fetch(apiBase()+'/api/population',{cache:'no-store',signal:ctrl?ctrl.signal:undefined})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
    .then(function(payload){
      clearTimeout(timer);popFetching=false;
      var ok=applyPopulationPayload(payload);
      popLoaded=ok;
      if(ok&&mapDialect)renderPopulation(mapDialect);
      updatePopUpdated();
      if(force)toast(ok?'人口数据已从服务端刷新':'服务端返回的数据格式不可用');
      return ok;
    })
    .catch(function(){
      clearTimeout(timer);popFetching=false;popLoaded=false;
      updatePopUpdated();
      if(force)toast('服务端不可用，继续使用内置公开统计');
      return false;
    });
}

function fmtPop(v){
  if(v>=10000)return (v/10000).toFixed(2).replace(/\.?0+$/,'')+'亿';
  return v+'万';
}
function tickLabel(v){
  if(v>=10000)return (v/10000)+'万';
  return String(v);
}
function drawPopChart(d){
  var data=POP.slice().sort(function(a,b){return b.value-a.value});
  var cw=$('#pop-chart').clientWidth||0;
  var narrow=cw>0&&cw<560;
  var s='';
  var ci=-1;
  data.forEach(function(p,i){if(p.id===d.id)ci=i});
  var logMin=Math.log10(300),logMax=Math.log10(100000);
  if(narrow){
    /* 窄屏：横向条形图，名字和数字都能看清 */
    var W=cw||360,H=448,padT=14,padB=28,rowH=(H-padT-padB)/data.length;
    var barX=74,barMax=W-barX-58;
    data.forEach(function(p,i){
      var now=p.id===d.id;
      var y=padT+i*rowH,cy=y+rowH/2;
      if(now)s+='<rect x="0" y="'+y+'" width="'+W+'" height="'+rowH+'" fill="'+d.color+'" opacity=".08" rx="8"/>';
      s+='<text class="pop-label'+(now?' now':'')+'" x="8" y="'+(cy+4)+'" text-anchor="start" style="font-size:13px">'+esc(p.chart)+'</text>';
      s+='<rect x="'+barX+'" y="'+(cy-7)+'" width="'+barMax+'" height="14" fill="#eee4d2" rx="7"/>';
      var w=Math.max(4,(Math.log10(p.value)-logMin)/(logMax-logMin)*barMax);
      s+='<rect class="pop-bar" x="'+barX+'" y="'+(cy-7)+'" width="'+w.toFixed(1)+'" height="14" fill="'+p.color+'" rx="7"><title>'+esc(p.name)+'：'+p.value+' 万人</title></rect>';
      s+='<text class="pop-label'+(now?' now':'')+'" x="'+(barX+w+6)+'" y="'+(cy+4)+'" text-anchor="start" style="font-size:12px">'+p.value+'</text>';
    });
    s+='<text class="pop-label small" x="8" y="'+(H-8)+'" text-anchor="start">条形越长，人口越多 · 对数压缩 · 单位：万人</text>';
    $('#pop-chart').setAttribute('viewBox','0 0 '+W+' '+H);
    $('#pop-axis-note').textContent='单位：万人 · 条形长度按对数压缩';
  }else{
    var W2=cw||760,H2=330,padL=58,padR=26,padT=34,padB=54;
    var X=function(i){return padL+i*(W2-padL-padR)/(data.length-1)};
    var Y=function(v){var t=(Math.log10(v)-logMin)/(logMax-logMin);return padT+(1-t)*(H2-padT-padB)};
    if(ci>=0)s+='<rect x="'+(X(ci)-24)+'" y="'+padT+'" width="48" height="'+(H2-padT-padB)+'" fill="'+d.color+'" opacity=".07" rx="8"/>';
    [300,1000,3000,10000,30000,100000].forEach(function(t){
      var y=Y(t);
      s+='<line class="pop-grid" x1="'+padL+'" y1="'+y+'" x2="'+(W2-padR)+'" y2="'+y+'"/>';
      s+='<text class="pop-label small" x="'+(padL-8)+'" y="'+(y+4)+'" text-anchor="end">'+tickLabel(t)+'</text>';
    });
    s+='<line class="pop-axis" x1="'+padL+'" y1="'+(H2-padB)+'" x2="'+(W2-padR)+'" y2="'+(H2-padB)+'"/>';
    var path=data.map(function(p,i){return (i?'L':'M')+X(i).toFixed(1)+' '+Y(p.value).toFixed(1)}).join(' ');
    s+='<path class="pop-line" d="'+path+'" pathLength="100"/>';
    data.forEach(function(p,i){
      var now=p.id===d.id;
      var y=Y(p.value);
      if(now)s+='<circle cx="'+X(i)+'" cy="'+y+'" r="10" fill="'+d.color+'" opacity=".18"/>';
      s+='<circle class="pop-point" cx="'+X(i)+'" cy="'+y+'" r="'+(now?5.5:4)+'" fill="'+p.color+'"><title>'+esc(p.name)+'：'+p.value+' 万人</title></circle>';
      var ly=Math.max(14,y-11);
      var lx=X(i),anchor='middle';
      if(i===0){lx=X(i)+9;anchor='start'}
      s+='<text class="pop-label'+(now?' now':'')+'" x="'+lx+'" y="'+ly+'" text-anchor="'+anchor+'">'+p.value+'</text>';
      s+='<text class="pop-label'+(now?' now':'')+'" x="'+X(i)+'" y="'+(H2-32)+'" text-anchor="middle">'+esc(p.chart)+'</text>';
    });
    s+='<text class="pop-label small" x="'+(W2-padR)+'" y="'+(H2-8)+'" text-anchor="end">按人口从多到少排列 · 连线仅用于比较</text>';
    $('#pop-chart').setAttribute('viewBox','0 0 '+W2+' '+H2);
    $('#pop-axis-note').textContent='单位：万人 · 纵轴为对数刻度';
  }
  $('#pop-chart').innerHTML=s;
  $('#pop-chart').setAttribute('aria-label','十个方言区使用人口对比（万人）：'+data.map(function(p){return p.chart+' '+p.value}).join('，'));
}

function renderPopulation(d){
  var pd=POP.filter(function(p){return p.id===d.id})[0]||POP[0];
  var sorted=POP.slice().sort(function(a,b){return b.value-a.value});
  var rank=sorted.map(function(p){return p.id}).indexOf(d.id)+1;
  var share=(pd.value/POP_TOTAL*100).toFixed(1);
  $('#data-title').textContent='「'+d.name+'」的使用人口';
  $('#pop-num').innerHTML=fmtPop(pd.value)+'<small>人</small>';
  $('#pop-desc').textContent='《中国语言地图集》第 2 版统计口径下，「'+d.name+'」的使用人口；该地图集的人口数字依据 2004 年行政区划人口资料，是十个方言区同一口径下较完整的一组数据。';
  $('#pop-kv').innerHTML=(POP_KV[d.id]||[]).map(function(k){return '<span><b>'+esc(k[0])+'</b>'+esc(k[1])+'</span>'}).join('');
  $('#pop-side').textContent=popNote(d);
  $('#pop-badge').textContent='十区中第 '+rank+' 位 · 占十区合计 '+share+'%';
  $('#pop-src').textContent=POP_SRC;
  updatePopUpdated();
  drawPopChart(d);
}

/* ---- 渲染 ---- */
function popNote(d){
  if(d.id==='beijing')return '注：官话是方言大区，包含东北、北京、冀鲁、胶辽、中原、兰银、江淮、西南八个区；官话不等于普通话，普通话是以北京语音为标准音、以北方话为基础方言的通用语。';
  if(d.id==='xiamen')return '注：地图集里的“闽语区”包含闽南、闽东、莆仙等分支，范围大于日常所说的“闽南语”，图中标为“闽语*”。';
  if(d.id==='nanning')return '注：地图集口径为“平话和土话区”，范围大于桂南平话；不同调查对平话人口的估计差别较大。';
  return '注：不同资料统计口径差别很大，有按方言区常住人口，也有按全球华人使用者。本页统一采用《中国语言地图集》第 2 版的十区口径，方便横向比较。';
}
function renderAudio(d){
  var all=window.FANGYAN_AUDIO||{};
  var list=all[d.id]||[];
  $('#audio-title').textContent='「'+d.name+'」的人言乡音';
  var el=$('#audio-list');
  if(!el)return;
  if(!list.length){
    el.innerHTML='<div class="audio-empty"><b>暂无授权录音</b>'+
      '<p>目前没有找到许可清晰、可再分发的「'+esc(d.name)+'」真人录音。为避免用合成音或未授权音频冒充方言，这里保持空白。</p>'+
      '<p>如果你有可授权的声音样本，欢迎到<a href="方言学习页.html#community">主页面乡音社区</a>留下语音，或到<a href="https://tatoeba.org/" target="_blank" rel="noopener">Tatoeba</a>等开放语料库贡献录音。</p></div>';
    $('#audio-note').textContent='说明：本页只接入许可清晰的真人录音；没有授权录音的方言会如实标注，不用合成音或未授权音频代替。';
    return;
  }
  el.innerHTML=list.map(function(a){
    var lic=a.licenseUrl?'<a href="'+esc(a.licenseUrl)+'" target="_blank" rel="noopener">'+esc(a.license||'许可')+'</a>':esc(a.license||'');
    var src=a.sourceUrl?'<a href="'+esc(a.sourceUrl)+'" target="_blank" rel="noopener">'+esc(a.source||'来源')+'</a>':esc(a.source||'');
    return '<article class="audio-item">'+
      '<h3>'+esc(a.title||'方言录音')+'</h3>'+
      (a.translation?'<p class="tr">'+esc(a.translation)+'</p>':'')+
      (a.roman?'<p class="roman">'+esc(a.roman)+'</p>':'')+
      '<audio controls preload="none" src="'+esc(a.src)+'"></audio>'+
      '<p class="audio-meta"><span class="lic">'+lic+'</span>录音：'+esc(a.speaker||'未署名')+' · 来源：'+src+'</p>'+
      (a.note?'<p class="audio-meta">'+esc(a.note)+'</p>':'')+
    '</article>';
  }).join('');
  $('#audio-note').innerHTML='说明：以上均为可再分发的真人录音，逐条标注作者、许可与来源。播放器音质与口音因录音来源而异；上方“试听合成音”按钮为浏览器普通话合成音，并非方言真实读音。';
}

function renderSeo(d){
  var setMeta=function(selector,value){
    var el=document.querySelector(selector);
    if(el)el.setAttribute('content',value);
  };
  setMeta('meta[property="og:image:alt"]',d.name+' · '+d.area);
  setMeta('meta[name="twitter:title"]',d.title+' · 一声一味');
  setMeta('meta[name="twitter:description"]',d.sub);
  setMeta('meta[name="twitter:image"]','assets/'+d.id+'.jpg');

  var ld={
    '@context':'https://schema.org',
    '@type':'WebPage',
    name:d.title+' · 一声一味',
    description:d.sub,
    inLanguage:'zh-CN',
    about:{'@type':'Thing',name:d.name,alternateName:d.fullName},
    isPartOf:{'@type':'WebSite',name:'一声一味 · 中国十大方言',inLanguage:'zh-CN'}
  };
  var el=document.getElementById('page-jsonld');
  if(!el){
    el=document.createElement('script');
    el.type='application/ld+json';
    el.id='page-jsonld';
    document.head.appendChild(el);
  }
  el.textContent=JSON.stringify(ld);
}

function render(d){
  document.title=d.name+' · 方言图鉴 · 一声一味';
  var metaDesc=document.querySelector('meta[name="description"]');
  if(metaDesc)metaDesc.setAttribute('content',d.name+'（'+d.fullName+'）：'+d.sub);
  var ogTitle=document.querySelector('meta[property="og:title"]');
  if(ogTitle)ogTitle.setAttribute('content',d.title+' · 一声一味');
  var ogDesc=document.querySelector('meta[property="og:description"]');
  if(ogDesc)ogDesc.setAttribute('content',d.sub);
  var ogImg=document.querySelector('meta[property="og:image"]');
  if(ogImg)ogImg.setAttribute('content','assets/'+d.id+'.jpg');
  renderSeo(d);

  $('#hero-title').textContent=d.title;
  $('#hero-sub').textContent=d.sub;
  $('#hero-tag').textContent='乡音 · '+d.tag+'  ·  '+d.area;
  $('#hear-label').textContent='试听合成音';
  var hear=$('#hear-btn');
  hear.onclick=function(){speak(d.sample,hear)};
  var webp=$('#hero-webp'),heroImg=$('#hero-img');
  if(webp)webp.srcset='assets/'+d.id+'-800.webp 800w, assets/'+d.id+'-1600.webp 1600w';
  if(heroImg){heroImg.src='assets/'+d.id+'.jpg';heroImg.alt=d.name+' · '+d.area;heroImg.classList.add('show');}
  $('#hero-seal').textContent=d.lbl;
  document.documentElement.style.setProperty('--hc',d.color);

  /* 历史 */
  $('#hist-title').textContent='「'+d.name+'」的发展脉络';
  $('#hist-lead').textContent=d.histLead;
  $('#timeline').innerHTML=d.history.map(function(h){
    return '<div class="tl-item"><span class="yr">'+esc(h[0])+'</span><h3>'+esc(h[1])+'</h3><p>'+esc(h[2])+'</p>'+
      (h[3]?'<p class="tl-tip"><b>小贴士</b> '+esc(h[3])+'</p>':'')+'</div>';
  }).join('');

  /* 授权录音 */
  renderAudio(d);

  /* 地区与地图 */
  $('#region-title').textContent='「'+d.name+'」的分布与风俗';
  $('#region-lead').textContent='上方可切换在线底图与离线示意；在线底图使用天地图，未配置 Key 或网络不可用时自动使用离线示意。高亮省份为该方言的主要分布区，右侧为各地区代表风俗。';
  $('#regions').innerHTML=d.regions.map(function(r){
    return '<div class="rg"><h4>'+esc(r.name)+'</h4><div class="cities">'+esc(r.cities)+'</div><ul>'+r.items.map(function(it){return '<li><b>'+esc(it[0])+'</b><span>'+esc(it[1])+'</span></li>'}).join('')+'</ul></div>';
  }).join('');
  $('#map-name').textContent=d.name;
  drawMap(d);
  initSwitch(d);
  initLiveMap(d);
  bindMapTabs();

  /* 人口 */
  renderPopulation(d);

  /* 本页板块快捷入口 */
  syncNavHeight();
  initSecNav();

  observeRVs();
}
function syncNavHeight(){
  var n=document.querySelector('.nav');
  var s=document.querySelector('.sec-nav');
  if(n)document.documentElement.style.setProperty('--nav-h',n.offsetHeight+'px');
  if(s)document.documentElement.style.setProperty('--sec-nav-h',s.offsetHeight+'px');
}
function initSecNav(){
  var links=$$('.sec-nav a');
  if(!links.length)return;
  var secs=[];
  links.forEach(function(a){
    var el=document.getElementById(a.getAttribute('href').slice(1));
    if(el)secs.push({el:el,a:a});
  });
  function setActive(id){
    links.forEach(function(a){
      var on=a.getAttribute('href')==='#'+id;
      a.classList.toggle('on',on);
      if(on)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');
    });
  }
  links.forEach(function(a){
    a.addEventListener('click',function(){setActive(a.getAttribute('href').slice(1))});
  });
  window.addEventListener('resize',syncNavHeight);
  if(!('IntersectionObserver' in window))return;
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){if(e.isIntersecting)setActive(e.target.id)});
  },{rootMargin:'-35% 0px -55% 0px'});
  secs.forEach(function(s){io.observe(s.el)});
}
function observeRVs(){
  var items=$$('.rv');
  if(!('IntersectionObserver' in window)){items.forEach(function(i){i.classList.add('in')});return}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.1});
  items.forEach(function(i){io.observe(i)});
}
function init(){
  var id=params();
  var d=DET[id]||DET.beijing;
  if(!DET[id] && window.history && history.replaceState){
    try{history.replaceState(null,'','fangyan-detail.html?d='+d.id)}catch(e){}
  }
  render(d);
  var popBtn=$('#pop-refresh');
  if(popBtn){
    popBtn.addEventListener('click',function(){
      if(popBtn.disabled)return;
      popBtn.disabled=true;
      popBtn.textContent='刷新中…';
      loadPopulation(true).then(function(){
        popBtn.disabled=false;
        popBtn.textContent='刷新数据';
      });
    });
  }
  loadPopulation();
}
var chartResizeTimer;
window.addEventListener('resize',function(){
  clearTimeout(chartResizeTimer);
  chartResizeTimer=setTimeout(function(){if(mapDialect)drawPopChart(mapDialect)},160);
});
init();
