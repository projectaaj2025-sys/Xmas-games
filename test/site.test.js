const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const read = file => fs.readFileSync(file, 'utf8');

test('the homepage stylesheet contains CSS, not a copy of the HTML', () => {
  const css = read('styles.css');
  assert.doesNotMatch(css, /<!doctype\s+html|<html\b/i);
  assert.match(css, /\.game-grid\s*\{/);
  assert.match(css, /\.modal-backdrop\s*\{/);
});

test('the guess card question is layered above its character image', () => {
  const dom = new JSDOM(read('index.html'));
  try {
    const { document, getComputedStyle } = dom.window;
    const style = document.createElement('style');
    style.textContent = read('styles.css');
    document.head.appendChild(style);
    const bubble = document.querySelector('.guess-illustration .speech-bubble');
    const character = document.querySelector('.guess-illustration .guess-character');
    assert.equal(bubble.textContent, 'Кто я?');
    assert.equal(getComputedStyle(bubble).position, 'absolute');
    assert.ok(Number(getComputedStyle(bubble).zIndex) > (Number(getComputedStyle(character).zIndex) || 0));
    assert.ok(Number(getComputedStyle(document.querySelector('.guess-card .card-top')).zIndex) > Number(getComputedStyle(bubble).zIndex));
  } finally { dom.window.close(); }
});

test('each game opens in its frame and the new game controls render', () => {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(read('index.html'), { url: 'http://localhost:4173/', runScripts: 'outside-only', virtualConsole: console });
  const { window } = dom;
  window.matchMedia = () => ({ matches: true });
  window.fetch = async () => ({ ok: false });
  window.WebSocket = class { constructor() { this.readyState = 0; } addEventListener() {} };
  window.WebSocket.OPEN = 1;
  try {
    for (const file of ['quiz-data.js', 'crossword-data.js', 'melody-data.js', 'field-data.js', 'app.js']) window.eval(read(file));
    const document = window.document;
    for (const game of ['memo', 'guess', 'croc', 'quiz', 'crossword', 'music', 'field', 'melody']) {
      document.querySelector(`[data-open="${game}"]`).click();
      assert.ok(document.querySelector('#gameModal').classList.contains('open'), `${game} should open`);
      assert.ok(document.querySelector('#gameBody').children.length, `${game} should render content`);
      if (game === 'field') {
        document.querySelector('#fieldStart').click();
        assert.ok(document.querySelector('.field-letter-btn'));
      }
      if (game === 'melody') assert.ok(document.querySelector('.melody-screen-view'));
      document.querySelector('#backHome').click();
      assert.equal(document.querySelector('#gameModal').getAttribute('aria-hidden'), 'true');
    }
    assert.deepEqual(errors, []);
  } finally { window.close(); }
});

test('melody board keeps three fields, a supergame, three scores and language selections', () => {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(read('index.html'), { url: 'http://localhost:4173/', runScripts: 'outside-only', virtualConsole });
  const { window } = dom;
  window.matchMedia = () => ({ matches: true });
  window.fetch = async () => ({ ok: false });
  window.confirm = () => true;
  let socket;
  window.WebSocket = class {
    constructor() { socket = this; this.readyState = 1; this.listeners = {}; this.messages = []; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    send(message) { this.messages.push(JSON.parse(message)); }
  };
  window.WebSocket.OPEN = 1;
  window.URL.createObjectURL = () => 'blob:test-audio';
  let revoked = [];
  window.URL.revokeObjectURL = url => revoked.push(url);
  let playing = 0, paused = 0;
  window.Audio = class { play() { playing++; return Promise.resolve(); } pause() { paused++; } };
  try {
    for (const file of ['quiz-data.js', 'crossword-data.js', 'melody-data.js', 'field-data.js', 'app.js']) window.eval(read(file));
    socket.listeners.open();
    const doc = window.document;
    const click = selector => { const element = doc.querySelector(selector); assert.ok(element, selector); element.click(); };
    const payload = () => socket.messages.filter(msg => msg.type === 'state').at(-1).payload;
    click('[data-open="melody"]');
    assert.equal(doc.querySelectorAll('[data-melody-tour]').length, 5);
    assert.equal(doc.querySelectorAll('[data-melody-note]').length, 20);
    assert.equal(doc.querySelectorAll('[data-melody-name]').length, 3);
    assert.equal(doc.querySelectorAll('#melodyVersion option').length, 4);
    click('[data-melody-note="0"]');
    assert.equal(payload().answer, '');
    assert.ok(!JSON.stringify(payload()).includes(window.MELODY_SONGS.russian[0]), 'answer must not leak to display');
    const fileInput = doc.querySelector('#melodyFile');
    Object.defineProperty(fileInput, 'files', { value: [new window.File(['audio'], 'song.mp3', {type:'audio/mpeg'})] });
    fileInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    click('#melodyPlay');
    assert.equal(playing, 2);
    click('[data-melody-score="2"][data-direction="1"]');
    assert.equal(payload().scores[2].score, 80);
    click('#melodyReveal');
    assert.equal(payload().answer, window.MELODY_SONGS.russian[0]);
    click('#melodyDone');
    assert.equal(payload().rows[0][0].used, true);
    assert.ok(paused > 0);
    click('[data-melody-tour="2"]');
    assert.equal(payload().tour, 2);
    assert.equal(payload().scores[2].score, 80);
    click('[data-melody-tour="1"]');
    assert.equal(doc.querySelector('[data-melody-note="0"]').disabled, true);
    const select = doc.querySelector('#melodyVersion');
    select.value = 'mixed'; select.dispatchEvent(new window.Event('change', { bubbles:true }));
    assert.equal(payload().scores[2].score, 0);
    assert.deepEqual(revoked, ['blob:test-audio']);
    click('[data-melody-note="1"]'); click('#melodyReveal');
    assert.equal(payload().answer, window.MELODY_SONGS.international[1]);
    click('#backHome');
    assert.deepEqual(errors, []);
  } finally { window.close(); }
});

test('projector displays the melody board and only a revealed answer', () => {
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(read('display.html'), { url:'http://localhost:4173/display.html?room=ABCDE', runScripts:'outside-only', virtualConsole });
  let socket;
  dom.window.WebSocket = class { constructor() { socket = this; this.listeners = {}; } addEventListener(name, fn) { this.listeners[name] = fn; } send() {} };
  try {
    dom.window.eval(read('display.js'));
    const data = {game:'melody',tour:1,categories:['Категория'],rows:[[{value:10,used:false,selected:true}]],scores:[{name:'Игрок',score:10}],selectedValue:10,answer:''};
    const send = () => socket.listeners.message({data:JSON.stringify({type:'state',payload:data})});
    send();
    const stage = dom.window.document.querySelector('#screenStage');
    assert.ok(stage.querySelector('.display-melody-board'));
    assert.match(stage.textContent, /Мелодия на 10 баллов/);
    assert.doesNotMatch(stage.textContent, /Тайная песня/);
    data.answer='Тайная песня'; data.answerArtist='Исполнитель'; send();
    assert.match(stage.textContent, /Ответ: Тайная песня — Исполнитель/);
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('bundled melodies are available and playback uses them without exposing answers', () => {
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(read('index.html'), { url:'http://localhost:4173/', runScripts:'outside-only', virtualConsole:vc });
  const w = dom.window;
  w.matchMedia = () => ({matches:true});
  w.fetch = async () => ({ok:false});
  w.confirm = () => true;
  w.WebSocket = class { constructor(){this.readyState=0} addEventListener(){} };
  w.WebSocket.OPEN=1;
  const played=[];
  w.Audio = class { constructor(url){this.url=url} pause(){} play(){played.push(this.url); return Promise.resolve()} };
  try {
    for (const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']) w.eval(read(f));
    for (const [name, path] of Object.entries(w.MELODY_AUDIO)) {
      assert.ok(w.MELODY_SONGS.international.includes(name));
      const data=fs.readFileSync(path);
      assert.ok(data.subarray(0,4).toString()==='RIFF' || data.subarray(0,3).toString()==='ID3' || data[0]===0xff, path);
      assert.ok(data.length > 100000, path);
    }
    const doc=w.document;
    doc.querySelector('[data-open="melody"]').click();
    doc.querySelector('#melodyIntro').click();
    assert.match(played.at(-1), /show-opening\.mp3$/);
    const version=doc.querySelector('#melodyVersion');
    version.value='international'; version.dispatchEvent(new w.Event('change',{bubbles:true}));
    doc.querySelector('[data-melody-note="4"]').click();
    assert.equal(doc.querySelector('#melodyPlay').disabled,false);
    doc.querySelector('#melodyPlay').click();
    assert.match(played.at(-1), /jingle-bells\.wav$/);
    doc.querySelector('[data-melody-tour="2"]').click();
    assert.match(played.at(-1), /show-endround\.mp3$/);
    doc.querySelector('[data-melody-note="0"]').click();
    assert.equal(doc.querySelector('#melodyPlay').disabled,false);
    assert.ok(doc.querySelector('#melodyExternalPlayer iframe'));
    assert.deepEqual(errors, []);
  } finally { w.close(); }
});

test('holiday card shows the original rules and separately links to the game and the bundle', () => {
  const dom = new JSDOM(read('index.html'), {url:'http://localhost:4173/',runScripts:'outside-only'});
  const w=dom.window; w.matchMedia=()=>({matches:true}); w.fetch=async()=>({ok:false});
  w.WebSocket=class { constructor(){this.readyState=0} addEventListener(){} }; w.WebSocket.OPEN=1;
  try {
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']) w.eval(read(f));
    w.document.querySelector('[data-open="drive"]').click();
    assert.ok(w.document.querySelector('#gameModal').classList.contains('open'));
    assert.equal(w.document.querySelectorAll('.holiday-round-list li').length,4);
    assert.match(w.document.querySelector('.holiday-actions .primary-button').href,/1fmAdYjsFhZEPXMQMf3L66cHbBRHsyEd-/);
    assert.match(w.document.querySelector('.holiday-download').href,/1ZG3EVOkOO_ovAt0RBEzLBdrJ5iSXvz_m/);
    assert.ok(w.document.querySelector('#goFullscreen'));
    assert.match(w.document.querySelector('.holiday-source').textContent,/скачать файл/i);
  } finally {w.close()}
});

test('all English titles have a local clip or an embedded recording and YouTube player stops', () => {
  const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only'});
  const w=dom.window; w.matchMedia=()=>({matches:true}); w.fetch=async()=>({ok:false}); w.confirm=()=>true;
  w.WebSocket=class {constructor(){this.readyState=0} addEventListener(){}}; w.WebSocket.OPEN=1;
  w.Audio=class {play(){return Promise.resolve()} pause(){}};
  try {
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']) w.eval(read(f));
    for(const name of w.MELODY_SONGS.international) assert.ok(w.MELODY_AUDIO[name] || w.MELODY_YOUTUBE[name],name);
    const doc=w.document; doc.querySelector('[data-open="melody"]').click();
    const select=doc.querySelector('#melodyVersion'); select.value='international'; select.dispatchEvent(new w.Event('change',{bubbles:true}));
    doc.querySelector('[data-melody-note="0"]').click(); doc.querySelector('#melodyYoutube').click();
    assert.match(doc.querySelector('#melodyExternalPlayer iframe').src,/yXQViqx6GMY/);
    doc.querySelector('[data-melody-score="0"][data-direction="1"]').click();
    assert.ok(doc.querySelector('#melodyExternalPlayer iframe'), 'score changes do not interrupt the song');
    doc.querySelector('#melodyStop').click();
    assert.equal(doc.querySelector('#melodyExternalPlayer iframe'),null);
  } finally {w.close()}
});

test('custom intro and round-transition files can be played and released', () => {
  const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only'});
  const w=dom.window; w.matchMedia=()=>({matches:true}); w.fetch=async()=>({ok:false});
  w.WebSocket=class {constructor(){this.readyState=0} addEventListener(){}}; w.WebSocket.OPEN=1;
  let n=0; const revoked=[]; const played=[];
  w.URL.createObjectURL=()=>`blob:cue${++n}`; w.URL.revokeObjectURL=url=>revoked.push(url);
  w.Audio=class {constructor(url){this.url=url} play(){played.push(this.url); return Promise.resolve()} pause(){}};
  try {
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']) w.eval(read(f));
    const doc=w.document; doc.querySelector('[data-open="melody"]').click();
    for(const id of ['melodyIntroFile','melodyTransitionFile']) {
      const input=doc.getElementById(id);
      Object.defineProperty(input,'files',{value:[new w.File(['sound'],id+'.mp3',{type:'audio/mpeg'})]});
      input.dispatchEvent(new w.Event('change',{bubbles:true}));
    }
    doc.querySelector('#melodyIntro').click(); assert.equal(played.at(-1),'blob:cue1');
    doc.querySelector('[data-melody-tour="2"]').click(); assert.equal(played.at(-1),'blob:cue2');
    doc.querySelector('#backHome').click(); assert.deepEqual(revoked,['blob:cue1','blob:cue2']);
  } finally {w.close()}
});

test('holiday adaptation can be completed across four rounds with a reliable score', () => {
  const errors=[]; const vc=new VirtualConsole(); vc.on('jsdomError', e=>errors.push(e));
  const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only',virtualConsole:vc});
  const w=dom.window; w.matchMedia=()=>({matches:true}); w.fetch=async()=>({ok:false});
  w.WebSocket=class {constructor(){this.readyState=0} addEventListener(){}}; w.WebSocket.OPEN=1;
  try {
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']) w.eval(read(f));
    const doc=w.document; doc.querySelector('[data-open="drive"]').click();
    doc.querySelector('#holidayStart').click();
    assert.equal(doc.querySelector('#holidayNext').disabled,true);
    for (let i=0;i<6;i++) {
      assert.match(doc.querySelector('.holiday-label').textContent,new RegExp(`РАУНД ${i<3?1:2}`));
      const correct=[0,1,0,1,0,0][i];
      doc.querySelector(`[data-holiday-answer="${correct}"]`).click();
      assert.ok(doc.querySelector('.holiday-answers .correct'));
      doc.querySelector('#holidayNext').click();
    }
    for (let i=0;i<3;i++) {
      assert.match(doc.querySelector('.holiday-label').textContent,/РАУНД 3/);
      doc.querySelector('#holidayListen').click();
      assert.match(doc.querySelector('.holiday-video').src,/youtube-nocookie\.com\/embed/);
      doc.querySelector('#holidayStop').click(); assert.equal(doc.querySelector('.holiday-video'),null);
      doc.querySelector('#holidayRight').click(); doc.querySelector('#holidayNext').click();
    }
    for (const answer of ['СНЕГОВИК','ПОДАРКИ','СНЕЖИНКА']) {
      assert.match(doc.querySelector('.holiday-label').textContent,/РАУНД 4/);
      for (const letter of new Set(answer)) doc.querySelector(`[data-holiday-letter="${letter}"]`).click();
      assert.match(doc.querySelector('.holiday-feedback').textContent,/\+1/);
      doc.querySelector('#holidayNext').click();
    }
    assert.match(doc.querySelector('.holiday-play').textContent,/12 из 12/);
    doc.querySelector('#holidayRestart').click(); assert.match(doc.querySelector('.holiday-play').textContent,/Счёт: 0/);
    assert.deepEqual(errors,[]);
  } finally {w.close()}
});

test('Russian melody sources follow the right note, including mixed mode', () => {
  const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only'});
  const w=dom.window; w.matchMedia=()=>({matches:true}); w.fetch=async()=>({ok:false}); w.confirm=()=>true;
  w.WebSocket=class {constructor(){this.readyState=0} addEventListener(){}}; w.WebSocket.OPEN=1;
  w.Audio=class {play(){return Promise.resolve()} pause(){}};
  try {
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']) w.eval(read(f));
    assert.equal(w.MELODY_SONGS.russian.length,47); assert.equal(w.MELODY_RUSSIAN_SOURCES.length,47);
    assert.equal(w.MELODY_SONGS.russian.filter(x=>x==='Новый год').length,1);
    const doc=w.document; doc.querySelector('[data-open="melody"]').click();
    assert.match(doc.querySelector('.melody-song-list').textContent,/Новый год — Стекловата \(повтор названия\)/);
    doc.querySelector('[data-melody-note="0"]').click();
    assert.match(doc.querySelector('.melody-answer p').textContent,/Новогодняя/);
    assert.match(doc.querySelector('.melody-audio-controls a').href,/song\/9293226/);
    doc.querySelector('#melodyYoutube').click();
    assert.match(doc.querySelector('#melodyExternalPlayer iframe').src,/1-bxBXOE368/);
    const select=doc.querySelector('#melodyVersion'); select.value='mixed'; select.dispatchEvent(new w.Event('change',{bubbles:true}));
    doc.querySelector('[data-melody-note="1"]').click();
    assert.match(doc.querySelector('.melody-answer p').textContent,/Last Christmas/);
    assert.ok(doc.querySelector('#melodyYoutube'));
  } finally {w.close()}
});

test('three 4 by 5 boards use the reference prices, distinct categories and per-song scoring', () => {
  const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only'});
  const w=dom.window;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.confirm=()=>true;
  w.WebSocket=class{constructor(){this.readyState=0}addEventListener(){}};w.WebSocket.OPEN=1;
  w.Audio=class{play(){return Promise.resolve()}pause(){}};
  try {
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js'])w.eval(read(f));
    const d=w.document;d.querySelector('[data-open="melody"]').click();
    const categories=[];
    for(let tour=1;tour<=3;tour++) {
      d.querySelector(`[data-melody-tour="${tour}"]`).click();
      const rows=[...d.querySelectorAll('.melody-board-row')];assert.equal(rows.length,4);
      assert.deepEqual(rows.map(row=>row.querySelectorAll('[data-melody-note]').length),[5,5,5,5]);
      categories.push(rows.map(row=>row.querySelector('.melody-category').textContent));
      if(tour===1) assert.deepEqual(rows.map(row=>[...row.querySelectorAll('[data-melody-note] span')].map(x=>Number(x.textContent))),[[80,40,90,60,70],[50,30,80,50,90],[80,40,50,70,30],[90,70,40,50,60]]);
    }
    assert.equal(new Set(categories.flat()).size,12);
    d.querySelector('[data-melody-tour="1"]').click();d.querySelector('[data-melody-note="0"]').click();
    d.querySelector('[data-melody-score="0"][data-direction="1"]').click();
    assert.equal(d.querySelector('[data-melody-score="0"][data-direction="1"]').disabled,true);
    assert.equal(d.querySelector('.melody-player-score strong').textContent,'80');
    d.querySelector('[data-melody-score="0"][data-direction="1"]').click();
    assert.equal(d.querySelector('.melody-player-score strong').textContent,'80');
    assert.equal(d.querySelectorAll('.melody-song-list li').length,72);
    assert.ok([...d.querySelectorAll('.melody-song-list li')].some(li=>/повтор названия/.test(li.textContent)));
  } finally {w.close()}
});

test('supergame skips and revisits, wins after seven, ends on error or timeout, and does not leak answers to projector', () => {
  const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only'});
  const w=dom.window;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.confirm=()=>true;
  let socket;w.WebSocket=class{constructor(){socket=this;this.readyState=1;this.listeners={};this.messages=[]}addEventListener(n,f){this.listeners[n]=f}send(m){this.messages.push(JSON.parse(m))}};w.WebSocket.OPEN=1;
  const plays=[];w.Audio=class{constructor(url){this.url=url}play(){plays.push(this.url);return Promise.resolve()}pause(){}};
  let now=100000;w.Date.now=()=>now;
  try {
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js'])w.eval(read(f));
    socket.listeners.open();const d=w.document;d.querySelector('[data-open="melody"]').click();d.querySelector('[data-melody-tour="4"]').click();
    assert.match(d.querySelector('.melody-stage').textContent,/семь мелодий за 30 секунд/i);
    d.querySelector('#superStart').click();assert.match(plays.at(-1),/kaby-ne-bylo-zimy\.mp3$/);
    const first=d.querySelector('.melody-answer p').textContent;
    const last=()=>socket.messages.filter(m=>m.type==='state').at(-1).payload;
    assert.equal(last().mode,'super');assert.ok(!JSON.stringify(last()).includes(first));
    d.querySelector('#superSkip').click();assert.notEqual(d.querySelector('.melody-answer p').textContent,first);
    for(let i=0;i<6;i++)d.querySelector('#superCorrect').click();
    assert.equal(d.querySelector('.melody-answer p').textContent,first);
    d.querySelector('#superCorrect').click();assert.match(d.querySelector('.melody-stage').textContent,/Победа/);assert.equal(last().status,'won');
    d.querySelector('#superStart').click();d.querySelector('#superWrong').click();assert.equal(last().status,'lost');
    d.querySelector('#superStart').click();now+=31000;d.querySelector('#superCorrect').click();assert.equal(last().status,'lost');
    assert.equal(d.querySelector('#superSeconds').textContent,'0');
    d.querySelector('#backHome').click();
  } finally {w.close()}
});

test('new show cues and Russian minus recordings are real local audio files', () => {
  for(const path of ['assets/melody/audio/show-opening.mp3','assets/melody/audio/show-endround.mp3','assets/melody/audio/kaby-ne-bylo-zimy.mp3','assets/melody/audio/zvenit-yanvarskaya-vyuga.mp3']) {
    const data=fs.readFileSync(path);assert.ok(data.length>50000,path);
    assert.ok(data.subarray(0,3).toString()==='ID3' || data[0]===0xff,path);
  }
});

test('projector displays the supergame clock and progress without song titles', () => {
  const dom=new JSDOM(read('display.html'),{url:'http://localhost:4173/display.html?room=ABCDE',runScripts:'outside-only'});
  let socket;dom.window.WebSocket=class{constructor(){socket=this;this.listeners={}}addEventListener(n,f){this.listeners[n]=f}send(){}};
  try {
    dom.window.eval(read('display.js'));
    socket.listeners.message({data:JSON.stringify({type:'state',payload:{game:'melody',mode:'super',seconds:12,correct:3,status:'running',player:'Игрок 1'}})});
    const stage=dom.window.document.querySelector('#screenStage');
    assert.match(stage.textContent,/СУПЕРИГРА/);assert.match(stage.textContent,/12 сек/);assert.match(stage.textContent,/3 \/ 7/);
  } finally {dom.window.close()}
});

test('bonus auction enforces bids, awards mistakes to the opponent and sends the winner to supergame', () => {
  const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only'});
  const w=dom.window;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.confirm=()=>true;
  let socket;w.WebSocket=class{constructor(){socket=this;this.readyState=1;this.listeners={};this.messages=[]}addEventListener(n,f){this.listeners[n]=f}send(m){this.messages.push(JSON.parse(m))}};w.WebSocket.OPEN=1;
  w.Audio=class{play(){return Promise.resolve()}pause(){}};
  try {
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js'])w.eval(read(f));
    socket.listeners.open();const d=w.document, click=s=>{const el=d.querySelector(s);assert.ok(el,s);el.click()};
    const payload=()=>socket.messages.filter(m=>m.type==='state').at(-1).payload;
    click('[data-open="melody"]');click('[data-melody-tour="5"]');
    let select=d.querySelector('[data-auction-player="0"]');select.value='2';select.dispatchEvent(new w.Event('change'));
    select=d.querySelector('[data-auction-player="1"]');select.value='2';select.dispatchEvent(new w.Event('change'));assert.equal(select.value,'1');
    click('#auctionStart');assert.equal(d.querySelector('#auctionPass').disabled,true);
    click('[data-auction-bid="7"]');assert.equal(d.querySelector('[data-auction-bid="7"]').disabled,true);
    click('[data-auction-bid="5"]');assert.equal(d.querySelector('[data-auction-bid="5"]').disabled,true);
    click('#auctionPass');const answer=d.querySelector('.melody-answer p').textContent;
    assert.equal(payload().phase,'guess');assert.equal(payload().bid,5);assert.equal(payload().answer,'');assert.ok(!JSON.stringify(payload()).includes(answer));
    click('#auctionWrong');assert.deepEqual(Array.from(payload().players,p=>p.score),[1,0]);assert.equal(payload().answer,answer);
    click('#auctionNext');click('[data-auction-bid="3"]');assert.equal(payload().phase,'guess');click('#auctionCorrect');
    click('#auctionNext');click('[data-auction-bid="3"]');click('#auctionCorrect');
    assert.equal(payload().phase,'finished');assert.deepEqual(Array.from(payload().players,p=>p.score),[3,0]);
    click('#auctionNext');assert.equal(payload().mode,'super');assert.equal(payload().player,'Игрок 3');
  } finally {w.close()}
});

test('new bundled Russian clips are mapped to actual MP3 files', () => {
  const dom=new JSDOM('',{runScripts:'outside-only'});
  try {
    dom.window.eval(read('melody-data.js'));
    const audio=dom.window.MELODY_RUSSIAN_AUDIO;
    for(const title of ['Пять минут','Три белых коня','Песенка о медведях','Песенка о снежинке','Снег идёт']) {
      const data=fs.readFileSync(audio[title]);assert.ok(data.length>100000,title);
      assert.ok(data.subarray(0,3).toString()==='ID3' || data[0]===0xff,title);
    }
  } finally {dom.window.close()}
});

test('game cards show features and player counts, never estimated duration', () => {
  const dom=new JSDOM(read('index.html'));
  try {
    const cards=[...dom.window.document.querySelectorAll('.game-card')];assert.ok(cards.length>0);
    for(const card of cards){
      const meta=card.querySelector('.game-meta');assert.ok(meta);
      assert.doesNotMatch(meta.textContent, /⏱|\d\s*[–-]\s*\d+\s*(?:минут|час)/i);
      assert.ok(meta.querySelectorAll('span').length>=2);
    }
  } finally {dom.window.close()}
});

test('new Russian recordings are playable, with duplicate titles mapped to the right artist', () => {
  const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only'});
  const w=dom.window;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.confirm=()=>true;
  w.WebSocket=class{constructor(){this.readyState=0}addEventListener(){}};w.WebSocket.OPEN=1;
  const played=[];w.Audio=class{constructor(url){this.url=url}play(){played.push(this.url);return Promise.resolve()}pause(){}};
  try {
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js'])w.eval(read(f));
    for(const [i,title] of w.MELODY_SONGS.russian.entries()) {
      const path=w.MELODY_RUSSIAN_AUDIO_BY_INDEX[i]||w.MELODY_RUSSIAN_AUDIO[title];
      if(path){const data=fs.readFileSync(path);assert.ok(data.length>100000,title);assert.ok(data.subarray(0,3).toString()==='ID3'||data[0]===0xff,title)}
    }
    assert.equal(w.MELODY_SONGS.russian.slice(0,43).filter((title,i)=>w.MELODY_RUSSIAN_AUDIO_BY_INDEX[i]||w.MELODY_RUSSIAN_AUDIO[title]).length,43);
    assert.equal(w.MELODY_SONGS.russian.filter((title,i)=>w.MELODY_RUSSIAN_AUDIO_BY_INDEX[i]||w.MELODY_RUSSIAN_AUDIO[title]).length,47);
    for(const i of w.MELODY_SUPER_TRACKS.russian) assert.ok(w.MELODY_RUSSIAN_AUDIO_BY_INDEX[i]||w.MELODY_RUSSIAN_AUDIO[w.MELODY_SONGS.russian[i]]);
    const d=w.document;d.querySelector('[data-open="melody"]').click();
    d.querySelector('[data-melody-note="2"]').click();assert.equal(d.querySelector('.melody-answer p').textContent,'Новый год');assert.equal(d.querySelector('#melodyPlay').disabled,false);d.querySelector('#melodyPlay').click();assert.match(played.at(-1),/novy-god-steklovata\.mp3$/);
    d.querySelector('[data-melody-note="1"]').click();assert.equal(d.querySelector('.melody-answer p').textContent,'Новогодняя песня');d.querySelector('#melodyPlay').click();assert.match(played.at(-1),/novogodnyaya-pesnya-a4\.mp3$/);
  } finally {w.close()}
});

test('new winter songs play from local files without replacing earlier catalogue entries', () => {
  const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only'});
  const w=dom.window;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.confirm=()=>true;
  w.WebSocket=class{constructor(){this.readyState=0}addEventListener(){}};w.WebSocket.OPEN=1;
  const played=[];w.Audio=class{constructor(url){this.url=url}play(){played.push(this.url);return Promise.resolve()}pause(){}};
  try {
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js'])w.eval(read(f));
    const all=w.MELODY_LAYOUT.flatMap(t=>t.flatMap(row=>row.ru));
    for(let i=0;i<43;i++)assert.ok(all.includes(i),`catalogue index ${i} is still on a board`);
    const d=w.document;d.querySelector('[data-open="melody"]').click();
    const positions=[
      [2,6,'Снег','sneg-kirkorov.mp3'],[2,1,'Новогодняя песня','novogodnyaya-pesnya-a4.mp3'],
      [2,5,'Зима в сердце','zima-v-serdtse.mp3'],[3,4,'Синий иней','siniy-iney.mp3'],[3,9,'Диалог у новогодней ёлки','dialog-u-elki.mp3']
    ];
    for(const [tour,note,title,file] of positions){
      d.querySelector(`[data-melody-tour="${tour}"]`).click();d.querySelector(`[data-melody-note="${note}"]`).click();
      assert.equal(d.querySelector('.melody-answer p').textContent,title);assert.equal(d.querySelector('#melodyPlay').disabled,false);
      d.querySelector('#melodyPlay').click();assert.ok(played.at(-1).endsWith(file),title);
      const bytes=fs.readFileSync(played.at(-1));assert.ok(bytes.length>100000,title);
      assert.ok(bytes.subarray(0,3).toString()==='ID3'||bytes[0]===0xff,title);
    }
  } finally {w.close()}
});


test('family selection has local playable songs on all three boards, in auction and supergame', () => {
  const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only'});
  const w=dom.window; w.matchMedia=()=>({matches:true}); w.fetch=async()=>({ok:false}); w.confirm=()=>true;
  w.WebSocket=class{constructor(){this.readyState=0}addEventListener(){}};w.WebSocket.OPEN=1;
  const played=[];w.Audio=class{constructor(url){this.url=url}play(){played.push(this.url);return Promise.resolve()}pause(){}};
  try {
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js']) w.eval(read(f));
    const d=w.document;d.querySelector('[data-open="melody"]').click();
    const select=d.querySelector('#melodyVersion');select.value='children';select.dispatchEvent(new w.Event('change',{bubbles:true}));
    const categories=[];
    for(let tour=1;tour<=3;tour++){
      d.querySelector(`[data-melody-tour="${tour}"]`).click();
      categories.push(...[...d.querySelectorAll('.melody-category')].map(n=>n.textContent));
      for(let note=0;note<20;note++){
        d.querySelector(`[data-melody-note="${note}"]`).click();
        assert.equal(d.querySelector('#melodyPlay').disabled,false,`${tour}:${note}`);
        d.querySelector('#melodyPlay').click();assert.ok(fs.existsSync(played.at(-1)),`${tour}:${note}`);
      }
    }
    assert.equal(new Set(categories).size,12);
    assert.equal(d.querySelectorAll('.melody-song-list li').length,72);
    assert.match(d.querySelector('.melody-song-list').textContent,/повтор названия/);
    assert.match(d.querySelector('.melody-song-list').textContent,/Голубой вагон/);
    d.querySelector('[data-melody-tour="5"]').click();d.querySelector('#auctionStart').click();
    d.querySelector('[data-auction-bid="3"]').click();
    assert.equal(d.querySelector('#auctionPlay').disabled,false);d.querySelector('#auctionPlay').click();assert.ok(fs.existsSync(played.at(-1)));
    d.querySelector('[data-auction-tour="4"]').click();d.querySelector('#superStart').click();
    for(let i=0;i<7;i++) {assert.ok(fs.existsSync(played.at(-1)));d.querySelector('#superCorrect').click();}
    assert.match(d.querySelector('.melody-stage').textContent,/Победа/);
  } finally {w.close()}
});


test('all Russian board slots and catalog recordings are local, with no repeats within each round', () => {
  const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only'});
  const w=dom.window;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.confirm=()=>true;
  w.WebSocket=class{constructor(){this.readyState=0}addEventListener(){}};w.WebSocket.OPEN=1;
  const played=[];w.Audio=class{constructor(url){this.url=url}play(){played.push(this.url);return Promise.resolve()}pause(){}};
  try {
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js'])w.eval(read(f));
    const d=w.document;d.querySelector('[data-open="melody"]').click();
    for(let tour=1;tour<=3;tour++){
      const indices=w.MELODY_LAYOUT[tour-1].flatMap(row=>row.ru);
      assert.equal(new Set(indices.map(i=>w.MELODY_SONGS.russian[i])).size,20);
      d.querySelector(`[data-melody-tour="${tour}"]`).click();
      for(let note=0;note<20;note++) {
        d.querySelector(`[data-melody-note="${note}"]`).click();
        assert.equal(d.querySelector('#melodyPlay').disabled,false,`${tour}:${note}`);
        assert.equal(d.querySelector('.melody-answer p').textContent,w.MELODY_SONGS.russian[indices[note]]);
        d.querySelector('#melodyPlay').click();const bytes=fs.readFileSync(played.at(-1));
        assert.ok(bytes.length>100000);assert.ok(bytes.subarray(0,3).toString()==='ID3'||bytes[0]===0xff);
      }
    }
    assert.match(d.querySelector('.melody-song-list').textContent,/повтор названия/);
  } finally {w.close()}
});
