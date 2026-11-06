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
  let socket = null, playerName = '', joined = false, retryTimer = null, phoneRole = 'player', lastState = null, profileTimer = null, profileRequest = 0;
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
    socket.addEventListener('open',()=>socket.send(JSON.stringify({type:'join',room,role:phoneRole,playerId,reconnectToken,name:playerName})));
    socket.addEventListener('message',event=>{
      let data;try{data=JSON.parse(event.data)}catch{return}
      if(data.type==='joined'){
        if(data.playerId) playerId=data.playerId;
        updateProfileUI();joined=true;$('#joinPanel').hidden=true;$('#gamePanel').hidden=false;status('Подключён','connected');
      }
      if(data.type==='profile-updated' && data.requestId===profileRequest){
        clearTimeout(profileTimer);$('#saveProfile').disabled=false;
        playerName=data.name;phoneRole=data.role;playerId=data.playerId||playerId;
        localStorage.setItem('snowyPlayerName',playerName);$('#playerName').value=playerName;$('#phoneRole').value=phoneRole;updateProfileUI();
        $('#profileFeedback').textContent='Сохранено.';$('#profileSettings').open=false;
        if(lastState?.game==='field')renderPlayerState(lastState);
        else if(phoneRole==='viewer'){lastState=null;renderPlayerState(null);}
      }
      if(data.type==='profile-error' && data.requestId===profileRequest){clearTimeout(profileTimer);$('#saveProfile').disabled=false;$('#profileFeedback').textContent='Не удалось сохранить. Проверьте имя и роль.';}
      if(data.type==='state'){lastState=data.payload;renderPlayerState(data.payload);}
    });
    socket.addEventListener('close',()=>{clearTimeout(profileTimer);$('#saveProfile').disabled=false;if(joined){status('Связь прервалась — подключаемся…','disconnected');retryTimer=setTimeout(connect,1300)}else{status('Не удалось подключиться','disconnected');$('#phoneRoom').textContent='Проверьте связь, код комнаты и открытую страницу ведущего, затем попробуйте ещё раз.'}});
    socket.addEventListener('error',()=>socket.close());
  }
  function updateProfileUI(){
    $('#profileSummary').textContent=`${playerName} · ${phoneRole==='viewer'?'Зритель':'Игрок'} — изменить`;
    $('#profileName').value=playerName;$('#profileRole').value=phoneRole;
  }
  $('#profileForm').addEventListener('submit',event=>{
    event.preventDefault();const name=$('#profileName').value.trim().slice(0,24),role=$('#profileRole').value;
    if(!name){$('#profileFeedback').textContent='Введите имя.';$('#profileName').focus();return;}
    if(!['player','viewer'].includes(role)||!socket||socket.readyState!==WebSocket.OPEN){$('#profileFeedback').textContent='Нет связи. Повторите после подключения.';return;}
    const requestId=++profileRequest;$('#saveProfile').disabled=true;$('#profileFeedback').textContent='Сохраняем…';
    try{socket.send(JSON.stringify({type:'profile-update',name,role,requestId}));}catch{$('#saveProfile').disabled=false;$('#profileFeedback').textContent='Нет связи. Повторите после подключения.';return;}
    clearTimeout(profileTimer);profileTimer=setTimeout(()=>{if(profileRequest===requestId){$('#saveProfile').disabled=false;$('#profileFeedback').textContent='Нет подтверждения. Проверьте связь и попробуйте ещё раз.';}},8000);
  });
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function renderPlayerState(state){
    if(state?.game==='field'){renderFieldPhone(state);return;}
    $('#fieldPhone').hidden=true;$('#playerCardFace').hidden=false;document.querySelector('.phone-reminder').hidden=false;
    if(!state||state.game!=='guess'||state.guessMode!=='circle'||!state.playerView){
      $('#playerTurn').textContent='ЖДЁМ ВЕДУЩЕГО';$('#playerHeading').textContent=phoneRole==='viewer'?'Вы подключены как зритель':'Телефонный круг ещё не начался';
      $('#playerInstructions').textContent=phoneRole==='viewer'?'Вы можете наблюдать за «Полем чудес». Для участия в телефонном круге выберите роль игрока.':'Ведущий включит режим «Круг с телефонами». До этого можно оставить эту страницу открытой.';
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
  let fieldPhonePhase='', fieldPhoneActive='';
  function renderFieldPhone(state){
    const existing=$('#phoneAnswer');const keep=existing && fieldPhonePhase===state.phase && fieldPhoneActive===state.activeId;const draft=keep?existing.value:'';const focused=keep&&document.activeElement===existing;
    fieldPhonePhase=state.phase;fieldPhoneActive=state.activeId;
    const active=phoneRole==='player'&&state.activeId===playerId&&!!state.activeId;
    $('#playerCardFace').hidden=true;$('#playerActions').hidden=true;document.querySelector('.phone-reminder').hidden=true;$('#playerHint').textContent='';
    $('#playerTurn').textContent=`ПОЛЕ ЧУДЕС · ${state.round}`;
    $('#playerHeading').textContent=phoneRole==='viewer'?'Вы зритель':active?'Ваш ход!':'Следим за игрой';
    $('#playerInstructions').textContent=state.message||'Ждём начала тура.';
    const box=$('#fieldPhone');box.hidden=false;
    const board=(state.board||[]).map(t=>t.space?'<span class="phone-field-space"></span>':`<button class="phone-field-tile" data-plus="${t.index}" ${!active||state.phase!=='plus'||t.letter?'disabled':''}>${esc(t.letter||'')}</button>`).join('');
    let controls='';
    if(phoneRole==='viewer') controls=`<div class="phone-field-actions">${['👏','🎉','❤️','😮'].map(r=>`<button data-reaction="${r}">${r}</button>`).join('')}</div>`;
    else if(active){
      if(state.phase==='spin')controls+='<button class="join-button" data-field-action="spin">Крутить барабан ↻</button>';
      if(['letter','superLetters'].includes(state.phase))controls+=`<div class="phone-field-letters">${[...'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'].map(l=>`<button data-letter="${l}" ${(state.guessed||[]).includes(l)?'disabled':''}>${l}</button>`).join('')}</div>`;
      if(state.phase==='prize')controls+='<div class="phone-field-actions"><button data-prize="take">Взять приз и выбыть</button><button data-prize="continue">Продолжить · 2000</button></div>';
      if(state.phase==='chest')controls+='<div class="phone-field-actions"><button data-chest="0">🎁 Шкатулка 1</button><button data-chest="1">🎁 Шкатулка 2</button></div>';
      if(['spin','letter','solveOnly','superSolve'].includes(state.phase))controls+='<form id="phoneSolve" class="phone-field-solve"><input id="phoneAnswer" maxlength="80" placeholder="Слово целиком" autocomplete="off"><button>Ответить</button></form>';
    }
    box.innerHTML=`<p class="phone-field-question">${esc(state.question||'Ведущий готовит тройку.')}</p><div class="phone-field-board">${board}</div><p>${state.seconds!=null&&state.phase==='superSolve'?`${esc(state.seconds)} секунд`:state.sector?`Сектор: ${esc(state.sector)}`:''}</p><div class="phone-field-scores">${(state.players||[]).map((p,i)=>`<span class="${i===state.activeIndex&&!p.out?'active':''}">${esc(p.name)} · ${p.score}${p.out?' · выбыл':''}</span>`).join('')}</div>${controls}`;
    const answer=box.querySelector('#phoneAnswer');if(answer&&keep){answer.value=draft;if(focused){answer.focus();answer.setSelectionRange(draft.length,draft.length);}}
    box.querySelector('[data-field-action="spin"]')?.addEventListener('click',()=>sendField({kind:'spin'}));
    box.querySelectorAll('[data-letter]').forEach(b=>b.addEventListener('click',()=>sendField({kind:'letter',value:b.dataset.letter})));
    box.querySelectorAll('[data-plus]').forEach(b=>b.addEventListener('click',()=>sendField({kind:'plus',value:+b.dataset.plus})));
    box.querySelectorAll('[data-prize]').forEach(b=>b.addEventListener('click',()=>sendField({kind:'prize',value:b.dataset.prize})));
    box.querySelectorAll('[data-chest]').forEach(b=>b.addEventListener('click',()=>sendField({kind:'chest',value:+b.dataset.chest})));
    box.querySelectorAll('[data-reaction]').forEach(b=>b.addEventListener('click',()=>sendField({kind:'reaction',value:b.dataset.reaction})));
    box.querySelector('#phoneSolve')?.addEventListener('submit',e=>{e.preventDefault();sendField({kind:'solve',value:$('#phoneAnswer').value});});
  }
  function sendField(action){if(!socket||socket.readyState!==WebSocket.OPEN)return;socket.send(JSON.stringify({type:'player-action',action}));}
  function sendAction(action){if(!socket||socket.readyState!==WebSocket.OPEN)return;socket.send(JSON.stringify({type:'player-action',action,playerId}));$('#playerActions').hidden=true;$('#playerHeading').textContent='Ход передан ведущему…';}
  $('#joinButton').addEventListener('click',()=>{
    playerName=$('#playerName').value.trim().slice(0,24); phoneRole=$('#phoneRole').value;
    if(!room){room=$('#roomCodeInput').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');if(room.length<4){$('#phoneRoom').textContent='Введи код комнаты из сообщения ведущего.';$('#roomCodeInput').focus();return;}$('#roomCode').textContent=room;$('#phoneRoom').textContent=`КОМНАТА ${room}`;}
    if(!playerName){$('#playerName').focus();return;}
    localStorage.setItem('snowyPlayerName',playerName);status('Подключаемся…');connect();
  });
  $('#playerName').addEventListener('keydown',e=>{if(e.key==='Enter')$('#joinButton').click()});
  $('#solvedButton').addEventListener('click',()=>sendAction('solved'));
  $('#passButton').addEventListener('click',()=>sendAction('pass'));
  $('#leaveButton').addEventListener('click',()=>{joined=false;playerName='';lastState=null;clearTimeout(profileTimer);profileRequest++;if(socket)socket.close();$('#gamePanel').hidden=true;$('#joinPanel').hidden=false;status('Не подключён')});
})();
