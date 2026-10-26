(() => {
  const room = new URLSearchParams(location.search).get('room') || '';
  const connection = document.querySelector('#screenConnection');
  const stage = document.querySelector('#screenStage');
  document.querySelector('#screenRoom').textContent = room ? `Код экрана: ${room.toUpperCase()}` : 'В ссылке не указан код игры';
  let socket;
  function connect() {
    if (!room) return;
    if(location.hostname.endsWith('.github.io')){connection.className='screen-state disconnected';connection.innerHTML='<i></i> Для экрана нужен локальный Node-сервер';return;}
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${scheme}//${location.host}/sync`);
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'join', room, role: 'screen' })));
    socket.addEventListener('message', event => {
      let data; try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === 'joined') { connection.className = 'screen-state connected'; connection.innerHTML = '<i></i> Экран подключён'; }
      if (data.type === 'presence') { connection.className = 'screen-state connected'; connection.innerHTML = '<i></i> Экран на связи'; }
      if (data.type === 'state') render(data.payload);
    });
    socket.addEventListener('close', () => { connection.className = 'screen-state disconnected'; connection.innerHTML = '<i></i> Связь прервалась — переподключаемся'; setTimeout(connect, 1600); });
    socket.addEventListener('error', () => socket.close());
  }
  function safeText(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
  function render(data) {
    if (!data || !data.game) return;
    stage.classList.toggle('quiz-display', data.game === 'quiz');
    stage.classList.toggle('quiz-question-active', data.game === 'quiz' && Boolean(data.questionNumber));
    stage.classList.toggle('memo-photo', data.game === 'memo' && data.deckId === 'photo');
    stage.classList.toggle('memo-event-active', data.game === 'memo' && Boolean(data.event));
    const roomNote = `<div class="screen-code">КОД ЭКРАНА: ${safeText(room.toUpperCase())}</div>`;
    if (data.game === 'idle') {
      stage.innerHTML = `<div class="screen-stars">✦　❄　✧　❄　✦</div><div class="waiting-art">🎄</div><div class="screen-kicker">ЭКРАН УЧАСТНИКОВ</div><h1>Ждём начала игры</h1><p>${safeText(data.instruction || 'Выберите игру на главном экране.')}</p>${roomNote}`;
      return;
    }
    if (data.game === 'quiz') {
      const scoreLine = Array.isArray(data.scores) ? `<div class="screen-quiz-score">${data.scores.map(item=>`<span>${safeText(item.name)} <b>${safeText(item.score)}</b></span>`).join('')}</div>` : '';
      if (!data.questionNumber) {
        const used=new Set(Array.isArray(data.usedQuestions)?data.usedQuestions:[]);
        const board=Array.from({length:70},(_,i)=>`<span class="screen-quiz-cell ${used.has(i)?'used':''} ${data.selectedQuestion===i+1?'selected':''}">${i+1}</span>`).join('');
        const scores=Array.isArray(data.scores)?data.scores:[],best=Math.max(0,...scores.map(item=>Number(item.score)||0));
        const leaders=scores.filter(item=>(Number(item.score)||0)===best).map(item=>item.name);
        const status=data.finished?(leaders.length>1?`Ничья: ${leaders.map(safeText).join(' и ')} · ${best} баллов`:`Победитель: ${safeText(leaders[0]||'')} · ${best} баллов`):`Ход команды: ${safeText(data.team || '')}`;
        stage.innerHTML = `<div class="screen-quiz-board-heading"><span>НОВОГОДНЯЯ ИГРА</span><small>${data.finished?'ИГРА ЗАВЕРШЕНА':`ОСТАЛОСЬ ${safeText(data.remaining)} ВОПРОСОВ`}</small></div><h1 class="screen-quiz-board-title">${data.finished?'Игра завершена':'Выберите вопрос'}</h1><p class="screen-quiz-turn">${status}</p><div class="screen-quiz-board">${board}</div>${scoreLine}${roomNote}`;
      } else {
        const choices = Array.isArray(data.options) ? `<div class="screen-quiz-options">${data.options.map((option,i)=>`<div class="screen-quiz-option ${data.correctIndex===i?'is-correct':''} ${data.selectedOption===i&&data.selectedOption!==data.correctIndex?'is-wrong':''}"><b>${String.fromCharCode(65+i)}.</b> ${safeText(option)}</div>`).join('')}</div>` : '';
        const answer = data.revealed ? `<div class="screen-quiz-answer">${safeText(data.answer || '')}</div>` : '';
        const image = data.questionImage ? `<img class="screen-quiz-image" src="${safeText(data.questionImage)}" alt="Иллюстрация к вопросу">` : '';
        stage.innerHTML = `<div class="screen-quiz-question-top"><span>ВОПРОС ${safeText(data.questionNumber)}</span><span>НОВОГОДНЯЯ ИГРА</span></div><div class="screen-quiz-layout"><img class="screen-quiz-mascot" src="assets/quiz-pdf-child.webp" alt="Персонаж из исходной викторины"><div class="screen-quiz-content">${image}<h1 class="screen-quiz-question">${safeText(data.question || '')}</h1>${choices}${answer}<p class="screen-quiz-turn">Отвечает: ${safeText(data.team || '')} · ${data.revealed?'Ответ открыт':'Обсудите ответ и скажите его ведущему'}</p></div></div>${scoreLine}${roomNote}`;
      }
      return;
    }
    if (data.game === 'memo') {
      const faces = Array.isArray(data.tiles) ? data.tiles : [];
      let event='';
      if(data.event?.type==='question'){
        const answers=Array.isArray(data.event.options)?data.event.options.map((option,i)=>`<span class="screen-memo-option ${data.event.answered&&safeText(option)===safeText(data.event.correctAnswer)?'is-correct':''} ${data.event.answered&&data.event.chosenOption===i&&!data.event.wasCorrect?'is-wrong':''}">${safeText(option)}</span>`).join(''):'';
        const feedback=data.event.answered?`<b class="screen-memo-feedback ${data.event.wasCorrect?'is-correct':'is-wrong'}">${data.event.wasCorrect?`Верно · +${safeText(data.event.bonus)} бонусных балла`:`Ответ: ${safeText(data.event.correctAnswer)}`}</b>`:'';
        event=`<aside class="screen-memo-event"><b class="screen-memo-event-title">ВОПРОС · +${safeText(data.event.bonus)} БОНУСНЫХ БАЛЛА</b><p>${safeText(data.event.prompt)}</p><div class="screen-memo-options">${answers}</div>${feedback}</aside>`;
      }else if(data.event?.type==='fact'){
        event=`<aside class="screen-memo-event is-fact"><b class="screen-memo-event-title">НОВОГОДНИЙ ФАКТ</b><p>${safeText(data.event.text)}</p></aside>`;
      }
      stage.innerHTML = `<div class="screen-kicker">МЕМО · ${safeText(data.deckLabel || '')} · ${safeText(data.modeLabel || '')}</div><h1>${safeText(data.title || 'Найди пары')}</h1><p>${safeText(data.scoreline || '')}</p><div class="screen-memory">${faces.map(tile => `<div class="screen-memory-tile card-style-${Number(tile.variant)||0} ${tile.open ? 'open' : ''} ${tile.matched ? 'matched' : ''}">${tile.open || tile.matched ? `<b class="screen-memory-season">НОВЫЙ ГОД</b><span class="screen-memory-art">${tile.image?`<img src="${safeText(tile.image)}" alt="">`:`<b>${safeText(tile.emoji)}</b>`}</span><small>${safeText(tile.name || '')}</small>` : '<span class="screen-memory-back">❄</span>'}</div>`).join('')}</div>${event}${roomNote}`;
      return;
    }
    if (data.game === 'guess' && data.guessMode === 'circle') {
      stage.innerHTML = `<div class="screen-stars">✦　❄　✧　❄　✦</div><div class="screen-kicker">НОВОГОДНИЕ ТАРАНТИНКИ · ТЕЛЕФОННЫЙ КРУГ</div><h1>Угадываем по кругу</h1><p>Каждый видит подсказку на телефоне. Не выводите личные карточки на общий экран.</p><div class="screen-team">Сейчас угадывает: ${safeText(data.team || 'участник')}</div>${roomNote}`;
      return;
    }
    if (!data.revealed) {
      stage.innerHTML = `<div class="screen-stars">✦　❄　✧　❄　✦</div><div class="waiting-art">🎄</div><div class="screen-kicker">ЭКРАН УЧАСТНИКОВ</div><h1>Слово появится здесь</h1><p>${safeText(data.instruction || 'Ведущий готовит карточку. Устройтесь поудобнее!')}</p>${roomNote}`;
      return;
    }
    stage.innerHTML = `<div class="screen-stars">✦　❄　✧　❄　✦</div><div class="screen-kicker">${safeText(data.gameLabel || 'НОВОГОДНЯЯ ИГРА')}</div><div class="screen-emoji">${data.image?`<img src="${safeText(data.image)}" alt="">`:safeText(data.emoji || '❄️')}</div><h1 class="screen-word">${safeText(data.word || '')}</h1><div class="screen-mode">${safeText(data.mode || 'ЗИМНЕЕ СЛОВО')}</div>${Number.isFinite(data.timer)?`<div class="screen-clock">${safeText(String(Math.floor(data.timer/60)).padStart(2,'0'))}:${safeText(String(data.timer%60).padStart(2,'0'))}</div>`:''}<div class="screen-team">${safeText(data.team || '')}</div><p class="screen-hint">${safeText(data.instruction || 'Удачи!')}</p>${roomNote}`;
  }
  document.querySelector('#screenFullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.();
  });
  connect();
})();
