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
    for (const file of ['quiz-data.js', 'crossword-data.js', 'melody-data.js', 'app.js']) window.eval(read(file));
    const document = window.document;
    for (const game of ['memo', 'guess', 'croc', 'quiz', 'crossword', 'music', 'field', 'melody']) {
      document.querySelector(`[data-open="${game}"]`).click();
      assert.ok(document.querySelector('#gameModal').classList.contains('open'), `${game} should open`);
      assert.ok(document.querySelector('#gameBody').children.length, `${game} should render content`);
      if (game === 'field') {
        document.querySelector('input[name="fieldMode"][value="player"]').click();
        assert.ok(document.querySelector('.field-letter-btn'));
      }
      if (game === 'melody') assert.ok(document.querySelector('.melody-screen-view'));
      document.querySelector('#backHome').click();
      assert.equal(document.querySelector('#gameModal').getAttribute('aria-hidden'), 'true');
    }
    assert.deepEqual(errors, []);
  } finally { window.close(); }
});

test('melody board keeps four rounds, three scores and three language selections', () => {
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
    for (const file of ['quiz-data.js', 'crossword-data.js', 'melody-data.js', 'app.js']) window.eval(read(file));
    socket.listeners.open();
    const doc = window.document;
    const click = selector => { const element = doc.querySelector(selector); assert.ok(element, selector); element.click(); };
    const payload = () => socket.messages.filter(msg => msg.type === 'state').at(-1).payload;
    click('[data-open="melody"]');
    assert.equal(doc.querySelectorAll('[data-melody-tour]').length, 4);
    assert.equal(doc.querySelectorAll('[data-melody-note]').length, 9);
    assert.equal(doc.querySelectorAll('[data-melody-name]').length, 3);
    assert.equal(doc.querySelectorAll('#melodyVersion option').length, 3);
    click('[data-melody-note="0"]');
    assert.equal(payload().answer, '');
    assert.ok(!JSON.stringify(payload()).includes(window.MELODY_SONGS.russian[0]), 'answer must not leak to display');
    const fileInput = doc.querySelector('#melodyFile');
    Object.defineProperty(fileInput, 'files', { value: [new window.File(['audio'], 'song.mp3', {type:'audio/mpeg'})] });
    fileInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    click('#melodyPlay');
    assert.equal(playing, 1);
    click('[data-melody-score="2"][data-direction="1"]');
    assert.equal(payload().scores[2].score, 10);
    click('#melodyReveal');
    assert.equal(payload().answer, window.MELODY_SONGS.russian[0]);
    click('#melodyDone');
    assert.equal(payload().rows[0][0].used, true);
    assert.ok(paused > 0);
    click('[data-melody-tour="2"]');
    assert.equal(payload().tour, 2);
    assert.equal(payload().scores[2].score, 10);
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
    data.answer='Тайная песня'; send();
    assert.match(stage.textContent, /Ответ: Тайная песня/);
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
    for (const f of ['quiz-data.js','crossword-data.js','melody-data.js','app.js']) w.eval(read(f));
    for (const [name, path] of Object.entries(w.MELODY_AUDIO)) {
      assert.ok(w.MELODY_SONGS.international.includes(name));
      const data=fs.readFileSync(path);
      assert.equal(data.subarray(0,4).toString(), 'RIFF', path);
      assert.ok(data.length > 100000, path);
    }
    const doc=w.document;
    doc.querySelector('[data-open="melody"]').click();
    doc.querySelector('#melodyIntro').click();
    assert.match(played.at(-1), /gameshow-brazz\.mp3$/);
    const version=doc.querySelector('#melodyVersion');
    version.value='international'; version.dispatchEvent(new w.Event('change',{bubbles:true}));
    doc.querySelector('[data-melody-note="4"]').click();
    assert.equal(doc.querySelector('#melodyPlay').disabled,false);
    doc.querySelector('#melodyPlay').click();
    assert.match(played.at(-1), /jingle-bells\.wav$/);
    doc.querySelector('[data-melody-tour="2"]').click();
    assert.match(played.at(-1), /christmas-town\.mp3$/);
    doc.querySelector('[data-melody-note="0"]').click();
    assert.equal(doc.querySelector('#melodyPlay').disabled,true);
    assert.deepEqual(errors, []);
  } finally { w.close(); }
});

test('holiday card shows the original rules and separately links to the game and the bundle', () => {
  const dom = new JSDOM(read('index.html'), {url:'http://localhost:4173/',runScripts:'outside-only'});
  const w=dom.window; w.matchMedia=()=>({matches:true}); w.fetch=async()=>({ok:false});
  w.WebSocket=class { constructor(){this.readyState=0} addEventListener(){} }; w.WebSocket.OPEN=1;
  try {
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','app.js']) w.eval(read(f));
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
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','app.js']) w.eval(read(f));
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
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','app.js']) w.eval(read(f));
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
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','app.js']) w.eval(read(f));
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
    for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','app.js']) w.eval(read(f));
    assert.equal(w.MELODY_SONGS.russian.length,36); assert.equal(w.MELODY_RUSSIAN_SOURCES.length,36);
    assert.equal(w.MELODY_SONGS.russian.filter(x=>x==='Новый год').length,2);
    const doc=w.document; doc.querySelector('[data-open="melody"]').click();
    assert.match(doc.querySelector('.melody-song-list').textContent,/Повтор названия.*Новый год/);
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
