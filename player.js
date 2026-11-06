(() => {
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  let room = params.get('room') || '';
  let playerId = localStorage.getItem('snowyPlayerId') || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  localStorage.setItem('snowyPlayerId', playerId);
  const tokenKey='snowyPlayerToken';
  let reconnectToken=localStorage.getItem(tokenKey);
  if(!reconnectToken || !/^[a-f0-9]{64}$/.test(reconnectToken)) {
    const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
    reconnectToken=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem(tokenKey,reconnectToken);
  }
  const savedName = localStorage.getItem('snowyPlayerName') || '';
  let socket = null, playerName = '', joined = false, retryTimer = null;
  $('#playerName').value = savedName;
  $('#manualRoomEntry').hidden = Boolean(room);
  $('#roomCodeInput').value = room.toUpperCase();
  $('#phoneRoom').textContent = room ? `КОМНАТА ${room.toUpperCase()}` : 'Открой ссылку ведущего или введи код комнаты.';
  $('#roomCode').textContent = room.toUpperCase() || '—';
  $('#roomCodeInput').addEventListener('input',()=>{const code=$('#roomCodeInput').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);$('#roomCodeInput').value=code;if(!joined){room=code;$('#roomCode').textContent=code||'—';if(code)$('#phoneRoom').textContent=`КОМНАТА ${code}`;}});

  function status(text, state='') {
    const el=$('#phoneConnection');el.className=`phone-connection ${state}`;el.innerHTML=`<i></i> ${text}`;
  }
  function connect() {
    if (!room || !playerName) return;
    clearTimeout(retryTimer);
    const scheme=location.protocol==='https:'?'wss:':'ws:';
    socket=location.protocol==='https:' && window.StaticSync ? new window.StaticSync(room,'client') : new WebSocket(`${scheme}//${location.host}/sync`);
    socket.addEventListener('open',()=>socket.send(JSON.stringify({type:'join',room,role:'player',playerId,reconnectToken,name:playerName})));
    socket.addEventListener('message',event=>{
      let data;try{data=JSON.parse(event.data)}catch{return}
      if(data.type==='joined'){
        if(data.playerId) playerId=data.playerId;
        joined=true;$('#joinPanel').hidden=true;$('#gamePanel').hidden=false;status('Подключён','connected');
      }
      if(data.type==='state')renderPlayerState(data.payload);
    });
    socket.addEventListener('close',()=>{if(joined){status('Связь прервалась — подключаемся…','disconnected');retryTimer=setTimeout(connect,1300)}else{status('Не удалось подключиться','disconnected');$('#phoneRoom').textContent='Проверьте связь, код комнаты и открытую страницу ведущего, затем попробуйте ещё раз.'}});
    socket.addEventListener('error',()=>socket.close());
  }
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function renderPlayerState(state){
    if(!state||state.game!=='guess'||state.guessMode!=='circle'||!state.playerView){
      $('#playerTurn').textContent='ЖДЁМ ВЕДУЩЕГО';$('#playerHeading').textContent='Телефонный круг ещё не начался';
      $('#playerInstructions').textContent='Ведущий включит режим «Круг с телефонами». До этого можно оставить эту страницу открытой.';
      $('#playerImage').innerHTML='❄';$('#playerWord').textContent='';$('#playerHint').textContent='';$('#playerActions').hidden=true;return;
    }
    const view=state.playerView;
    $('#playerTurn').textContent=view.active?'ТВОЯ ОЧЕРЕДЬ · НЕ ПОДСМАТРИВАЙ':'ПОМОГИ УГАДЫВАЮЩЕМУ';
    $('#playerHeading').textContent=view.active?'Не смотри на экран!':`${view.activeName} угадывает`;
    $('#playerInstructions').textContent=view.active?'Задавай вопросы остальным участникам. Они видят твою карточку и отвечают только «да» или «нет».':'Покажи этот экран участнику, который угадывает. Отвечай на его вопросы только «да» или «нет». Свой секрет ты не увидишь.';
    $('#playerCardFace').className=`phone-card-face card-style-${Number(view.style)||0} ${view.active?'phone-face-hidden':''}`;
    $('#playerImage').innerHTML=view.active?'<span class="phone-card-hidden">?</span>':view.image?`<img src="${esc(view.image)}" alt="Новогодняя карточка">`:esc(view.emoji||'❄');
    $('#playerWord').textContent=view.active?'ТВОЯ КАРТОЧКА':view.word||'';
    $('#playerHint').textContent=view.active?'Твоя карточка скрыта от тебя.':view.hint||'';
    $('#playerActions').hidden=!view.active;
  }
  function sendAction(action){if(!socket||socket.readyState!==WebSocket.OPEN)return;socket.send(JSON.stringify({type:'player-action',action,playerId}));$('#playerActions').hidden=true;$('#playerHeading').textContent='Ход передан ведущему…';}
  $('#joinButton').addEventListener('click',()=>{
    playerName=$('#playerName').value.trim().slice(0,24);
    if(!room){room=$('#roomCodeInput').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');if(room.length<4){$('#phoneRoom').textContent='Введи код комнаты из сообщения ведущего.';$('#roomCodeInput').focus();return;}$('#roomCode').textContent=room;$('#phoneRoom').textContent=`КОМНАТА ${room}`;}
    if(!playerName){$('#playerName').focus();return;}
    localStorage.setItem('snowyPlayerName',playerName);status('Подключаемся…');connect();
  });
  $('#playerName').addEventListener('keydown',e=>{if(e.key==='Enter')$('#joinButton').click()});
  $('#solvedButton').addEventListener('click',()=>sendAction('solved'));
  $('#passButton').addEventListener('click',()=>sendAction('pass'));
  $('#leaveButton').addEventListener('click',()=>{joined=false;playerName='';if(socket)socket.close();$('#gamePanel').hidden=true;$('#joinPanel').hidden=false;status('Не подключён')});
})();
