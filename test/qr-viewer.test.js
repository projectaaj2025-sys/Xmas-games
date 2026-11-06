const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const read=f=>fs.readFileSync(f,'utf8');
function setup(){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only',virtualConsole:vc});
 const w=dom.window;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:true,json:async()=>({addresses:['192.168.0.2'],port:4173})});
 w.Audio=class{play(){return Promise.resolve()}pause(){}};
 w.makeInviteQr=text=>'data:image/svg+xml,'+encodeURIComponent(text);
 w.WebSocket=class{constructor(){this.readyState=0}addEventListener(){}};w.WebSocket.OPEN=1;
 for(const file of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js'])w.eval(read(file));
 const click=selector=>{const el=w.document.querySelector(selector);assert.ok(el,selector);el.click()};
 return {w,d:w.document,click,errors};
}
const wait=()=>new Promise(resolve=>setTimeout(resolve,0));
test('phone QR opens enlarged, can close with Escape without closing game',async()=>{
 const {w,d,click,errors}=setup();try{
  click('[data-open="field"]');await wait();d.querySelector('.field-invite').open=true;d.querySelector('#enlargePlayerQr').focus();click('#enlargePlayerQr');
  assert.ok(d.querySelector('.large-qr-dialog[aria-modal="true"]'));assert.match(d.querySelector('.large-qr-dialog img').src,/api\/qr.svg/);assert.match(d.querySelector('#largeQrTitle').textContent,/игроков/);
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(d.querySelector('.large-qr-dialog'),null);assert.ok(d.querySelector('#gameModal').classList.contains('open'));assert.equal(d.activeElement.id,'enlargePlayerQr');assert.deepEqual(errors,[]);
 }finally{w.close()}
});
test('screen QR opens enlarged and restores focus on close',()=>{
 const {w,d,click,errors}=setup();try{
  click('[data-open="melody"]');click('#showScreenQr');assert.equal(d.querySelector('#screenQrPanel').hidden,false);d.querySelector('#enlargeScreenQr').focus();click('#enlargeScreenQr');
  assert.match(d.querySelector('#largeQrTitle').textContent,/экрана участников/);assert.equal(d.querySelector('.large-qr-dialog img').src,d.querySelector('#screenQrImage').src);click('#closeLargeQr');assert.equal(d.activeElement.id,'enlargeScreenQr');assert.equal(d.querySelector('.large-qr-dialog'),null);assert.deepEqual(errors,[]);
 }finally{w.close()}
});

test('connected same-computer monitor guidance keeps the active host game and fullscreen uses that window',()=>{
 const {w,d,click,errors}=setup();try{
  let fullscreenCalls=0,opened=0;d.documentElement.requestFullscreen=()=>{fullscreenCalls++;return Promise.resolve()};w.open=()=>{opened++;return {}};
  click('[data-open="melody"]');click('[data-melody-note="1"]');
  click('#openDisplay');assert.match(d.querySelector('.screen-guide').textContent,/это окно игры/);assert.match(d.querySelector('.screen-guide').textContent,/только для просмотра/);assert.equal(opened,0);
  click('#guideFullscreen');assert.equal(fullscreenCalls,1);assert.ok(d.querySelector('[data-melody-note="1"].selected'));assert.equal(d.querySelector('.screen-guide'),null);
  click('#openViewerDisplay');assert.equal(opened,1);assert.deepEqual(errors,[]);
 }finally{w.close()}
});
