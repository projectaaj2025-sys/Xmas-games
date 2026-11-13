const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM, VirtualConsole} = require('jsdom');
const read = p => fs.readFileSync(p, 'utf8');
function setup(saves={}, broken=false) {
  const errors=[], vc=new VirtualConsole(); vc.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only',virtualConsole:vc});
  const w=dom.window,d=w.document;let socket, spinCallback, now=100000, played=[], revoked=[];
  for(const [key,value] of Object.entries(saves))w.localStorage.setItem(key,value);
  if(broken)Object.defineProperty(w,'localStorage',{get(){throw Error('storage blocked')}});
  w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.confirm=()=>true;
  w.Date.now=()=>now;w.WebSocket=class {constructor(){socket=this;this.readyState=1;this.events={};this.messages=[]}addEventListener(n,f){this.events[n]=f}send(m){this.messages.push(JSON.parse(m))}};w.WebSocket.OPEN=1;
  w.Audio=class{constructor(url){this.url=url}play(){played.push(this.url);return Promise.resolve()}pause(){}};
  w.URL.createObjectURL=()=> 'blob:secret';w.URL.revokeObjectURL=url=>revoked.push(url);
  for(const file of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js'])w.eval(read(file));socket.events.open();
  w.FIELD_QUESTIONS=[{question:'Тайный вопрос',answer:'БАРАБАН'}];
  const timer=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>ms===2400?(spinCallback=fn,123):timer(fn,ms,...args);
  const click=sel=>{const el=d.querySelector(sel);assert.ok(el,sel);assert.equal(el.disabled,false,sel);el.click();};
  const state=()=>socket.messages.filter(m=>m.type==='state').at(-1).payload;
  const snapshot=()=>Object.fromEntries(Object.keys(w.localStorage).map(key=>[key,w.localStorage.getItem(key)]));
  return {w,d,click,state,snapshot,played,revoked,errors,socket, advance:ms=>{now+=ms},finishSpin:()=>spinCallback?.()};
}

test('field resumes score, turn and letters after interrupted spin; reconnect seats explicitly',()=>{
  const a=setup();let saved;
  try{
    a.click('[data-open="field"]');a.click('#fieldStart');a.w.Math.random=()=>0;a.click('#fieldSpin');a.finishSpin();a.click('[data-field-letter="А"]');
    assert.equal(a.state().players[0].score,1500);a.click('#fieldSpin');
    a.click('#backHome');a.finishSpin();saved=a.snapshot();
  }finally{a.w.close()}
  const b=setup(saved);
  try{
    b.click('[data-open="field"]');assert.ok(b.d.querySelector('#resumeGame'));b.click('#resumeGame');
    assert.equal(b.state().phase,'spin');assert.equal(b.state().activeIndex,0);assert.equal(b.state().players[0].score,1500);assert.equal(b.state().board.filter(x=>x.letter==='А').length,3);
    assert.ok(!JSON.stringify(b.state()).includes('БАРАБАН'));
    b.socket.events.message({data:JSON.stringify({type:'presence',players:[{id:'new-phone',name:'Аня'}]})});
    b.click('#fieldRefreshPlayers');const select=b.d.querySelector('[data-field-player-seat="0"]');select.value='new-phone';select.dispatchEvent(new b.w.Event('change',{bubbles:true}));
    assert.equal(b.state().activeId,'new-phone');assert.equal(b.state().players[0].score,1500);
    b.w.confirm=()=>false;b.click('#resetCurrentGame');assert.equal(b.state().players[0].score,1500);
    b.w.confirm=()=>true;b.click('#resetCurrentGame');assert.ok(b.d.querySelector('#fieldStart'));
    assert.deepEqual(b.errors,[]);
  }finally{b.w.close()}
});

test('melody saves notes, scores and selection, safely disposes audio and allows undo',()=>{
  const a=setup();let saved;
  try{
    a.click('[data-open="melody"]');a.click('[data-melody-note="0"]');
    a.click('#melodyStop');assert.ok(a.d.querySelector('.melody-answer-open'));a.click('[data-melody-score="0"][data-direction="-1"]');assert.equal(a.state().scores[0].score,-80);assert.ok(a.d.querySelector('.melody-answer-open'),'the open answer survives a re-render');
    a.click('[data-melody-undo="0"]');assert.equal(a.state().scores[0].score,0);
    a.click('[data-melody-score="0"][data-direction="1"]');a.click('#melodyDone');a.click('[data-melody-note="1"]');
    const file=a.d.querySelector('#melodyFile');Object.defineProperty(file,'files',{value:[new a.w.File(['x'],'custom.mp3')]});file.dispatchEvent(new a.w.Event('change',{bubbles:true}));
    saved=a.snapshot();assert.doesNotMatch(JSON.stringify(saved),/blob:secret|custom.mp3/);a.click('#backHome');assert.deepEqual(a.revoked,['blob:secret']);saved=a.snapshot();
  }finally{a.w.close()}
  const b=setup(saved);try{
    b.click('[data-open="melody"]');b.w.confirm=()=>false;b.click('#newSavedGame');assert.ok(b.d.querySelector('#resumeGame'));b.click('#resumeGame');
    assert.equal(b.state().scores[0].score,80);assert.equal(b.state().rows[0][0].used,true);assert.equal(b.state().rows[0][1].selected,true);assert.deepEqual(b.played,[]);
    b.w.confirm=()=>false;b.click('#resetCurrentGame');assert.equal(b.state().scores[0].score,80);
    b.w.confirm=()=>true;b.click('#resetCurrentGame');assert.equal(b.state().scores[0].score,0);assert.equal(b.state().rows[0][0].used,false);assert.deepEqual(b.errors,[]);
  }finally{b.w.close()}
});

test('melody supergame resumes paused with remaining time and queue, without autoplay',()=>{
  const a=setup();let saved;try{
    a.click('[data-open="melody"]');a.click('[data-melody-tour="4"]');a.click('#superStart');a.click('#superCorrect');a.click('#superSkip');a.advance(7000);a.click('#backHome');saved=a.snapshot();
    const ss=JSON.parse(saved['snowy-host-melody-v1']).state.super;assert.equal(ss.status,'paused');assert.equal(ss.seconds,23);assert.deepEqual(ss.queue,[2,3,4,5,6,1]);
  }finally{a.w.close()}
  const b=setup(saved);try{
    b.advance(600000);b.click('[data-open="melody"]');b.click('#resumeGame');assert.equal(b.state().status,'paused');assert.equal(b.state().seconds,23);assert.equal(b.state().correct,1);assert.deepEqual(b.played,[]);
    assert.match(b.d.querySelector('#superStart').textContent,/Продолжить/);b.click('#superStart');assert.equal(b.state().seconds,23);assert.equal(b.state().correct,1);assert.equal(b.state().status,'running');assert.equal(b.played.length,1);assert.deepEqual(b.errors,[]);
  }finally{b.w.close()}
});

test('field super timer is paused while away and resumes at the remaining seconds',()=>{
  const a=setup();let saved;try{
    a.click('[data-open="field"]');a.click('#fieldStart');
    const answer=()=>{a.d.querySelector('#fieldAnswer').value='БАРАБАН';a.d.querySelector('#fieldSolve').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));};
    answer();for(let i=0;i<3;i++){a.click('#fieldNext');a.click('#fieldStart');answer();}a.click('#fieldSuper');for(const ch of ['А','Б','В','Г','Д'])a.click(`[data-field-letter="${ch}"]`);
    a.advance(12000);a.click('#backHome');saved=a.snapshot();assert.equal(JSON.parse(saved['snowy-host-field-v1']).state.seconds,48);
  }finally{a.w.close()}
  const b=setup(saved);try{b.advance(500000);b.click('[data-open="field"]');b.click('#resumeGame');assert.equal(b.state().phase,'superSolve');assert.equal(b.state().seconds,48);assert.deepEqual(b.errors,[]);}finally{b.w.close()}
});

test('corrupt and blocked storage never break play or claim persistent save',()=>{
  const a=setup({'snowy-host-melody-v1':'{"version":1,"state":{"tour":4}}'});try{a.click('[data-open="melody"]');assert.ok(a.d.querySelector('[data-melody-note]'));assert.deepEqual(a.errors,[]);}finally{a.w.close()}
  const b=setup({},true);try{b.click('[data-open="melody"]');assert.match(b.d.querySelector('.game-save-status').textContent,/недоступно/);b.click('[data-melody-note="0"]');b.click('#backHome');b.click('[data-open="melody"]');b.click('#resumeGame');assert.equal(b.state().rows[0][0].selected,true);assert.deepEqual(b.errors,[]);}finally{b.w.close()}
});

test('auction bid and score survive pagehide and a new browser document',()=>{
  const a=setup();let saved;try{
    a.click('[data-open="melody"]');a.click('[data-melody-tour="5"]');a.click('#auctionStart');a.click('[data-auction-bid="5"]');
    a.w.dispatchEvent(new a.w.Event('pagehide'));saved=a.snapshot();
  }finally{a.w.close()}
  const b=setup(saved);try{
    b.click('[data-open="melody"]');b.click('#resumeGame');assert.match(b.d.querySelector('.auction-bid').textContent,/5 нот/);assert.ok(b.d.querySelector('[data-auction-bid="4"]'));assert.deepEqual(b.errors,[]);
  }finally{b.w.close()}
});

test('melody resumes manual judging and passed status while closing stale phone buzzer',()=>{
  const a=setup();let saved;try{
    a.click('[data-open="melody"]');a.click('[data-melody-note="0"]');a.click('[data-melody-answerer="0"]');a.click('#melodyWrong');assert.equal(a.state().scores[0].score,-80);assert.equal(a.state().buzz.open,true);const old=a.state().buzz.token;a.click('#backHome');saved=a.snapshot();
    const b=setup(saved);try{b.click('[data-open="melody"]');b.click('#resumeGame');assert.equal(b.state().scores[0].score,-80);assert.deepEqual([...b.state().buzz.passed],[0]);assert.equal(b.state().buzz.open,false);assert.equal(b.state().buzz.token,'');b.click('#melodyBuzzOpen');assert.notEqual(b.state().buzz.token,old);b.click('[data-melody-answerer="1"]');assert.ok(b.d.querySelectorAll('.melody-player-score')[1].classList.contains('active'));b.click('#melodyCorrect');assert.equal(b.state().scores[1].score,80);assert.deepEqual(b.errors,[]);}finally{b.w.close()}
  }finally{a.w.close()}
});

test('undoing an earlier penalty does not undo a later correct answer',()=>{
  const a=setup();try{
    a.click('[data-open="melody"]');a.click('[data-melody-note="0"]');a.click('[data-melody-answerer="0"]');a.click('#melodyWrong');a.click('[data-melody-answerer="1"]');a.click('#melodyCorrect');
    a.click('[data-melody-undo="0"]');assert.equal(a.state().scores[0].score,0);assert.equal(a.state().scores[1].score,80);assert.equal(a.state().buzz.finished,true);a.click('#melodyDone');assert.equal(a.state().rows[0][0].used,true);assert.deepEqual(a.errors,[]);
  }finally{a.w.close()}
});

test('legacy Russian save migrates by song without moving results onto replacement notes',()=>{
  const a=setup();let saved;try{
    a.click('[data-open="melody"]');a.click('#backHome');saved=a.snapshot();
    const data=JSON.parse(saved['snowy-host-melody-v1']),s=data.state;
    delete s.catalogRevision;delete s.uniqueCatalogRevision;delete s.modernCatalogRevision;s.names=['Аня','Борис','Света'];s.scores=[80,-50,30];
    // In the old first board, notes 1 and 2 were A4 and Steklovata; note 5 remains unchanged.
    s.used=[[0,2,5],[],[]];s.selected=1;s.revealed=true;
    s.judged={'russian-1-1-0':80,'russian-1-2-1':-50,'russian-1-5-2':30};
    s.attempts={'russian-1-1':{active:0,passed:[1],open:true,finished:false,token:'old'},'russian-1-5':{active:null,passed:[2],open:false,finished:false,token:''}};
    saved['snowy-host-melody-v1']=JSON.stringify(data);
  }finally{a.w.close()}
  const b=setup(saved);try{
    b.click('[data-open="melody"]');assert.match(b.d.querySelector('.game-resume').textContent,/Подборка обновилась/);b.click('#resumeGame');
    const current=JSON.parse(b.snapshot()['snowy-host-melody-v1']).state;
    assert.deepEqual(current.names,['Аня','Борис','Света']);assert.deepEqual(current.scores,[80,-50,30]);
    assert.deepEqual(current.used[0],[0,5]);assert.equal(current.selected,null);assert.equal(current.revealed,false);
    assert.equal(current.judged['russian-1-1-0'],undefined);assert.equal(current.judged['russian-1-2-1'],undefined);assert.equal(current.judged['russian-1-5-2'],30);
    assert.equal(current.attempts['russian-1-1'],undefined);assert.ok(current.attempts['russian-1-5']);
    assert.equal(b.state().rows[0][1].used,false);assert.equal(b.state().rows[0][2].used,false);
    b.click('[data-melody-note="1"]');assert.ok(b.d.querySelector('[data-melody-score="0"][data-direction="1"]:not(:disabled)'));
    assert.equal(current.catalogRevision,2);assert.deepEqual(b.errors,[]);
  }finally{b.w.close()}
});

test('legacy mixed, family and English saves warn and preserve unambiguous songs',()=>{
  const a=setup();let base;try{a.click('[data-open="melody"]');a.click('#backHome');base=a.snapshot()}finally{a.w.close()}
  for(const version of ['mixed','children','international']){
    const saved={...base},data=JSON.parse(saved['snowy-host-melody-v1']);delete data.state.catalogRevision;delete data.state.uniqueCatalogRevision;delete data.state.modernCatalogRevision;
    data.state.version=version;const note=version==='children'?0:1;data.state.used=[[note,2],[],[]];data.state.selected=note;data.state.scores=[42,0,0];
    data.state.judged={[`${version}-1-${note}-0`]:42};data.state.attempts={[`${version}-1-${note}`]:{active:null,passed:[0],open:false,finished:false,token:''}};
    saved['snowy-host-melody-v1']=JSON.stringify(data);
    const b=setup(saved);try{
      b.click('[data-open="melody"]');assert.match(b.d.querySelector('.game-resume').textContent,/Подборка обновилась/);b.click('#resumeGame');
      const s=JSON.parse(b.snapshot()['snowy-host-melody-v1']).state;
      assert.equal(s.selected,note);assert.equal(s.judged[`${version}-1-${note}-0`],42);assert.ok(s.used[0].includes(note));assert.equal(s.scores[0],42);
      if(version==='children')assert.ok(s.used[0].includes(2));else assert.ok(!s.used[0].includes(2));
      assert.deepEqual(b.errors,[]);
    }finally{b.w.close()}
  }
});

test('holiday selection saves and resumes its own score and selected note',()=>{
  const a=setup();let saved;try{
    a.click('[data-open="melody"]');const select=a.d.querySelector('#melodyVersion');
    select.value='newyear';select.dispatchEvent(new a.w.Event('change',{bubbles:true}));
    a.click('[data-melody-note="4"]');a.click('[data-melody-score="0"][data-direction="1"]');a.click('#backHome');saved=a.snapshot();
    assert.equal(JSON.parse(saved['snowy-host-melody-v1']).state.version,'newyear');
  }finally{a.w.close()}
  const b=setup(saved);try{
    b.click('[data-open="melody"]');b.click('#resumeGame');
    assert.equal(b.d.querySelector('#melodyVersion').value,'newyear');assert.equal(b.state().scores[0].score,70);
    assert.equal(b.state().rows[0][4].selected,true);assert.equal(b.d.querySelector('.melody-answer p').textContent,'Happy New Year');
    assert.deepEqual(b.played,[]);assert.deepEqual(b.errors,[]);
  }finally{b.w.close()}
});

test('legacy holiday progress follows matching songs and warns before bonus reset',()=>{
  const a=setup();let saved;try{
    a.click('[data-open="melody"]');const select=a.d.querySelector('#melodyVersion');select.value='newyear';select.dispatchEvent(new a.w.Event('change',{bubbles:true}));
    a.click('#backHome');saved=a.snapshot();const data=JSON.parse(saved['snowy-host-melody-v1']),s=data.state;
    delete s.holidayCatalogRevision;delete s.modernCatalogRevision;delete s.seasonalCatalogRevision;s.names=['Аня','Борис','Света'];s.scores=[80,40,-20];
    s.used=[[0,4,11],[],[0]];s.selected=10;s.revealed=true;
    s.judged={'newyear-1-10-0':80,'newyear-1-4-1':40,'newyear-3-0-2':-20};
    s.attempts={'newyear-1-10':{active:null,passed:[0],open:false,finished:false,token:''},'newyear-3-0':{active:null,passed:[2],open:false,finished:false,token:''}};
    s.auction.phase='result';s.auction.lastWinner=0;s.auction.points=[1,0];
    s.super.status='paused';s.super.seconds=17;s.super.queue=[2,3,4,5,6];
    saved['snowy-host-melody-v1']=JSON.stringify(data);
  }finally{a.w.close()}
  const b=setup(saved);try{
    b.click('[data-open="melody"]');assert.match(b.d.querySelector('.game-resume').textContent,/Торги и суперигра.*начнутся заново/);
    b.click('#resumeGame');const s=JSON.parse(b.snapshot()['snowy-host-melody-v1']).state;
    assert.deepEqual(s.names,['Аня','Борис','Света']);assert.deepEqual(s.scores,[80,40,-20]);
    assert.deepEqual(s.used[0],[0,10,13]);assert.deepEqual(s.used[2],[]);
    assert.equal(s.selected,4);assert.equal(b.d.querySelector('.melody-answer p').textContent,'Happy New Year');
    assert.equal(s.judged['newyear-1-4-0'],80);assert.equal(s.judged['newyear-1-10-1'],40);assert.equal(s.judged['newyear-3-0-2'],undefined);
    assert.ok(s.attempts['newyear-1-4']);assert.equal(s.attempts['newyear-3-0'],undefined);
    assert.equal(s.auction.phase,'setup');assert.deepEqual(s.auction.points,[0,0]);assert.equal(s.super.status,'ready');assert.equal(s.super.seconds,30);
    assert.equal(s.holidayCatalogRevision,2);assert.deepEqual(b.played,[]);assert.deepEqual(b.errors,[]);
  }finally{b.w.close()}
});

test('published standard layouts migrate by identity, discard ambiguous duplicates and reset bonus phases',()=>{
  const a=setup();let base;try{a.click('[data-open="melody"]');a.click('#backHome');base=a.snapshot()}finally{a.w.close()}
  for(const version of ['russian','mixed','children','international']){
    const saved={...base},data=JSON.parse(saved['snowy-host-melody-v1']),s=data.state;
    s.version=version;s.catalogRevision=2;delete s.uniqueCatalogRevision;delete s.modernCatalogRevision;
    s.names=['Аня','Борис','Света'];s.scores=[80,40,-20];s.tour=version==='russian'?2:1;
    s.auction.phase='result';s.auction.lastWinner=0;s.auction.points=[2,1];
    s.super.status='paused';s.super.seconds=17;s.super.queue=[2,3,4,5,6];
    if(version==='russian'){
      // Round 2: МакSим moves to position 4; the old New Year song and Женя Белоусов are removed from that round.
      s.used=[[],[0,10,11],[]];s.selected=10;s.revealed=true;
      s.judged={'russian-2-10-0':80,'russian-2-0-1':40};s.attempts={'russian-2-10':{active:null,passed:[0],open:false,finished:false,token:''}};
    }else if(version==='children'){
      // "Голубой вагон" occurs twice in the old first board, so neither old result can be assigned safely.
      s.used=[[0,7,17],[],[]];s.selected=7;s.revealed=true;
      s.judged={'children-1-7-0':80,'children-1-17-1':40};s.attempts={'children-1-7':{active:null,passed:[0],open:false,finished:false,token:''}};
    }else{
      // Last Christmas remains at position 1 in both mixed and English modes.
      s.used=[[1],[],[]];s.selected=1;s.revealed=true;
      s.judged={[`${version}-1-1-0`]:80};s.attempts={[`${version}-1-1`]:{active:null,passed:[0],open:false,finished:false,token:''}};
    }
    saved['snowy-host-melody-v1']=JSON.stringify(data);
    const b=setup(saved);try{
      b.click('[data-open="melody"]');assert.match(b.d.querySelector('.game-resume').textContent,/Торги и суперигра.*начнутся заново/);b.click('#resumeGame');
      const result=JSON.parse(b.snapshot()['snowy-host-melody-v1']).state;
      assert.deepEqual(result.names,['Аня','Борис','Света']);assert.deepEqual(result.scores,[80,40,-20]);
      assert.equal(result.uniqueCatalogRevision,1);assert.equal(result.auction.phase,'setup');assert.deepEqual(result.auction.points,[0,0]);
      assert.equal(result.super.status,'ready');assert.equal(result.super.seconds,30);assert.deepEqual(result.super.queue,[0,1,2,3,4,5,6]);
      if(version==='russian'){
        assert.deepEqual(result.used[1],[4]);assert.equal(result.selected,4);assert.equal(result.judged['russian-2-4-0'],80);assert.equal(result.judged['russian-2-0-1'],undefined);
      }else if(version==='children'){
        assert.deepEqual(result.used[0],[0]);assert.equal(result.selected,null);assert.equal(result.revealed,false);assert.deepEqual(result.judged,{});assert.deepEqual(result.attempts,{});
      }else{
        assert.deepEqual(result.used[0],[1]);assert.equal(result.selected,1);assert.equal(result.judged[`${version}-1-1-0`],80);
      }
      assert.deepEqual(b.played,[]);assert.deepEqual(b.errors,[]);
    }finally{b.w.close()}
  }
});

test('previously published songs migrate safely in every mode after the modern update',()=>{
  const a=setup();let base;try{a.click('[data-open="melody"]');a.click('#backHome');base=a.snapshot()}finally{a.w.close()}
  const examples={russian:{tour:1,retained:0,removed:1},international:{tour:1,retained:0,removed:5},mixed:{tour:1,retained:1,removed:2},children:{tour:1,retained:15,removed:18},newyear:{tour:2,retained:0,removed:1}};
  for(const [version,{tour,retained,removed}] of Object.entries(examples)){
    const saved={...base},data=JSON.parse(saved['snowy-host-melody-v1']),s=data.state;
    s.version=version;s.tour=tour;delete s.modernCatalogRevision;delete s.seasonalCatalogRevision;s.catalogRevision=2;s.uniqueCatalogRevision=1;s.holidayCatalogRevision=2;
    s.names=['Аня','Борис','Света'];s.scores=[80,-40,30];s.used=[[],[],[]];s.used[tour-1]=[retained,removed];s.selected=removed;s.revealed=true;
    s.judged={[`${version}-${tour}-${retained}-0`]:80,[`${version}-${tour}-${removed}-1`]:-40};
    s.attempts={[`${version}-${tour}-${removed}`]:{active:null,passed:[1],open:false,finished:false,token:''}};
    s.auction.phase='result';s.auction.points=[1,0];s.auction.lastWinner=0;s.super.status='paused';s.super.seconds=10;s.super.queue=[3,4,5,6];
    saved['snowy-host-melody-v1']=JSON.stringify(data);const b=setup(saved);
    try{
      b.click('[data-open="melody"]');assert.match(b.d.querySelector('.game-resume').textContent,/Торги и суперигра.*начнутся заново/);b.click('#resumeGame');
      const current=JSON.parse(b.snapshot()['snowy-host-melody-v1']).state;
      assert.deepEqual(current.names,['Аня','Борис','Света']);assert.deepEqual(current.scores,[80,-40,30]);
      assert.deepEqual(current.used[tour-1],[retained]);assert.equal(current.selected,null);assert.equal(current.revealed,false);
      assert.equal(current.judged[`${version}-${tour}-${retained}-0`],80);assert.equal(current.judged[`${version}-${tour}-${removed}-1`],undefined);
      assert.equal(current.auction.phase,'setup');assert.deepEqual(current.auction.points,[0,0]);assert.equal(current.super.status,'ready');assert.equal(current.super.seconds,30);
      assert.equal(current.modernCatalogRevision,1);assert.deepEqual(b.played,[]);assert.deepEqual(b.errors,[]);
    }finally{b.w.close()}
  }
});

test('seasonal holiday refresh preserves matching notes and scores, and resets bonus phases',()=>{
  const a=setup();let saved;
  try{
    a.click('[data-open="melody"]');const select=a.d.querySelector('#melodyVersion');select.value='newyear';select.dispatchEvent(new a.w.Event('change',{bubbles:true}));
    a.click('#backHome');saved=a.snapshot();
  }finally{a.w.close()}
  const data=JSON.parse(saved['snowy-host-melody-v1']),s=data.state;
  delete s.seasonalCatalogRevision;s.modernCatalogRevision=1;s.holidayCatalogRevision=2;s.tour=2;
  s.names=['Аня','Борис','Света'];s.scores=[90,40,-20];s.used=[[],[0,1],[]];s.selected=1;s.revealed=true;
  s.attempts={'newyear-2-0':{active:null,passed:[],open:false,finished:true,token:''},'newyear-2-1':{active:null,passed:[],open:false,finished:true,token:''}};
  s.judged={'newyear-2-0-0':true,'newyear-2-1-1':true};s.auction.phase='result';s.auction.points=[2,3];s.super.status='won';
  saved['snowy-host-melody-v1']=JSON.stringify(data);
  const b=setup(saved);
  try{
    b.click('[data-open="melody"]');assert.match(b.d.querySelector('.game-resume').textContent,/Торги и суперигра/);b.click('#resumeGame');b.click('#backHome');
    const current=JSON.parse(b.snapshot()['snowy-host-melody-v1']).state;
    assert.deepEqual(current.names,['Аня','Борис','Света']);assert.deepEqual(current.scores,[90,40,-20]);
    assert.deepEqual(current.used[1],[0]);assert.equal(current.selected,null);assert.equal(current.revealed,false);
    assert.ok(current.attempts['newyear-2-0']);assert.equal(current.attempts['newyear-2-1'],undefined);
    assert.equal(current.judged['newyear-2-0-0'],true);assert.equal(current.judged['newyear-2-1-1'],undefined);
    assert.equal(current.auction.phase,'setup');assert.deepEqual(current.auction.points,[0,0]);assert.equal(current.super.status,'ready');assert.equal(current.seasonalCatalogRevision,1);
    assert.deepEqual(b.played,[]);assert.deepEqual(b.errors,[]);
  }finally{b.w.close()}
});
