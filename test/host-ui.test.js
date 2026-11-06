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

test('melody answer is visible on the host screen only after reveal and is hidden again',()=>{
 const {w,d,click,socket,errors}=setup();try{
  click('[data-open="melody"]');click('[data-melody-note="0"]');
  const title=d.querySelector('.melody-answer p').textContent;
  assert.equal(d.querySelector('.melody-revealed-answer'),null);
  assert.equal(socket.messages.filter(x=>x.type==='state').at(-1).payload.answer,'');
  assert.match(d.querySelector('#melodyReveal').textContent,/участникам/);
  click('#melodyReveal');assert.match(d.querySelector('.melody-revealed-answer').textContent,new RegExp(title));
  assert.equal(socket.messages.filter(x=>x.type==='state').at(-1).payload.answer,title);
  click('#melodyReveal');assert.equal(d.querySelector('.melody-revealed-answer'),null);
  assert.equal(socket.messages.filter(x=>x.type==='state').at(-1).payload.answer,'');assert.deepEqual(errors,[]);
 }finally{w.close()}
});
