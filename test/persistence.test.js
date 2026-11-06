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
    a.d.querySelector('.melody-answer').open=true;a.click('[data-melody-score="0"][data-direction="-1"]');assert.equal(a.state().scores[0].score,-80);assert.equal(a.d.querySelector('.melody-answer').open,true);
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
