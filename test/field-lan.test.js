const test=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port}
test('LAN transport supports active player and spectator roles for field',async()=>{
  const port=await freePort(),child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  const sockets=[];
  try{
    await Promise.race([once(child.stdout,'data'),delay(3000).then(()=>{throw Error('server did not start')})]);
    async function connect(role,name,id){const ws=new WebSocket(`ws://127.0.0.1:${port}/sync`),messages=[];sockets.push(ws);ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));await once(ws,'open');ws.send(JSON.stringify({type:'join',room:'TESTROOM',role,name,playerId:id}));await delay(30);return {ws,messages}}
    const host=await connect('host'),alice=await connect('player','Аня','alice'),bob=await connect('player','Борис','bob'),viewer=await connect('viewer','Зритель','v');
    host.ws.send(JSON.stringify({type:'state',payload:{game:'field',activeId:'alice',phase:'spin',board:[{letter:''}]}}));await delay(30);
    const before=host.messages.filter(m=>m.type==='player-action').length;
    bob.ws.send(JSON.stringify({type:'player-action',action:{kind:'spin'}}));await delay(30);assert.equal(host.messages.filter(m=>m.type==='player-action').length,before);
    alice.ws.send(JSON.stringify({type:'player-action',action:{kind:'spin'}}));viewer.ws.send(JSON.stringify({type:'player-action',action:{kind:'reaction',value:'👏'}}));await delay(30);
    const events=host.messages.filter(m=>m.type==='player-action');assert.equal(events.length,before+2);assert.equal(events.at(-2).playerId,'alice');assert.equal(events.at(-1).role,'viewer');
    assert.equal(viewer.messages.filter(m=>m.type==='state').at(-1).payload.board[0].letter,'');
  }finally{for(const ws of sockets)ws.close();child.kill();}
});

test('LAN profile updates report viewer counts and preserve connection identity',async()=>{
  const port=await freePort(),child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});const sockets=[];
  try{
    await Promise.race([once(child.stdout,'data'),delay(3000).then(()=>{throw Error('server did not start')})]);
    async function connect(role,name,id){const ws=new WebSocket(`ws://127.0.0.1:${port}/sync`),messages=[];sockets.push(ws);ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));await once(ws,'open');ws.send(JSON.stringify({type:'join',room:'TESTROOM',role,name,playerId:id}));await delay(35);return {ws,messages}}
    const host=await connect('host'),player=await connect('player','Аня','alice'),viewer=await connect('viewer','Гость','guest');
    let presence=host.messages.filter(m=>m.type==='presence').at(-1);assert.equal(presence.players.length,1);assert.equal(presence.viewers.length,1);
    player.ws.send(JSON.stringify({type:'profile-update',name:'Анна',role:'viewer',requestId:3}));await delay(35);
    const ack=player.messages.filter(m=>m.type==='profile-updated').at(-1);assert.equal(ack.playerId,'alice');assert.equal(ack.name,'Анна');assert.equal(ack.role,'viewer');
    presence=host.messages.filter(m=>m.type==='presence').at(-1);assert.equal(presence.players.length,0);assert.equal(presence.viewers.length,2);
    player.ws.send(JSON.stringify({type:'profile-update',name:'   ',role:'player',requestId:4}));await delay(35);assert.equal(player.messages.filter(m=>m.type==='profile-error').at(-1).requestId,4);assert.equal(host.messages.filter(m=>m.type==='presence').at(-1).viewers.length,2);
  }finally{for(const ws of sockets)ws.close();child.kill()}
});

test('LAN routes melody buzzer only from player connections',async()=>{
  const port=await freePort(),child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});const sockets=[];
  try{
    await Promise.race([once(child.stdout,'data'),delay(3000).then(()=>{throw Error('server did not start')})]);
    async function connect(role,name,id){const ws=new WebSocket(`ws://127.0.0.1:${port}/sync`),messages=[];sockets.push(ws);ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));await once(ws,'open');ws.send(JSON.stringify({type:'join',room:'TESTROOM',role,name,playerId:id}));await delay(35);return {ws,messages}}
    const host=await connect('host'),player=await connect('player','Аня','alice'),viewer=await connect('viewer','Гость','guest');
    host.ws.send(JSON.stringify({type:'state',payload:{game:'melody',buzz:{open:true,token:'token'}}}));await delay(35);
    viewer.ws.send(JSON.stringify({type:'player-action',action:{kind:'melody-buzz',token:'token'}}));player.ws.send(JSON.stringify({type:'player-action',action:{kind:'melody-buzz',token:'token'}}));await delay(35);
    const actions=host.messages.filter(m=>m.type==='player-action');assert.equal(actions.length,1);assert.equal(actions[0].playerId,'alice');assert.equal(actions[0].role,'player');
  }finally{for(const ws of sockets)ws.close();child.kill()}
});
