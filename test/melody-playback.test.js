const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const read=f=>fs.readFileSync(f,'utf8');
function setup(){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(read('index.html'),{url:'https://example.test/',runScripts:'outside-only',virtualConsole:vc});
  const w=dom.window,d=w.document,audios=[];let socket;
  w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.confirm=()=>true;
  w.WebSocket=class{constructor(){socket=this;this.readyState=1;this.events={};this.messages=[]}addEventListener(n,f){this.events[n]=f}send(data){this.messages.push(JSON.parse(data))}};w.WebSocket.OPEN=1;
  w.Audio=class{constructor(url){this.url=url;this.plays=0;this.pauses=0;audios.push(this)}play(){this.plays++;return Promise.resolve()}pause(){this.pauses++}};
  for(const file of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js'])w.eval(read(file));socket.events.open();
  const click=sel=>{const el=d.querySelector(sel);assert.ok(el,sel);assert.equal(el.disabled,false,sel);el.click()};
  const state=()=>socket.messages.filter(x=>x.type==='state').at(-1).payload;
  return {w,d,click,state,audios,errors};
}

test('a note starts audio immediately, shows the host title and artist on end, then reveals after judging',()=>{
 const a=setup();try{
  a.click('[data-open="melody"]');a.click('[data-melody-note="0"]');
  const audio=a.audios.at(-1);assert.match(audio.url,/novogodnyaya.mp3$/);assert.equal(audio.plays,1);
  assert.equal(a.d.querySelector('.melody-answer'),null,'the title is not rendered automatically');
  assert.equal(a.state().answer,'');assert.equal(a.state().answerArtist,'');
  audio.onended();assert.equal(a.d.querySelector('.melody-answer'),null,'the end of the clip reveals nothing');
  a.click('#melodyReveal');
  assert.ok(a.d.querySelector('.melody-answer-open'));assert.match(a.d.querySelector('.melody-answer-open').textContent,/Новогодняя/);assert.match(a.d.querySelector('.melody-answer-open').textContent,/Дискотека Авария/);
  a.click('[data-melody-answerer="0"]');assert.ok(a.d.querySelector('#melodyCorrect'));
  assert.equal(a.state().answer,'Новогодняя','the host reveal is also published');a.click('#melodyCorrect');
  assert.equal(a.state().answer,'Новогодняя');assert.equal(a.state().answerArtist,'Дискотека Авария');assert.equal(a.state().scores[0].score,80);
  a.click('[data-melody-undo="0"]');assert.equal(a.state().answer,'');assert.equal(a.state().scores[0].score,0);a.click('[data-melody-answerer="1"]');a.click('#melodyWrong');
  assert.equal(a.state().scores[1].score,-80);assert.equal(a.state().answer,'');assert.deepEqual(a.errors,[]);
 }finally{a.w.close()}
});

test('buzz and stop pause playback and show the host answer; old ended events cannot reveal a new note',()=>{
 const a=setup();try{
  a.click('[data-open="melody"]');a.click('[data-melody-note="0"]');const old=a.audios.at(-1);
  a.click('[data-melody-note="1"]');const next=a.audios.at(-1);assert.ok(old.pauses);old.onended();assert.equal(a.d.querySelector('.melody-answer'),null);
  a.click('#melodyStop');assert.ok(next.pauses);assert.equal(a.d.querySelector('.melody-answer'),null,'stop reveals nothing');
  a.click('#melodyPlay');assert.equal(next.plays,2);a.click('[data-melody-answerer="0"]');assert.ok(next.pauses>=2);
  assert.equal(a.d.querySelector('.melody-answer'),null,'choosing an answerer reveals nothing');assert.ok(a.d.querySelector('#melodyWrong'));
  a.click('#melodyReveal');assert.match(a.d.querySelector('.melody-answer-open').textContent,/Стас Костюшкин/);assert.deepEqual(a.errors,[]);
 }finally{a.w.close()}
});

test('English note without local audio opens YouTube and handles its completion without exposing answers early',()=>{
 const a=setup();try{
  a.click('[data-open="melody"]');const version=a.d.querySelector('#melodyVersion');version.value='international';version.dispatchEvent(new a.w.Event('change',{bubbles:true}));
  a.click('[data-melody-note="0"]');const frame=a.d.querySelector('#melodyExternalPlayer iframe');assert.ok(frame);assert.match(frame.src,/yXQViqx6GMY.*autoplay=1/);assert.equal(a.state().answer,'');
  a.w.dispatchEvent(new a.w.MessageEvent('message',{origin:'https://www.youtube-nocookie.com',source:frame.contentWindow,data:JSON.stringify({event:'onStateChange',info:0})}));
  assert.equal(a.d.querySelector('.melody-answer'),null,'the end of the clip reveals nothing');
  a.click('#melodyReveal');assert.match(a.d.querySelector('.melody-answer-open').textContent,/Mariah Carey/);
  a.click('[data-melody-answerer="0"]');assert.equal(a.d.querySelector('#melodyExternalPlayer').hidden,true);a.click('#melodyCorrect');assert.equal(a.state().answerArtist,'Mariah Carey');assert.deepEqual(a.errors,[]);
 }finally{a.w.close()}
});

test('the host screen keeps setup collapsed and the board and host console in the compact grid',()=>{
 const a=setup();try{
  const style=a.d.createElement('style');style.textContent=read('styles.css');a.d.head.appendChild(style);
  a.click('[data-open="melody"]');assert.equal(a.d.querySelector('.melody-config').open,false);assert.equal(a.d.querySelector('.melody-screen-tools').open,false);
  const layout=a.w.getComputedStyle(a.d.querySelector('.melody-main'));assert.equal(layout.display,'grid');assert.match(layout.gridTemplateAreas,/stage panel/);assert.equal(layout.maxWidth,'1920px');
  assert.equal(a.w.getComputedStyle(a.d.querySelector('.modal-content.melody-screen')).maxWidth,'1920px');
  assert.equal(a.w.getComputedStyle(a.d.querySelector('.melody-stage')).gridArea,'stage');assert.equal(a.w.getComputedStyle(a.d.querySelector('.melody-host-panel')).gridArea,'panel');
  a.d.querySelector('.melody-config').open=true;a.click('#melodyCloseSettings');assert.equal(a.d.querySelector('.melody-config').open,false);assert.deepEqual(a.errors,[]);
 }finally{a.w.close()}
});

test('holiday hit starts locally and reveals title and artist after the clip ends',()=>{
 const a=setup();try{
  a.click('[data-open="melody"]');const version=a.d.querySelector('#melodyVersion');version.value='newyear';version.dispatchEvent(new a.w.Event('change',{bubbles:true}));
  a.click('[data-melody-note="4"]');const audio=a.audios.at(-1);
  assert.match(audio.url,/happy-new-year-abba\.mp3$/);assert.equal(audio.plays,1);assert.equal(a.state().answer,'');
  audio.onended();assert.equal(a.d.querySelector('.melody-answer'),null,'the end of the clip reveals nothing');
  a.click('#melodyReveal');assert.match(a.d.querySelector('.melody-answer-open').textContent,/Happy New Year/);assert.match(a.d.querySelector('.melody-answer-open').textContent,/ABBA/);
  a.click('[data-melody-answerer="0"]');a.click('#melodyCorrect');assert.equal(a.state().answer,'Happy New Year');assert.equal(a.state().answerArtist,'ABBA');assert.deepEqual(a.errors,[]);
 }finally{a.w.close()}
});

test('nothing reveals the title until the host presses «Показать ответ»',()=>{
 const a=setup();try{
  a.click('[data-open="melody"]');a.click('[data-melody-note="0"]');
  const hidden=()=>a.d.querySelector('.melody-answer')===null;
  assert.ok(hidden(),'picking a note does not render the title');
  a.click('#melodyStop');assert.ok(hidden(),'«Стоп» does not render the title');
  a.audios.at(-1).onended();assert.ok(hidden(),'the end of the clip does not render the title');
  a.click('[data-melody-answerer="0"]');assert.ok(hidden(),'choosing an answerer does not render the title');
  assert.equal(a.state().answer,'','participants never receive the title automatically');
  a.click('#melodyReveal');
  const visible=a.d.querySelector('.melody-answer-open');
  assert.ok(visible,'the host button shows the title');assert.equal(visible.tagName,'DIV');
  assert.match(visible.textContent,/Новогодняя/);assert.match(visible.textContent,/Дискотека Авария/);
  assert.match(visible.textContent,/участники тоже видят/);
  assert.equal(a.state().answer,'Новогодняя','pressing the button also opens it for participants');
  // A new note hides it again.
  a.click('[data-melody-note="1"]');assert.equal(a.d.querySelector('.melody-answer'),null);
 }finally{a.w.close()}
});

test('auction and supergame open the answer block right away instead of hiding it behind a click',()=>{
 const a=setup();try{
  a.click('[data-open="melody"]');a.click('[data-melody-tour="5"]');
  a.click('#auctionStart');a.click('[data-auction-bid="3"]');
  assert.equal(a.d.querySelector('.melody-answer'),null,'the auction title is hidden');
  a.click('#auctionReveal');assert.match(a.d.querySelector('.melody-answer-open').textContent,/Салют, Вера/);
  a.click('[data-auction-tour="4"]');a.click('#superStart');
  assert.equal(a.d.querySelector('.melody-answer'),null,'the supergame title is hidden');
  a.click('#superReveal');assert.match(a.d.querySelector('.melody-answer-open').textContent,/Тает лёд/);
  a.click('#superReveal');a.click('#superStop');assert.equal(a.d.querySelector('.melody-answer'),null);
  assert.deepEqual(a.errors,[]);
 }finally{a.w.close()}
});

test('the title is nowhere in the host markup until «Показать ответ» is pressed — no collapsed block either',()=>{
 const a=setup();try{
  a.click('[data-open="melody"]');a.click('[data-melody-note="0"]');
  const html=()=>a.d.querySelector('#gameBody').innerHTML;
  for(const step of ['note','stop','end','answerer']){
   if(step==='stop')a.click('#melodyStop');
   if(step==='end')a.audios.at(-1).onended();
   if(step==='answerer'){a.click('[data-melody-answerer="0"]');}
   // The collapsible «Список песен для ведущего» always lists every title; the answer block must not.
   const panel=a.d.querySelector('.melody-host-panel').innerHTML;
   assert.doesNotMatch(panel,/Новогодняя|Дискотека Авария|melody-answer-open/,`no trace of the title after ${step}`);
   assert.doesNotMatch(JSON.stringify(a.state()),/Новогодняя|Дискотека Авария/,`nothing published after ${step}`);
  }
  a.click('#melodyReveal');assert.match(html(),/Новогодняя/);
 }finally{a.w.close()}
});
