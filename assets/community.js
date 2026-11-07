/* 乡音社区 · 每人一句家乡话（主页面） */
(function(){
  var CM_KEY='fangyan-community-v1';
  var CM_TOKEN_KEY='fangyan-delete-tokens-v1';
  var CM_TYPES={dialect:'家乡话',suggest:'建议'};
  var cmPosts=[],cmFilter='all',cmProvince='',cmReply=null,cmAudio=null,cmAudioName='';
  var cmRecording=null,cmStream=null,cmCurrent=null,cmInitialized=false;
  var cmMode='local',cmEventSource=null,cmRefreshTimer=null,cmRetryTimer=null,cmClientId='',cmServerChecked=false;

  function cmEsc(s){
    return String(s==null?'':s).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function cmApiBase(){
    var c=window.FANGYAN_CONFIG||{};
    if(c.apiBase)return String(c.apiBase).replace(/\/$/,'');
    if(location.protocol==='http:'||location.protocol==='https:')return '';
    return 'http://localhost:8787';
  }
  function cmApi(path){return cmApiBase()+path}
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
    return cmPosts.filter(function(p){return p.board===id}).length;
  }
  function cmScheduleRefresh(){
    clearTimeout(cmRefreshTimer);
    cmRefreshTimer=setTimeout(function(){cmRefreshPosts()},180);
  }
  function cmRefreshPosts(){
    if(cmMode!=='server'){
      cmPosts=cmLoad();
      cmRender(cmCurrent);
      return Promise.resolve(false);
    }
    return fetch(cmApi('/api/community'),{cache:'no-store',headers:{'X-Client-Id':cmClientId}})
      .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
      .then(function(j){
        if(j&&Array.isArray(j.posts))cmPosts=j.posts;
        cmRender(cmCurrent);
        return true;
      })
      .catch(function(){return false});
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
        cmSetMode('server');
        clearTimeout(cmRetryTimer);
        return cmRefreshPosts().then(function(){
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
    return fetch(cmApi('/api/community'),{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Client-Id':cmClientId},
      body:JSON.stringify(post)
    }).then(function(r){
      return r.json().then(function(j){if(!r.ok)throw new Error((j&&j.error)||('HTTP '+r.status));return j});
    }).then(function(j){
      if(j&&j.post){
        cmPosts.unshift(j.post);
        if(j.deleteToken)cmRememberToken(j.post.id,j.deleteToken);
        cmRender(cmCurrent);
      }
      return j&&j.post;
    });
  }
  function cmLikeServer(p){
    var liked=!p.liked;
    return fetch(cmApi('/api/community/'+encodeURIComponent(p.id)+'/like'),{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Client-Id':cmClientId},
      body:JSON.stringify({liked:liked})
    }).then(function(r){
      return r.json().then(function(j){if(!r.ok)throw new Error((j&&j.error)||('HTTP '+r.status));return j});
    }).then(function(j){
      if(j&&j.post){
        for(var i=0;i<cmPosts.length;i++)if(cmPosts[i].id===j.post.id)cmPosts[i]=j.post;
        cmRenderPosts(cmCurrent);
      }
    });
  }
  function cmDeleteServer(id){
    return fetch(cmApi('/api/community/'+encodeURIComponent(id)),{
      method:'DELETE',
      headers:{'X-Client-Id':cmClientId,'X-Delete-Token':cmTokenFor(id)}
    }).then(function(r){
      return r.json().then(function(j){if(!r.ok)throw new Error((j&&j.error)||('HTTP '+r.status));return j});
    }).then(function(){
      cmForgetToken(id);
      cmPosts=cmPosts.filter(function(p){return p.id!==id});
      cmRender(cmCurrent);
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
  function cmRenderPosts(d){
    var list=cmPosts.filter(function(p){return p.board===d.id})
      .filter(function(p){return !cmProvince||p.province===cmProvince})
      .filter(function(p){return cmFilter==='all'||p.type===cmFilter})
      .sort(function(a,b){return b.createdAt-a.createdAt});
    var total=cmBoardTotal(d.id);
    if(!list.length){
      var title=total?'没有符合筛选条件的留言':'「'+d.name+'」板块还没有留言';
      var sub=total?'换一个筛选条件，或者自己也留一句。':'来做第一个用家乡话打招呼的人吧。';
      $('#cm-list').innerHTML='<div class="cm-empty"><b>'+cmEsc(title)+'</b><p>'+cmEsc(sub)+'</p><button type="button" class="cm-write" data-write>写第一句</button></div>';
      return;
    }
    $('#cm-list').innerHTML=list.map(function(p){
      var type=CM_TYPES[p.type]||'家乡话';
      var color=(cmBoardById(p.board)||{}).color||'#B07C2A';
      var canDelete=cmMode!=='server'||!!cmTokenFor(p.id);
      var audio=(p.audio&&/^data:audio\//.test(p.audio))?'<audio class="cm-audio-player" controls preload="metadata" src="'+cmEsc(p.audio)+'"></audio>':'';
      return '<article class="cm-post" data-id="'+cmEsc(p.id)+'">'+
        '<div class="cm-post-head"><span class="cm-avatar" style="--hc:'+cmEsc(color)+'">'+cmEsc((p.name||'乡').slice(0,1))+'</span>'+
        '<div class="cm-who"><b>'+cmEsc(p.name||'匿名乡音')+'</b><span>'+cmEsc(p.province||'未填省份')+' · '+cmEsc(type)+(p.audio?' · 语音':'')+'</span></div>'+
        '<time datetime="'+new Date(p.createdAt).toISOString()+'">'+cmTime(p.createdAt)+'</time></div>'+
        (p.replyTo?'<div class="cm-reply-to">回复 @'+cmEsc(p.replyTo)+'</div>':'')+
        '<p class="cm-text">'+cmEsc(p.text)+'</p>'+audio+
        '<div class="cm-post-foot"><button type="button" class="cm-like'+(p.liked?' on':'')+'" data-like="'+cmEsc(p.id)+'">同乡呼应 <span>'+(p.likes||0)+'</span></button>'+
        '<button type="button" class="cm-reply-btn" data-reply="'+cmEsc(p.id)+'">接一句</button>'+
        (canDelete?'<button type="button" class="cm-del" data-del="'+cmEsc(p.id)+'">删除</button>':'')+'</div></article>';
    }).join('');
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
    cmAudio=null;cmAudioName='';
    var input=$('#cm-audio');if(input)input.value='';
    $('#cm-audio-name').textContent='未选择语音（可选，≤1.5MB）';
    $('#cm-audio-clear').hidden=true;
  }
  function cmSetAudio(data,name){
    if(!/^data:audio\//.test(data)){toast('音频格式不支持');return}
    if(data.length>2400000){toast('语音太大，请控制在 1.5MB 以内');return}
    cmAudio=data;cmAudioName=name||'语音';
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
    cmPosts=cmLoad();
    if(cmInitialized){cmRender(cmCurrent);return}
    cmInitialized=true;

    $('#cm-boards').addEventListener('click',function(e){
      var btn=e.target.closest('[data-board]');
      if(!btn)return;
      var b=cmBoardById(btn.getAttribute('data-board'));
      if(!b)return;
      cmCurrent=b;
      cmProvince='';
      cmSelectTab('all');
      cmRender(cmCurrent);
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
    $('#cm-text').addEventListener('input',function(){
      $('#cm-count').textContent=this.value.length+' / 200';
    });
    $('#cm-audio').addEventListener('change',function(){
      var file=this.files&&this.files[0];
      if(!file)return;
      if(!/^audio\//.test(file.type)){toast('请选择音频文件');this.value='';return}
      if(file.size>1.5*1024*1024){toast('语音文件请小于 1.5MB');this.value='';return}
      var reader=new FileReader();
      reader.onload=function(){cmSetAudio(reader.result,file.name)};
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
          reader.onload=function(){cmSetAudio(reader.result,'录音 '+new Date().toLocaleTimeString())};
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
      if(!text){$('#cm-status').textContent='请先写一句家乡话。';$('#cm-text').focus();return}
      var checked=document.querySelector('input[name="cm-type"]:checked');
      var post={
        board:cmCurrent.id,
        province:$('#cm-f-province').value||cmCurrent.provinces[0]||'',
        name:($('#cm-name').value.trim()||'匿名乡音').slice(0,20),
        type:checked?checked.value:'dialect',
        text:text,
        audio:cmAudio,
        audioName:cmAudioName,
        replyTo:cmReply?cmReply.name:null
      };
      var submit=$('#cm-submit');
      function done(){
        $('#cm-text').value='';
        $('#cm-count').textContent='0 / 200';
        cmCloseForm();
        cmSelectTab('all');
        cmRender(cmCurrent);
      }
      if(cmMode==='server'){
        if(submit){submit.disabled=true;submit.textContent='发布中…'}
        $('#cm-status').textContent='';
        cmPostServer(post).then(function(saved){
          if(!saved)throw new Error('发布失败');
          done();
          toast('已发布到实时社区');
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
