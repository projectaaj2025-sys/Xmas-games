(() => {
  const $ = s => document.querySelector(s);
  // localStorage can throw in in-app browsers and private mode; fall back to memory so the page still works.
  const store={get(key){try{return localStorage.getItem(key)}catch{return null}},set(key,value){try{localStorage.setItem(key,value)}catch{}}};
  const params = new URLSearchParams(location.search);
  let room = params.get('room') || '';
  let playerId = store.get('snowyPlayerId') || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  store.set('snowyPlayerId', playerId);
  const tokenKey='snowyPlayerToken';
  let reconnectToken=store.get(tokenKey);
  if(!reconnectToken || !/^[a-f0-9]{64}$/.test(reconnectToken)) {
    const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
    reconnectToken=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    store.set(tokenKey,reconnectToken);
  }
  const savedName = store.get('snowyPlayerName') || '';
  let socket = null, playerName = '', joined = false, retryTimer = null, phoneRole = 'player', lastState = null, profileTimer = null, profileRequest = 0;
  let melodyPendingToken='',melodyPendingTimer=null;
  $('#playerName').value = savedName;
  $('#manualRoomEntry').hidden = Boolean(room);
  $('#roomCodeInput').value = room.toUpperCase();
  $('#phoneRoom').textContent = room ? `КОМНАТА ${room.toUpperCase()}` : 'Открой ссылку ведущего или введи код комнаты.';
  $('#roomCode').textContent = room.toUpperCase() || '—';
  $('#roomCodeInput').addEventListener('input',()=>{const code=$('#roomCodeInput').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);$('#roomCodeInput').value=code;if(!joined){room=code;$('#roomCode').textContent=code||'—';if(code)$('#phoneRoom').textContent=`КОМНАТА ${code}`;}});

  function status(text, state='') {
    const el=$('#phoneConnection');el.className=`phone-connection ${state}`;el.innerHTML=`<i></i> ${text}`;
  }
  const wsScheme=()=>location.protocol==='https:'?'wss:':'ws:';
  const hostedStatic=()=>location.protocol==='https:' && typeof window.StaticSync==='function';
  let staticTried=false, directTried=false;
  // HTTPS pages (GitHub Pages, previews) try the hosted PeerJS channel first, then the same-origin /sync socket as a fallback.
  function buildSocket() {
    if (hostedStatic() && !staticTried) { staticTried=true; try { return new window.StaticSync(room,'client'); } catch {} }
    directTried = directTried || !hostedStatic();
    return new WebSocket(`${wsScheme()}//${location.host}/sync`);
  }
  function connect() {
    if (!room || !playerName) return;
    clearTimeout(retryTimer); staticTried=false; directTried=false;
    attach(buildSocket());
  }
  function attach(next) {
    socket=next;
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
        store.set('snowyPlayerName',playerName);$('#playerName').value=playerName;$('#phoneRole').value=phoneRole;updateProfileUI();
        $('#profileFeedback').textContent='Сохранено.';$('#profileSettings').open=false;
        if(lastState?.game==='field')renderPlayerState(lastState);
        else if(phoneRole==='viewer'){lastState=null;renderPlayerState(null);}
      }
      if(data.type==='profile-error' && data.requestId===profileRequest){clearTimeout(profileTimer);$('#saveProfile').disabled=false;$('#profileFeedback').textContent='Не удалось сохранить. Проверьте имя и роль.';}
      if(data.type==='state'){lastState=data.payload;renderPlayerState(data.payload);}
    });
    socket.addEventListener('close',()=>{clearTimeout(melodyPendingTimer);melodyPendingToken='';if($('#melodyBuzz'))$('#melodyBuzz').disabled=true;clearTimeout(profileTimer);$('#saveProfile').disabled=false;
      if(joined){status('Связь прервалась — подключаемся…','disconnected');retryTimer=setTimeout(connect,1300);return;}
      // Hosted channel failed — give the same-origin socket one chance before giving up.
      if(hostedStatic() && staticTried && !directTried && socket===next){directTried=true;status('Пробуем напрямую…');try{attach(new WebSocket(`${wsScheme()}//${location.host}/sync`));}catch{directTried=true;status('Не удалось подключиться','disconnected');const hint='Проверьте интернет и открытую страницу ведущего, затем нажмите «Подключиться к игре» ещё раз.';$('#phoneRoom').textContent=hint;joinFeedback(hint);}return;}
      status('Не удалось подключиться','disconnected');
      const hint='Проверьте интернет и открытую страницу ведущего, затем нажмите «Подключиться к игре» ещё раз.';
      $('#phoneRoom').textContent=hint;
      const feedback=$('#joinFeedback');if(feedback)feedback.textContent=hint;});
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
    if(state?.game==='field'){$('#melodyPhone').hidden=true;renderFieldPhone(state);return;}
    if(state?.game==='melody'){renderMelodyPhone(state);return;}
    // The circle already shows each card and its own buttons; only these games need the turn panel.
    if(['quiz','memo','croc'].includes(state?.game)&&state.turn){renderTurnPhone(state);return;}
    $('#melodyPhone').hidden=true;$('#fieldPhone').hidden=true;$('#playerCardFace').hidden=false;document.querySelector('.phone-reminder').hidden=false;
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
  function renderMelodyPhone(state){
    $('#fieldPhone').hidden=true;$('#playerCardFace').hidden=true;$('#playerActions').hidden=true;document.querySelector('.phone-reminder').hidden=true;$('#playerHint').textContent='';
    const box=$('#melodyPhone');box.hidden=false;$('#playerTurn').textContent='УГАДАЙ МЕЛОДИЮ';
    const i=Array.isArray(state.phoneIds)?state.phoneIds.indexOf(playerId):-1,buzz=state.buzz||{},passed=Array.isArray(buzz.passed)&&buzz.passed.includes(i),active=i>=0&&buzz.active===i;
    let heading,description;
    if(phoneRole==='viewer'){heading='Вы зритель';description='Следите за игрой на экране ведущего.';}
    else if(state.mode){heading='Дополнительный раунд';description='В этом раунде игрой управляет ведущий.';}
    else if(i<0){heading='Телефон пока без места';description='Телефон не назначен на место. Попросите ведущего выбрать его в списке мест — или он продолжит ход за вас со своего экрана.';}
    else if(buzz.finished){heading='Ответ принят';description='Дождитесь следующей мелодии.';}
    else if(active){heading='Вы отвечаете!';description='Назовите мелодию. Ведущий оценит ответ.';}
    else if(passed){heading='Ход пропущен';description='Дождитесь следующей мелодии.';}
    else if(buzz.eligible?.[i]===false){heading='Ответ уже оценён';description='Дождитесь следующей мелодии.';}
    else if(buzz.active!==null&&buzz.active!==undefined){heading='Отвечает другой игрок';description='Дождитесь решения ведущего.';}
    else if(buzz.open){heading='Нажмите, если знаете!';description='Отвечает тот, чей сигнал первым получит ведущий.';}
    else {heading='Ждём мелодию';description='Кнопка «Я знаю!» включится сама, когда ведущий запустит следующую мелодию.';}
    $('#playerHeading').textContent=heading;$('#playerInstructions').textContent=description;
    if(melodyPendingToken && melodyPendingToken!==buzz.token){melodyPendingToken='';clearTimeout(melodyPendingTimer);}
    const enabled=phoneRole==='player'&&i>=0&&!passed&&buzz.eligible?.[i]!==false&&buzz.open&&typeof buzz.token==='string'&&!!buzz.token&&!melodyPendingToken&&socket?.readyState===WebSocket.OPEN;
    box.innerHTML=`<button type="button" id="melodyBuzz" class="join-button phone-buzz" ${enabled?'':'disabled'}>♫ Я знаю!</button>`;
    box.querySelector('#melodyBuzz').addEventListener('click',e=>{if(!enabled||!socket||socket.readyState!==WebSocket.OPEN)return;e.currentTarget.disabled=true;melodyPendingToken=buzz.token;$('#playerInstructions').textContent='Сигнал отправлен. Ждём подтверждения ведущего…';try{socket.send(JSON.stringify({type:'player-action',action:{kind:'melody-buzz',token:buzz.token}}));}catch{melodyPendingToken='';e.currentTarget.disabled=socket.readyState!==WebSocket.OPEN;$('#playerInstructions').textContent='Не удалось отправить сигнал. Проверьте связь и попробуйте снова.';return;}clearTimeout(melodyPendingTimer);melodyPendingTimer=setTimeout(()=>{if(melodyPendingToken===buzz.token){melodyPendingToken='';if(lastState?.game==='melody'&&lastState.buzz?.token===buzz.token){renderMelodyPhone(lastState);$('#playerInstructions').textContent='Нет подтверждения. Проверьте связь и попробуйте ещё раз.';}}},2500);});
  }
  // --- «Моя очередь»: телефон заменяет пульт, пока ходит этот игрок ---
  let turnDraft={game:'',tiles:[]};
  function sendTurn(state,action){
    if(!socket||socket.readyState!==WebSocket.OPEN)return false;
    try{socket.send(JSON.stringify({type:'player-action',action:{kind:'turn-action',game:state.game,action}}));return true;}
    catch{return false;}
  }
  function renderTurnPhone(state){
    const turn=state.turn||{},box=$('#fieldPhone');
    $('#melodyPhone').hidden=true;$('#playerCardFace').hidden=true;$('#playerActions').hidden=true;document.querySelector('.phone-reminder').hidden=true;$('#playerHint').textContent='';
    box.hidden=false;
    const mine=Number.isInteger(turn.mine)?turn.mine:null,active=Number.isInteger(turn.active)?turn.active:-1;
    const myName=mine!==null&&Array.isArray(turn.names)?turn.names[mine]:'';
    const activeName=active>=0&&Array.isArray(turn.names)?turn.names[active]:'';
    const isMyTurn=mine!==null&&mine===active;
    $('#playerTurn').textContent=state.game==='quiz'?'НОВОГОДНЯЯ ВИКТОРИНА':state.game==='memo'?'МЕМО · НОВЫЙ ГОД':state.game==='croc'?'СУПЕРКРОКОДИЛ':'НОВОГОДНИЕ ТАРАНТИНКИ';
    $('#playerHeading').textContent=phoneRole==='viewer'?'Вы зритель':isMyTurn?'ВАША ОЧЕРЕДЬ!':activeName?`Отвечает: ${activeName}`:'Ждём ведущего';
    $('#playerInstructions').textContent=phoneRole==='viewer'?'Следите за игрой на большом экране. Для участия выберите роль игрока в настройках профиля.':mine===null?'Телефон не привязан к игроку. Попросите ведущего выбрать ваше имя в блоке «Телефоны по очереди» — или играйте с его экрана.':isMyTurn?'Нажимайте кнопки здесь — ведущий увидит ваш выбор сразу.':'Сейчас не ваш ход. Телефон включится сам, когда очередь дойдёт до вас.';
    if(phoneRole==='viewer'||mine===null){box.innerHTML='';return;}
    if(!isMyTurn){box.innerHTML=`<p class="phone-turn-wait">Сейчас ходит <b>${esc(activeName||'другой игрок')}</b>. Ваш ход придёт сюда автоматически.</p>`;return;}
    const content=state.game==='quiz'?quizTurnMarkup(state):state.game==='memo'?memoTurnMarkup(state):crocTurnMarkup(state);
    box.innerHTML=`<div class="phone-turn-box">${content}</div>`;
    bindTurnPhone(state);
  }
  function quizTurnMarkup(state){
    const quiz=state.turn.quiz||{};
    if(state.turn.phase==='finished')return '<p class="phone-turn-done">Игра завершена. Спасибо за игру!</p>';
    if(quiz.selected==null){
      const free=Array.isArray(quiz.free)?quiz.free:[];
      return `<p class="phone-turn-lead">Ваш ход: выберите любой свободный вопрос.</p><div class="phone-quiz-board">${free.map(i=>`<button class="phone-quiz-cell" data-quiz-cell="${i}">${i+1}</button>`).join('')}</div>`;
    }
    if(quiz.type==='choice'&&!state.turn.revealed){
      return `<p class="phone-turn-lead">Вопрос ${Number(quiz.selected)+1}: выберите ответ.</p><div class="phone-quiz-options">${(quiz.options||[]).map((option,i)=>`<button class="phone-quiz-option" data-quiz-option="${i}"><b>${String.fromCharCode(65+i)}.</b> ${esc(option)}</button>`).join('')}</div>`;
    }
    if(state.turn.revealed){
      if(quiz.type==='choice')return `<p class="phone-turn-done">${quiz.result?'Верно! +1 балл, ход остаётся ваш.':'Не угадали — ход переходит дальше.'}</p><button class="join-button" data-quiz-continue>Следующий вопрос →</button>`;
      return `<p class="phone-turn-done">Правильный ответ: <b>${esc(quiz.answer||'')}</b></p><div class="phone-turn-row"><button class="join-button" data-quiz-judge="1">Ответ верный · +1</button><button class="pass-button" data-quiz-judge="0">Не угадали</button></div>`;
    }
    return `<p class="phone-turn-lead">Ждём, пока ведущий откроет ответ на своём экране.</p><button class="pass-button" data-quiz-back>← К игровому полю</button>`;
  }
  function memoTurnMarkup(state){
    const memo=state.turn.memo||{};
    if(memo.event&&memo.event.type==='question'){
      if(memo.event.answered)return `<p class="phone-turn-done">Ответ принят.</p><button class="join-button" data-memo-continue>Продолжить игру →</button>`;
      return `<p class="phone-turn-lead">Бонусный вопрос: выберите вариант.</p><div class="phone-quiz-options">${(memo.event.options||[]).map((option,i)=>`<button class="phone-quiz-option" data-memo-answer="${i}">${esc(option)}</button>`).join('')}</div>`;
    }
    if(memo.event)return `<p class="phone-turn-lead">Новогодний факт — прочитайте его на большом экране.</p><button class="join-button" data-memo-continue>Продолжить игру →</button>`;
    const size=Number(memo.size)||0,opened=Array.isArray(memo.opened)?memo.opened:[],matched=Array.isArray(memo.matched)?memo.matched:[];
    const keep=turnDraft.game==='memo'?turnDraft.tiles:[];
    const selected=keep.filter(i=>opened.includes(i)&&!matched.includes(i));
    return `<p class="phone-turn-lead">${memo.locked?'Ход закрыт — ждём ведущего.':'Ваш ход: откройте две карточки.'}</p><div class="phone-memo-grid ${size>16?'compact':''}">${Array.from({length:size},(_,i)=>{const isMatched=matched.includes(i),isOpen=opened.includes(i)||selected.includes(i);return `<button class="phone-memo-tile ${isMatched?'matched':''} ${isOpen?'open':''}" data-memo-tile="${i}" ${memo.locked||isMatched||isOpen?'disabled':''}>${isMatched?'✓':isOpen?'❄':String(i+1).padStart(2,'0')}</button>`;}).join('')}</div><p class="phone-turn-hint">Пары и баллы считает ведущий.</p>`;
  }
  function crocTurnMarkup(state){
    const croc=state.turn.croc||{},words=Array.isArray(croc.words)?croc.words:[];
    if(croc.selected){
      return `<p class="phone-turn-lead">Слово ${croc.task+1}${words[croc.task]?`: <b>${esc(words[croc.task])}</b>`:''}</p><div class="phone-turn-row"><button class="join-button" data-croc-reveal>${croc.revealed?'Скрыть слово':'Показать слово'}</button><button class="join-button" data-croc-correct>Угадали ✓</button></div><div class="phone-turn-row"><button class="pass-button" data-croc-skip>Пропустить слово ↷</button></div>`;
    }
    return `<p class="phone-turn-lead">Ваш ход: выберите номер слова на карточке ведущего.</p><div class="phone-quiz-options">${Array.from({length:5},(_,i)=>`<button class="phone-quiz-option" data-croc-task="${i}"><span class="task-number">${i+1}</span> Слово ${i+1}</button>`).join('')}</div>`;
  }
  function guessTurnMarkup(){
    return '<p class="phone-turn-lead">Вы угадываете! Задавайте вопросы остальным — они видят вашу карточку.</p><div class="phone-turn-row"><button class="join-button" data-guess-solved>Угадал! 🎉</button><button class="pass-button" data-guess-pass>Передать ход →</button></div>';
  }
  function bindTurnPhone(state){
    const box=$('#fieldPhone');
    box.querySelectorAll('[data-quiz-cell]').forEach(b=>b.addEventListener('click',()=>sendTurn(state,{kind:'pick',value:+b.dataset.quizCell})));
    box.querySelectorAll('[data-quiz-option]').forEach(b=>b.addEventListener('click',()=>sendTurn(state,{kind:'option',value:+b.dataset.quizOption})));
    box.querySelectorAll('[data-quiz-judge]').forEach(b=>b.addEventListener('click',()=>sendTurn(state,{kind:'judge',value:b.dataset.quizJudge==='1'})));
    box.querySelector('[data-quiz-continue]')?.addEventListener('click',()=>sendTurn(state,{kind:'continue'}));
    box.querySelector('[data-quiz-back]')?.addEventListener('click',()=>sendTurn(state,{kind:'back'}));
    box.querySelectorAll('[data-memo-tile]').forEach(b=>{
      b.addEventListener('click',()=>{
        const tile=Number(b.dataset.memoTile);
        if(turnDraft.game!=='memo')turnDraft={game:'memo',tiles:[]};
        if(turnDraft.tiles.includes(tile))turnDraft.tiles=turnDraft.tiles.filter(t=>t!==tile);
        else turnDraft.tiles=[...turnDraft.tiles,tile].slice(-2);
        if(turnDraft.tiles.length===2){const pair=turnDraft.tiles.slice();turnDraft.tiles=[];sendTurn(state,{kind:'pair',value:pair});return;}
        renderTurnPhone(state);
      });
    });
    box.querySelectorAll('[data-memo-answer]').forEach(b=>b.addEventListener('click',()=>sendTurn(state,{kind:'answer',value:+b.dataset.memoAnswer})));
    box.querySelector('[data-memo-continue]')?.addEventListener('click',()=>sendTurn(state,{kind:'continue'}));
    box.querySelectorAll('[data-croc-task]').forEach(b=>b.addEventListener('click',()=>sendTurn(state,{kind:'select',value:+b.dataset.crocTask})));
    box.querySelector('[data-croc-reveal]')?.addEventListener('click',()=>sendTurn(state,{kind:'reveal'}));
    box.querySelector('[data-croc-correct]')?.addEventListener('click',()=>sendTurn(state,{kind:'correct'}));
    box.querySelector('[data-croc-skip]')?.addEventListener('click',()=>sendTurn(state,{kind:'skip'}));
    box.querySelector('[data-guess-solved]')?.addEventListener('click',()=>sendTurn(state,{kind:'solved'}));
    box.querySelector('[data-guess-pass]')?.addEventListener('click',()=>sendTurn(state,{kind:'pass'}));
  }
  let fieldPhonePhase='', fieldPhoneActive='';
  function renderFieldPhone(state){
    const existing=$('#phoneAnswer');const keep=existing && fieldPhonePhase===state.phase && fieldPhoneActive===state.activeId;const draft=keep?existing.value:'';const focused=keep&&document.activeElement===existing;
    fieldPhonePhase=state.phase;fieldPhoneActive=state.activeId;
    const seatedPhone=state.phase!=='setup'&&(state.players||[]).some(p=>p.id&&p.id===playerId);
    const active=phoneRole==='player'&&state.activeId===playerId&&!!state.activeId;
    $('#playerCardFace').hidden=true;$('#playerActions').hidden=true;document.querySelector('.phone-reminder').hidden=true;$('#playerHint').textContent='';
    $('#playerTurn').textContent=`ПОЛЕ ЧУДЕС · ${state.round}`;
    $('#playerHeading').textContent=phoneRole==='viewer'?'Вы зритель':active?'Ваш ход!':phoneRole==='player'&&!seatedPhone&&state.phase!=='setup'?'Телефон пока без места':'Следим за игрой';
    $('#playerInstructions').textContent=phoneRole==='player'&&!seatedPhone&&state.phase!=='setup'?'Телефон подключён, но не назначен ни одному участнику. Попросите ведущего выбрать ваш телефон в блоке «Назначить или переподключить телефоны» — или пусть ведущий ходит за вас на своём экране.':(state.message||'Ждём начала тура.');
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
  function joinFeedback(text){const el=$('#joinFeedback');if(el)el.textContent=text||'';}
  $('#joinButton').addEventListener('click',()=>{
    playerName=$('#playerName').value.trim().slice(0,24); phoneRole=$('#phoneRole').value;
    if(!room){room=$('#roomCodeInput').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');if(room.length<4){joinFeedback('Введи код комнаты из сообщения ведущего (4–8 символов).');$('#roomCodeInput').focus();return;}$('#roomCode').textContent=room;$('#phoneRoom').textContent=`КОМНАТА ${room}`;}
    if(!playerName){joinFeedback('Введи имя, чтобы подключиться к игре.');$('#playerName').focus();return;}
    store.set('snowyPlayerName',playerName);joinFeedback('');status('Подключаемся…');connect();
  });
  $('#playerName').addEventListener('keydown',e=>{if(e.key==='Enter')$('#joinButton').click()});
  $('#solvedButton').addEventListener('click',()=>sendAction('solved'));
  $('#passButton').addEventListener('click',()=>sendAction('pass'));
  $('#leaveButton').addEventListener('click',()=>{joined=false;playerName='';lastState=null;clearTimeout(profileTimer);profileRequest++;if(socket)socket.close();$('#gamePanel').hidden=true;$('#joinPanel').hidden=false;status('Не подключён')});
})();
