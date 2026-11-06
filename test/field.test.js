const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const read=p=>fs.readFileSync(p,'utf8');
function setup(){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(read('index.html'),{url:'http://localhost:4173/',runScripts:'outside-only',virtualConsole:vc});
  const w=dom.window;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:false});w.confirm=()=>true;let socket;
  w.WebSocket=class{constructor(){socket=this;this.readyState=1;this.events={};this.messages=[]}addEventListener(n,f){this.events[n]=f}send(m){this.messages.push(JSON.parse(m))}};w.WebSocket.OPEN=1;
  w.Audio=class{play(){return Promise.resolve()}pause(){}};
  for(const f of ['quiz-data.js','crossword-data.js','melody-data.js','field-data.js','app.js'])w.eval(read(f));socket.events.open();
  let spinTimer;const timer=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>ms===2400?(spinTimer=fn,123):timer(fn,ms,...args);
  const d=w.document, click=sel=>{const el=d.querySelector(sel);assert.ok(el,sel);assert.equal(el.disabled,false,sel);el.click()}, state=()=>socket.messages.filter(m=>m.type==='state').at(-1).payload;
  const spin=i=>{w.Math.random=()=> (i+.1)/24;click('#fieldSpin');assert.equal(state().phase,'spinning');spinTimer();};
  const answer=value=>{d.querySelector('#fieldAnswer').value=value;d.querySelector('#fieldSolve').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
  return {w,d,click,state,spin,answer,socket,errors};
}
test('100 distinct question clues do not contain the answer',()=>{
  const {w}=setup();try{const questions=w.FIELD_QUESTIONS;assert.ok(questions.length>=100);assert.equal(new Set(questions.map(q=>q.answer)).size,questions.length);for(const q of questions){assert.ok(q.question&&q.answer);assert.ok(!q.question.toUpperCase().includes(q.answer),q.question);assert.match(q.answer,/^[А-ЯЁ ]+$/)}}finally{w.close()}
});
test('field scores repeated letters, advances on errors, and runs all three rounds and final',()=>{
  const {w,d,click,state,spin,answer,errors}=setup();try{
    w.FIELD_QUESTIONS=[{question:'Сложная подсказка',answer:'БАРАБАН'}];click('[data-open="field"]');click('#fieldStart');
    assert.equal(d.querySelectorAll('.field-wheel-art>span').length,24);assert.ok(!JSON.stringify(state()).includes('БАРАБАН'));
    spin(0);click('[data-field-letter="А"]');assert.equal(state().players[0].score,1500);assert.equal(state().board.filter(x=>x.letter==='А').length,3);assert.equal(state().activeIndex,0);
    spin(0);click('[data-field-letter="Я"]');assert.equal(state().activeIndex,1);
    answer('НЕВЕРНО');assert.equal(state().players[1].out,true);assert.equal(state().activeIndex,2);
    answer('БАРАБАН');assert.equal(state().phase,'over');assert.match(state().message,/Игрок 3/);
    for(let r=2;r<=3;r++){click('#fieldNext');click('#fieldStart');answer('БАРАБАН');assert.equal(state().phase,'over');assert.equal(state().round,`ТРОЙКА ${r} / 3`)}
    click('#fieldNext');assert.match(d.querySelector('.field-setup').textContent,/Финалисты/);click('#fieldStart');assert.equal(state().players.length,3);assert.equal(state().round,'ФИНАЛ');answer('БАРАБАН');assert.equal(state().phase,'over');assert.deepEqual(errors,[]);
  }finally{w.close()}
});
test('special sectors, chest and single-player three-move rule',()=>{
  const {w,d,click,state,spin,answer}=setup();try{
    w.FIELD_QUESTIONS=[{question:'Вопрос',answer:'АБВГДЕЖЗ'}];click('[data-open="field"]');click('#fieldStart');
    spin(2);assert.equal(state().activeIndex,1);assert.equal(state().players[0].score,0);
    spin(7);assert.equal(state().activeIndex,2);assert.equal(state().sector,'0');
    spin(15);assert.equal(state().phase,'plus');click('[data-field-tile="0"]');assert.equal(state().board[0].letter,'А');assert.equal(state().players[2].score,0);
    spin(5);assert.equal(state().phase,'prize');click('[data-field-prize="continue"]');click('[data-field-letter="Б"]');assert.equal(state().players[2].score,2000);
    spin(9);click('[data-field-letter="В"]');assert.equal(state().players[2].score,4000);
    spin(0);click('[data-field-letter="Г"]');assert.equal(state().phase,'chest');click('[data-field-chest="0"]');assert.equal(state().phase,'spin');
    answer('НЕВЕРНО');assert.equal(state().players[2].out,true);assert.equal(state().activeIndex,0);
    answer('НЕВЕРНО');assert.equal(state().players[0].out,true);assert.equal(state().activeIndex,1);
    spin(0);click('[data-field-letter="Д"]');spin(0);click('[data-field-letter="Е"]');spin(0);click('[data-field-letter="Ж"]');assert.equal(state().phase,'chest');click('[data-field-chest="1"]');assert.equal(state().phase,'solveOnly');assert.equal(d.querySelector('#fieldSpin').disabled,true);answer('АБВГДЕЖЗ');assert.equal(state().phase,'over');
  }finally{w.close()}
});
test('new Russian and English melodies are bundled in the intended board cells',()=>{
  const {w,d,click}=setup();try{const played=[];w.Audio=class{constructor(url){this.url=url}play(){played.push(this.url);return Promise.resolve()}pause(){}};
    click('[data-open="melody"]');click('[data-melody-tour="2"]');
    for(const [index,title,file] of [[9,'Диалог у новогодней ёлки','dialog-u-elki.mp3'],[10,'Отпусти и забудь','otpusti-i-zabud.mp3']]){click(`[data-melody-note="${index}"]`);assert.equal(d.querySelector('.melody-answer p').textContent,title);click('#melodyPlay');assert.ok(played.at(-1).endsWith(file));}
    const select=d.querySelector('#melodyVersion');select.value='international';select.dispatchEvent(new w.Event('change',{bubbles:true}));click('[data-melody-tour="1"]');click('[data-melody-note="1"]');click('#melodyPlay');assert.ok(played.at(-1).endsWith('last-christmas-wham.mp3'));
    click('[data-melody-note="6"]');click('#melodyPlay');assert.ok(played.at(-1).endsWith('let-it-snow-martin.mp3'));
  }finally{w.close()}
});
test('supergame opens five chosen letters, enforces the deadline and reports a win',()=>{
  const {w,d,click,state,answer}=setup();try{
    w.FIELD_QUESTIONS=[{question:'Зимний вопрос',answer:'ВАЛЕНКИ'}];click('[data-open="field"]');click('#fieldStart');answer('ВАЛЕНКИ');
    for(let i=0;i<3;i++){click('#fieldNext');click('#fieldStart');answer('ВАЛЕНКИ')}
    click('#fieldSuper');assert.equal(state().phase,'superLetters');assert.equal(state().round,'СУПЕРИГРА');assert.ok(!JSON.stringify(state()).includes('ВАЛЕНКИ'));
    for(const ch of ['А','Б','В','Г','Д'])click(`[data-field-letter="${ch}"]`);
    assert.equal(state().phase,'superSolve');assert.equal(state().seconds,60);assert.equal(state().board.filter(t=>t.letter).length,2);
    answer('ВАЛЕНКИ');assert.equal(state().phase,'over');assert.match(state().message,/выиграна/);
    // Run another game and submit after the deadline; it must lose even if the timer callback was delayed.
    click('#fieldNext');click('#fieldStart');answer('ВАЛЕНКИ');for(let i=0;i<3;i++){click('#fieldNext');click('#fieldStart');answer('ВАЛЕНКИ')}
    click('#fieldSuper');let now=100000;w.Date.now=()=>now;for(const ch of ['А','Б','В','Г','Д'])click(`[data-field-letter="${ch}"]`);now+=60001;answer('ВАЛЕНКИ');assert.match(state().message,/Время вышло/);
  }finally{w.close()}
});

test('field host and projector use a light background with readable text',()=>{
  const dom=new JSDOM(`<style>${read('display.css')}</style><style>${read('field.css')}</style>
    <div class="field-show"><header class="field-intro"><h2>Поле чудес</h2></header>
    <div class="field-stage"><h3>Вопрос</h3><div class="field-status">Ход игрока</div></div>
    <div class="field-console"><p>Назовите букву</p></div></div>
    <div class="screen-stage"><div class="field-projection"><div class="field-stage"><h1>Вопрос</h1><p class="field-status">Ход игрока</p></div></div></div>`);
  try {
    const {document,getComputedStyle}=dom.window;
    const rgb=css=>css.match(/\d+/g).slice(0,3).map(Number);
    const luminance=([r,g,b])=>[r,g,b].map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const backdrop=[230,241,248]; // darkest stop of the pale gradient
    for(const sel of ['.field-show','.field-projection']) {
      const bg=rgb(getComputedStyle(document.querySelector(sel)).backgroundColor);
      assert.ok(luminance(bg)>.85,sel);
    }
    for(const sel of ['.field-intro h2','.field-stage h3','.field-status','.field-console p','.field-projection h1','.field-projection p.field-status']) {
      const fg=rgb(getComputedStyle(document.querySelector(sel)).color);
      const ratio=(luminance(backdrop)+.05)/(luminance(fg)+.05);
      assert.ok(ratio>=4.5,`${sel}: contrast ${ratio.toFixed(2)}`);
    }
  } finally {dom.window.close()}
});

test('host can play offline, rename, skip with visible turn, and judge a spoken answer',()=>{
  const {w,d,click,state}=setup();try{
    w.FIELD_QUESTIONS=[{question:'Вопрос',answer:'БАРАБАН'}];click('[data-open="field"]');const name=d.querySelector('[data-field-name="0"]');name.value='Мария';name.dispatchEvent(new w.Event('input',{bubbles:true}));click('#fieldStart');
    assert.match(d.querySelector('.field-score.active').textContent,/Мария/);click('#fieldSkip');assert.equal(state().activeIndex,1);assert.equal(state().lastPassed,0);assert.ok(d.querySelectorAll('.field-score')[0].classList.contains('passed'));assert.match(d.querySelector('.field-score.active').textContent,/Игрок 2/);
    w.confirm=()=>false;click('#fieldWrong');assert.equal(state().players[1].out,false);w.confirm=()=>true;click('#fieldWrong');assert.equal(state().players[1].out,true);assert.equal(state().activeIndex,2);assert.ok(d.querySelectorAll('.field-score')[1].classList.contains('out'));
    assert.ok(!JSON.stringify(state()).includes('БАРАБАН'));click('#fieldRight');assert.equal(state().phase,'over');assert.match(state().message,/Игрок 3/);
  }finally{w.close()}
});
