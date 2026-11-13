'use strict';

// =====================================================================
//  せってい（ここを かえると ゲームの ルールが かわります）
// =====================================================================
const CONFIG = {
  startLevel: 1,
  maxLevel: 6,
  bossHp: 3,                 // ボスを たおすのに ひつような せいかい
  maxHp: 5,                  // しゅじんこうの HP（まちがえると 1 へる。0 で ステージの さいしょから）
  mazeSize: (lv) => Math.min(10 + (lv - 1) * 2, 20), // めいろの おおきさ（マス）
  stepTime: 0.15,            // 1マス すすむ びょう
  encounterChance: 0.16,     // 1マス すすむ ごとに てきが でる かくりつ
  encounterMinSteps: 3,      // たたかいの あと この マスは でない
  rareRate: 0.1,             // レアてきが でる かくりつ（たおすと ボスまで ワープ）
  maxItems: 5,               // もてる アイテムの かず
  afterCorrectWait: 3.3,     // せいかい してから つぎへ すすむまでの びょう
  starCharge: 2.2,           // ほしの まほうを ためる びょう
  walkSpeed: 230,            // あるく はやさ（px/びょう）
  heroX: 0.3,                // しゅじんこうの いち（がめんの はばに たいする わりあい）
  enemyX: 0.64,              // てきの いち（みぎしたの テンキーと かさならない いち）
};

// ---------------------------------------------------------------------
//  もんだいの つくりかた（難易度ごと）。
//  2けた＋1けた は 10〜19、2けたどうし は 10〜29。
//  1〜3: 繰り上げ・繰り下げ なし / 4〜6: 繰り上げ・繰り下げ あり
// ---------------------------------------------------------------------
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[rnd(0, arr.length - 1)];
const mk = (a, op, b) => ({ a, op, b, ans: op === '+' ? a + b : a - b });

const QUESTIONS = {
  1: { // 1桁+1桁 / 1桁-1桁
    add: () => { const a = rnd(1, 8); return mk(a, '+', rnd(1, 9 - a)); },
    sub: () => { const a = rnd(2, 9); return mk(a, '-', rnd(1, a - 1)); },
  },
  2: { // 十いくつ+1桁 / 十いくつ-1桁（なし）
    add: () => { const u = rnd(0, 8); return mk(10 + u, '+', rnd(1, 9 - u)); },
    sub: () => { const u = rnd(1, 9); return mk(10 + u, '-', rnd(1, u)); },
  },
  3: { // 2けた+2けた / 2けた-2けた（なし、29まで）
    add: () => { const ua = rnd(0, 9); return mk(rnd(1, 2) * 10 + ua, '+', rnd(1, 2) * 10 + rnd(0, 9 - ua)); },
    sub: () => {
      let a, b;
      do { const ta = rnd(1, 2), ua = rnd(0, 9); a = ta * 10 + ua; b = rnd(1, ta) * 10 + rnd(0, ua); } while (a === b);
      return mk(a, '-', b);
    },
  },
  4: { // 1桁+1桁（くりあがり）/ 10-1桁（くりさがり）
    add: () => { const a = rnd(2, 9); return mk(a, '+', rnd(10 - a, 9)); },
    sub: () => mk(10, '-', rnd(1, 9)),
  },
  5: { // 十いくつ+1桁 / 十いくつ-1桁（あり）
    add: () => { const u = rnd(1, 9); return mk(10 + u, '+', rnd(10 - u, 9)); },
    sub: () => { const u = rnd(1, 8); return mk(10 + u, '-', rnd(u + 1, 9)); },
  },
  6: { // 2けた+2けた（くりあがり）/ 2けた-2けた（くりさがり）、29まで
    add: () => { const ua = rnd(1, 9); return mk(rnd(1, 2) * 10 + ua, '+', rnd(1, 2) * 10 + rnd(10 - ua, 9)); },
    sub: () => { const ua = rnd(0, 8); return mk(20 + ua, '-', 10 + rnd(ua + 1, 9)); },
  },
};

// さいごの ボス（レベル6）だけの とくべつ もんだい：99までの おおきな かず
const FINAL_BOSS_QUESTIONS = {
  add: () => { const ua = rnd(1, 9), ta = rnd(1, 7); return mk(ta * 10 + ua, '+', rnd(1, 8 - ta) * 10 + rnd(10 - ua, 9)); },
  sub: () => { const ta = rnd(4, 9), ua = rnd(0, 8); return mk(ta * 10 + ua, '-', rnd(1, ta - 2) * 10 + rnd(ua + 1, 9)); }, // こたえは 2けた
  // とどめの もんだいは こたえが 100を こえる
  over100: () => { const a = rnd(51, 99); return mk(a, '+', rnd(Math.max(10, 101 - a), 99)); },
};

function makeQuestion(level) {
  const set = QUESTIONS[Math.min(level, CONFIG.maxLevel)];
  return Math.random() < 0.5 ? set.add() : set.sub();
}

// ボスは ひとつ うえの レベルの もんだい。さいごの ボスは とくべつ もんだい
function makeBossQuestion(level, finalBlow) {
  if (level < CONFIG.maxLevel) return makeQuestion(level + 1);
  if (finalBlow) return FINAL_BOSS_QUESTIONS.over100();
  return Math.random() < 0.5 ? FINAL_BOSS_QUESTIONS.add() : FINAL_BOSS_QUESTIONS.sub();
}

// ステージの いろ（レベルごとに けしきが かわる）
const THEMES = {
  1: { place: 'はなばたけ',      sky: ['#bfe6ff', '#fff4fb'], far: '#c9e8c0', near: '#9fdc93', ground: '#86cf73', path: '#f1d9a6', accent: ['#ff8fbf', '#ffd84a', '#ffffff'] },
  2: { place: 'おかしの おか',    sky: ['#ffd6ea', '#fff6e0'], far: '#f8c7da', near: '#f3a9c8', ground: '#e992b8', path: '#fbe5c5', accent: ['#fff', '#7fd6ff', '#ffd84a'] },
  3: { place: 'きのこの もり',    sky: ['#cdeccd', '#fffbe8'], far: '#9fcf9a', near: '#74b572', ground: '#5ea65e', path: '#d9c08f', accent: ['#ff6b6b', '#fff', '#ffd84a'] },
  4: { place: 'ゆうやけ こうげん', sky: ['#ffb38a', '#ffe6c4'], far: '#e8a07a', near: '#c98a6a', ground: '#a8c46a', path: '#f0d29a', accent: ['#ffef8a', '#fff', '#ff8fbf'] },
  5: { place: 'ほしぞら の まち',  sky: ['#4a3f8f', '#b49be0'], far: '#6c5bb0', near: '#5a4a98', ground: '#4f7f8f', path: '#c9b8e6', accent: ['#ffe27a', '#bff', '#ffb3e0'] },
  6: { place: 'ドラゴンの おしろ', sky: ['#2b1f55', '#8d5cc4'], far: '#4b3786', near: '#3a2a6e', ground: '#5c4a90', path: '#b9a2e8', accent: ['#ffd84a', '#ff8fbf', '#9ff'] },
};

// ざこてきが ステージで つよく なる みため
const ENEMY_POWER = {
  1: { prefix: '',         scale: 1.0 },
  2: { prefix: 'ぷんぷん ', scale: 1.05, anger: true },
  3: { prefix: 'つのつき ', scale: 1.1,  anger: true, horns: true },
  4: { prefix: 'メラメラ ', scale: 1.15, anger: true, horns: true, aura: 'rgba(255,90,40,.95)' },
  5: { prefix: 'ダーク ',   scale: 1.2,  anger: true, horns: true, aura: 'rgba(150,60,255,.95)', filter: 'saturate(1.4) brightness(.8)' },
  6: { prefix: 'キング ',   scale: 1.25, anger: true, horns: true, aura: 'rgba(255,40,120,.95)', filter: 'saturate(1.5) brightness(.75) contrast(1.15)', crown: true },
};

// ボスは ステージが すすむと おおきく、まわりの えんしゅつも はでに なる（さいごは ほんもの）
//   sparkle: キラキラの いろ   flame: メラメラの いろ   dark: やみの オーラ   castle: うしろの おしろの いろ
const BOSS_STAGES = {
  1: { name: 'ちび どらぎょ',     height: 190, sparkle: ['#ffffff', '#fff3a0'], castle: '#b9a7d8' },
  2: { name: 'こども どらぎょ',   height: 202, sparkle: ['#ffffff', '#ffb3d9', '#bfe9ff'], castle: '#c79ac0' },
  3: { name: 'わんぱく どらぎょ', height: 214, sparkle: ['#fff3a0', '#c8ffb0'], flame: ['#ffd84a', '#ff9a3a'], castle: '#8f8aa8' },
  4: { name: 'おおきな どらぎょ', height: 226, sparkle: ['#fff3a0'], flame: ['#ffd84a', '#ff7a2a', '#ff3b2f'], aura: 'rgba(255,120,40,.9)', castle: '#8a6f78' },
  5: { name: 'キング どらぎょ',   height: 238, sparkle: ['#ffe27a', '#ffffff', '#9ff'], flame: ['#ffe27a', '#ff6a2a', '#ff2d55'], aura: 'rgba(255,60,60,.95)', castle: '#5f5590' },
  6: { name: null,                height: 250, dark: true, aura: 'rgba(120,20,200,.95)', filter: 'brightness(.8) saturate(1.3) hue-rotate(-12deg)', castle: '#2c2147' }, // null は えの なまえ
};

const SPELLS = {
  fire:   { lines: ['ファイア！'], color: '#ff3b2f' },
  water:  { lines: ['アクア！'], color: '#2f7dff' },
  wind:   { lines: ['ウインド！'], color: '#22a85a' },
  star:   { lines: ['スターライト・', 'シャワー！'], color: '#e0a800' },
  double: { lines: ['ダブル', 'スターライト・', 'シャワー！'], color: '#e0408a' },
};


// =====================================================================
//  じゅんび
// =====================================================================
const $ = (id) => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');
const H = 540;          // けいさんで つかう たかさ（はばは がめんに あわせる）
const INK = '#3a2a4d';
let W = 960, pxScale = 1, dpr = 1;

function resize() {
  dpr = window.devicePixelRatio || 1;
  pxScale = innerHeight / H;
  W = Math.max(640, innerWidth / pxScale);
  cv.width = Math.round(innerWidth * dpr);
  cv.height = Math.round(innerHeight * dpr);
}
addEventListener('resize', resize);
resize();

const GROUND = () => H * 0.84;
const HERO_X = () => W * CONFIG.heroX;
const ENEMY_X = () => W * CONFIG.enemyX;
const CAT_X = () => HERO_X() + 135;

// =====================================================================
//  え：かみの しろい ところを とうめいに する
// =====================================================================
const SPR = { hero: null, enemies: [], rares: [], boss: null, cat: null };

async function loadAll() {
  const IM = window.IMAGES || {};
  const [hero] = await Promise.all((IM[window.HERO_FOLDER || '主人公'] || []).slice(0, 1).map(loadImage));
  SPR.hero = hero || null;
  if (SPR.hero) {
    const url = SPR.hero.canvas.toDataURL();
    ['titleChara', 'upChara', 'downChara', 'clearHero'].forEach((id) => { $(id).src = url; });
  }
  SPR.enemies = (await Promise.all((IM['雑魚敵'] || []).map(loadImage))).filter(Boolean);
  SPR.rares = (await Promise.all((IM['レア敵'] || []).map(loadImage))).filter(Boolean);
  SPR.boss = (await Promise.all((IM['ボス'] || []).slice(0, 1).map(loadImage)))[0] || null;
  SPR.cat = (await Promise.all((IM['仲間'] || []).slice(0, 1).map(loadImage)))[0] || null;
  if (SPR.cat) $('clearCat').src = SPR.cat.canvas.toDataURL();
}

// =====================================================================
//  おと
// =====================================================================
let actx = null, soundOn = true;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { actx = null; } }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function note(freq, start, dur, { type = 'triangle', vol = 0.16, slide = 0, vib = 0 } = {}) {
  const a = audio(); if (!a || !soundOn) return;
  const t = a.currentTime + start;
  const o = a.createOscillator(), gn = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  if (vib) {
    const l = a.createOscillator(), lg = a.createGain();
    l.frequency.value = 7; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + .1);
  }
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn).connect(a.destination); o.start(t); o.stop(t + dur + .05);
}
function noise(start, dur, vol = 0.12, freq = 800) {
  const a = audio(); if (!a || !soundOn) return;
  const t = a.currentTime + start;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const gn = a.createGain();
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(gn).connect(a.destination); src.start(t);
}
const SFX = {
  step: () => note(520 + Math.random() * 80, 0, .06, { vol: .04, type: 'sine' }),
  encounter: () => [880, 660, 880, 1175].forEach((f, i) => note(f, i * .07, .1, { type: 'square', vol: .07 })),
  bossWarn: () => { for (let i = 0; i < 4; i++) { note(196, i * .38, .3, { type: 'sawtooth', vol: .07 }); note(185, i * .38 + .15, .2, { type: 'sawtooth', vol: .06 }); } },
  bossLand: () => { noise(0, .6, .3, 120); note(60, 0, .7, { type: 'sine', vol: .3, slide: .5 }); },
  key: () => note(900, 0, .05, { type: 'sine', vol: .08 }),
  good: () => { [784, 988, 1319].forEach((f, i) => note(f, i * .08, .2)); },
  fire: () => { noise(0, .45, .18, 700); note(200, 0, .35, { type: 'sawtooth', vol: .05, slide: 2 }); },
  water: () => { [700, 900, 1200].forEach((f, i) => note(f, i * .05, .12, { type: 'sine', vol: .1, slide: 1.6 })); noise(.25, .3, .08, 2500); },
  wind: () => { noise(0, .6, .15, 1500); note(500, 0, .5, { type: 'sine', vol: .04, slide: 2.5 }); },
  charge: (dur) => {
    note(180, 0, dur, { type: 'sine', vol: .12, slide: 6 });
    note(270, 0, dur, { type: 'triangle', vol: .05, slide: 6, vib: 10 });
    for (let i = 0; i < 10; i++) note(1200 + i * 150, i * dur / 10, .08, { type: 'sine', vol: .04 });
  },
  star: () => {
    [1047, 1319, 1568, 2093, 2637, 3136].forEach((f, i) => note(f, i * .06, .3, { type: 'sine', vol: .09 }));
    [523, 659, 784].forEach((f) => note(f, 0, .9, { vol: .08 }));
  },
  bad: () => { note(330, 0, .25, { type: 'square', vol: .07, slide: .5 }); note(247, .22, .35, { type: 'square', vol: .06, slide: .6 }); },
  roar: () => { noise(0, .8, .2, 300); note(110, 0, .8, { type: 'sawtooth', vol: .1, slide: .7, vib: 8 }); },
  breath: () => { noise(0, 1.1, .3, 500); noise(0, 1.1, .15, 1500); },
  poof: () => note(300, 0, .25, { type: 'sine', vol: .12, slide: 3 }),
  boom: () => { noise(0, 1.2, .35, 200); note(80, 0, 1, { type: 'sine', vol: .25, slide: .4 }); },
  meow: () => { note(650, 0, .16, { type: 'sine', vol: .14, slide: 1.5 }); note(950, .16, .3, { type: 'sine', vol: .14, slide: .65 }); },
  heal: () => [659, 784, 988, 1319].forEach((f, i) => note(f, i * .09, .25, { type: 'sine', vol: .12 })),
  levelUp: () => {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => note(f, i * .11, .22, { vol: .14 }));
    [1568, 2093, 2637].forEach((f, i) => note(f, .85 + i * .06, .3, { type: 'sine', vol: .06 }));
  },
  levelDown: () => {
    [392, 370, 349, 330, 311].forEach((f, i) => note(f, i * .28, .4, { type: 'sawtooth', vol: .05, vib: 6 }));
    note(98, .1, 1.6, { type: 'sine', vol: .18, vib: 3 });
    note(1400, 1.5, .5, { type: 'sine', vol: .04, slide: .3 }); // ひゅ〜
  },
};

// =====================================================================
//  ゲームの じょうたい
// =====================================================================
const S = {
  mode: 'title',      // title / walk（めいろ）/ riddle / bosswarn / encounter / question / answered / levelfx / nanmonOffer / clear
  level: CONFIG.startLevel,
  hp: CONFIG.maxHp,
  items: [],          // もっている アイテム（さいだい CONFIG.maxItems）
  churu: false,       // にゃんこの チュールを つかった（つぎの てきを にゃんこが たおす）
  stats: { answered: 0, correct: 0 }, // せいかいりつ よう
  nanmon: 'skip',     // なんもん：clear / fail / skip
  startedAt: 0,
  maze: null,         // めいろ（maze.js）
  castleX: null,      // ボスせんの うしろの おしろの いち
  catUsed: false,     // この ステージで にゃんこが かつやく したか
  hintNext: false,
  scroll: 0,
  sinceEnc: 0,
  walkPhase: 0,
  t: 0,
  phaseT: 0,
  q: null,
  input: '',
  digits: [],         // ひっさんで うった すうじ（[いち, じゅう]）
  vertical: false,    // いまの もんだいが ひっさんか
  monster: null,
  cat: null,
  charge: null,
  hero: { hurt: 0, jump: 0, dashX: 0 },
  heroSay: null,      // ちょなちゃんの ふきだし
  shake: 0,
  flash: 0, flashColor: '255,255,255',
  waitEnter: null,    // まちがえた あと Enter を まっている ときの つづき
  keyHeld: false,
  btnHeld: false,
};
const particles = [];
const spells = [];
const timers = [];
function later(sec, fn) { timers.push({ t: sec, fn }); }

function setMode(m) { S.mode = m; S.phaseT = 0; updateUI(); }

// =====================================================================
//  がめん（DOM）
// =====================================================================
const ghostSVG = (on) => `<svg viewBox="0 0 24 24" class="${on ? 'on' : ''}"><path d="M3 12 C3 3 21 3 21 12 L21 22 L17.5 19 L14 22 L10.5 19 L7 22 L3 19 Z" fill="${on ? '#8a5cd1' : '#eee4f2'}" stroke="#3a2a4d" stroke-width="1.6"/><circle cx="9" cy="11" r="1.8" fill="${on ? '#fff' : '#cbbfd6'}"/><circle cx="15" cy="11" r="1.8" fill="${on ? '#fff' : '#cbbfd6'}"/></svg>`;
const starSVG = (on) => `<svg viewBox="0 0 24 24" class="${on ? 'on' : ''}"><path d="M12 2 L14.9 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.1 8.6 Z" fill="${on ? '#ffd84a' : '#eee4f2'}" stroke="#3a2a4d" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

function renderHud() {
  $('lvnum').textContent = S.level;
  $('placeName').textContent = THEMES[S.level].place;
  if (typeof renderMazeHud === 'function') renderMazeHud(); // HP・アイテム（maze.js）
}

function updateUI() {
  const m = S.mode;
  $('title').hidden = m !== 'title';
  $('hud').hidden = m === 'title' || m === 'clear';
  $('clear').hidden = m !== 'clear';
  $('quiz').hidden = !(m === 'question' || m === 'answered');
  $('pad').hidden = m !== 'question';
  $('walkBtn').hidden = true;
  $('bossNotice').hidden = true;
  $('bossWarn').hidden = m !== 'bosswarn';
  if (m !== 'levelfx') { $('lvup').hidden = true; $('lvdown').hidden = true; }
  renderHud();
}

function renderAnswer() {
  const el = $('ans');
  el.textContent = S.input;
  el.className = 'ans' + (S.mode === 'question' && !S.vertical ? ' blink' : '');
  if (S.vertical) renderHissan('input');
}

// ---------------------------------------------------------------------
//  ひっさん：2けたいじょうの かずが でてくる もんだいは たてに ならべて、いちのくらいから うつ
//    3けたの たしざん・ひきざん（ネクロディウス）にも つかう。くらいは 0: いち 1: じゅう 2: ひゃく 3: せん
// ---------------------------------------------------------------------
const needsHissan = (q) => (q.op === '+' || q.op === '-') && (q.a >= 10 || q.b >= 10);
const PLACE_NAMES = ['いち', 'じゅう', 'ひゃく', 'せん'];
const PLACE_KEYS = ['o', 't', 'h', 's'];
const digitsOf = (n) => String(n).split('').reverse().map(Number); // [いち, じゅう, ひゃく …]

function hissanInfo(q) {
  const A = digitsOf(q.a), B = digitsOf(q.b), len = String(q.ans).length;
  const n = Math.max(A.length, B.length, len);
  const dA = (i) => A[i] || 0, dB = (i) => B[i] || 0;
  const carryIn = [], lend = [], borrows = [];
  if (q.op === '+') {
    let c = 0;
    for (let i = 0; i <= n; i++) { carryIn[i] = c; c = dA(i) + dB(i) + c >= 10 ? 1 : 0; }
  } else {
    let lent = 0;
    for (let i = 0; i < n; i++) { lend[i] = lent; borrows[i] = dA(i) - lent < dB(i); lent = borrows[i] ? 1 : 0; }
  }
  return {
    A, B, dA, dB, carryIn, lend, borrows, len, cols: Math.max(2, n),
    // むかしの なまえ（2けた）
    ta: dA(1), ua: dA(0), tb: dB(1), ub: dB(0),
    carry: !!carryIn[1], carry2: !!carryIn[2], borrow: !!borrows[0],
  };
}

// いま どこを けいさん するかの あんない
function hissanStep(q) {
  const h = hissanInfo(q), col = S.digits.length;
  if (col >= h.len) return 'できたら <b>Enter</b> で こたえよう！';
  const name = PLACE_NAMES[col], next = PLACE_NAMES[col + 1];
  const hasA = col < h.A.length, hasB = col < h.B.length;
  if (q.op === '+') {
    const terms = [];
    if (hasA) terms.push(h.dA(col));
    if (hasB) terms.push(h.dB(col));
    const cin = !!h.carryIn[col], cout = !!h.carryIn[col + 1];
    if (!terms.length) return `${name}のくらい：<br>くりあがりの <b>1</b> を そのまま おろそう`;
    if (cin) terms.push(1);
    if (terms.length === 1) return `${name}のくらい：${terms[0]} を そのまま おろそう`;
    if (col === 0) return `いちのくらい：<b>${terms.join('＋')}</b> は？` + (cout ? '<br>10を こえたら、いちのくらいには のこりを かくよ' : '');
    return (cin ? 'くりあがりの <b>1</b> を わすれずに！<br>' : '') + `${name}のくらい：<b>${terms.join('＋')}</b> は？`
      + (cout ? `<br>10を こえたら ${next}のくらいに 1 くりあがり` : '');
  }
  const a = h.dA(col), b = h.dB(col), lent = !!h.lend[col], top = a - (lent ? 1 : 0);
  if (lent && a === 0) { // 0 から かした ときは ひだりから かりて 10、1 かして 9
    return `${name}のくらいは 0 なので ${next}のくらいから 10 かりて、<br>1 かしたので <b>9−${b}</b> は？`;
  }
  const lentText = lent ? `10 かしたので ${a} → ${top}。<br>` : '';
  if (h.borrows[col]) return `${lentText}${top}から ${b}は ひけない！<br>${next}のくらいから 10 かりて <b>${top + 10}−${b}</b> は？`;
  if (hasB) return lentText + `${name}のくらい：<b>${top}−${b}</b> は？`;
  return lentText + `${name}のくらい：${top} を そのまま おろそう`;
}

// how: 'input'（うっている）/ 'good'（せいかい）/ 'reveal'（まちがい → こたえと けいさんの ながれを みせる）
function renderHissan(how) {
  const q = S.q, h = hissanInfo(q);
  const reveal = how === 'reveal', done = reveal || how === 'good';
  const col = S.digits.length; // つぎに うつ くらい
  const cell = (cls, text = '') => `<span class="${cls}">${text}</span>`;
  const box = (text) => `<span class="box${text !== '' ? ' on' : ''}">${text}</span>`;
  const now = (c) => (how === 'input' && col === c && col < h.len ? ' now' : '');
  const cur = (c) => (how === 'input' && col === c && col < h.len ? ' cur' : '');
  // ひだりから ならべる くらい（「十」「一」は ＋ − と にているので ひらがなで）
  const places = Array.from({ length: h.cols }, (_, k) => h.cols - 1 - k).map((i) => ({ k: PLACE_KEYS[i], i, label: PLACE_NAMES[i] }));
  // くりあがりの 1 は ひとつ みぎの くらいを うったら でる。くりさがりは さいしょから だす
  const memo = (i) => {
    if (q.op === '+') return h.carryIn[i] ? box(done || col >= i ? '1' : '') : '';
    const lent = h.lend[i], bor = h.borrows[i];
    if (bor && !lent) return box('10');
    if (lent && !bor) return box(String(h.dA(i) - 1));
    if (lent && bor) return box(String(h.dA(i) - 1 + 10));
    return '';
  };
  const ds = reveal ? String(q.ans).split('').reverse() : S.digits; // [いち, じゅう, ひゃく]
  const ansCls = 'ansc' + (done ? ' good' : '');

  let html = cell('hd') + places.map((p) => cell('hd ' + p.k, p.label)).join('');
  html += cell('memo') + places.map((p) => cell('memo ' + p.k, memo(p.i))).join('');
  html += cell('') + places.map((p) => cell(p.k + now(p.i) + (h.lend[p.i] ? ' struck' : ''), p.i < h.A.length ? h.A[p.i] : '')).join('');
  html += cell('op line', q.op === '+' ? '＋' : '−') + places.map((p) => cell(p.k + ' line' + now(p.i), p.i < h.B.length ? h.B[p.i] : '')).join('');
  html += cell(ansCls) + places.map((p) => cell(`${ansCls} ${p.k}${now(p.i)}${cur(p.i)}`, ds[p.i] || '')).join('');
  $('vgrid').style.gridTemplateColumns = `46px repeat(${h.cols}, ${h.cols > 3 ? 58 : 68}px)`;
  $('vgrid').innerHTML = html;

  let step = '';
  if (how === 'input') step = hissanStep(q);
  else if (reveal) {
    const notes = [];
    for (let i = 0; i < h.cols; i++) {
      const name = PLACE_NAMES[i], next = PLACE_NAMES[i + 1];
      if (q.op === '+' && h.carryIn[i + 1]) {
        const parts = [h.dA(i), h.dB(i)].concat(h.carryIn[i] ? [1] : []), sum = parts.reduce((x, y) => x + y, 0);
        notes.push(`${name}のくらい ${parts.join('＋')}＝${sum}。<b>${sum % 10}</b> を かいて、<b>1</b> を ${next}のくらいへ`);
      }
      if (q.op === '-' && h.borrows[i]) {
        const top = h.dA(i) - (h.lend[i] ? 1 : 0), b = h.dB(i);
        if (top < 0) notes.push(`${name}のくらい：0 なので ${next}のくらいから 10 かりて、1 かしたので 9−${b}＝<b>${9 - b}</b>`);
        else notes.push(`${name}のくらい：${top}から ${b}は ひけないので、10 かりて ${top + 10}−${b}＝<b>${top + 10 - b}</b>`);
      }
    }
    step = notes.join('<br>');
  }
  $('vstep').innerHTML = step;
}

// にゃんこの ヒント：10の まとまりと 1こずつの ブロック
function renderHint(q) {
  if (q.a >= 100 || q.b >= 100 || (q.op !== '+' && q.op !== '-')) { $('hint').hidden = true; return; } // ブロックで かぞえられる ときだけ
  const box = $('hintBlocks');
  box.innerHTML = '';
  const group = (n, cls, crossFrom = Infinity) => {
    const g = document.createElement('div'); g.className = 'hgroup';
    let i = 0;
    while (i < n) {
      const row = document.createElement('div'); row.className = 'hrow';
      const len = Math.min(10, n - i);
      for (let k = 0; k < len; k++, i++) {
        const c = document.createElement('span');
        c.className = 'hcell ' + cls + (i >= crossFrom ? ' cross' : '');
        row.appendChild(c);
      }
      g.appendChild(row);
    }
    return g;
  };
  if (q.op === '+') {
    const plus = document.createElement('span'); plus.className = 'hop'; plus.textContent = '＋';
    box.append(group(q.a, 'a'), plus, group(q.b, 'b'));
    $('hintLabel').textContent = 'にゃんこの ヒント：ぜんぶで いくつ？';
  } else {
    box.append(group(q.a, 'a', q.a - q.b));
    $('hintLabel').textContent = `にゃんこの ヒント：×の ${q.b}こを とると いくつ？`;
  }
  $('hint').hidden = false;
}

// =====================================================================
//  ながれ
// =====================================================================
function startGame() {
  audio();
  S.level = CONFIG.startLevel;
  S.items = []; S.churu = false;
  S.stats = { answered: 0, correct: 0 }; S.nanmon = 'skip';
  S.startedAt = Date.now();
  startStage();
  setMode('walk');
}

// ステージの さいしょ：あたらしい めいろ・HP まんたん（アイテムは そのまま）
function startStage() {
  S.hp = CONFIG.maxHp;
  S.catUsed = false; S.hintNext = false; S.castleX = null;
  buildStage(S.level); // maze.js
}

// たたかいの はじまり（めいろで てきに あった）。opts.boss / opts.rare
function encounter(opts = {}) {
  S.keyHeld = false; S.btnHeld = false;
  S.scroll = rnd(0, 5000); // たたかいの けしきを かえる
  if (opts.boss) {
    setMode('bosswarn');
    restartAnim($('bossWarn'));
    SFX.bossWarn();
    later(1.8, spawnBoss);
    return;
  }
  const rare = !!opts.rare && SPR.rares.length > 0;
  let spr = rare ? pick(SPR.rares) : SPR.enemies.length ? pick(SPR.enemies) : null;
  const pw = ENEMY_POWER[S.level];
  // しろい え は でる たびに いろちがい
  let tint = null;
  if (spr && spr.tint) { tint = pick(TINTS); spr = tintSprite(spr, tint.color); }
  S.monster = {
    boss: false, rare, spr, level: S.level, power: rare ? { ...pw, aura: 'rgba(255,215,60,.95)', filter: null } : pw,
    tintColor: tint ? tint.color : null,
    name: rare ? spr.name : pw.prefix + (tint ? tint.name + ' ' : '') + (spr ? spr.name : 'スライム'),
    height: (spr && spr.height ? spr.height : 180) * pw.scale,
    x: ENEMY_X(), y: -200, vy: 0, landed: false,
    state: 'enter', t: 0, alpha: 1, hp: 1, maxHp: 1, hitFlash: 0,
  };
  SFX.encounter();
  S.flash = 0.8; S.flashColor = rare ? '255,236,140' : '255,255,255';
  for (let i = 0; i < (rare ? 40 : 18); i++) spawn(rare ? 'rainbow' : 'star', ENEMY_X() + rnd(-80, 80), GROUND() - rnd(20, 160), { vx: rnd(-120, 120), vy: rnd(-220, -40), hue: rnd(0, 360) });
  setMode('encounter');
}

function spawnBoss() {
  const st = BOSS_STAGES[S.level];
  const spr = SPR.boss;
  S.castleX = S.scroll + ENEMY_X() + 30; // うしろに ドラゴンの おしろ
  S.monster = {
    boss: true, spr, level: S.level, stage: st,
    name: st.name || (spr ? spr.name : 'ドラゴン'),
    height: st.height,
    x: ENEMY_X(), y: -400, vy: 0, landed: false,
    state: 'enter', t: 0, alpha: 1, hp: CONFIG.bossHp, maxHp: CONFIG.bossHp, hitFlash: 0,
  };
  setMode('encounter');
}

// てきの なまえ：「」つきで ふとじ・いろつき（もんだいの うえに だす）
function enemyTag(m) {
  const color = m.boss ? '#c0306a' : m.rare ? '#c98a00' : m.tintColor ? shade(m.tintColor, -60) : '#e2588f';
  const safe = String(m.name).replace(/[<>&]/g, '');
  return `<b class="en-name" style="color:${color}">「${safe}」</b>`;
}

// つぎの せいかいで ボスを たおせるか（とどめの ひっさつわざ）。ステラクエストでは こうげきりょくで かわる
function isFinalBlow(m) { return !!m && m.boss && m.hp === 1; }

// てきが ついたら：チュールが あれば にゃんこが たおす、なければ もんだい
function startBattleTurn() {
  const m = S.monster;
  if (!m.boss && !m.nanmon && S.churu) { churuAttack(); return; }
  askQuestion();
}

function churuAttack() {
  const m = S.monster;
  S.churu = false; renderHud();
  catEnter(['まかせるにゃ！']);
  later(1.0, () => {
    catSay(['にゃんこ', 'パーンチ！']);
    SFX.meow(); SFX.boom();
    m.hitFlash = 1; S.shake = 0.6;
    for (let i = 0; i < 20; i++) spawn('star', m.x, GROUND() - m.height * 0.5, { vx: rnd(-300, 300), vy: rnd(-380, 40), color: '#ffb3e0' });
    m.state = 'hit'; m.t = 0;
  });
  later(2.8, () => { catLeave(); endBattle(); });
}

function askQuestion() {
  const m = S.monster;
  const finalBlow = isFinalBlow(m);
  S.q = m.nanmon ? makeNanmonQuestion() : (m.boss || m.rare) ? makeBossQuestion(S.level, finalBlow) : makeQuestion(S.level);
  S.input = '';
  S.digits = [];
  S.vertical = !S.q.nanmon && needsHissan(S.q);
  $('formulaH').classList.toggle('small', S.vertical); // ひっさんの ときも よこがきの しきを うえに
  $('vbox').hidden = !S.vertical;
  let label = m.nanmon ? 'でんせつの なんもん！ できるかな？' : `${enemyTag(m)} が あらわれた！`;
  if (m.boss && S.level >= CONFIG.maxLevel) label = `ボス ${enemyTag(m)}！ ${finalBlow ? 'とどめの 3けた もんだい！' : 'とくべつ もんだい'}`;
  else if (m.boss) label = `ボス ${enemyTag(m)}！（レベル ${S.level + 1} の もんだい）`;
  else if (m.rare) label = `レア ${enemyTag(m)} が あらわれた！（ボスと おなじ もんだい）`;
  $('monName').innerHTML = label;
  $('quiz').classList.toggle('boss', m.boss);
  $('qtext').textContent = S.q.text || `${S.q.a} ${S.q.op === '+' ? '＋' : '−'} ${S.q.b}`;
  $('qmsg').textContent = ''; $('qmsg').className = 'qmsg';
  $('nextBtn').hidden = true;
  if (S.hintNext) { S.hintNext = false; renderHint(S.q); } else $('hint').hidden = true;
  setMode('question');
  renderAnswer();
}

function typeDigit(k) {
  if (S.mode !== 'question') return;
  if (S.vertical) {
    // ひっさんは いちのくらい → じゅうのくらい の じゅんに うめる
    const { carryIn, len } = hissanInfo(S.q);
    if (S.digits.length >= len) return;
    S.digits.push(k);
    S.input = [...S.digits].reverse().join('');
    SFX.key();
    const n = S.digits.length;
    if (carryIn[n]) later(0.05, () => note(1320, 0, .15, { type: 'sine', vol: .1, slide: 1.5 })); // くりあがり ポン
    renderAnswer();
    return;
  }
  if (S.input.length >= 3) return;
  if (S.input === '0') S.input = '';
  S.input += k; SFX.key(); renderAnswer();
}
function eraseDigit() {
  if (S.mode !== 'question') return;
  if (S.vertical) {
    S.digits.pop();
    S.input = [...S.digits].reverse().join('');
  } else S.input = S.input.slice(0, -1);
  renderAnswer();
}

function submit() {
  if (S.mode !== 'question' || S.input === '') return;
  if (S.vertical && S.digits.length < hissanInfo(S.q).len) return; // ぜんぶの くらいを うってから
  const ok = Number(S.input) === S.q.ans;
  setMode('answered');
  const el = $('ans');
  if (ok) {
    el.className = 'ans good';
    if (S.vertical) renderHissan('good');
    resolveAnswer(true);
  } else {
    el.className = 'ans bad';
    el.innerHTML = `<s>${S.input}</s><span class="right">${S.q.ans}</span>`;
    if (S.vertical) renderHissan('reveal');
    resolveAnswer(false, S.vertical ? `おしい！ ${S.input} じゃなくて ${S.q.ans} だよ` : `おしい！ こたえは ${S.q.ans} だよ`);
  }
}

// こたえが あっていたか どうかで たたかいを すすめる（けいさん・かんじ きょうつう）
//   attackKinds: ふつうの こうげきの しゅるい（cast に わたす）
function resolveAnswer(ok, wrongMsg = '', attackKinds = ['fire', 'water', 'wind']) {
  const m = S.monster, msg = $('qmsg');
  if (m.nanmon) { nanmonResult(ok, wrongMsg); return; }
  S.stats.answered++;
  if (ok) S.stats.correct++;
  if (ok) {
    msg.textContent = pick(['せいかい！', 'すごい！', 'やったね！', 'てんさい！', 'ばっちり！']);
    msg.className = 'qmsg good';
    S.hero.jump = 1;
    SFX.good();
    if (isFinalBlow(m)) {
      // さいごの いちげき：ためてから ひっさつわざ
      // にゃんこが まだ かつやく してなければ かけつける。もう いれば いっしょに うつ
      const withCat = !!S.cat || (!S.catUsed && !!SPR.cat);
      if (S.cat) catSay(['いっしょに', 'いくにゃ！']);
      else if (withCat) { S.catUsed = true; catEnter(['いっしょに', 'いくにゃ！']); }
      later(0.4, () => startCharge(withCat));
    } else {
      later(0.25, () => cast(pick(attackKinds), onSpellHit));
    }
  } else {
    msg.textContent = wrongMsg;
    msg.className = 'qmsg bad';
    m.state = 'attack'; m.t = 0;
    SFX.bad();
    if (m.boss) { SFX.roar(); later(0.3, SFX.breath); }
    later(m.boss ? 0.7 : 0.3, damageHero); // HP が 1 へる（maze.js）
    // こたえを かくにん してから Enter で つぎへ
    later(m.boss ? 1.5 : 0.9, () => { S.waitEnter = onEnemyAttackDone; $('nextBtn').hidden = false; });
  }
}

function proceed() {
  if (!S.waitEnter) return;
  const fn = S.waitEnter;
  S.waitEnter = null;
  $('nextBtn').hidden = true;
  fn();
}

function onSpellHit() {
  const m = S.monster;
  if (!m.boss) {
    m.state = 'hit'; m.t = 0;
    later(CONFIG.afterCorrectWait, endBattle);
    return;
  }
  m.hp--;
  renderHud();
  if (m.hp > 0) {
    m.state = 'flinch'; m.t = 0;
    SFX.roar();
    later(CONFIG.afterCorrectWait, () => { m.state = 'idle'; askQuestion(); });
  } else {
    m.state = 'defeated'; m.t = 0;
    S.shake = 1; S.flash = 1; S.flashColor = '255,246,200';
    SFX.boom();
    const last = S.level >= CONFIG.maxLevel;
    later(3.2, () => { S.monster = null; catLeave(); if (last) offerNanmon(); else levelFx('up'); });
  }
}

function onEnemyAttackDone() {
  const m = S.monster;
  if (!m.boss) {
    m.state = 'flee'; m.t = 0;
    later(0.8, () => { if (S.hp <= 0) { S.monster = null; levelFx('lose'); } else endBattle(); });
    return;
  }
  m.state = 'idle';
  // ピンチ！ この ステージで まだなら にゃんこが たすけに くる
  if (!S.catUsed && SPR.cat) { catHelp(askQuestion); return; }
  if (S.hp > 0) { askQuestion(); return; }
  m.state = 'laugh'; m.t = 0;
  later(1.8, () => { S.monster = null; catLeave(); levelFx('lose'); });
}

function endBattle() {
  const wasRare = S.monster && S.monster.rare;
  S.monster = null; S.q = null; S.castleX = null;
  setMode('walk');
  if (wasRare) gotDragonScale(); // レアてきを たおしたら ドラゴンの うろこ（maze.js）
}

function levelFx(kind) {
  S.q = null;
  setMode('levelfx');
  if (kind === 'up') {
    S.level = Math.min(CONFIG.maxLevel, S.level + 1);
    S.items = S.items.filter((id) => id !== 'scale'); // ドラゴンの うろこは つぎの ステージで きえる
    startStage();
    $('upTitle').innerHTML = 'レベル<br>アップ！';
    $('upSub').textContent = `レベル ${S.level}「${THEMES[S.level].place}」へ！`;
    restartAnim($('lvup'));
    SFX.levelUp();
    for (let i = 0; i < 90; i++) {
      spawn(Math.random() < 0.5 ? 'heart' : 'confetti', W / 2 + rnd(-60, 60), H * 0.45, { vx: rnd(-420, 420), vy: rnd(-520, -120) });
    }
  } else {
    $('downTitle').innerHTML = 'HP が<br>0 に…';
    $('downSub').textContent = `「${THEMES[S.level].place}」の さいしょから やりなおし！ がんばれ！`;
    startStage();
    restartAnim($('lvdown'));
    SFX.levelDown();
    for (let i = 0; i < 12; i++) spawn('bat', i % 2 ? W + 100 : -100, rnd(60, H * 0.6), { vx: i % 2 ? -rnd(120, 260) : rnd(120, 260), vy: rnd(-30, 30), delay: i * 0.12 });
  }
  renderHud();
  later(kind === 'up' ? 3.4 : 3.8, () => { if (S.mode === 'levelfx') setMode('walk'); });
}

// ---------------------------------------------------------------------
//  なんもん：さいごの ボスの あとに ちょうせん できる とくべつ もんだい
// ---------------------------------------------------------------------
// けいさんの なんもん：3つの かずの たしひき（ひっさん なし）。かんじ・おんがくは それぞれの js で うわがき
function makeNanmonQuestion() {
  let a, b, c, ans;
  do { a = rnd(21, 59); b = rnd(21, 49); c = rnd(11, 39); ans = a + b - c; } while (ans < 10 || ans > 99);
  return { a, b, c, op: '+', ans, nanmon: true, text: `${a} ＋ ${b} − ${c}` };
}

function offerNanmon() {
  S.q = null;
  setMode('nanmonOffer');
}

function startNanmon() {
  S.scroll = rnd(0, 5000);
  S.monster = {
    nanmon: true, boss: false, spr: null, level: S.level, name: 'でんせつの たからばこ', height: 150,
    x: ENEMY_X(), y: -200, vy: 0, landed: false, state: 'enter', t: 0, alpha: 1, hp: 1, maxHp: 1, hitFlash: 0,
  };
  SFX.encounter();
  setMode('encounter');
}

function nanmonResult(ok, wrongMsg) {
  const m = S.monster, msg = $('qmsg');
  S.nanmon = ok ? 'clear' : 'fail';
  m.state = ok ? 'open' : 'sealed'; m.t = 0;
  if (ok) {
    msg.textContent = 'すごい！ なんもん クリア！ でんせつの ゆうしゃだ！'; msg.className = 'qmsg good';
    S.hero.jump = 1; SFX.levelUp(); S.flash = 0.8; S.flashColor = '255,240,180';
    for (let i = 0; i < 60; i++) spawn(i % 2 ? 'rainbow' : 'star', m.x, GROUND() - 80, { vx: rnd(-420, 420), vy: rnd(-520, -60), hue: rnd(0, 360) });
  } else {
    msg.textContent = wrongMsg + '（ざんねん！ また ちょうせん してね）'; msg.className = 'qmsg bad';
    SFX.bad();
  }
  later(1.2, () => { S.waitEnter = () => { S.monster = null; gameClear(); }; $('nextBtn').hidden = false; });
}

// ---------------------------------------------------------------------
//  ゲームクリア：クリア じかんで ランキング（この パソコンの ブラウザに きろく）
// ---------------------------------------------------------------------
const RECORD_KEY = window.RECORD_KEY || 'chona-sansu:records';
function loadRecords() { try { return JSON.parse(localStorage.getItem(RECORD_KEY)) || []; } catch { return []; } }
function saveRecords(list) { try { localStorage.setItem(RECORD_KEY, JSON.stringify(list.slice(0, 50))); } catch { /* ほぞん できなくても あそべる */ } }
const faster = (a, b) => a.seconds - b.seconds;
const fmtTime = (sec) => `${Math.floor(sec / 60)}ふん ${String(sec % 60).padStart(2, '0')}びょう`;
const NANMON_LABEL = { clear: '◎ クリア！', fail: '× ざんねん', skip: 'ちょうせん なし' };

function gameClear() {
  S.q = null;
  const seconds = Math.round((Date.now() - (S.startedAt || Date.now())) / 1000);
  const accuracy = S.stats.answered ? Math.round(S.stats.correct / S.stats.answered * 100) : 100;
  const now = new Date();
  const mine = { seconds, accuracy, nanmon: S.nanmon, date: `${now.getMonth() + 1}/${now.getDate()}`, id: now.getTime() };
  const prev = loadRecords().filter((r) => typeof r.seconds === 'number');
  const bestBefore = prev.length ? [...prev].sort(faster)[0] : null;
  const list = [...prev, mine].sort(faster);
  saveRecords(list);
  const rank = list.findIndex((r) => r.id === mine.id) + 1;

  setMode('clear');
  document.querySelector('#clear .clear-stats').innerHTML = `
    <div>クリア じかん<b>${fmtTime(seconds)}</b></div>
    <div>せいかいりつ<b>${accuracy}<small>%</small></b></div>
    <div>なんもん<b class="nm ${S.nanmon}">${NANMON_LABEL[S.nanmon]}</b></div>`;
  const lines = [];
  if (S.nanmon === 'clear' && accuracy === 100) lines.push('<b class="perfect">パーフェクト！ でんせつの ゆうしゃ！</b>');
  lines.push(`これまで ${list.length}かい クリアした なかで <b>${rank}ばんめ</b> に はやい！`);
  if (bestBefore && seconds < bestBefore.seconds) lines.push('<b>じこベスト こうしん！</b>');
  $('clearRank').innerHTML = lines.join('<br>');
  document.querySelector('#clear .rank-head').textContent = 'ランキング（クリア じかんが はやい じゅん）';
  $('rankList').innerHTML = list.slice(0, 5).map((r, i) =>
    `<li class="${r.id === mine.id ? 'me' : ''}"><span class="no">${i + 1}い</span><span><b>${fmtTime(r.seconds)}</b></span><span class="sub">${r.accuracy ?? '-'}%${r.nanmon === 'clear' ? '・なんもん◎' : ''}・${r.date}</span></li>`).join('');
  restartAnim($('clear'));
  SFX.levelUp();
  later(1.2, SFX.levelUp);
  for (let i = 0; i < 140; i++) spawn(Math.random() < 0.5 ? 'heart' : 'confetti', rnd(0, W), -20, { vx: rnd(-120, 120), vy: rnd(0, 200), delay: i * 0.03 });
}

function restartAnim(el) {
  el.hidden = false;
  el.querySelectorAll('*').forEach((c) => { c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; });
}

// =====================================================================
//  にゃんこ（おたすけ キャラ）
// =====================================================================
function catEnter(lines) {
  S.cat = { state: 'in', t: 0, x: -120, say: { lines, t: 0 } };
  SFX.meow();
}
function catSay(lines) { if (S.cat) S.cat.say = { lines, t: 0 }; }
function catLeave() { if (S.cat) { S.cat.state = 'out'; S.cat.t = 0; S.cat.say = null; } }

function catHelp(next) {
  S.catUsed = true;
  catEnter(['たすけに', 'きたにゃ！']);
  later(1.4, () => {
    S.hp = Math.min(CONFIG.maxHp, S.hp + 1);
    renderHud();
    SFX.heal();
    for (let i = 0; i < 16; i++) spawn('heart', HERO_X() + rnd(-40, 40), GROUND() - rnd(60, 200), { vx: rnd(-80, 80), vy: rnd(-260, -80), color: '#ff6fa8' });
    catSay(['ハート かいふく！', 'ヒントも だすにゃ']);
    S.hintNext = true;
  });
  later(3.6, () => { if (S.cat) S.cat.say = null; next(); });
}

function drawCat() {
  const c = S.cat; if (!c) return;
  const gy = GROUND(), target = CAT_X();
  if (c.state === 'in') {
    const k = Math.min(1, c.t / 0.8);
    c.x = -120 + (target + 120) * k;
    c.y = gy - Math.sin(k * Math.PI) * 140;
    if (k >= 1) c.state = 'stay';
  } else if (c.state === 'stay') {
    c.x = target; c.y = gy - Math.abs(Math.sin(S.t * 4)) * 6;
  } else { // ぴょんと はねて ひだりへ かえる
    c.y = gy - Math.sin(Math.min(1, c.t / 0.7) * Math.PI) * 120;
    c.x = target - c.t * 700;
    if (c.x < -200) { S.cat = null; return; }
  }
  const spr = SPR.cat; if (!spr) return;
  const h = spr.height || 115, w = h * spr.w / spr.h;
  ctx.fillStyle = 'rgba(40,20,60,.18)';
  ctx.beginPath(); ctx.ellipse(c.x, gy + 8, w * 0.4, 8, 0, 0, 7); ctx.fill();
  ctx.save();
  if (S.charge) { ctx.shadowColor = 'rgba(255,220,80,.95)'; ctx.shadowBlur = 25; }
  ctx.drawImage(spr.canvas, c.x - w / 2, c.y + 8 - h, w, h);
  ctx.restore();
  if (c.say) drawSpeech(c.say.lines, { cx: c.x, bottom: c.y - h - 18, tailTo: { x: c.x, y: c.y - h + 4 }, color: '#e0408a', size: 22 });
}

// =====================================================================
//  まほう
// =====================================================================
function staffTip() { return { x: HERO_X() + 70, y: GROUND() - 170 }; }
function enemyCenter() {
  const m = S.monster;
  return { x: m.x, y: GROUND() - m.height * 0.5 };
}

function startCharge(withCat) {
  S.charge = { t: 0, dur: CONFIG.starCharge, withCat };
  S.heroSay = { lines: ['ちからを', 'ためて…'], color: '#8a5cd1', t: 0, dur: CONFIG.starCharge };
  SFX.charge(CONFIG.starCharge);
}

function cast(kind, onHit) {
  const from = staffTip(), to = enemyCenter();
  const sp = SPELLS[kind];
  S.heroSay = { lines: sp.lines, color: sp.color, t: 0, dur: 1.6 };
  SFX[kind === 'double' ? 'star' : kind]();
  if (kind === 'star' || kind === 'double') {
    S.flash = 0.8; S.flashColor = '255,240,180';
    S.shake = 0.4;
    const origins = [from];
    if (kind === 'double' && S.cat) origins.push({ x: S.cat.x, y: GROUND() - 80 });
    const n = kind === 'double' ? 14 : 10;
    for (let i = 0; i < n; i++) {
      const o = origins[i % origins.length];
      spells.push({
        kind: 'star', sx: o.x, sy: o.y, tx: to.x + rnd(-40, 40), ty: to.y + rnd(-60, 60),
        t: -i * 0.08, dur: 0.6, arc: rnd(-220, 160), size: 28 + rnd(0, 16),
        hue: (i * 37) % 360, onHit: i === n - 1 ? onHit : null,
      });
    }
    for (let i = 0; i < 50; i++) spawn('rainbow', from.x, from.y, { vx: rnd(-320, 320), vy: rnd(-420, 100), hue: rnd(0, 360) });
    return;
  }
  spells.push({ kind, sx: from.x, sy: from.y, tx: to.x, ty: to.y, t: 0, dur: 0.55, arc: kind === 'wind' ? 0 : 70, size: 26, onHit });
}

function stepCharge(dt) {
  const c = S.charge; if (!c) return;
  c.t += dt;
  const tip = staffTip();
  // まわりから ひかりが あつまる
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2, r = rnd(110, 200);
    spawn('converge', tip.x + Math.cos(a) * r, tip.y + Math.sin(a) * r, { tx: tip.x, ty: tip.y, hue: rnd(0, 360) });
  }
  if (c.withCat && S.cat && Math.random() < 0.5) {
    const a = Math.random() * Math.PI * 2;
    spawn('converge', S.cat.x + Math.cos(a) * 120, GROUND() - 70 + Math.sin(a) * 120, { tx: S.cat.x, ty: GROUND() - 70, hue: rnd(0, 360) });
  }
  if (c.t >= c.dur) {
    S.charge = null;
    cast(c.withCat ? 'double' : 'star', onSpellHit);
  }
}

function drawCharge() {
  const c = S.charge; if (!c) return;
  const k = Math.min(1, c.t / c.dur);
  const gy = GROUND(), hx = HERO_X();
  // あしもとの まほうじん
  ctx.save();
  ctx.translate(hx, gy + 14);
  ctx.scale(1, 0.32);
  ctx.globalAlpha = 0.5 + 0.5 * k;
  ctx.strokeStyle = `hsl(${(S.t * 120) % 360},100%,70%)`;
  ctx.lineWidth = 6;
  const r = 90 + k * 40;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, 7); ctx.stroke();
  ctx.rotate(S.t * 2);
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; ctx.lineTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75); }
  ctx.stroke();
  ctx.restore();
  // つえの さきで ほしが おおきく なる
  const tip = staffTip();
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(S.t * 5);
  glow('#fff3a0', 30 + k * 70);
  drawStar(0, 0, 8 + k * 30 + Math.sin(S.t * 30) * 2, `hsl(${(S.t * 300) % 360},95%,65%)`);
  drawStar(0, 0, 4 + k * 14, '#fffbe0');
  ctx.restore();
  // がめんを すこし くらく
  ctx.fillStyle = `rgba(30,10,60,${0.25 * k})`;
  ctx.fillRect(-30, -30, W + 60, H + 60);
}

function stepSpells(dt) {
  for (let i = spells.length - 1; i >= 0; i--) {
    const s = spells[i];
    s.t += dt;
    if (s.t < 0) continue;
    const k = Math.min(1, s.t / s.dur);
    s.x = s.sx + (s.tx - s.sx) * k;
    s.y = s.sy + (s.ty - s.sy) * k - Math.sin(k * Math.PI) * s.arc + (s.kind === 'wind' ? Math.sin(k * 14) * 18 : 0);
    if (s.kind === 'fire') { for (let j = 0; j < 3; j++) spawn('ember', s.x, s.y, { vx: rnd(-60, 30), vy: rnd(-90, -20) }); }
    if (s.kind === 'water' && Math.random() < 0.7) spawn('drop', s.x, s.y, { vx: rnd(-60, 0), vy: rnd(-40, 40) });
    if (s.kind === 'wind' && Math.random() < 0.5) spawn('leaf', s.x, s.y, { vx: rnd(-120, -20), vy: rnd(-80, 80) });
    if (s.kind === 'star') spawn('rainbow', s.x, s.y, { vx: rnd(-40, 40), vy: rnd(-40, 40), hue: (s.hue + s.t * 400) % 360 });
    if (k >= 1) {
      impact(s);
      spells.splice(i, 1);
      if (s.onHit) s.onHit();
    }
  }
}

function impact(s) {
  const { x, y } = s;
  if (s.kind === 'fire') {
    for (let i = 0; i < 26; i++) spawn('ember', x, y, { vx: rnd(-260, 260), vy: rnd(-300, 120), size: rnd(8, 16) });
    S.flash = 0.35; S.flashColor = '255,140,90';
  } else if (s.kind === 'water') {
    for (let i = 0; i < 26; i++) spawn('drop', x, y, { vx: rnd(-260, 260), vy: rnd(-360, 60), size: rnd(5, 10) });
    S.flash = 0.3; S.flashColor = '140,200,255';
  } else if (s.kind === 'wind') {
    for (let i = 0; i < 20; i++) spawn('leaf', x, y, { vx: rnd(-280, 280), vy: rnd(-300, 80) });
    spawn('swirl', x, y, {});
    S.flash = 0.25; S.flashColor = '170,255,190';
  } else {
    for (let i = 0; i < 14; i++) spawn('rainbow', x, y, { vx: rnd(-420, 420), vy: rnd(-460, 120), hue: rnd(0, 360) });
    for (let i = 0; i < 6; i++) spawn('star', x, y, { vx: rnd(-300, 300), vy: rnd(-400, -60), size: rnd(14, 24), color: '#fff2a0' });
    S.shake = Math.max(S.shake, 0.5);
  }
  if (S.monster) S.monster.hitFlash = 1;
}

function drawSpells() {
  for (const s of spells) {
    if (s.t < 0 || s.x === undefined) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.kind === 'fire') {
      const fl = 1 + Math.sin(S.t * 50) * 0.1;
      glow('#ff6a2a', 44 * fl);
      ctx.fillStyle = '#ff3b2f'; blob(26 * fl);
      ctx.fillStyle = '#ffa53a'; blob(17 * fl);
      ctx.fillStyle = '#fff1a6'; blob(8 * fl);
    } else if (s.kind === 'water') {
      glow('#55a8ff', 40);
      ctx.fillStyle = '#2f7dff'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill();
      ctx.fillStyle = '#9fd4ff'; ctx.beginPath(); ctx.arc(-4, -3, 14, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(-8, -9, 6, 4, -0.6, 0, 7); ctx.fill();
    } else if (s.kind === 'wind') {
      glow('#5fe08a', 40);
      ctx.rotate(S.t * 18);
      ctx.strokeStyle = '#2fbf65'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.arc(0, 0, 22, 0, 2.2); ctx.stroke(); }
      ctx.strokeStyle = '#c9ffd9'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, 4); ctx.stroke();
    } else {
      ctx.rotate(s.t * 8);
      glow(`hsl(${s.hue},100%,70%)`, s.size * 2.2);
      drawStar(0, 0, s.size, `hsl(${(s.hue + S.t * 300) % 360},95%,62%)`);
      drawStar(0, 0, s.size * 0.55, '#fffbe0');
    }
    ctx.restore();
  }
}

function glow(color, r) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha *= 0.55; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.globalAlpha /= 0.55;
}
function blob(r) {
  ctx.beginPath();
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 6) {
    const rr = r * (1 + 0.18 * Math.sin(a * 3 + S.t * 30));
    ctx.lineTo(Math.cos(a) * rr * 1.15, Math.sin(a) * rr);
  }
  ctx.fill();
}

// =====================================================================
//  つぶつぶ（エフェクト）
// =====================================================================
const LIFE = { bat: 4, puff: 0.7, ember: 0.5, drop: 0.7, leaf: 0.9, swirl: 0.6, rainbow: 1.0, flame: 0.7, converge: 0.45, twinkle: 0.9, bflame: 0.75, dark: 1.3 };
function spawn(type, x, y, o = {}) {
  particles.push({
    back: !!o.back, // true は ボスの うしろに えがく
    type, x, y, sx: x, sy: y, tx: o.tx, ty: o.ty, vx: o.vx || 0, vy: o.vy || 0,
    life: 0, max: LIFE[type] || 1.6,
    delay: o.delay || 0, rot: Math.random() * 6, vr: rnd(-6, 6),
    color: o.color || pick(['#ff8fbf', '#ffd84a', '#7fd6ff', '#9be38a', '#c9a2ff']),
    size: o.size || rnd(8, 16), hue: o.hue || 0,
  });
}

const GRAVITY = { confetti: 260, heart: 320, star: 380, ember: -60, drop: 600, leaf: 120, rainbow: 160, puff: 0, swirl: 0, flame: -120, twinkle: 0, bflame: -80, dark: -20 };
function stepParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.delay > 0) { p.delay -= dt; continue; }
    p.life += dt;
    if (p.type === 'bat') {
      p.x += p.vx * dt; p.y += p.vy * dt + Math.sin(p.life * 6) * 1.5;
    } else if (p.type === 'converge') {
      const k = Math.min(1, p.life / p.max), e = k * k;
      p.x = p.sx + (p.tx - p.sx) * e; p.y = p.sy + (p.ty - p.sy) * e;
    } else {
      p.vy += (GRAVITY[p.type] ?? 380) * dt;
      p.vx *= 0.99;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    if (p.life >= p.max) particles.splice(i, 1);
  }
}

function drawStar(x, y, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}
function drawHeart(x, y, s, color) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.4, x, y + s * 0.35);
  ctx.fillStyle = color; ctx.fill();
}

function drawParticles(back = false) {
  for (const p of particles) {
    if (p.delay > 0 || p.back !== back) continue;
    const fade = 1 - p.life / p.max;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p.type === 'bat' ? 1 : fade * 1.4));
    ctx.translate(p.x, p.y); ctx.rotate(p.type === 'bat' ? 0 : p.rot);
    switch (p.type) {
      case 'star': drawStar(0, 0, p.size, p.color); break;
      case 'twinkle': { // キラッ（4つの ひかり）
        const k = Math.sin((1 - fade) * Math.PI), r = p.size * k;
        if (r <= 0.5) break;
        ctx.globalAlpha = Math.min(1, k * 1.3); ctx.rotate(-p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -r); ctx.quadraticCurveTo(0, 0, r, 0); ctx.quadraticCurveTo(0, 0, 0, r);
        ctx.quadraticCurveTo(0, 0, -r, 0); ctx.quadraticCurveTo(0, 0, 0, -r);
        ctx.fill();
        break;
      }
      case 'bflame': { // メラメラ
        ctx.rotate(-p.rot);
        ctx.globalCompositeOperation = 'lighter';
        const r = p.size * (0.4 + 0.6 * fade);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.moveTo(0, -r * 2.2); ctx.quadraticCurveTo(r, -r * 0.4, 0, r); ctx.quadraticCurveTo(-r, -r * 0.4, 0, -r * 2.2); ctx.fill();
        break;
      }
      case 'dark': { // やみの オーラ
        ctx.globalAlpha = Math.max(0, fade * 0.75);
        const r = p.size * (1.6 - fade * 0.6);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, 'rgba(30,0,50,.95)'); g.addColorStop(0.6, 'rgba(90,20,150,.6)'); g.addColorStop(1, 'rgba(90,20,150,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
        break;
      }
      case 'rainbow': drawStar(0, 0, p.size * 0.8, `hsl(${p.hue},95%,65%)`); break;
      case 'converge': ctx.globalAlpha = 1; drawStar(0, 0, 4 + fade * 6, `hsl(${p.hue},100%,75%)`); break;
      case 'heart': drawHeart(0, 0, p.size * 1.3, p.color); break;
      case 'confetti': ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); break;
      case 'puff': ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 10 + (1 - fade) * 18, 0, 7); ctx.fill(); break;
      case 'ember': ctx.fillStyle = fade > 0.5 ? '#ffb13a' : '#ff4b3a'; ctx.beginPath(); ctx.arc(0, 0, p.size * 0.6 * fade + 2, 0, 7); ctx.fill(); break;
      case 'flame': {
        const r = 8 + (1 - fade) * 34;
        ctx.fillStyle = fade > 0.7 ? '#fff3a0' : fade > 0.4 ? '#ff9f2e' : '#ff3b2f';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
        break;
      }
      case 'drop': ctx.fillStyle = '#5aa9ff'; ctx.beginPath(); ctx.ellipse(0, 0, p.size * 0.5, p.size * 0.75, 0, 0, 7); ctx.fill(); break;
      case 'leaf': ctx.fillStyle = '#3cc46e'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#1f8a48'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke(); break;
      case 'swirl': {
        ctx.strokeStyle = 'rgba(95,224,138,.9)'; ctx.lineWidth = 5;
        const r = 20 + (1 - fade) * 70;
        for (let k = 0; k < 3; k++) {
          const rr = r - k * 14;
          if (rr <= 1) continue; // はんけいが マイナスだと エラーで とまる
          ctx.beginPath(); ctx.arc(0, 0, rr, k, k + 3.5); ctx.stroke();
        }
        break;
      }
      case 'bat': {
        const flap = Math.sin(p.life * 22) * 10;
        ctx.scale(p.vx < 0 ? -1 : 1, 1);
        ctx.fillStyle = '#2a1840';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-14, -12 - flap, -30, -4 - flap);
        ctx.quadraticCurveTo(-20, 0, -16, 6); ctx.quadraticCurveTo(-8, 2, 0, 8);
        ctx.quadraticCurveTo(8, 2, 16, 6); ctx.quadraticCurveTo(20, 0, 30, -4 - flap);
        ctx.quadraticCurveTo(14, -12 - flap, 0, 0);
        ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
        ctx.fillStyle = '#ff6fa8'; ctx.beginPath(); ctx.arc(-3, -1, 1.8, 0, 7); ctx.arc(3, -1, 1.8, 0, 7); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
}

// =====================================================================
//  けしき
// =====================================================================
function hash(i) { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

function drawWorld() {
  const th = THEMES[S.level], gy = GROUND(), sc = S.scroll;
  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(-30, -30, W + 60, H + 60);

  if (sceneLv() >= 5) { // よるの ステージは ほし
    for (let i = 0; i < 50; i++) {
      const x = ((hash(i) * W * 1.5 - sc * 0.05) % (W + 20) + W + 20) % (W + 20) - 10;
      ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(S.t * 1.5 + i));
      drawStar(x, hash(i + 99) * gy * 0.6, 2 + hash(i + 7) * 3, '#fff7c2');
    }
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = sceneLv() >= 5 ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.9)';
  tiles(sc * 0.15, 320, (x, i) => {
    const y = 50 + hash(i) * 110, s = 0.7 + hash(i + 3) * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, 26 * s, 0, 7); ctx.arc(x + 30 * s, y - 12 * s, 32 * s, 0, 7); ctx.arc(x + 64 * s, y, 24 * s, 0, 7);
    ctx.fill();
  });

  ctx.fillStyle = th.far;
  ctx.beginPath(); ctx.moveTo(-30, gy);
  for (let x = -30; x <= W + 40; x += 20) {
    const wx = x + sc * 0.3;
    ctx.lineTo(x, gy - 110 - Math.sin(wx / 160) * 30 - Math.sin(wx / 63) * 12);
  }
  ctx.lineTo(W + 40, gy); ctx.fill();

  ctx.fillStyle = th.near;
  ctx.beginPath(); ctx.moveTo(-30, gy);
  for (let x = -30; x <= W + 40; x += 20) {
    const wx = x + sc * 0.55;
    ctx.lineTo(x, gy - 55 - Math.sin(wx / 120) * 22);
  }
  ctx.lineTo(W + 40, gy); ctx.fill();

  tiles(sc * 0.8, 230, (x, i) => {
    if (hash(i + 50) < 0.35) return;
    drawProp(x, gy - 6, i);
  });

  if (S.castleX !== null) drawCastle(S.castleX - sc, gy - 4, BOSS_STAGES[S.level], S.level >= CONFIG.maxLevel);

  ctx.fillStyle = th.ground; ctx.fillRect(-30, gy - 8, W + 60, H - gy + 40);
  ctx.fillStyle = th.path; ctx.fillRect(-30, gy + 14, W + 60, 34);
  ctx.fillStyle = 'rgba(0,0,0,.06)';
  tiles(sc, 70, (x, i) => { ctx.beginPath(); ctx.ellipse(x, gy + 31, 10 + hash(i) * 8, 4, 0, 0, 7); ctx.fill(); });

  tiles(sc, 46, (x, i) => {
    const y = gy + (hash(i + 1) < 0.5 ? 0 : 62) + hash(i + 2) * 8;
    ctx.fillStyle = th.accent[Math.floor(hash(i + 3) * th.accent.length)];
    for (let k = 0; k < 5; k++) { const a = k * 1.2566; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
  });

  // ボスせんは すこし くらく
  if (S.monster && S.monster.boss && S.monster.state !== 'defeated') {
    ctx.fillStyle = 'rgba(40,10,60,.28)'; ctx.fillRect(-30, -30, W + 60, H + 60);
  }
}

// '#rrggbb' を あかるく（＋）/ くらく（−）する
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

// ドラゴンの おしろ（ボスの まえに みえてくる）。さいごの まちは おおきくて くらい
function drawCastle(cx, gy, st, final) {
  if (cx < -400 || cx > W + 400) return;
  const s = final ? 1.25 : 1;
  const wall = st.castle, dark = shade(wall, -40);
  const roof = final ? '#5a1030' : '#c0405a';
  const win = final ? '#ff3b5c' : '#ffe27a';
  ctx.save();
  ctx.translate(cx, gy);
  ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = INK;
  if (final) { ctx.shadowColor = 'rgba(150,40,255,.9)'; ctx.shadowBlur = 30 + Math.sin(S.t * 3) * 10; }
  // とう（りょうがわ）と ほんたい
  const towers = [[-170, 300], [170, 300], [-85, 250], [85, 250]];
  towers.forEach(([x, h]) => {
    ctx.fillStyle = Math.abs(x) > 100 ? wall : dark;
    ctx.fillRect(x - 32, -h, 64, h); ctx.strokeRect(x - 32, -h, 64, h);
    ctx.fillStyle = roof;
    ctx.beginPath(); ctx.moveTo(x - 42, -h); ctx.lineTo(x, -h - 80); ctx.lineTo(x + 42, -h); ctx.closePath(); ctx.fill(); ctx.stroke();
    // はた（ドラゴンの いろ）
    ctx.beginPath(); ctx.moveTo(x, -h - 80); ctx.lineTo(x, -h - 112); ctx.stroke();
    ctx.fillStyle = final ? '#7a1fd0' : '#ff7a3a';
    const wave = Math.sin(S.t * 6 + x) * 4;
    ctx.beginPath(); ctx.moveTo(x, -h - 112); ctx.lineTo(x + 30, -h - 104 + wave); ctx.lineTo(x, -h - 94); ctx.closePath(); ctx.fill();
    ctx.fillStyle = win;
    ctx.beginPath(); ctx.ellipse(x, -h + 50, 9, 14, 0, 0, 7); ctx.fill();
  });
  ctx.shadowBlur = 0;
  ctx.fillStyle = wall;
  ctx.fillRect(-140, -190, 280, 190); ctx.strokeRect(-140, -190, 280, 190);
  ctx.fillStyle = wall;
  for (let i = 0; i < 7; i++) { ctx.fillRect(-140 + i * 42, -212, 26, 24); ctx.strokeRect(-140 + i * 42, -212, 26, 24); }
  // もん
  ctx.fillStyle = '#1e1230';
  ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(-50, -80); ctx.arc(0, -80, 50, Math.PI, 0); ctx.lineTo(50, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  // もんの うえの ドラゴンの マーク
  ctx.fillStyle = final ? '#c040ff' : '#ff9a3a';
  ctx.beginPath(); ctx.arc(0, -158, 18, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(-6, -160, 3, 5, 0, 0, 7); ctx.ellipse(6, -160, 3, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = win;
  [[-100, -120], [100, -120]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x, y, 11, 17, 0, 0, 7); ctx.fill(); });
  ctx.restore();
}

// ボスの まわりの えんしゅつ（キラキラ → メラメラ → やみの オーラ）
function bossAura(m, dt) {
  const st = m.stage, gy = GROUND(), h = m.height, w = h * 0.9;
  const rate = (n) => Math.random() < n * dt;
  if (st.sparkle) {
    const n = 3 + sceneLv() * 3;
    for (let k = 0; k < 3; k++) if (rate(n / 3)) spawn('twinkle', m.x + rnd(-w * 0.7, w * 0.7), gy - rnd(0, h * 1.15), { color: pick(st.sparkle), size: rnd(6, 13) });
  }
  if (st.flame) {
    const n = sceneLv() * 9;
    for (let k = 0; k < 4; k++) if (rate(n / 4)) {
      const side = Math.random() < 0.5 ? -1 : 1;
      spawn('bflame', m.x + side * rnd(w * 0.25, w * 0.6), gy + 4 - rnd(0, h * 0.5), { color: pick(st.flame), vx: rnd(-20, 20), vy: rnd(-140, -60), size: rnd(10, 20), back: true });
    }
  }
  if (st.dark) {
    for (let k = 0; k < 5; k++) if (rate(14)) {
      spawn('dark', m.x + rnd(-w * 0.65, w * 0.65), gy - rnd(-10, h * 0.9), { vx: rnd(-25, 25), vy: rnd(-90, -30), size: rnd(14, 30), back: true });
    }
    if (rate(4)) spawn('twinkle', m.x + rnd(-w * 0.7, w * 0.7), gy - rnd(0, h * 1.1), { color: pick(['#c070ff', '#ff4b8a', '#ffffff']), size: rnd(6, 12) });
    if (rate(0.35)) { S.flash = 0.22; S.flashColor = '90,20,150'; }
  }
}

function tiles(offset, spacing, fn) {
  const first = Math.floor(offset / spacing) - 1;
  for (let i = first; i < first + Math.ceil(W / spacing) + 3; i++) fn(i * spacing - offset, i);
}

// けしきの しゅるい（ほかの ゲームで レベルの かずが ちがう ときは THEMES[n].props で えらぶ）
function sceneLv() { return THEMES[S.level].props || S.level; }

function drawProp(x, y, i) {
  const lv = sceneLv();
  if (lv === 2) { // ペロペロキャンディ
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 90, 6, 90);
    ctx.fillStyle = ['#ff8fbf', '#7fd6ff', '#ffd84a'][((i % 3) + 3) % 3];
    ctx.beginPath(); ctx.arc(x, y - 110, 30, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y - 110, 16, 0, 5); ctx.stroke();
  } else if (lv === 3) { // きのこ
    ctx.fillStyle = '#fff3dc'; ctx.fillRect(x - 10, y - 60, 20, 60);
    ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.ellipse(x, y - 60, 46, 34, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff';
    [[-20, -72], [6, -82], [24, -68]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(x + dx, y + dy, 6, 0, 7); ctx.fill(); });
  } else if (lv >= 5) { // とんがり やね の いえ
    ctx.fillStyle = lv === 5 ? '#7b6bc4' : '#5a3f99'; ctx.fillRect(x - 28, y - 80, 56, 80);
    ctx.fillStyle = lv === 5 ? '#ff8fbf' : '#ffd84a';
    ctx.beginPath(); ctx.moveTo(x - 36, y - 80); ctx.lineTo(x, y - 140); ctx.lineTo(x + 36, y - 80); ctx.fill();
    ctx.fillStyle = '#ffe98a'; ctx.fillRect(x - 10, y - 60, 20, 20);
  } else { // まるい き
    ctx.fillStyle = '#b07a4a'; ctx.fillRect(x - 7, y - 70, 14, 70);
    ctx.fillStyle = lv === 4 ? '#e3925a' : '#6cc46c';
    ctx.beginPath(); ctx.arc(x, y - 90, 40, 0, 7); ctx.arc(x - 26, y - 70, 26, 0, 7); ctx.arc(x + 26, y - 70, 26, 0, 7); ctx.fill();
    if (lv === 1) {
      ctx.fillStyle = '#ff8fbf';
      [[-14, -100], [16, -86], [-4, -70]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(x + dx, y + dy, 5, 0, 7); ctx.fill(); });
    }
  }
}

// =====================================================================
//  ふきだし
// =====================================================================
function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// o.right: みぎはしの x（しっぽは みぎ）/ o.cx + o.bottom: まんなかと したはし（しっぽは した）
// o.sub：うえに ちいさく だす ひとこと（わざの レベル など）
function drawSpeech(lines, o) {
  const size = o.size || 26, lh = size * 1.22, pad = 14, subSize = Math.round(size * 0.58), subH = o.sub ? subSize * 1.5 : 0;
  ctx.font = `400 ${subSize}px "Dela Gothic One", "Zen Maru Gothic", sans-serif`;
  const sw = o.sub ? ctx.measureText(o.sub).width : 0;
  ctx.font = `400 ${size}px "Dela Gothic One", "Zen Maru Gothic", sans-serif`;
  const tw = Math.max(sw, ...lines.map((l) => ctx.measureText(l).width));
  const w = tw + pad * 2, h = lines.length * lh + pad * 1.4 + subH;
  let x, y, base1, base2;
  if (o.right !== undefined) {
    x = Math.max(6, o.right - w); y = o.cy - h / 2;
    base1 = { x: x + w - 1, y: o.cy - 10 }; base2 = { x: x + w - 1, y: o.cy + 10 };
  } else {
    x = Math.max(6, Math.min(W - w - 6, o.cx - w / 2)); y = o.bottom - h;
    const bx = Math.max(x + 18, Math.min(x + w - 18, o.tailTo.x));
    base1 = { x: bx - 10, y: y + h - 1 }; base2 = { x: bx + 10, y: y + h - 1 };
  }
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.fillStyle = '#ffffff';
  roundRectPath(x, y, w, h, 16); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(base1.x, base1.y); ctx.lineTo(o.tailTo.x, o.tailTo.y); ctx.lineTo(base2.x, base2.y); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(base1.x, base1.y); ctx.lineTo(o.tailTo.x, o.tailTo.y); ctx.lineTo(base2.x, base2.y); ctx.stroke();
  ctx.fillStyle = o.color || INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (o.sub) {
    ctx.save(); ctx.font = `400 ${subSize}px "Dela Gothic One", "Zen Maru Gothic", sans-serif`; ctx.fillStyle = o.subColor || '#7a6890';
    ctx.fillText(o.sub, x + w / 2, y + pad * 0.6 + subSize * 0.6); ctx.restore();
  }
  lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + pad * 0.7 + subH + lh * (i + 0.5)));
  ctx.restore();
}

// =====================================================================
//  ちょなちゃん
// =====================================================================
function drawHero() {
  if (S.mode === 'title') return; // タイトルでは おおきな え を だしている
  const gy = GROUND(), x = HERO_X();
  const hh = 250;
  let bob = 0, tilt = 0, dx = 0;
  const walking = S.mode === 'walk' && (S.keyHeld || S.btnHeld);
  if (walking) { bob = Math.abs(Math.sin(S.walkPhase)) * 12; tilt = Math.sin(S.walkPhase) * 0.07; }
  else { bob = Math.sin(S.t * 2.2) * 2; }
  if (S.hero.jump > 0) bob += Math.sin((1 - S.hero.jump) * Math.PI) * 60;
  if (S.hero.hurt > 0) { dx = Math.sin(S.hero.hurt * 60) * 8 * S.hero.hurt - 20 * S.hero.hurt; tilt = -0.15 * S.hero.hurt; }
  if (S.charge) { bob = 6 + Math.sin(S.t * 20) * 2; }
  const dash = S.hero.dashX || 0; // けんで きりかかる ときの ダッシュ
  dx += dash;

  ctx.fillStyle = 'rgba(40,20,60,.18)';
  ctx.beginPath(); ctx.ellipse(x + dash, gy + 10, Math.max(20, 70 - bob * 0.6), 12, 0, 0, 7); ctx.fill();

  ctx.save();
  ctx.translate(x + dx, gy + 12 - bob);
  ctx.rotate(tilt);
  if (S.charge) { ctx.shadowColor = 'rgba(255,220,80,.95)'; ctx.shadowBlur = 20 + Math.sin(S.t * 18) * 10; }
  const spr = SPR.hero;
  if (spr) {
    const w = hh * spr.w / spr.h;
    ctx.drawImage(spr.canvas, -w / 2, -hh, w, hh);
  } else if (typeof window.drawHeroPlaceholder === 'function') {
    window.drawHeroPlaceholder(hh); // え が まだ ない ときの かわり
  } else {
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, -120, 50, 0, 7); ctx.fill();
  }
  ctx.restore();

  if (S.hero.hurt > 0.3 && !S.heroSay) drawSpeech(['いたっ！'], { right: x - 78, cy: gy - 205, tailTo: { x: x - 52, y: gy - 190 }, color: '#8a5cd1', size: 28 });

  const say = S.heroSay;
  if (say) {
    ctx.save();
    const k = Math.min(1, say.t / 0.15);
    ctx.globalAlpha = say.t > say.dur - 0.3 ? Math.max(0, (say.dur - say.t) / 0.3) : 1;
    drawSpeech(say.lines, { right: x - 78, cy: gy - 205, tailTo: { x: x - 52, y: gy - 190 }, color: say.color, size: 24 + 2 * k, sub: say.sub, subColor: say.subColor });
    ctx.restore();
  }
}

function outlinedText(text, x, y, size, color) {
  ctx.font = `400 ${size}px "Dela Gothic One", "Zen Maru Gothic", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.strokeText(text, x, y);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

// =====================================================================
//  てき（てがきの え を つかう）
// =====================================================================
function bossMouth(m) {
  const spr = m.spr, h = m.height, w = h * spr.w / spr.h;
  const mo = spr.mouth || { x: 0.15, y: 0.22 };
  return { x: m.x - w / 2 + mo.x * w, y: GROUND() + 8 - h + mo.y * h };
}

function drawMonster() {
  const m = S.monster; if (!m) return;
  if (m.nanmon) { drawBigChest(m); return; } // でんせつの たからばこ（maze.js）
  const gy = GROUND(), spr = m.spr;
  const h = m.height, w = spr ? h * spr.w / spr.h : h;
  let sx = 1, sy = 1, ox = 0, oy = 0, rot = 0;
  const wob = Math.sin(S.t * 5);
  switch (m.state) {
    case 'enter': case 'idle':
      if (m.boss) { sy = 1 + Math.sin(S.t * 2.4) * 0.015; oy = Math.sin(S.t * 2.4) * 2; }
      else { sx = 1 + wob * 0.04; sy = 1 - wob * 0.04; }
      break;
    case 'hit': { const k = Math.min(1, m.t * 2.2); sx = 1 + k * 0.6; sy = Math.max(0.05, 1 - k * 1.1); break; }
    case 'attack':
      if (m.boss) { rot = -Math.sin(Math.min(1, m.t / 1.2) * Math.PI) * 0.12; ox = -Math.sin(Math.min(1, m.t / 1.2) * Math.PI) * 20; }
      else ox = -Math.sin(Math.min(1, m.t / 0.5) * Math.PI) * (m.x - W * 0.45);
      break;
    case 'flee': ox = m.t * 600; break;
    case 'flinch': ox = Math.sin(m.t * 70) * 10 * Math.max(0, 1 - m.t); rot = 0.1 * Math.max(0, 1 - m.t * 2); break;
    case 'laugh': oy = -Math.abs(Math.sin(m.t * 10)) * 18; break;
    case 'defeated': rot = m.t * 6; sx = sy = Math.max(0.01, 1 - m.t / 1.6); oy = -m.t * 120; break;
  }
  if (m.alpha <= 0) return;

  ctx.save();
  ctx.fillStyle = 'rgba(30,10,50,.22)';
  ctx.beginPath(); ctx.ellipse(m.x + ox, gy + 8, Math.max(4, w * 0.42 * sx), 12, 0, 0, 7); ctx.fill();

  const baseY = m.landed ? gy + 8 : m.y;
  ctx.translate(m.x + ox, baseY + oy);
  ctx.translate(0, -h / 2); ctx.rotate(rot); ctx.translate(0, h / 2);
  ctx.scale(sx, sy);

  const pw = m.boss ? m.stage : m.power;
  if (spr) {
    ctx.save();
    if (pw.aura) { ctx.shadowColor = pw.aura; ctx.shadowBlur = 22 + Math.sin(S.t * 6) * 10; }
    if (pw.filter) ctx.filter = pw.filter;
    ctx.drawImage(spr.canvas, -w / 2, -h, w, h);
    ctx.restore();
    if (m.hitFlash > 0) { ctx.globalAlpha = m.hitFlash; ctx.drawImage(spr.white, -w / 2, -h, w, h); ctx.globalAlpha = 1; }
  } else {
    ctx.fillStyle = '#8fd3ff'; ctx.beginPath(); ctx.arc(0, -h / 2, h / 2, 0, 7); ctx.fill();
  }

  // ざこてきの つよそうな かざり
  if (!m.boss) {
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    if (pw.horns) {
      ctx.fillStyle = '#fff1c9';
      [-1, 1].forEach((d) => {
        ctx.beginPath(); ctx.moveTo(d * w * 0.12, -h * 0.94); ctx.lineTo(d * w * 0.3, -h * 1.12); ctx.lineTo(d * w * 0.26, -h * 0.86); ctx.closePath(); ctx.fill(); ctx.stroke();
      });
    }
    if (pw.crown) {
      ctx.fillStyle = '#ffd84a';
      ctx.beginPath(); ctx.moveTo(-22, -h * 0.98); ctx.lineTo(-26, -h * 0.98 - 30); ctx.lineTo(-10, -h * 0.98 - 16); ctx.lineTo(0, -h * 0.98 - 36); ctx.lineTo(10, -h * 0.98 - 16); ctx.lineTo(26, -h * 0.98 - 30); ctx.lineTo(22, -h * 0.98); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (pw.anger && m.state !== 'hit') drawAnger(w * 0.36, -h * 0.82, 14 + Math.sin(S.t * 8) * 2);
  }
  ctx.restore();

  // ボスの こえは あたまの うえの HP と かさならない ように みぎよこに
  const voiceX = Math.min(m.x + w * 0.5 + 80, W - 100), voiceY = gy - h * 0.75;
  if (m.boss && m.state === 'laugh') outlinedText('ガハハハ！', voiceX, voiceY + oy, 36, '#c98cff');
  if (m.boss && m.state === 'idle' && m.t < 1.2 && m.roared) outlinedText('ガオーッ！', voiceX, voiceY, 38, '#ff5a3a');
}

// ボスせんの HP：それぞれの キャラの あたまの うえに だす（もんだいの ふきだしには かさならない）
function drawBattleStatus() {
  const m = S.monster;
  if (!m || !m.landed || m.state === 'defeated') return;
  const gy = GROUND();
  // data-avoid の ついた パネル（もんだい・かきとり など）と かさならない ように する
  const rects = [...document.querySelectorAll('[data-avoid]')].filter((el) => !el.hidden && el.offsetParent !== null).map((el) => {
    const r = el.getBoundingClientRect();
    return { l: r.left / pxScale - 8, r: r.right / pxScale + 8, t: r.top / pxScale - 8, b: r.bottom / pxScale + 8 };
  });
  const hitOf = (x, y, w, h) => rects.find((R) => x < R.r && x + w > R.l && y < R.b && y + h > R.t);
  // かさなる ときは よこに ずらす。それでも だめなら パネルの したへ
  const place = (cx, w, wantY, side, h = 44) => {
    let x = cx - w / 2, y = Math.max(wantY, 70 / pxScale);
    const R = hitOf(x, y, w, h);
    if (!R) return { x, y };
    const moved = side < 0 ? R.l - w : R.r;
    if (moved >= 4 && moved + w <= W - 4 && !hitOf(moved, y, w, h)) return { x: moved, y };
    return { x, y: Math.max(y, ...rects.filter((Q) => x < Q.r && x + w > Q.l).map((Q) => Q.b)) };
  };

  // ちょなちゃんの ハート
  {
    const n = CONFIG.maxHp, gap = 28, w = n * gap + 16, h = 34;
    const { x, y } = place(HERO_X(), w, gy + 12 - 250 - h - 6, -1);
    ctx.save();
    roundRectPath(x, y, w, h, 17);
    ctx.fillStyle = 'rgba(255,250,243,.92)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    for (let i = 0; i < n; i++) {
      const hx = x + 8 + gap * (i + 0.5), hy = y + h / 2 + 2;
      drawHeart(hx, hy, 10, i < S.hp ? '#ff6fa8' : '#e4d9ec');
      ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    }
    ctx.restore();
  }

  // ボスの HP バー（ステラクエストでは HP が 2 いじょうの てきにも だす）
  if (m.boss || m.maxHp > 1) {
    const w = 190, h = 44;
    const { x, y } = place(m.x, w, gy + 8 - m.height - h - 8, 1);
    ctx.save();
    roundRectPath(x, y, w, h, 14);
    ctx.fillStyle = 'rgba(255,250,243,.92)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#6a2f8f'; ctx.stroke();
    ctx.font = '900 13px "Zen Maru Gothic", sans-serif';
    ctx.fillStyle = '#6a2f8f'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(m.name, x + 12, y + 12);
    const bx = x + 12, by = y + 22, bw = w - 24, bh = 13;
    roundRectPath(bx, by, bw, bh, 6.5);
    ctx.fillStyle = '#eee4f2'; ctx.fill();
    const shown = (m.hpShown ?? m.hp) / m.maxHp;
    if (shown > 0) {
      roundRectPath(bx, by, Math.max(bh, bw * shown), bh, 6.5);
      const gr = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      gr.addColorStop(0, '#ff4b6e'); gr.addColorStop(1, '#ff9a4b');
      ctx.fillStyle = gr; ctx.fill();
    }
    roundRectPath(bx, by, bw, bh, 6.5);
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
  }
}

function drawAnger(x, y, s) { // 💢 みたいな おこりマーク
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#ff3b4a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(s * 0.3, -s); ctx.quadraticCurveTo(s * 0.3, -s * 0.3, s, -s * 0.3); ctx.stroke();
  }
  ctx.restore();
}

// =====================================================================
//  まいフレーム
// =====================================================================
let last = performance.now();
function frame(now) {
  // えがく とちゅうで エラーが おきても ゲームが とまらないように する
  requestAnimationFrame(frame);
  try { tick(now); } catch (err) { console.error(err); }
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  S.t += dt; S.phaseT += dt;
  update(dt);

  const sx = S.shake > 0 ? (Math.random() - 0.5) * 24 * S.shake : 0;
  const sy = S.shake > 0 ? (Math.random() - 0.5) * 24 * S.shake : 0;
  ctx.setTransform(dpr * pxScale, 0, 0, dpr * pxScale, sx * dpr * pxScale, sy * dpr * pxScale);
  ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.shadowBlur = 0;
  ctx.clearRect(-30, -30, W + 60, H + 60);
  if (inMaze()) { // めいろの がめん（maze.js）
    drawMaze();
    drawParticles();
    if (S.flash > 0) { ctx.fillStyle = `rgba(${S.flashColor},${Math.min(0.85, S.flash)})`; ctx.fillRect(-30, -30, W + 60, H + 60); }
    return;
  }
  drawWorld();
  drawCharge();
  drawParticles(true); // ボスの うしろの メラメラ・やみ
  drawMonster();
  drawHero();
  drawCat();
  drawSpells();
  drawParticles();
  drawBattleStatus();
  if (S.flash > 0) { ctx.fillStyle = `rgba(${S.flashColor},${Math.min(0.85, S.flash)})`; ctx.fillRect(-30, -30, W + 60, H + 60); }
}

function update(dt) {
  for (let i = timers.length - 1; i >= 0; i--) {
    timers[i].t -= dt;
    if (timers[i].t <= 0) { const fn = timers[i].fn; timers.splice(i, 1); fn(); }
  }
  if (S.hero.jump > 0) S.hero.jump = Math.max(0, S.hero.jump - dt * 2);
  if (S.hero.hurt > 0) S.hero.hurt = Math.max(0, S.hero.hurt - dt * 1.4);
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 1.5);
  if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 3);
  if (S.heroSay) { S.heroSay.t += dt; if (S.heroSay.t > S.heroSay.dur) S.heroSay = null; }
  if (S.cat) { S.cat.t += dt; if (S.cat.say) S.cat.say.t += dt; }
  stepCharge(dt);

  if (S.mode === 'walk') mazeUpdate(dt); // めいろを あるく（maze.js）

  const m = S.monster;
  if (m && m.boss && m.landed && m.state !== 'defeated') bossAura(m, dt);
  if (m) {
    m.t += dt;
    if (m.hitFlash > 0) m.hitFlash = Math.max(0, m.hitFlash - dt * 5);
    // HP バーは するする へる
    if (m.hpShown === undefined) m.hpShown = m.hp;
    if (m.hpShown > m.hp) m.hpShown = Math.max(m.hp, m.hpShown - dt * 2);
    if (m.state === 'enter') {
      m.vy += (m.boss ? 3200 : 2400) * dt; m.y += m.vy * dt;
      const floor = GROUND() + 8;
      if (m.y >= floor) {
        m.landed = true; m.y = floor;
        if (m.boss) {
          m.state = 'idle'; m.t = 0; m.roared = true;
          S.shake = 1.2; SFX.bossLand(); SFX.roar();
          for (let i = 0; i < 14; i++) spawn('puff', m.x + rnd(-130, 130), GROUND() - rnd(0, 20), { vx: rnd(-160, 160), vy: rnd(-80, -10) });
          // とうじょうで ひを ふく（うえむき）
          later(0.2, () => { if (m.spr) for (let i = 0; i < 30; i++) { const mo = bossMouth(m); spawn('flame', mo.x, mo.y, { vx: rnd(-260, -120), vy: rnd(-260, -120), delay: i * 0.02 }); } });
          later(1.4, askQuestion);
        } else if (m.vy > 300) { m.vy = -m.vy * 0.35; m.landed = false; }
        else { m.state = 'idle'; m.t = 0; startBattleTurn(); }
      }
    } else if (m.state === 'hit') {
      if (m.t > 0.45 && m.alpha === 1) {
        SFX.poof();
        for (let i = 0; i < 16; i++) spawn('star', m.x, GROUND() - 50, { vx: rnd(-260, 260), vy: rnd(-420, -120) });
        for (let i = 0; i < 6; i++) spawn('puff', m.x + rnd(-40, 40), GROUND() - rnd(10, 70), { vx: rnd(-40, 40), vy: rnd(-60, -10) });
        m.alpha = 0;
      }
    } else if (m.state === 'attack') {
      if (m.boss) {
        // ひを ふく！
        if (m.t > 0.3 && m.t < 1.2 && m.spr) {
          const mo = bossMouth(m), hx = HERO_X(), hy = GROUND() - 130;
          for (let i = 0; i < 4; i++) {
            const tt = rnd(45, 60) / 100;
            spawn('flame', mo.x, mo.y, { vx: (hx - mo.x) / tt + rnd(-40, 40), vy: (hy - mo.y) / tt + rnd(-60, 60) });
          }
        }
        if (m.t > 0.7 && m.t < 0.85 && S.hero.hurt === 0) { S.hero.hurt = 1; S.flash = 0.4; S.flashColor = '255,120,60'; }
      } else if (m.t > 0.25 && m.t < 0.4 && S.hero.hurt === 0) S.hero.hurt = 1;
    } else if (m.state === 'defeated') {
      if (Math.random() < 0.6) spawn('rainbow', m.x + rnd(-120, 120), GROUND() - rnd(40, 280), { vx: rnd(-200, 200), vy: rnd(-300, 0), hue: rnd(0, 360) });
      if (m.t > 1.5 && m.alpha === 1) {
        m.alpha = 0;
        for (let i = 0; i < 50; i++) spawn('star', m.x, GROUND() - 140, { vx: rnd(-500, 500), vy: rnd(-600, 100), size: rnd(10, 22) });
        S.flash = 1; S.flashColor = '255,255,255';
      }
    }
  }
  stepSpells(dt);
  stepParticles(dt);
}

// =====================================================================
//  そうさ
// =====================================================================
addEventListener('keydown', (e) => {
  const enter = (e.key === 'Enter' || e.code === 'NumpadEnter') && !e.repeat;
  if (S.mode === 'title') {
    if (enter) { e.preventDefault(); startGame(); }
    return;
  }
  if (S.mode === 'clear') {
    if (enter && S.phaseT > 2) { e.preventDefault(); setMode('title'); }
    return;
  }
  if (S.mode === 'walk' || S.mode === 'riddle' || S.mode === 'nanmonOffer') { mazeKeyDown(e); return; } // maze.js
  if (S.mode === 'answered') {
    if (enter) { proceed(); e.preventDefault(); }
    return;
  }
  if (S.mode === 'question') {
    const mm = e.code.match(/^(Digit|Numpad)(\d)$/);
    if (mm && !e.repeat) { typeDigit(mm[2]); e.preventDefault(); return; }
    if (e.key === 'Enter' || e.code === 'NumpadEnter') { submit(); e.preventDefault(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete' || e.code === 'NumpadDecimal') { eraseDigit(); e.preventDefault(); }
  }
});
addEventListener('keyup', (e) => mazeKeyUp(e));
addEventListener('blur', () => mazeKeyUp(null));

$('pad').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const k = b.dataset.k;
  if (k === 'ok') submit(); else if (k === 'del') eraseDigit(); else typeDigit(k);
});
$('startBtn').addEventListener('click', startGame);
$('nextBtn').addEventListener('click', proceed);
$('againBtn').addEventListener('click', () => setMode('title'));
$('muteBtn').addEventListener('click', (e) => {
  soundOn = !soundOn; e.currentTarget.textContent = 'おと：' + (soundOn ? 'オン' : 'オフ'); e.currentTarget.blur();
});

// =====================================================================
//  スタート
// =====================================================================
// maze.js・kanji.js・music.js を ぜんぶ よんでから はじめる
addEventListener('DOMContentLoaded', () => {
  loadAll();
  updateUI();
  requestAnimationFrame(frame);
  // スタディクエストの タイトルから えらばれた ときは すぐ はじめる（xxx.html#start）
  if (location.hash === '#start') { history.replaceState(null, '', location.pathname); startGame(); }
});
