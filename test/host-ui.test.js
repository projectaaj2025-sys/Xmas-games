const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const read=p=>fs.readFileSync(p,'utf8');
function setup(){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only',virtualConsole:vc});
  const w=dom.window;let socket;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.confirm=()=>true;
  w.WebSocket=class{constructor(){socket=this;this.readyState=1;this.events={};this.messages=[]}addEventListener(n,f){this.events[n]=f}send(data){this.messages.push(JSON.parse(data))}};w.WebSocket.OPEN=1;
  w.Audio=class{play(){return Promise.resolve()}pause(){}};
  for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js'])w.eval(read(f));socket.events.open();
  const click=sel=>{const el=w.document.querySelector(sel);assert.ok(el,sel);el.click()};
  return {w,d:w.document,click,socket,errors};
}

test('all game frames identify this device as the host and the participant display as optional',()=>{
 const {w,d,click,errors}=setup();try{
  for(const game of ['memo','guess','croc','quiz','crossword','music','drive','field','melody']){
   click(`[data-open="${game}"]`);
   assert.match(d.querySelector('.host-screen-label').textContent,/экран[еа] ведущего/i,game);
   assert.match(d.querySelector('#openViewerDisplay').textContent,/экран участников/i,game);
   assert.match(d.querySelector('.screen-instruction').textContent,/только просмотр/,game);
   if(game==='field')assert.equal(d.querySelector('[data-field-seat="0"] option').textContent,'Управляет ведущий');
   click('#backHome');
  }
  click('#warmupOpen');assert.match(d.querySelector('.host-screen-label').textContent,/экран[еа] ведущего/i);
  assert.deepEqual(errors,[]);
 }finally{w.close()}
});

test('the melody title appears on the host screen and for participants only after «Показать ответ»',()=>{
 const {w,d,click,socket,errors}=setup();try{
  const last=()=>socket.messages.filter(x=>x.type==='state').at(-1).payload;
  click('[data-open="melody"]');click('[data-melody-note="0"]');
  assert.equal(d.querySelector('.melody-answer'),null,'the title is not rendered just by picking a note');
  click('#melodyStop');assert.equal(d.querySelector('.melody-answer'),null,'«Стоп» does not render the title');
  assert.equal(last().answer,'','participants get nothing automatically');
  assert.match(d.querySelector('#melodyReveal').textContent,/Показать ответ/);
  click('#melodyReveal');
  const title=d.querySelector('.melody-answer-open p').textContent;
  assert.ok(title);assert.match(d.querySelector('.melody-answer-open').textContent,/участники тоже видят/);
  assert.equal(last().answer,title,'participants see the title after the host presses the button');
  assert.equal(d.querySelector('.melody-revealed-answer').textContent.includes(title),true);
  click('#melodyReveal');assert.equal(d.querySelector('.melody-answer'),null);
  assert.equal(last().answer,'','hiding takes it back');assert.deepEqual(errors,[]);
 }finally{w.close()}
});
