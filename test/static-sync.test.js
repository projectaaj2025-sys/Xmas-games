const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('static-sync.js','utf8');

// A deterministic in-memory PeerJS data-channel network. It exercises our
// protocol, not real signalling, NAT traversal or browser WebRTC.
function fakeNetwork() {
  const peers=new Map();let counter=0;
  class Emitter {constructor(){this.events={}} on(n,f){(this.events[n]??=[]).push(f)} emit(n,...args){for(const f of this.events[n]||[])f(...args)}}
  class Connection extends Emitter {
    constructor(peer){super();this.peer=peer;this.open=false;this.closed=false}
    send(data){if(this.open && !this.closed)setImmediate(()=>{if(!this.other.closed)this.other.emit('data',structuredClone(data))})}
    close(){if(this.closed)return;this.closed=true;this.open=false;this.emit('close');if(!this.other.closed)this.other.close()}
  }
  class Peer extends Emitter {
    constructor(id){super();this.id=id||`anonymous-${++counter}`;this.destroyed=false;this.connections=[];setImmediate(()=>{if(peers.has(this.id))this.emit('error',new Error('taken'));else{peers.set(this.id,this);this.emit('open',this.id)}})}
    connect(id){const client=new Connection(id);const remote=peers.get(id);setImmediate(()=>{if(!remote){client.emit('error',new Error('missing'));return}const server=new Connection(this.id);client.other=server;server.other=client;this.connections.push(client);remote.connections.push(server);remote.emit('connection',server);client.open=server.open=true;client.emit('open');server.emit('open')});return client}
    destroy(){if(this.destroyed)return;this.destroyed=true;if(peers.get(this.id)===this)peers.delete(this.id);for(const c of this.connections)if(c.other)c.close()}
    reconnect(){}
  }
  return Peer;
}
const wait=()=>new Promise(resolve=>setTimeout(resolve,30));
// Re-rendered state messages race with assertions in slow/loaded runs; poll for the outcome instead of a fixed delay.
async function waitFor(condition, tries=80){for(let i=0;i<tries;i++){if(condition())return true;await wait();}return condition();}
function create(Peer,role,token,name,requestedId) {
  const dom=new JSDOM('',{url:'https://example.com/',runScripts:'outside-only'});const w=dom.window;w.Peer=Peer;w.eval(source);
  const socket=new w.StaticSync('ABCD2345',role==='host'?'host':'client');const messages=[];
  socket.addEventListener('message',e=>messages.push(JSON.parse(e.data)));
  socket.addEventListener('open',()=>socket.send(JSON.stringify(role==='host'?{type:'join',role:'host'}:{type:'join',role,playerId:requestedId,name,reconnectToken:token})));
  return {dom,socket,messages};
}

test('host routes filtered state, authenticates reconnect identity, and rejects inactive actions',async()=>{
  const Peer=fakeNetwork(),clients=[];
  const spawn=(...args)=>{const c=create(Peer,...args);clients.push(c);return c};
  const host=spawn('host');await wait();
  const alice=spawn('player','a'.repeat(64),'Alice','public-id');
  const bob=spawn('player','b'.repeat(64),'Bob','public-id');
  const screen=spawn('screen');await wait();
  try {
    const a=alice.messages.find(m=>m.type==='joined').playerId,b=bob.messages.find(m=>m.type==='joined').playerId;
    assert.notEqual(a,b);assert.notEqual(a,'public-id');
    let presence=host.messages.filter(m=>m.type==='presence').at(-1);
    assert.equal(presence.count,1);assert.equal(presence.players.length,2);
    host.socket.send(JSON.stringify({type:'state',payload:{game:'guess',guessMode:'circle',activePlayerId:a,circleCards:[{id:a,name:'Alice',word:'SECRET-A',emoji:'A',image:'a.png',hint:'hint A'},{id:b,name:'Bob',word:'SECRET-B'}]}}));await wait();
    const state=c=>c.messages.filter(m=>m.type==='state').at(-1).payload;
    assert.equal(state(alice).playerView.word,'');assert.ok(!JSON.stringify(state(alice)).includes('SECRET-A'));
    assert.equal(state(bob).playerView.word,'SECRET-A');assert.ok(!JSON.stringify(state(bob)).includes('SECRET-B'));
    assert.ok(!JSON.stringify(state(screen)).includes('SECRET-A'));assert.ok(!('circleCards' in state(screen)));
    bob.socket.send(JSON.stringify({type:'player-action',action:'solved',playerId:a}));await wait();assert.equal(host.messages.filter(m=>m.type==='player-action').length,0);
    alice.socket.send(JSON.stringify({type:'player-action',action:'solved',playerId:b}));await wait();assert.equal(host.messages.filter(m=>m.type==='player-action').at(-1).playerId,a);
    alice.socket.close();await wait();assert.equal(host.messages.filter(m=>m.type==='presence').at(-1).players.length,1);
    const returnee=spawn('player','a'.repeat(64),'Alice','fake');await wait();
    assert.equal(returnee.messages.find(m=>m.type==='joined').playerId,a);
    assert.equal(state(returnee).playerView.word,'');
    assert.equal(host.messages.filter(m=>m.type==='presence').at(-1).players.length,2);
  } finally {for(const c of clients){c.socket.close();c.dom.window.close()}}
});

test('HTTPS host, phones and projector cooperate through the static transport',async()=>{
  const Peer=fakeNetwork(),doms=[];
  function page(file,url,scripts) {
    const dom=new JSDOM(fs.readFileSync(file,'utf8'),{url,runScripts:'outside-only'});doms.push(dom);
    const w=dom.window;w.Peer=Peer;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.Audio=class{play(){return Promise.resolve()}pause(){}};
    for(const script of scripts){w.eval(fs.readFileSync(script,'utf8'));if(script==='static-sync.js' && file==='index.html'){const Original=w.StaticSync;w.StaticSync=class extends Original{constructor(...args){super(...args);w.__hostSync=this}}}}
    return w;
  }
  try {
    const host=page('index.html','https://example.com/Xmas-games/',['assets/vendor/qrcode-generator-1.4.4.js','static-sync.js','quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']);await wait();
    const d=host.document;d.querySelector('[data-open="guess"]').click();d.querySelector('[data-guess-mode="circle"]').click();await wait();
    assert.match(d.querySelector('#playerInviteQr').src,/^data:image\/svg\+xml/);
    const url=d.querySelector('#playerInviteUrl').textContent,room=new URL(url).searchParams.get('room');assert.equal(room.length,8);
    d.querySelector('#showScreenQr').click();assert.match(d.querySelector('#screenQrImage').src,/^data:image\/svg\+xml/);
    const projector=page('display.html',`https://example.com/Xmas-games/display.html?room=${room}`,['static-sync.js','display.js']);
    const a=page('player.html',url,['static-sync.js','player.js']);const b=page('player.html',url,['static-sync.js','player.js']);
    for(const [w,name] of [[a,'Alice'],[b,'Bob']]){w.document.querySelector('#playerName').value=name;w.document.querySelector('#joinButton').click()}
    await wait();await wait();
    assert.match(d.querySelector('.circle-player-list').textContent,/Alice/);assert.match(d.querySelector('.circle-player-list').textContent,/Bob/);
    assert.match(projector.document.querySelector('#screenConnection').textContent,/связи|подключён/);
    assert.equal(a.document.querySelector('#playerActions').hidden,false);assert.equal(a.document.querySelector('#playerWord').textContent,'ТВОЯ КАРТОЧКА');
    assert.notEqual(b.document.querySelector('#playerWord').textContent,'');
    a.document.querySelector('#solvedButton').click();
    assert.ok(await waitFor(()=>/1 ★/.test(d.querySelector('.circle-player-list').textContent)),'the host counts the point');
    assert.ok(await waitFor(()=>b.document.querySelector('#playerActions').hidden===false),'the turn passes to Bob');
    // A dropped channel and rejoin must keep Alice's score.
    const member=[...PeerFor(host).members].find(m=>m.name==='Alice');member.conn.close();await wait();
    // Trigger reconnection immediately rather than waiting for the browser timer.
    a.document.querySelector('#leaveButton').click();a.document.querySelector('#playerName').value='Alice';a.document.querySelector('#joinButton').click();await wait();await wait();
    assert.match(d.querySelector('.circle-player-list').textContent,/Alice[\s\S]*1 ★/);
  } finally {for(const dom of doms)dom.window.close()}
  function PeerFor(w){return w.__hostSync}
});

test('field phones and spectators get safe state; only the active player can act',async()=>{
  const Peer=fakeNetwork(),doms=[];
  function page(file,url,scripts){const dom=new JSDOM(fs.readFileSync(file,'utf8'),{url,runScripts:'outside-only'});doms.push(dom);const w=dom.window;w.Peer=Peer;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.Audio=class{play(){return Promise.resolve()}pause(){}};for(const script of scripts){w.eval(fs.readFileSync(script,'utf8'));if(script==='static-sync.js'&&file==='index.html'){const Original=w.StaticSync;w.StaticSync=class extends Original{constructor(...args){super(...args);w.__hostSync=this}}}}return w}
  try{
    const host=page('index.html','https://example.com/Xmas-games/',['assets/vendor/qrcode-generator-1.4.4.js','static-sync.js','quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']);await wait();
    host.FIELD_QUESTIONS=[{question:'Тайный вопрос',answer:'АБРИКОС'}];const d=host.document;d.querySelector('[data-open="field"]').click();await wait();
    const url=d.querySelector('#playerInviteUrl').textContent,room=new URL(url).searchParams.get('room');assert.match(d.querySelector('#playerInviteQr').src,/^data:image\/svg/);
    const a=page('player.html',url,['static-sync.js','player.js']), b=page('player.html',url,['static-sync.js','player.js']),v=page('player.html',url,['static-sync.js','player.js']);
    const projector=page('display.html',`https://example.com/Xmas-games/display.html?room=${room}`,['static-sync.js','display.js']);
    for(const [w,name,role] of [[a,'Аня','player'],[b,'Борис','player'],[v,'Зритель','viewer']]){w.document.querySelector('#playerName').value=name;w.document.querySelector('#phoneRole').value=role;w.document.querySelector('#joinButton').click()}
    await wait();await wait();const members=[...host.__hostSync.members];const alice=members.find(m=>m.name==='Аня'),bob=members.find(m=>m.name==='Борис');
    for(const [i,m] of [[0,alice],[1,bob]]){const select=d.querySelector(`[data-field-seat="${i}"]`);select.value=m.playerId;select.dispatchEvent(new host.Event('change',{bubbles:true}));}
    d.querySelector('#fieldStart').click();await wait();
    assert.equal(a.document.querySelector('[data-field-action="spin"]').disabled,false);assert.equal(b.document.querySelector('[data-field-action="spin"]'),null);
    assert.ok(v.document.querySelector('[data-reaction="👏"]'));assert.ok(!v.document.querySelector('[data-field-action="spin"]'));
    assert.match(projector.document.querySelector('#screenStage').textContent,/Тайный вопрос/);assert.ok(!projector.document.querySelector('#screenStage').textContent.includes('АБРИКОС'));
    // Inactive device forges an action, but the transport refuses it.
    bob.conn.other.send({type:'player-action',action:{kind:'spin'}});await wait();assert.equal(d.querySelector('#fieldSpin').disabled,false);
    v.document.querySelector('[data-reaction="👏"]').click();await wait();assert.match(d.querySelector('.field-reaction').textContent,/👏/);
    a.document.querySelector('#phoneAnswer').value='АБРИКОС';a.document.querySelector('#phoneSolve').dispatchEvent(new a.Event('submit',{bubbles:true,cancelable:true}));
    // Host processing and screen broadcast are separate asynchronous deliveries.
    for(let attempt=0;attempt<20 && !projector.document.querySelector('#screenStage').textContent.includes('АБРИКОС');attempt++) await wait();
    assert.match(projector.document.querySelector('#screenStage').textContent,/АБРИКОС/);assert.match(a.document.querySelector('#playerInstructions').textContent,/угадал/);
  }finally{for(const dom of doms)dom.window.close()}
});

test('phone profile updates keep identity, update field roster and stop spectator control',async()=>{
  const Peer=fakeNetwork(),doms=[];
  function page(file,url,scripts){const dom=new JSDOM(fs.readFileSync(file,'utf8'),{url,runScripts:'outside-only'});doms.push(dom);const w=dom.window;w.Peer=Peer;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.Audio=class{play(){return Promise.resolve()}pause(){}};for(const script of scripts){w.eval(fs.readFileSync(script,'utf8'));if(script==='static-sync.js'&&file==='index.html'){const Original=w.StaticSync;w.StaticSync=class extends Original{constructor(...args){super(...args);w.__hostSync=this}}}}return w;}
  const submit=(w,selector)=>w.document.querySelector(selector).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  try{
    const host=page('index.html','https://example.com/Xmas-games/',['assets/vendor/qrcode-generator-1.4.4.js','static-sync.js','quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']);await wait();
    host.FIELD_QUESTIONS=[{question:'Вопрос',answer:'БАРАБАН'}];const d=host.document;d.querySelector('[data-open="field"]').click();await wait();const url=d.querySelector('#playerInviteUrl').textContent;
    const a=page('player.html',url,['static-sync.js','player.js']),v=page('player.html',url,['static-sync.js','player.js']);
    for(const [w,name,role] of [[a,'Аня','player'],[v,'Гость','viewer']]){w.document.querySelector('#playerName').value=name;w.document.querySelector('#phoneRole').value=role;w.document.querySelector('#joinButton').click()}
    await wait();await wait();assert.match(d.querySelector('[data-connected-members]').textContent,/Подключено: 2 · Игроки: 1 · Зрители: 1/);assert.match(d.querySelector('[data-connected-members]').textContent,/Гость/);
    const member=[...host.__hostSync.members].find(m=>m.name==='Аня'),id=member.playerId;
    const seat=d.querySelector('[data-field-seat="0"]');seat.value=id;seat.dispatchEvent(new host.Event('change',{bubbles:true}));d.querySelector('#fieldStart').click();await wait();
    assert.ok(a.document.querySelector('[data-field-action="spin"]'));
    d.querySelector('#fieldAnswer').value='Черновик';
    a.document.querySelector('#profileName').value='Анна';submit(a,'#profileForm');await wait();await wait();
    assert.equal(member.playerId,id);assert.match(a.document.querySelector('#profileSummary').textContent,/Анна · Игрок/);assert.match(d.querySelector('.field-score').textContent,/Анна/);assert.equal(d.querySelector('#fieldAnswer').value,'Черновик');assert.match(d.querySelector('[data-connected-members]').textContent,/Анна/);
    a.document.querySelector('#profileRole').value='viewer';submit(a,'#profileForm');await wait();await wait();
    assert.match(d.querySelector('[data-connected-members]').textContent,/Игроки: 0 · Зрители: 2/);assert.ok(a.document.querySelector('[data-reaction="👏"]'));assert.equal(a.document.querySelector('[data-field-action="spin"]'),null);
    member.conn.other.send({type:'player-action',action:{kind:'spin'}});await wait();assert.equal(d.querySelector('#fieldSpin').disabled,false);
    a.document.querySelector('#profileRole').value='player';submit(a,'#profileForm');await wait();await wait();
    assert.match(d.querySelector('[data-connected-members]').textContent,/Игроки: 1 · Зрители: 1/);assert.equal(a.document.querySelector('[data-field-action="spin"]'),null);
    const assign=d.querySelector('[data-field-player-seat="0"]');assign.value=id;assign.dispatchEvent(new host.Event('change',{bubbles:true}));await wait();assert.ok(a.document.querySelector('[data-field-action="spin"]'));
    const renamed=d.querySelector('[data-field-player-name="0"]');renamed.value='Игрок А';renamed.dispatchEvent(new host.Event('change',{bubbles:true}));await wait();assert.match(d.querySelector('.field-score').textContent,/Игрок А/);assert.equal(d.querySelector('#fieldAnswer').value,'Черновик');
  }finally{for(const dom of doms)dom.window.close()}
});

test('changing phone name and role in the circle preserves identity and points without exposing a private card',async()=>{
  const Peer=fakeNetwork(),doms=[];
  function page(file,url,scripts){const dom=new JSDOM(fs.readFileSync(file,'utf8'),{url,runScripts:'outside-only'});doms.push(dom);const w=dom.window;w.Peer=Peer;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.Audio=class{play(){return Promise.resolve()}pause(){}};for(const script of scripts){w.eval(fs.readFileSync(script,'utf8'));if(script==='static-sync.js'&&file==='index.html'){const Original=w.StaticSync;w.StaticSync=class extends Original{constructor(...args){super(...args);w.__hostSync=this}}}}return w;}
  try{
    const host=page('index.html','https://example.com/Xmas-games/',['assets/vendor/qrcode-generator-1.4.4.js','static-sync.js','quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']);await wait();const d=host.document;d.querySelector('[data-open="guess"]').click();d.querySelector('[data-guess-mode="circle"]').click();await wait();
    const player=page('player.html',d.querySelector('#playerInviteUrl').textContent,['static-sync.js','player.js']);player.document.querySelector('#playerName').value='Аня';player.document.querySelector('#joinButton').click();await wait();await wait();
    const member=[...host.__hostSync.members].find(m=>m.name==='Аня'),id=member.playerId;
    player.document.querySelector('#solvedButton').click();await wait();assert.match(d.querySelector('.circle-player-list').textContent,/1 ★/);
    const submit=()=>player.document.querySelector('#profileForm').dispatchEvent(new player.Event('submit',{bubbles:true,cancelable:true}));
    player.document.querySelector('#profileName').value='Анна';submit();await wait();await wait();assert.match(d.querySelector('.circle-player-list').textContent,/Анна[\s\S]*1 ★/);assert.equal(member.playerId,id);assert.equal(player.document.querySelector('#playerWord').textContent,'ТВОЯ КАРТОЧКА');
    player.document.querySelector('#profileRole').value='viewer';submit();await wait();await wait();assert.match(d.querySelector('[data-connected-members]').textContent,/Игроки: 0 · Зрители: 1/);assert.equal(player.document.querySelector('#playerWord').textContent,'');assert.equal(player.document.querySelector('#playerActions').hidden,true);
    player.document.querySelector('#profileRole').value='player';submit();await wait();await wait();assert.match(d.querySelector('.circle-player-list').textContent,/Анна[\s\S]*1 ★/);assert.equal(player.document.querySelector('#playerWord').textContent,'ТВОЯ КАРТОЧКА');
  }finally{for(const dom of doms)dom.window.close()}
});

test('melody buzzer accepts the first assigned phone, rejects stale and spectator signals, and supports host judging',async()=>{
  const Peer=fakeNetwork(),doms=[];
  function page(file,url,scripts){const dom=new JSDOM(fs.readFileSync(file,'utf8'),{url,runScripts:'outside-only'});doms.push(dom);const w=dom.window;w.Peer=Peer;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.Audio=class{play(){return Promise.resolve()}pause(){}};for(const script of scripts){w.eval(fs.readFileSync(script,'utf8'));if(script==='static-sync.js'&&file==='index.html'){const Original=w.StaticSync;w.StaticSync=class extends Original{constructor(...args){super(...args);w.__hostSync=this}}}}return w;}
  try{
    const host=page('index.html','https://example.com/Xmas-games/',['assets/vendor/qrcode-generator-1.4.4.js','static-sync.js','quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']);await wait();const d=host.document;d.querySelector('[data-open="melody"]').click();await wait();
    const url=d.querySelector('#playerInviteUrl').textContent;const a=page('player.html',url,['static-sync.js','player.js']),b=page('player.html',url,['static-sync.js','player.js']),v=page('player.html',url,['static-sync.js','player.js']);
    for(const [w,name,role] of [[a,'Аня','player'],[b,'Борис','player'],[v,'Гость','viewer']]){w.document.querySelector('#playerName').value=name;w.document.querySelector('#phoneRole').value=role;w.document.querySelector('#joinButton').click()};await wait();await wait();
    for(const [i,name] of [[0,'Аня'],[1,'Борис']]){const m=[...host.__hostSync.members].find(m=>m.name===name),select=d.querySelector(`[data-melody-seat="${i}"]`);select.value=m.playerId;select.dispatchEvent(new host.Event('change',{bubbles:true}));}
    d.querySelector('[data-melody-note="0"]').click();await wait();const oldToken=host.__hostSync.state.buzz.token;
    assert.equal(a.document.querySelector('#melodyBuzz').disabled,false);assert.equal(v.document.querySelector('#melodyBuzz').disabled,true);
    a.document.querySelector('#melodyBuzz').click();b.document.querySelector('#melodyBuzz').click();await wait();await wait();
    assert.equal(host.__hostSync.state.buzz.active,0);assert.ok(d.querySelectorAll('.melody-player-score')[0].classList.contains('active'));assert.match(a.document.querySelector('#playerHeading').textContent,/отвечаете/);
    d.querySelector('#melodyWrong').click();await wait();await wait();assert.equal(host.__hostSync.state.scores[0].score,-80);assert.deepEqual([...host.__hostSync.state.buzz.passed],[0]);assert.ok(d.querySelectorAll('.melody-player-score')[0].classList.contains('passed'));
    const bob=[...host.__hostSync.members].find(m=>m.name==='Борис');bob.conn.other.send({type:'player-action',action:{kind:'melody-buzz',token:oldToken}});await wait();assert.equal(host.__hostSync.state.buzz.active,null);
    b.document.querySelector('#melodyBuzz').click();await wait();assert.equal(host.__hostSync.state.buzz.active,1);d.querySelector('#melodyCorrect').click();await wait();assert.equal(host.__hostSync.state.scores[1].score,80);assert.equal(host.__hostSync.state.buzz.finished,true);
    d.querySelector('#melodyDone').click();d.querySelector('[data-melody-note="1"]').click();assert.ok(!d.querySelectorAll('.melody-player-score')[0].classList.contains('passed'));
    d.querySelector('[data-melody-answerer="2"]').click();d.querySelector('#melodyPass').click();assert.ok(d.querySelectorAll('.melody-player-score')[2].classList.contains('passed'));d.querySelector('[data-melody-unpass="2"]').click();assert.ok(!d.querySelectorAll('.melody-player-score')[2].classList.contains('passed'));await wait();await wait();
  }finally{for(const dom of doms)dom.window.close()}
});

test('phones are seated automatically and can act on their turn without manual assignment',async()=>{
  const Peer=fakeNetwork(),doms=[];
  function page(file,url,scripts){const dom=new JSDOM(fs.readFileSync(file,'utf8'),{url,runScripts:'outside-only'});doms.push(dom);const w=dom.window;w.Peer=Peer;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.confirm=()=>true;w.Audio=class{play(){return Promise.resolve()}pause(){}};for(const script of scripts){w.eval(fs.readFileSync(script,'utf8'));if(script==='static-sync.js'&&file==='index.html'){const Original=w.StaticSync;w.StaticSync=class extends Original{constructor(...args){super(...args);w.__hostSync=this}}}}return w;}
  try{
    const host=page('index.html','https://example.com/Xmas-games/',['assets/vendor/qrcode-generator-1.4.4.js','static-sync.js','quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']);await wait();
    host.FIELD_QUESTIONS=[{question:'Вопрос',answer:'БАРАБАН'}];const d=host.document;d.querySelector('[data-open="field"]').click();await wait();
    const phone=page('player.html',d.querySelector('#playerInviteUrl').textContent,['static-sync.js','player.js']);
    phone.document.querySelector('#playerName').value='Аня';phone.document.querySelector('#joinButton').click();await wait();await wait();
    const seat=d.querySelector('[data-field-seat="0"]');assert.ok(seat.value,'phone is seated without host action');assert.match(d.querySelector('.field-seat-status').textContent,/Аня/);
    d.querySelector('#fieldStart').click();await wait();await wait();
    assert.match(phone.document.querySelector('#playerHeading').textContent,/Ваш ход/);
    const spin=phone.document.querySelector('[data-field-action="spin"]');assert.ok(spin,'the seated phone gets its own controls');assert.equal(spin.disabled,false);
    // Detaching the phone sticks: the same phone is not re-seated by a later presence event.
    const detach=d.querySelector('[data-field-player-seat="0"]');detach.value='';detach.dispatchEvent(new host.Event('change',{bubbles:true}));await wait();
    await wait();assert.equal(host.__hostSync.state.players[0].id,'');
    assert.equal(phone.document.querySelector('[data-field-action="spin"]'),null);
    // Re-rendering after a detach must not silently re-seat the same phone again.
    const answer=d.querySelector('#fieldAnswer');answer.value='Черновик';
    d.querySelector('#fieldRefreshPlayers').click();await wait();
    assert.equal(d.querySelector('[data-field-player-seat="0"]').value,'');
    assert.equal(d.querySelector('#fieldAnswer').value,'Черновик');
  }finally{for(const dom of doms)dom.window.close()}
});

test('a melody note opens the phone buzzers at once while the answer stays on the host console',async()=>{
  const Peer=fakeNetwork(),doms=[];
  function page(file,url,scripts){const dom=new JSDOM(fs.readFileSync(file,'utf8'),{url,runScripts:'outside-only'});doms.push(dom);const w=dom.window;w.Peer=Peer;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.confirm=()=>true;w.Audio=class{play(){return Promise.resolve()}pause(){}};for(const script of scripts){w.eval(fs.readFileSync(script,'utf8'));if(script==='static-sync.js'&&file==='index.html'){const Original=w.StaticSync;w.StaticSync=class extends Original{constructor(...args){super(...args);w.__hostSync=this}}}}return w;}
  try{
    const host=page('index.html','https://example.com/Xmas-games/',['assets/vendor/qrcode-generator-1.4.4.js','static-sync.js','quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']);await wait();const d=host.document;
    d.querySelector('[data-open="melody"]').click();await wait();
    const phone=page('player.html',d.querySelector('#playerInviteUrl').textContent,['static-sync.js','player.js']);
    phone.document.querySelector('#playerName').value='Аня';phone.document.querySelector('#joinButton').click();await wait();await wait();
    assert.ok(d.querySelector('[data-melody-seat="0"]').value,'phone takes a free melody seat');
    d.querySelector('[data-melody-note="0"]').click();await wait();await wait();
    assert.equal(phone.document.querySelector('#melodyBuzz').disabled,false,'buzz is live while the clip plays');
    assert.match(phone.document.querySelector('#playerHeading').textContent,/Нажмите|знаете/);
    assert.equal(d.querySelector('.melody-answer'),null,'host answer is hidden until the host reveals it');
    phone.document.querySelector('#melodyBuzz').click();await wait();await wait();
    assert.equal(host.__hostSync.state.buzz.active,0);
    d.querySelector('#melodyStop').click();await wait();
    assert.equal(d.querySelector('.melody-answer'),null,'«Стоп» still shows nothing to the host');
    assert.equal(host.__hostSync.state.answer,'','participants never receive the title');
    d.querySelector('#melodyReveal').click();await wait();
    assert.ok(d.querySelector('.melody-answer-open'),'the host button shows the title');
    assert.equal(host.__hostSync.state.answer,'Новогодняя','and then the participants see it too');
  }finally{for(const dom of doms)dom.window.close()}
});

test('a detached melody seat is not re-seated by a later host re-render',async()=>{
  const Peer=fakeNetwork(),doms=[];
  function page(file,url,scripts){const dom=new JSDOM(fs.readFileSync(file,'utf8'),{url,runScripts:'outside-only'});doms.push(dom);const w=dom.window;w.Peer=Peer;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.confirm=()=>true;w.Audio=class{play(){return Promise.resolve()}pause(){}};for(const script of scripts){w.eval(fs.readFileSync(script,'utf8'));if(script==='static-sync.js'&&file==='index.html'){const Original=w.StaticSync;w.StaticSync=class extends Original{constructor(...args){super(...args);w.__hostSync=this}}}}return w;}
  try{
    const host=page('index.html','https://example.com/Xmas-games/',['assets/vendor/qrcode-generator-1.4.4.js','static-sync.js','quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']);await wait();const d=host.document;
    d.querySelector('[data-open="melody"]').click();await wait();
    const phone=page('player.html',d.querySelector('#playerInviteUrl').textContent,['static-sync.js','player.js']);
    phone.document.querySelector('#playerName').value='Аня';phone.document.querySelector('#joinButton').click();await wait();await wait();
    const seat=d.querySelector('[data-melody-seat="0"]');assert.ok(seat.value);
    seat.value='';seat.dispatchEvent(new host.Event('change',{bubbles:true}));await wait();
    assert.equal(d.querySelector('[data-melody-seat="0"]').value,'');
    // Any ordinary host re-render (a name edit) must keep the seat empty.
    const name=d.querySelector('[data-melody-name="0"]');name.value='Аня';name.dispatchEvent(new host.Event('change',{bubbles:true}));await wait();
    assert.equal(d.querySelector('[data-melody-seat="0"]').value,'');
    assert.match(phone.document.querySelector('#playerInstructions').textContent,/без места|не назначен/i);
  }finally{for(const dom of doms)dom.window.close()}
});

test('a seating phone drives the quiz and memo on its turn, and the host rejects other turns',async()=>{
  const Peer=fakeNetwork(),doms=[];
  function page(file,url,scripts){const dom=new JSDOM(fs.readFileSync(file,'utf8'),{url,runScripts:'outside-only'});doms.push(dom);const w=dom.window;w.Peer=Peer;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.confirm=()=>true;w.Audio=class{play(){return Promise.resolve()}pause(){}};for(const script of scripts){w.eval(fs.readFileSync(script,'utf8'));if(script==='static-sync.js'&&file==='index.html'){const Original=w.StaticSync;w.StaticSync=class extends Original{constructor(...args){super(...args);w.__hostSync=this}}}}return w;}
  try{
    const host=page('index.html','https://example.com/Xmas-games/',['assets/vendor/qrcode-generator-1.4.4.js','static-sync.js','quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']);await wait();
    const d=host.document;d.querySelector('[data-open="quiz"]').click();await wait();
    const a=page('player.html',d.querySelector('#playerInviteUrl').textContent,['static-sync.js','player.js']);
    const b=page('player.html',d.querySelector('#playerInviteUrl').textContent,['static-sync.js','player.js']);
    for(const [w,name] of [[a,'Команда 1'],[b,'Команда 2']]){w.document.querySelector('#playerName').value=name;w.document.querySelector('#joinButton').click()}
    // The active team is announced on the host console; read it instead of guessing.
    assert.ok(await waitFor(()=>host.__hostSync.state?.turn&&['Команда 1','Команда 2'].includes(host.__hostSync.state.turn.names[host.__hostSync.state.turn.active])),'the host publishes the turn');
    const activeName=host.__hostSync.state.turn.names[host.__hostSync.state.turn.active];
    const phones={'Команда 1':a,'Команда 2':b};
    const driver=phones[activeName],other=activeName==='Команда 1'?b:a,otherName=activeName==='Команда 1'?'Команда 2':'Команда 1';
    assert.ok(await waitFor(()=>driver.document.querySelector('#playerHeading').textContent==='ВАША ОЧЕРЕДЬ!'),'the phone on turn gets the turn UI');
    assert.ok(await waitFor(()=>new RegExp('Отвечает: '+activeName).test(other.document.querySelector('#playerHeading').textContent)),'the other phone waits');
    assert.equal(other.document.querySelectorAll('[data-quiz-cell]').length,0,'only the phone on its turn gets the board');
    driver.document.querySelector('[data-quiz-cell]').click();
    assert.ok(await waitFor(()=>!!d.querySelector('.quiz-question-card')),'the host opens the chosen question');
    assert.ok(await waitFor(()=>driver.document.querySelectorAll('[data-quiz-option]').length>0),'the phone gets the answer options');
    driver.document.querySelector('[data-quiz-option]').click();
    assert.ok(await waitFor(()=>driver.document.querySelector('.phone-turn-done')!==null),'the phone shows the result');
    assert.match(driver.document.querySelector('.phone-turn-done').textContent,/Верно|Не угадали/);
    // A device that is not on its turn cannot drive the quiz.
    const forged=[...host.__hostSync.members].find(m=>m.name===otherName);
    forged.conn.other.send({type:'player-action',action:{kind:'turn-action',game:'quiz',action:{kind:'pick',value:69}}});await wait();await wait();await wait();
    assert.ok(!d.querySelector('.quiz-question-card')?.textContent.includes(String(70)),'the host keeps the current question');
    // Memo is a solo game named «Игрок 1»: rename phone a in its profile so the host seats it.
    d.querySelector('#backHome').click();d.querySelector('[data-open="memo"]').click();await wait();
    a.document.querySelector('#profileName').value='Игрок 1';
    a.document.querySelector('#saveProfile').click();
    assert.ok(await waitFor(()=>a.document.querySelector('#playerHeading').textContent==='ВАША ОЧЕРЕДЬ!',120),'the phone gets the memo turn after matching the seated player');
    const tiles=a.document.querySelectorAll('[data-memo-tile]');
    assert.ok(tiles.length>0,'the phone draws the memo grid');
    tiles[0].click();tiles[1].click();
    assert.ok(await waitFor(()=>d.querySelectorAll('.memory-tile.revealed,.memory-tile.matched').length>=1,120),'the host flips the chosen pair');
  }finally{for(const dom of doms)dom.window.close()}
});

test('the «Подключиться к игре» button works even when storage is blocked, and gives inline feedback',async()=>{
  const Peer=fakeNetwork(),doms=[];
  const vc=new (require('jsdom').VirtualConsole)();vc.on('jsdomError',()=>{});
  const dom=new JSDOM(fs.readFileSync('player.html','utf8'),{url:'https://example.com/Xmas-games/player.html?room=ABCD2345',runScripts:'outside-only',virtualConsole:vc,beforeParse(window){
    const bad={getItem(){throw new Error('SecurityError')},setItem(){throw new Error('SecurityError')},removeItem(){},clear(){},key(){return null},length:0};
    Object.defineProperty(window,'localStorage',{value:bad,configurable:true});
  }});
  doms.push(dom);
  const w=dom.window;w.Peer=Peer;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});
  try{
    w.eval(fs.readFileSync('static-sync.js','utf8'));w.eval(fs.readFileSync('player.js','utf8'));
    const d=w.document;
    d.querySelector('#joinButton').click();
    assert.match(d.querySelector('#joinFeedback').textContent,/имя/i,'an empty name produces an inline message, not silence');
    d.querySelector('#playerName').value='Аня';
    d.querySelector('#joinButton').click();
    assert.equal(d.querySelector('#phoneConnection').textContent.trim(),'Подключаемся…');
    assert.equal(d.querySelector('#gamePanel').hidden,true);
    await wait();await wait();
  }finally{for(const d2 of doms)d2.window.close()}
});
