/* Hosted signalling with end-to-end WebRTC data channels. No game server is run by the user. */
(() => {
  const OPEN=1, CLOSED=3;
  function privateState(payload, member) {
    const state={...payload};
    if(state.game==='guess' && state.guessMode==='circle') {
      const active=Array.isArray(state.circleCards) ? state.circleCards.find(p=>p.id===state.activePlayerId) : null;
      if(member.role==='player') {
        const isActive=member.playerId===state.activePlayerId;
        state.playerView={id:member.playerId,name:member.name,active:isActive,activeName:active?.name||'участник',word:isActive?'':active?.word||'',emoji:isActive?'':active?.emoji||'',image:isActive?'':active?.image||'',style:active?.style??0,hint:isActive?'':active?.hint||'',round:state.round||1};
      } else { state.revealed=false;state.word='';state.image='';state.emoji=''; }
      delete state.circleCards;
    }
    return state;
  }
  class StaticSync {
    constructor(room, role) {
      this.readyState=0; this.listeners={};this.members=new Set();this.identities=new Map();this.state=null;this.role=role;this.closed=false;
      const id='snowy-xmas-'+String(room).toUpperCase().replace(/[^A-Z0-9]/g,'');
      try {
        if(typeof window.Peer!=='function') throw Error('PeerJS unavailable');
        this.peer=role==='host'?new window.Peer(id):new window.Peer();
        this.timeout=setTimeout(()=>this.fail(),15000);
        this.peer.on('open',()=>{
          if(this.closed)return;
          if(role==='host'){clearTimeout(this.timeout);this.readyState=OPEN;this.emit('open');}
          else {
            const conn=this.peer.connect(id,{reliable:true}); this.conn=conn;
            conn.on('open',()=>{if(this.closed)return;clearTimeout(this.timeout);this.readyState=OPEN;this.emit('open');});
            conn.on('data',message=>this.emit('message',{data:JSON.stringify(message)}));
            conn.on('close',()=>this.close());conn.on('error',()=>this.fail());
          }
        });
        this.peer.on('connection',conn=>{if(role==='host')this.addMember(conn);else conn.close();});
        this.peer.on('error',()=>this.fail());
        this.peer.on('disconnected',()=>{if(!this.closed && !this.peer.destroyed)try{this.peer.reconnect();}catch{this.fail();}});
      } catch { setTimeout(()=>this.fail(),0); }
    }
    addEventListener(name,fn){(this.listeners[name] ||= []).push(fn);}
    emit(name,event={}){for(const fn of this.listeners[name]||[])fn(event);}
    fail(){if(this.closed)return;this.emit('error');this.close();}
    close(){if(this.closed)return;this.closed=true;this.readyState=CLOSED;clearTimeout(this.timeout);for(const m of this.members)try{m.conn.close();}catch{};try{this.conn?.close();this.peer?.destroy();}catch{}this.emit('close');}
    addMember(conn) {
      if(this.closed){conn.close();return;}
      const member={conn,role:null,playerId:'',name:''};this.members.add(member);
      conn.on('data',data=>this.receive(member,data));
      const remove=()=>{if(this.members.delete(member))this.presence();};
      conn.on('close',remove);conn.on('error',remove);
    }
    sendMember(member,message){if(member.conn.open)try{member.conn.send(message);}catch{}}
    presence(){
      const members=[...this.members].filter(m=>m.role);
      const data={type:'presence',count:members.filter(m=>m.role==='screen').length,players:members.filter(m=>m.role==='player').map(m=>({id:m.playerId,name:m.name})),viewers:members.filter(m=>m.role==='viewer').map(m=>({id:m.playerId,name:m.name}))};
      this.emit('message',{data:JSON.stringify(data)});members.forEach(m=>this.sendMember(m,data));
    }
    receive(member,data) {
      if(!data || typeof data!=='object')return;
      if(data.type==='join' && !member.role){
        if(!['player','viewer','screen'].includes(data.role))return;
        member.role=data.role;
        if(member.role==='player' || member.role==='viewer') {
          // Reconnects prove possession of a private random token; public IDs cannot be claimed.
          const token=typeof data.reconnectToken==='string' && /^[a-f0-9]{64}$/.test(data.reconnectToken) ? data.reconnectToken : null;
          if(token && this.identities.has(token)) member.playerId=this.identities.get(token);
          else {
            const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
            member.playerId=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
            if(token)this.identities.set(token,member.playerId);
          }
          member.name=String(data.name||'Игрок').trim().slice(0,24)||'Игрок';
          // A reconnected player replaces their stale channel instead of appearing twice.
          for(const other of [...this.members])if(other!==member&&(other.role==='player'||other.role==='viewer')&&other.playerId===member.playerId){this.members.delete(other);other.conn.close();}
        }
        this.sendMember(member,{type:'joined',role:member.role,playerId:member.playerId});
        this.presence();
        if(this.state)this.sendMember(member,{type:'state',payload:privateState(this.state,member)});
      } else if((member.role==='player'||member.role==='viewer') && data.type==='profile-update') {
        const name=typeof data.name==='string'?data.name.trim().slice(0,24):'';
        if(!name || !['player','viewer'].includes(data.role)){this.sendMember(member,{type:'profile-error',requestId:data.requestId});return;}
        member.name=name;member.role=data.role;
        this.sendMember(member,{type:'profile-updated',requestId:data.requestId,playerId:member.playerId,name,role:member.role});
        this.presence();
        if(this.state)this.sendMember(member,{type:'state',payload:privateState(this.state,member)});
      } else if((member.role==='player'||member.role==='viewer') && data.type==='player-action') {
        if(this.state?.game==='field' && (member.role==='viewer' || (member.role==='player' && this.state.activeId===member.playerId)))
          this.emit('message',{data:JSON.stringify({type:'player-action',action:data.action,playerId:member.playerId,name:member.name,role:member.role})});
        if(member.role==='player' && this.state?.game==='guess' && this.state.guessMode==='circle' && this.state.activePlayerId===member.playerId && ['solved','pass'].includes(data.action))
          this.emit('message',{data:JSON.stringify({type:'player-action',action:data.action,playerId:member.playerId,name:member.name})});
      }
    }
    send(raw) {
      if(this.readyState!==OPEN)return;
      let data;try{data=JSON.parse(raw);}catch{return;}
      if(this.role!=='host'){try{this.conn.send(data);}catch{this.fail();}return;}
      if(data.type==='join'){this.emit('message',{data:JSON.stringify({type:'joined',screenCount:0})});return;}
      if(data.type==='state' && data.payload && typeof data.payload==='object'){
        this.state=data.payload;
        for(const member of this.members)if(member.role)this.sendMember(member,{type:'state',payload:privateState(this.state,member)});
      }
    }
  }
  window.StaticSync=StaticSync;
  window.makeInviteQr = text => {const qr=qrcode(0,'M');qr.addData(text);qr.make();return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qr.createSvgTag(5,2));};
})();
