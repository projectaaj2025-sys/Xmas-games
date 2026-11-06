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
