/* 乡音社区 · 每人一句家乡话（主页面） */
(function(){
  var CM_KEY='fangyan-community-v1';
  var CM_TOKEN_KEY='fangyan-delete-tokens-v1';
  var CM_SESSION_KEY='fangyan-session-v1';
  var CM_TYPES={dialect:'家乡话',suggest:'建议'};
  var CM_PAGE_SIZE=20;
  var cmPosts=[],cmFilter='all',cmProvince='',cmReply=null,cmAudio=null,cmAudioName='',cmAudioFile=null;
  var cmRecording=null,cmStream=null,cmCurrent=null,cmInitialized=false;
  var cmMode='local',cmEventSource=null,cmRefreshTimer=null,cmRetryTimer=null,cmClientId='',cmServerChecked=false,cmSession=null,cmUploads=false;
  var cmNextCursor=null,cmHasMore=false,cmCounts={},cmLoadingMore=false,cmPageSeq=0;

  function cmEsc(s){
    return String(s==null?'':s).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function cmInvalid(el,on){
    if(!el)return;
    if(on)el.setAttribute('aria-invalid','true');
    else el.removeAttribute('aria-invalid');
  }
  function cmApiBase(){
    var c=window.FANGYAN_CONFIG||{};
    if(c.apiBase)return String(c.apiBase).replace(/\/$/,'');
    if(location.protocol==='http:'||location.protocol==='https:')return '';
    return 'http://localhost:8787';
  }
  function cmApi(path){return cmApiBase()+path}
  function cmAccountToken(){
    try{
      var a=window.FANGYAN_ACCOUNT;
      return a&&typeof a.token==='function'?(a.token()||''):'';
    }catch(e){return ''}
  }
  function cmAuthHeader(){
    var t=cmAccountToken();
    return t?{'Authorization':'Bearer '+t}:{};
  }
  function cmBoards(){
    var source=(window.FANGYAN_DATA&&FANGYAN_DATA.dialects)||window.DIALECTS||[];
    return source.map(function(d){
      return {id:d.id,name:d.name,color:d.color,provinces:d.provinces||[]};
    });
  }
  function cmBoardById(id){
    var list=cmBoards();
    for(var i=0;i<list.length;i++)if(list[i].id===id)return list[i];
    return null;
  }
  function cmClient(){
    try{
      var id=localStorage.getItem('fangyan-client-v1');
      if(!id||!/^[A-Za-z0-9_-]{6,64}$/.test(id)){
        id='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
        localStorage.setItem('fangyan-client-v1',id);
      }
      return id;
    }catch(e){return 'c'+Math.random().toString(36).slice(2,12)}
  }
  function cmSessionValid(session){
    return !!(session&&typeof session.token==='string'&&typeof session.clientId==='string'&&
      /^[A-Za-z0-9_-]{6,64}$/.test(session.clientId)&&Number(session.expiresAt)>Date.now()+60000);
  }
  function cmLoadSession(){
    try{
      var raw=localStorage.getItem(CM_SESSION_KEY);
      var obj=raw?JSON.parse(raw):null;
      return cmSessionValid(obj)?obj:null;
    }catch(e){return null}
  }
  function cmSaveSession(session){
    try{localStorage.setItem(CM_SESSION_KEY,JSON.stringify(session))}catch(e){}
  }
  function cmClearSession(){
    cmSession=null;
    try{localStorage.removeItem(CM_SESSION_KEY)}catch(e){}
  }
  function cmRequestSession(){
    var headers={'Content-Type':'application/json'};
    if(cmSession&&cmSession.token)headers['X-Client-Token']=cmSession.token;
    return fetch(cmApi('/api/session'),{method:'POST',headers:headers,cache:'no-store'})
      .then(function(r){
        return r.json().then(function(j){if(!r.ok)throw new Error((j&&j.error)||('HTTP '+r.status));return j});
      })
      .then(function(j){
        if(!j||typeof j.token!=='string'||typeof j.clientId!=='string')throw new Error('会话响应无效');
        cmSession={token:j.token,clientId:j.clientId,expiresAt:Number(j.expiresAt)||0};
        cmSaveSession(cmSession);
        cmClientId=cmSession.clientId;
        return cmSession;
      });
  }
  function cmEnsureSession(force){
    if(!cmSession)cmSession=cmLoadSession();
    if(!force&&cmSessionValid(cmSession))return Promise.resolve(cmSession);
    return cmRequestSession();
  }
  function cmWrite(path,init,retried){
    return cmEnsureSession().then(function(){
      var headers=Object.assign({},init.headers||{},{'X-Client-Token':cmSession.token},cmAuthHeader());
      return fetch(cmApi(path),Object.assign({},init,{headers:headers,cache:'no-store'}));
    }).then(function(r){
      if(r.status===401&&!retried){
        cmClearSession();
        return cmWrite(path,init,true);
      }
      return r.json().then(function(j){if(!r.ok)throw new Error((j&&j.error)||('HTTP '+r.status));return j});
    });
  }
  function cmLoadTokens(){
    try{
      var raw=localStorage.getItem(CM_TOKEN_KEY);
      var obj=raw?JSON.parse(raw):{};
      return obj&&typeof obj==='object'&&!Array.isArray(obj)?obj:{};
    }catch(e){return {}}
  }
  function cmSaveTokens(obj){
    try{localStorage.setItem(CM_TOKEN_KEY,JSON.stringify(obj))}catch(e){}
  }
  function cmTokenFor(id){return cmLoadTokens()[id]||''}
  function cmRememberToken(id,token){
    if(!id||!token)return;
    var obj=cmLoadTokens();
    obj[id]=token;
    cmSaveTokens(obj);
  }
  function cmForgetToken(id){
    var obj=cmLoadTokens();
    delete obj[id];
    cmSaveTokens(obj);
  }
  function cmSetMode(mode){
    cmMode=mode;
    var box=$('#cm-conn'),text=$('#cm-conn-text'),submit=$('#cm-submit');
    if(box)box.className='cm-conn '+(mode==='server'?'live':'local');
    if(text)text.textContent=mode==='server'?'实时服务已连接 · 留言跨浏览器同步':'本地模式 · 只保存在这台浏览器';
    if(submit)submit.textContent=mode==='server'?'发布到实时社区':'发布到本机';
  }
  function cmLoad(){
    try{
      var raw=window.localStorage?localStorage.getItem(CM_KEY):null;
      var arr=raw?JSON.parse(raw):[];
      if(!Array.isArray(arr))return [];
      return arr.filter(function(p){return p&&typeof p.text==='string'&&p.board}).map(function(p){
        p.createdAt=+p.createdAt||Date.now();
        p.likes=+p.likes||0;
        p.liked=!!p.liked;
        return p;
      });
    }catch(e){return []}
  }
  function cmSave(){
    try{
      if(!window.localStorage)throw new Error('no storage');
      localStorage.setItem(CM_KEY,JSON.stringify(cmPosts));
      return true;
    }catch(e){
      toast('本机存储空间不足，语音可能太大；请换小一点的音频');
      return false;
    }
  }
  function cmTime(ts){
    var diff=Date.now()-ts;
    if(diff<60000)return '刚刚';
    if(diff<3600000)return Math.floor(diff/60000)+' 分钟前';
    if(diff<86400000)return Math.floor(diff/3600000)+' 小时前';
    if(diff<7*86400000)return Math.floor(diff/86400000)+' 天前';
    var dt=new Date(ts);
    return dt.getFullYear()+'-'+('0'+(dt.getMonth()+1)).slice(-2)+'-'+('0'+dt.getDate()).slice(-2);
  }
  function cmFind(id){
    for(var i=0;i<cmPosts.length;i++)if(cmPosts[i].id===id)return cmPosts[i];
    return null;
  }
  function cmBoardTotal(id){
    if(cmMode==='server')return Math.max(0,Number(cmCounts[id])||0);
    return cmPosts.filter(function(p){return p.board===id}).length;
  }
  function cmScheduleRefresh(){
    clearTimeout(cmRefreshTimer);
    cmRefreshTimer=setTimeout(function(){cmRefreshPosts()},180);
  }
  function cmFetchPosts(mode){
    var seq=cmPageSeq;
    var headers=Object.assign(
      cmSessionValid(cmSession)?{'X-Client-Token':cmSession.token}:{'X-Client-Id':cmClientId},
      cmAuthHeader()
    );
    var qs='?limit='+CM_PAGE_SIZE;
    if(cmCurrent&&cmCurrent.id)qs+='&board='+encodeURIComponent(cmCurrent.id);
    if(mode==='more'&&cmNextCursor)qs+='&before='+encodeURIComponent(cmNextCursor);
    return fetch(cmApi('/api/community'+qs),{cache:'no-store',headers:headers})
      .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
      .then(function(j){
        if(seq!==cmPageSeq)return null;
        if(!j||!Array.isArray(j.posts))throw new Error('响应格式不正确');
        if(j.counts&&typeof j.counts==='object')cmCounts=j.counts;
        if(mode==='more'){
          var seen={};
          cmPosts.forEach(function(p){seen[p.id]=1});
          j.posts.forEach(function(p){if(!seen[p.id]){seen[p.id]=1;cmPosts.push(p)}});
          cmNextCursor=j.nextCursor||null;
          cmHasMore=!!j.hasMore;
        }else if(mode==='reset'){
          cmPosts=j.posts;
          cmNextCursor=j.nextCursor||null;
          cmHasMore=!!j.hasMore;
        }else{
          /* 合并第一页：保留已经加载的旧页，同时拿到新留言与最新计数 */
          var known={},merged=[];
          j.posts.forEach(function(p){if(!known[p.id]){known[p.id]=1;merged.push(p)}});
          cmPosts.forEach(function(p){if(!known[p.id]){known[p.id]=1;merged.push(p)}});
          merged.sort(function(a,b){return (b.createdAt||0)-(a.createdAt||0)});
          cmPosts=merged;
          if(!cmNextCursor)cmNextCursor=j.nextCursor||null;
          if(!cmHasMore)cmHasMore=!!j.hasMore;
        }
        return j;
      });
  }
  function cmRefreshPosts(reset){
    if(cmMode!=='server'){
      cmPosts=cmLoad();
      cmRender(cmCurrent);
      return Promise.resolve(false);
    }
    if(reset)cmPageSeq+=1;
    return cmFetchPosts(reset?'reset':'merge').then(function(){
      cmRender(cmCurrent);
      return true;
    }).catch(function(){return false});
  }
  function cmLoadMore(){
    if(cmMode!=='server'||!cmHasMore||cmLoadingMore)return;
    cmLoadingMore=true;
    cmRenderPosts(cmCurrent);
    cmFetchPosts('more').then(function(){
      cmLoadingMore=false;
      cmRenderPosts(cmCurrent);
    }).catch(function(err){
      cmLoadingMore=false;
      cmRenderPosts(cmCurrent);
      toast((err&&err.message)||'加载失败，请稍后重试');
    });
  }
  function cmConnectServer(){
    if(cmServerChecked)return;
    cmServerChecked=true;
    var ctrl=window.AbortController?new AbortController():null;
    var timer=setTimeout(function(){if(ctrl)ctrl.abort()},1800);
    fetch(cmApi('/api/health'),{cache:'no-store',signal:ctrl?ctrl.signal:undefined})
      .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
      .then(function(j){
        clearTimeout(timer);
        if(!j||j.ok!==true)throw new Error('bad health');
        cmUploads=!!(j.features&&j.features.uploads==='presigned');
        return cmEnsureSession().then(function(){
          cmSetMode('server');
          clearTimeout(cmRetryTimer);
          return cmRefreshPosts(true).then(function(){
            if(cmEventSource)return;
            try{
              cmEventSource=new EventSource(cmApi('/api/community/stream')+'?clientId='+encodeURIComponent(cmClientId));
              cmEventSource.addEventListener('refresh',cmScheduleRefresh);
              cmEventSource.onopen=function(){cmSetMode('server')};
              cmEventSource.onerror=function(){
                var text=$('#cm-conn-text');
                if(text)text.textContent='实时连接中断，正在自动重连…';
              };
            }catch(e){}
          });
        });
      })
      .catch(function(){
        clearTimeout(timer);
        cmSetMode('local');
        cmPosts=cmLoad();
        cmRender(cmCurrent);
        clearTimeout(cmRetryTimer);
        cmRetryTimer=setTimeout(function(){cmServerChecked=false;cmConnectServer()},20000);
      });
  }
  function cmPostServer(post){
    return cmWrite('/api/community',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(post)
    }).then(function(j){
      if(j&&j.post){
        if(!j.pending){
          cmPosts.unshift(j.post);
          cmCounts[j.post.board]=(Number(cmCounts[j.post.board])||0)+1;
        }
        if(j.deleteToken)cmRememberToken(j.post.id,j.deleteToken);
        cmRender(cmCurrent);
      }
      return j;
    });
  }
  function cmUploadAudio(file){
    var type=file.type||'audio/webm';
    return cmEnsureSession().then(function(){
      return fetch(cmApi('/api/uploads/sign'),{
        method:'POST',
        headers:{'Content-Type':'application/json','X-Client-Token':cmSession.token},
        body:JSON.stringify({contentType:type,size:file.size})
      }).then(function(r){
        return r.json().then(function(j){
          if(!r.ok)throw new Error((j&&j.error)||('HTTP '+r.status));
          return j;
        });
      }).then(function(sign){
        if(!sign||!sign.uploadUrl||!sign.key)throw new Error('上传签名无效');
        return fetch(sign.uploadUrl,{
          method:sign.method||'PUT',
          headers:sign.headers||{'Content-Type':type},
          body:file
        }).then(function(r){
          if(!r.ok)throw new Error('语音上传失败（HTTP '+r.status+'）');
          return sign.key;
        });
      });
    });
  }
  function cmLikeServer(p){
    var liked=!p.liked;
    return cmWrite('/api/community/'+encodeURIComponent(p.id)+'/like',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({liked:liked})
    }).then(function(j){
      if(j&&j.post){
        for(var i=0;i<cmPosts.length;i++)if(cmPosts[i].id===j.post.id)cmPosts[i]=j.post;
        cmRenderPosts(cmCurrent);
      }
    });
  }
  function cmDeleteServer(id){
    var headers=Object.assign({'X-Delete-Token':cmTokenFor(id)},cmAuthHeader());
    if(cmSession&&cmSession.token)headers['X-Client-Token']=cmSession.token;
    return fetch(cmApi('/api/community/'+encodeURIComponent(id)),{
      method:'DELETE',
      headers:headers
    }).then(function(r){
      return r.json().then(function(j){if(!r.ok)throw new Error((j&&j.error)||('HTTP '+r.status));return j});
    }).then(function(){
      var removed=cmFind(id);
      cmForgetToken(id);
      cmPosts=cmPosts.filter(function(p){return p.id!==id});
      if(removed&&cmCounts[removed.board]){
        cmCounts[removed.board]=Math.max(0,cmCounts[removed.board]-1);
      }
      cmRender(cmCurrent);
    });
  }
  function cmReportServer(id,reason){
    return cmWrite('/api/community/'+encodeURIComponent(id)+'/report',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({reason:reason})
    }).then(function(j){
      if(j&&j.hidden){
        var reported=cmFind(id);
        cmPosts=cmPosts.filter(function(p){return p.id!==id});
        if(reported&&cmCounts[reported.board]){
          cmCounts[reported.board]=Math.max(0,cmCounts[reported.board]-1);
        }
        cmRender(cmCurrent);
        toast('已收到举报，留言已转入待审');
        return;
      }
      toast('已收到举报，管理员会尽快处理');
      return cmRefreshPosts();
    });
  }
  function cmRenderBoards(d){
    $('#cm-boards').innerHTML=cmBoards().map(function(x){
      return '<button type="button" class="cm-board'+(x.id===d.id?' on':'')+'" data-board="'+cmEsc(x.id)+'"'+(x.id===d.id?' aria-current="true"':'')+'>'+
        '<span class="dot" style="background:'+cmEsc(x.color)+'"></span>'+cmEsc(x.name)+'<span class="n">'+cmBoardTotal(x.id)+'</span></button>';
    }).join('');
  }
  function cmProvinceOptions(d,sel,all){
    if(!sel)return;
    var html=(all?'<option value="">全部省份</option>':'')+d.provinces.map(function(n){return '<option value="'+cmEsc(n)+'">'+cmEsc(n)+'</option>'}).join('');
    sel.innerHTML=html;
  }
  function cmMoreButton(){
    if(cmMode!=='server'||!cmHasMore)return '';
    return '<div class="cm-more"><button type="button" class="cm-more-btn" data-more'+
      (cmLoadingMore?' disabled aria-busy="true"':'')+'>'+
      (cmLoadingMore?'正在加载…':'加载更多留言')+'</button></div>';
  }
  function cmRenderPosts(d){
    var list=cmPosts.filter(function(p){return p.board===d.id})
      .filter(function(p){return !cmProvince||p.province===cmProvince})
      .filter(function(p){return cmFilter==='all'||p.type===cmFilter})
      .sort(function(a,b){return b.createdAt-a.createdAt});
    var total=cmBoardTotal(d.id);
    if(!list.length){
      var title=total?'没有符合筛选条件的留言':'「'+d.name+'」板块还没有留言';
      var sub=total?'换一个筛选条件，或者自己也留一句。':'来做第一个用家乡话打招呼的人吧。';
      $('#cm-list').innerHTML='<div class="cm-empty"><b>'+cmEsc(title)+'</b><p>'+cmEsc(sub)+'</p><button type="button" class="cm-write" data-write>写第一句</button></div>'+cmMoreButton();
      return;
    }
    var html=list.map(function(p){
      var type=CM_TYPES[p.type]||'家乡话';
      var color=(cmBoardById(p.board)||{}).color||'#B07C2A';
      var canDelete=cmMode!=='server'||!!cmTokenFor(p.id)||!!p.mine;
      var audioSrc=p.audio||p.audioUrl||'';
      var hasAudio=!!(p.hasAudio||audioSrc);
      /* 语音按需加载：列表只带地址，preload="none" 在点击播放时才真正请求 */
      var audio=(audioSrc&&/^(data:audio\/|https?:\/\/|\/api\/community\/)/.test(audioSrc))?'<audio class="cm-audio-player" controls preload="none" src="'+cmEsc(audioSrc)+'"></audio>':'';
      return '<article class="cm-post" data-id="'+cmEsc(p.id)+'">'+
        '<div class="cm-post-head"><span class="cm-avatar" style="--hc:'+cmEsc(color)+'">'+cmEsc((p.name||'乡').slice(0,1))+'</span>'+
        '<div class="cm-who"><b>'+cmEsc(p.name||'匿名乡音')+'</b><span>'+cmEsc(p.province||'未填省份')+' · '+cmEsc(type)+(hasAudio?' · 语音':'')+'</span></div>'+
        '<time datetime="'+new Date(p.createdAt).toISOString()+'">'+cmTime(p.createdAt)+'</time></div>'+
        (p.replyTo?'<div class="cm-reply-to">回复 @'+cmEsc(p.replyTo)+'</div>':'')+
        '<p class="cm-text">'+cmEsc(p.text)+'</p>'+audio+
        '<div class="cm-post-foot"><button type="button" class="cm-like'+(p.liked?' on':'')+'" data-like="'+cmEsc(p.id)+'">同乡呼应 <span>'+(p.likes||0)+'</span></button>'+
        '<button type="button" class="cm-reply-btn" data-reply="'+cmEsc(p.id)+'">接一句</button>'+
        (cmMode==='server'?'<button type="button" class="cm-report" data-report="'+cmEsc(p.id)+'">举报</button>':'')+
        (canDelete?'<button type="button" class="cm-del" data-del="'+cmEsc(p.id)+'">删除</button>':'')+'</div>'+
        (cmMode==='server'?'<form class="cm-report-form" data-report-form="'+cmEsc(p.id)+'" hidden>'+
          '<input type="text" maxlength="100" placeholder="举报原因（可选）：垃圾广告、诈骗、人身攻击…" aria-label="举报原因">'+
          '<button type="submit" class="cm-report-submit">提交举报</button>'+
          '<button type="button" class="cm-report-cancel" data-report-cancel>取消</button>'+
        '</form>':'')+
        '</article>';
    }).join('');
    html+=cmMoreButton();
    $('#cm-list').innerHTML=html;
  }
  function cmRender(d){
    if(!d||!$('#cm-boards'))return;
    $('#cm-board-name').textContent=d.name;
    $('#cm-board-count').textContent=cmBoardTotal(d.id)+' 条留言';
    $('#cm-form-board').textContent=d.name;
    cmRenderBoards(d);
    var ps=$('#cm-province');
    cmProvinceOptions(d,ps,true);
    ps.value=cmProvince;
    var fs=$('#cm-f-province');
    var prev=fs.value;
    cmProvinceOptions(d,fs,false);
    if(prev)fs.value=prev;
    cmRenderPosts(d);
    cmSetMode(cmMode);
  }
  function cmStopRecording(){
    if(cmRecording){
      try{cmRecording.onstop=null;cmRecording.stop()}catch(e){}
      cmRecording=null;
    }
    if(cmStream){
      try{cmStream.getTracks().forEach(function(t){t.stop()})}catch(e){}
      cmStream=null;
    }
    var btn=$('#cm-record');
    if(btn){btn.textContent='录制语音';btn.classList.remove('rec')}
  }
  function cmResetAudio(){
    cmAudio=null;cmAudioName='';cmAudioFile=null;
    var input=$('#cm-audio');if(input)input.value='';
    $('#cm-audio-name').textContent='未选择语音（可选，≤1.5MB）';
    $('#cm-audio-clear').hidden=true;
  }
  function cmSetAudio(data,name,file){
    if(!/^data:audio\//.test(data)){toast('音频格式不支持');return}
    if(data.length>2400000){toast('语音太大，请控制在 1.5MB 以内');return}
    cmAudio=data;cmAudioName=name||'语音';cmAudioFile=file||null;
    $('#cm-audio-name').textContent=cmAudioName;
    $('#cm-audio-clear').hidden=false;
  }
  function cmOpenForm(reply){
    var f=$('#cm-form');
    f.hidden=false;
    cmReply=reply||null;
    $('#cm-reply').hidden=!cmReply;
    if(cmReply)$('#cm-reply-name').textContent=cmReply.name;
    $('#cm-status').textContent='';
    cmInvalid($('#cm-text'),false);
    cmInvalid($('#cm-consent'),false);
    setTimeout(function(){$('#cm-text').focus()},60);
  }
  function cmCloseForm(){
    $('#cm-form').hidden=true;
    cmReply=null;
    $('#cm-reply').hidden=true;
    cmStopRecording();
    cmResetAudio();
    $('#cm-status').textContent='';
  }
  function cmSelectTab(name){
    cmFilter=name;
    $$('.cm-tab').forEach(function(x){
      var on=x.getAttribute('data-filter')===name;
      x.classList.toggle('on',on);x.setAttribute('aria-selected',on?'true':'false');
    });
  }
  function initCommunity(){
    var boards=cmBoards();
    if(!boards.length)return;
    cmCurrent=boards[0];
    cmClientId=cmClient();
    cmSession=cmLoadSession();
    if(cmSession)cmClientId=cmSession.clientId;
    cmPosts=cmLoad();
    if(cmInitialized){cmRender(cmCurrent);return}
    cmInitialized=true;

    window.addEventListener('fangyan:account',function(){
      if(cmMode==='server')cmRefreshPosts(true);
    });
    window.addEventListener('fangyan:community-refresh',function(){
      if(cmMode==='server')cmRefreshPosts();
    });

    $('#cm-boards').addEventListener('click',function(e){
      var btn=e.target.closest('[data-board]');
      if(!btn)return;
      var b=cmBoardById(btn.getAttribute('data-board'));
      if(!b)return;
      cmCurrent=b;
      cmProvince='';
      cmSelectTab('all');
      if(cmMode==='server'){
        cmPosts=[];
        cmNextCursor=null;
        cmHasMore=false;
        cmRender(cmCurrent);
        cmRefreshPosts(true);
      }else{
        cmRender(cmCurrent);
      }
    });
    $('#cm-write').addEventListener('click',function(){cmOpenForm(null)});
    $('#cm-close').addEventListener('click',cmCloseForm);
    $('#cm-reply-cancel').addEventListener('click',function(){
      cmReply=null;$('#cm-reply').hidden=true;
    });
    $('#cm-province').addEventListener('change',function(){
      cmProvince=this.value;
      cmRenderPosts(cmCurrent);
    });
    $$('.cm-tab').forEach(function(t){
      t.addEventListener('click',function(){
        cmSelectTab(t.getAttribute('data-filter'));
        cmRenderPosts(cmCurrent);
      });
    });
    $('#cm-list').addEventListener('click',function(e){
      var write=e.target.closest('[data-write]');
      if(write){cmOpenForm(null);return}
      var more=e.target.closest('[data-more]');
      if(more){cmLoadMore();return}
      var like=e.target.closest('[data-like]');
      if(like){
        var p=cmFind(like.getAttribute('data-like'));
        if(!p)return;
        if(cmMode==='server'){
          like.disabled=true;
          cmLikeServer(p).catch(function(err){
            toast((err&&err.message)||'操作失败，请稍后重试');
          }).then(function(){like.disabled=false});
          return;
        }
        p.liked=!p.liked;
        p.likes=Math.max(0,(p.likes||0)+(p.liked?1:-1));
        if(cmSave())cmRenderPosts(cmCurrent);
        return;
      }
      var reply=e.target.closest('[data-reply]');
      if(reply){
        var r=cmFind(reply.getAttribute('data-reply'));
        if(r)cmOpenForm({id:r.id,name:r.name||'匿名乡音'});
        return;
      }
      var report=e.target.closest('[data-report]');
      if(report){
        var article=report.closest('.cm-post');
        var form=article&&article.querySelector('[data-report-form]');
        if(form){
          var opening=form.hidden;
          $$('[data-report-form]').forEach(function(f){if(f!==form)f.hidden=true});
          form.hidden=!opening;
          if(opening){var reasonInput=form.querySelector('input');if(reasonInput)reasonInput.focus()}
        }
        return;
      }
      var reportCancel=e.target.closest('[data-report-cancel]');
      if(reportCancel){
        var cancelForm=reportCancel.closest('[data-report-form]');
        if(cancelForm){
          cancelForm.hidden=true;
          var cancelInput=cancelForm.querySelector('input');
          if(cancelInput)cancelInput.value='';
        }
        return;
      }
      var del=e.target.closest('[data-del]');
      if(del){
        if(!confirm('删除这条留言？删除后无法恢复。'))return;
        var delId=del.getAttribute('data-del');
        if(cmMode==='server'){
          cmDeleteServer(delId).then(function(){toast('已删除')}).catch(function(err){
            toast((err&&err.message)||'删除失败，请稍后重试');
          });
          return;
        }
        cmPosts=cmPosts.filter(function(p){return p.id!==delId});
        if(cmSave())cmRender(cmCurrent);
      }
    });
    $('#cm-list').addEventListener('submit',function(e){
      var form=e.target.closest('[data-report-form]');
      if(!form)return;
      e.preventDefault();
      var id=form.getAttribute('data-report-form');
      var input=form.querySelector('input');
      var reason=input?input.value.trim():'';
      var submit=form.querySelector('.cm-report-submit');
      if(submit){submit.disabled=true;submit.textContent='提交中…'}
      cmReportServer(id,reason).catch(function(err){
        toast((err&&err.message)||'举报失败，请稍后重试');
        if(submit){submit.disabled=false;submit.textContent='提交举报'}
      });
    });
    $('#cm-text').addEventListener('input',function(){
      $('#cm-count').textContent=this.value.length+' / 200';
      if(this.value.trim())cmInvalid(this,false);
    });
    $('#cm-consent').addEventListener('change',function(){
      if(this.checked)cmInvalid(this,false);
    });
    $('#cm-audio').addEventListener('change',function(){
      var file=this.files&&this.files[0];
      if(!file)return;
      if(!/^audio\//.test(file.type)){toast('请选择音频文件');this.value='';return}
      if(file.size>1.5*1024*1024){toast('语音文件请小于 1.5MB');this.value='';return}
      var reader=new FileReader();
      reader.onload=function(){cmSetAudio(reader.result,file.name,file)};
      reader.onerror=function(){toast('读取音频失败')};
      reader.readAsDataURL(file);
    });
    $('#cm-audio-clear').addEventListener('click',cmResetAudio);
    $('#cm-record').addEventListener('click',function(){
      var btn=this;
      if(cmRecording&&cmRecording.state==='recording'){cmRecording.stop();return}
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){
        toast('当前浏览器不支持录音，请改用上传音频');return;
      }
      navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
        cmStream=stream;
        var chunks=[];
        var mr=new MediaRecorder(stream);
        cmRecording=mr;
        mr.ondataavailable=function(ev){if(ev.data&&ev.data.size)chunks.push(ev.data)};
        mr.onstop=function(){
          try{stream.getTracks().forEach(function(t){t.stop()})}catch(e){}
          cmStream=null;cmRecording=null;
          btn.textContent='录制语音';btn.classList.remove('rec');
          var blob=new Blob(chunks,{type:mr.mimeType||'audio/webm'});
          if(!blob.size){toast('没有录到声音');return}
          if(blob.size>1.5*1024*1024){toast('录音太长，请控制在 1.5MB 以内');return}
          var reader=new FileReader();
          reader.onload=function(){cmSetAudio(reader.result,'录音 '+new Date().toLocaleTimeString(),blob)};
          reader.onerror=function(){toast('读取录音失败')};
          reader.readAsDataURL(blob);
        };
        mr.start();
        btn.textContent='停止录音';btn.classList.add('rec');
        toast('正在录音，再点一次停止');
      }).catch(function(){toast('无法使用麦克风，请改用上传音频')});
    });
    $('#cm-form').addEventListener('submit',function(e){
      e.preventDefault();
      if(!cmCurrent)return;
      var text=$('#cm-text').value.trim();
      if(!text){
        $('#cm-status').textContent='请先写一句家乡话。';
        cmInvalid($('#cm-text'),true);
        $('#cm-text').focus();
        return;
      }
      cmInvalid($('#cm-text'),false);
      var consent=$('#cm-consent');
      if(!consent||!consent.checked){
        $('#cm-status').textContent='请先阅读并勾选同意隐私政策。';
        cmInvalid(consent,true);
        if(consent)consent.focus();
        return;
      }
      cmInvalid(consent,false);
      var checked=document.querySelector('input[name="cm-type"]:checked');
      var post={
        board:cmCurrent.id,
        province:$('#cm-f-province').value||cmCurrent.provinces[0]||'',
        name:($('#cm-name').value.trim()||'匿名乡音').slice(0,20),
        type:checked?checked.value:'dialect',
        text:text,
        audio:cmAudio,
        audioName:cmAudioName,
        replyTo:cmReply?cmReply.name:null,
        consent:true
      };
      var submit=$('#cm-submit');
      function done(){
        $('#cm-text').value='';
        $('#cm-count').textContent='0 / 200';
        if(consent)consent.checked=false;
        cmCloseForm();
        cmSelectTab('all');
        cmRender(cmCurrent);
      }
      /* 蜜罐字段：正常用户看不见，机器人填写后静默丢弃 */
      var honey=$('#cm-website');
      if(honey&&honey.value){
        done();
        toast('已发布');
        return;
      }
      if(cmMode==='server'){
        if(submit){submit.disabled=true;submit.textContent='发布中…'}
        $('#cm-status').textContent='';
        var upload=(cmAudioFile&&cmUploads)?cmUploadAudio(cmAudioFile):Promise.resolve(null);
        upload.then(function(audioKey){
          if(audioKey){post.audio=null;post.audioKey=audioKey;}
          return cmPostServer(post);
        }).then(function(res){
          if(!res||!res.post)throw new Error('发布失败');
          done();
          toast(res.pending?(res.notice||'留言已进入待审队列'):'已发布到实时社区');
        }).catch(function(err){
          $('#cm-status').textContent=(err&&err.message)||'发布失败，请稍后重试';
        }).then(function(){
          if(submit)submit.disabled=false;
          cmSetMode(cmMode);
        });
        return;
      }
      post.id='p'+Date.now()+Math.random().toString(36).slice(2,6);
      post.likes=0;post.liked=false;post.createdAt=Date.now();
      cmPosts.unshift(post);
      if(!cmSave()){cmPosts.shift();return}
      done();
      toast('已保存到本机浏览器');
    });

    cmRender(cmCurrent);
    cmConnectServer();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initCommunity);
  else initCommunity();
})();
