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
    for (const file of ['quiz-data.js', 'crossword-data.js', 'app.js']) window.eval(read(file));
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
