'use strict';
// =====================================================================
//  ステラクエスト：たたかい の アクション
//  ・タイミング こうげき：せいかい の あと、うごく しるし に あわせて タップ（Enter）→「つよい」は ダメージ 2ばい
//  ・コンボ：はやく こたえると れんぞく。1コンボ ごと に ダメージ ＋1（おそくても そん は しない）
//  ・スワイプ で よける：まちがえた とき、やじるし の むき に スワイプ（やじるし キー）できたら ダメージ 0
//  ・ボス の おおわざ：ボス の HP が はんぶん に なったら、れんだ で バリア（かず で ダメージ が へる）
//  ・とどめ を ゆび で とばす：ひっぱって はなすと ねらった ほう へ（ボス に むいて いれば あたる）
//  stella_timeattack.js の あと、stella_pace.js の まえ に よむ。しよう：docs/GAME_SPEC.md 14.8
// =====================================================================

const ACT = {
  timingSec: Infinity,   // タイミング こうげき を まつ じかん（2026-11-15：おす まで きえない。テスト だけ みじかく）
  zone: [0.39, 0.61],    // ぴったり の ところ（0〜1）
  period: 1.15,          // しるし が いったりきたり する はやさ（びょう）
  dodgeSec: { mob: 0.85, boss: 0.7 }, // よけられる じかん
  mashSec: 3.2,          // ボス の おおわざ：れんだ の じかん
  mashGood: [14, 7],     // この かず で ダメージ 0・1（それ より すくない と 2）
  comboSec: { math: 8, kanji: 20, music: 10, english: 15 },
  autoAim: false,        // テスト よう：とどめ を じどう で とばす
  // その とき の ようす
  mult: 1, combo: 0, qStart: 0, pendingTiming: false, dodge: null, dodged: false, mash: null, aim: null, bigPending: false,
};
try {
  const t = localStorage.getItem('stella:test:actionSec');
  if (t !== null) { ACT.timingSec = +t; ACT.mashSec = +t; }
  if (localStorage.getItem('stella:test:autoAim')) ACT.autoAim = true;
  if (t !== null) ACT.mashAuto = true; // テスト：れんだ は じどう で せいこう
} catch { /* テスト よう（ふだん は ない） */ }

const actOn = () => !!(ST.battle && !ST.battle.practice && S.monster && !S.monster.nanmon); // アルト の れんしゅう には いれない（じゅんばん に とく ため）

// ---------------------------------------------------------------------
//  がめん の ぶひん
// ---------------------------------------------------------------------
(function buildActionUi() {
  const add = (id, cls, html = '') => { const d = document.createElement('div'); d.id = id; d.className = cls; d.hidden = true; d.innerHTML = html; $('game').appendChild(d); return d; };
  add('actTiming', 'act-layer act-timing', '<div class="act-box"><div class="act-cap">タイミング よく タップ！</div><div class="act-bar"><i class="zone"></i><i class="mark"></i></div></div>');
  add('actDodge', 'act-layer act-dodge', '<div class="act-box"><div class="act-cap">スワイプ で よけて！</div><div class="act-arrow">⬅</div></div>');
  add('actMash', 'act-layer act-mash', '<div class="act-box"><div class="act-cap">おおわざ が くる！ れんだ で バリア！</div><div class="act-count">0</div><div class="act-meter"><i></i></div></div>');
  add('actAim', 'act-layer act-aim', '<div class="act-box top"><div class="act-cap">ひっぱって はなして とどめ！</div><small>ちゅなちゃん から うしろ へ ひっぱる → はなす と とんでいく</small></div><canvas id="actAimCv"></canvas>');
  add('actPop', 'act-pop');
  $('actTiming').addEventListener('pointerdown', (e) => { e.preventDefault(); timingTap(); });
  $('actMash').addEventListener('pointerdown', (e) => { e.preventDefault(); mashTap(); });
  const dl = $('actDodge');
  dl.addEventListener('pointerdown', (e) => { ACT.swipe = { x: e.clientX, y: e.clientY }; });
  dl.addEventListener('pointerup', (e) => {
    if (!ACT.swipe) return;
    const dx = e.clientX - ACT.swipe.x, dy = e.clientY - ACT.swipe.y; ACT.swipe = null;
    if (Math.hypot(dx, dy) < 36) return;
    dodgeInput(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  const al = $('actAim');
  al.addEventListener('pointerdown', (e) => { if (!ACT.aim) return; e.preventDefault(); ACT.aim.drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY }; try { al.setPointerCapture(e.pointerId); } catch { /* なし */ } });
  al.addEventListener('pointermove', (e) => { if (ACT.aim && ACT.aim.drag) { ACT.aim.drag.x = e.clientX; ACT.aim.drag.y = e.clientY; drawAim(); } });
  al.addEventListener('pointerup', () => aimRelease());
})();

function actPop(text, color = '#ff6fa8') {
  const p = $('actPop');
  p.textContent = text; p.style.color = color; p.hidden = false;
  p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
  clearTimeout(actPop.t); actPop.t = setTimeout(() => { p.hidden = true; }, 1300);
}

// ---------------------------------------------------------------------
//  コンボ：もんだい が でた じかん から こたえる まで
// ---------------------------------------------------------------------
const baseAskQuestionAct = askQuestion;
askQuestion = function () {
  const m = S.monster;
  if (ACT.bigPending && m && m.boss && !m.necro && actOn()) { ACT.bigPending = false; startBigAttack(() => askQuestion()); return; }
  baseAskQuestionAct();
  ACT.qStart = S.t;
};
const baseEncounterAct = encounter;
encounter = function (opts) { ACT.combo = 0; ACT.mult = 1; baseEncounterAct(opts); };

const baseResolveAct = resolveAnswer;
resolveAnswer = function (ok, wrongMsg, attackKinds) {
  const m = S.monster;
  if (!actOn()) { baseResolveAct(ok, wrongMsg, attackKinds); return; }
  if (ok) {
    const subj = (S.q && S.q.subject) || 'math', lim = (ACT.comboSec[subj] || 10) * (S.vertical ? 1.8 : 1);
    ACT.combo = S.t - ACT.qStart <= lim ? ACT.combo + 1 : 0;
    if (ACT.combo >= 2) later(0.15, () => actPop(`${ACT.combo} コンボ！`, '#ff8a3c'));
    ACT.pendingTiming = !isFinalBlow(m);
  } else {
    ACT.combo = 0;
    if (!(ST.battle && ST.battle.practice)) openDodge(m);
  }
  baseResolveAct(ok, wrongMsg, attackKinds);
};

// ---------------------------------------------------------------------
//  タイミング こうげき（cast の まえ に はさむ）
// ---------------------------------------------------------------------
const baseCastAct = cast;
cast = function (kind, onHit) {
  if (!ACT.pendingTiming || !actOn()) { baseCastAct(kind, onHit); return; }
  ACT.pendingTiming = false;
  ACT.timing = { t0: performance.now(), done: false, go: () => baseCastAct(kind, onHit) };
  $('actTiming').hidden = false;
  stepTiming();
};
function timingPos() { const t = (performance.now() - ACT.timing.t0) / 1000 / ACT.period; return 0.5 - 0.5 * Math.cos(t * Math.PI * 2 + Math.PI * 0.35); }
function stepTiming() {
  const T = ACT.timing;
  if (!T || T.done) return;
  $('actTiming').querySelector('.mark').style.left = `${timingPos() * 100}%`;
  if ((performance.now() - T.t0) / 1000 >= ACT.timingSec) { finishTiming(false); return; }
  requestAnimationFrame(stepTiming);
}
function timingTap() {
  const T = ACT.timing;
  if (!T || T.done) return;
  const p = timingPos();
  finishTiming(p >= ACT.zone[0] && p <= ACT.zone[1]);
}
function finishTiming(strong) {
  const T = ACT.timing;
  T.done = true; ACT.timing = null;
  $('actTiming').hidden = true;
  ACT.mult = strong ? 2 : 1;
  if (strong) { actPop('つよい！ ダメージ 2ばい！', '#e2588f'); [988, 1318].forEach((f, i) => note(f, i * 0.06, 0.18, { type: 'square', vol: 0.06 })); }
  else actPop('ふつう', '#7a6890');
  T.go();
}

// あたった：つよい・コンボ の ぶん だけ よけい に へらす
const baseOnSpellHitAct = onSpellHit;
onSpellHit = function () {
  const m = S.monster;
  if (actOn() && m && !(ST.battle && ST.battle.practice && false)) {
    const extra = heroAtk() * (ACT.mult - 1) + Math.max(0, ACT.combo - 1);
    if (extra > 0) m.hp = m.boss ? Math.max(1, m.hp - extra) : Math.max(0, m.hp - extra);
    ACT.mult = 1;
    const half = m.boss && !m.necro && !m.bigDone && m.hp > 0;
    baseOnSpellHitAct();
    if (half && m.hp > 0 && m.hp <= m.maxHp / 2) { m.bigDone = true; ACT.bigPending = true; }
    return;
  }
  baseOnSpellHitAct();
};

// ---------------------------------------------------------------------
//  スワイプ で よける（まちがえた とき）
// ---------------------------------------------------------------------
const DODGE_ARROW = { up: '⬆', down: '⬇', left: '⬅', right: '➡' };
function openDodge(m) {
  const dir = pick(['up', 'down', 'left', 'right']);
  ACT.dodge = { dir, until: S.t + (m.boss ? ACT.dodgeSec.boss : ACT.dodgeSec.mob), done: false, pending: 0 };
  ACT.dodged = false;
  const el = $('actDodge');
  el.querySelector('.act-arrow').textContent = DODGE_ARROW[dir];
  el.hidden = false;
  later((m.boss ? ACT.dodgeSec.boss : ACT.dodgeSec.mob), closeDodge);
}
function dodgeInput(dir) {
  const D = ACT.dodge;
  if (!D || D.done) return;
  D.done = true;
  if (dir === D.dir) {
    ACT.dodged = true;
    S.hero.jump = 1;
    actPop('よけた！', '#1f9c74');
    note(1200, 0, 0.12, { type: 'sine', vol: 0.08, slide: 0.6 });
  } else actPop('あっ……', '#e8203c');
  $('actDodge').hidden = true;
}
function closeDodge() {
  const D = ACT.dodge;
  if (!D) return;
  ACT.dodge = null;
  $('actDodge').hidden = true;
  const n = D.pending; D.pending = 0;
  if (!ACT.dodged) for (let i = 0; i < n; i++) baseDamageHeroAct();
  ACT.dodged = false;
}
// こうげき が あたる とき：よける ちゅう なら まって、よけたら 0
const baseDamageHeroAct = damageHero;
damageHero = function () {
  if (ACT.dodge) { if (ACT.dodge.done && ACT.dodged) return; ACT.dodge.pending++; if (ACT.dodge.done) closeDodge(); return; }
  baseDamageHeroAct();
};

// ---------------------------------------------------------------------
//  ボス の おおわざ：れんだ で バリア
// ---------------------------------------------------------------------
function startBigAttack(done) {
  const m = S.monster;
  ACT.mash = { n: 0, t0: performance.now(), done };
  setMode('answered');
  $('quiz').hidden = true;
  S.shake = 0.8; SFX.roar ? SFX.roar() : SFX.bad();
  m.state = 'flinch'; m.t = 0;
  const el = $('actMash');
  el.querySelector('.act-count').textContent = '0';
  el.querySelector('.act-meter i').style.width = '0%';
  el.hidden = false;
  stepMash();
}
function mashTap() {
  const M = ACT.mash; if (!M) return;
  M.n++;
  $('actMash').querySelector('.act-count').textContent = M.n;
  $('actMash').querySelector('.act-meter i').style.width = `${Math.min(100, M.n / ACT.mashGood[0] * 100)}%`;
  note(500 + M.n * 30, 0, 0.05, { type: 'square', vol: 0.04 });
}
function stepMash() {
  const M = ACT.mash; if (!M) return;
  if ((performance.now() - M.t0) / 1000 < ACT.mashSec) { requestAnimationFrame(stepMash); return; }
  ACT.mash = null;
  $('actMash').hidden = true;
  const m = S.monster;
  if (ACT.mashAuto) M.n = Math.max(M.n, ACT.mashGood[0]);
  const dmg = M.n >= ACT.mashGood[0] ? 0 : M.n >= ACT.mashGood[1] ? 1 : 2;
  if (m) { m.state = 'attack'; m.t = 0; }
  S.shake = 1; S.flash = 0.5; S.flashColor = '255,120,60';
  later(0.5, () => {
    for (let i = 0; i < dmg; i++) baseDamageHeroAct();
    actPop(dmg === 0 ? 'バリア せいこう！ ダメージ 0！' : dmg === 1 ? `バリア！ ダメージ 1` : 'ダメージ 2……！', dmg === 0 ? '#1f9c74' : '#e8203c');
  });
  later(1.6, () => {
    if (!S.monster) return;
    S.monster.state = 'idle';
    if (S.hp <= 0) { S.monster = null; levelFx('lose'); return; }
    M.done();
  });
}

// ---------------------------------------------------------------------
//  とどめ を ゆび で とばす（ひっぱって はなす）
// ---------------------------------------------------------------------
const baseStartChargeAct = startCharge;
startCharge = function (withCat) {
  if (!actOn() || (ST.battle && ST.battle.practice)) { baseStartChargeAct(withCat); return; }
  ACT.aim = { go: () => baseStartChargeAct(withCat), drag: null, miss: 0 };
  const el = $('actAim'), cv = $('actAimCv');
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  el.hidden = false;
  drawAim();
  if (ACT.autoAim) later(0.3, () => aimFire());
};
function aimPoints() {
  const m = S.monster;
  return { hx: HERO_X() * pxScale, hy: (GROUND() - 120) * pxScale, mx: (m ? m.x : W * 0.7) * pxScale, my: (GROUND() - (m ? m.height * 0.5 : 120)) * pxScale };
}
function drawAim() {
  const A = ACT.aim; if (!A) return;
  const cv = $('actAimCv'), g = cv.getContext('2d'), P = aimPoints();
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight);
  g.fillStyle = 'rgba(255,240,160,.85)'; g.beginPath(); g.arc(P.hx, P.hy, 26 + Math.sin(performance.now() / 150) * 4, 0, 7); g.fill();
  if (A.drag) {
    const dx = A.drag.x - A.drag.x0, dy = A.drag.y - A.drag.y0;
    g.strokeStyle = '#ff6fa8'; g.lineWidth = 6; g.setLineDash([10, 8]);
    g.beginPath(); g.moveTo(P.hx, P.hy); g.lineTo(P.hx + dx, P.hy + dy); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#ffd84a'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(P.hx, P.hy); g.lineTo(P.hx - dx * 2, P.hy - dy * 2); g.stroke();
  } else requestAnimationFrame(drawAim);
}
function aimRelease() {
  const A = ACT.aim; if (!A || !A.drag) return;
  const dx = A.drag.x - A.drag.x0, dy = A.drag.y - A.drag.y0; A.drag = null;
  if (Math.hypot(dx, dy) < 40) { drawAim(); return; }
  const P = aimPoints();
  const shot = Math.atan2(-dy, -dx), want = Math.atan2(P.my - P.hy, P.mx - P.hx);
  let diff = Math.abs(shot - want); if (diff > Math.PI) diff = Math.PI * 2 - diff;
  if (diff < 0.7) aimFire();
  else { A.miss++; actPop('はずれ！ ボス の ほう へ ねらって！', '#e8203c'); SFX.bad(); drawAim(); }
}
function aimFire() {
  const A = ACT.aim; if (!A) return;
  ACT.aim = null;
  $('actAim').hidden = true;
  actPop('いっけー！', '#ff6fa8');
  A.go();
}

// ---------------------------------------------------------------------
//  キー：Enter／スペース ＝ タイミング・れんだ・とどめ（まっすぐ）、やじるし ＝ よける
// ---------------------------------------------------------------------
addEventListener('keydown', (e) => {
  const enter = e.key === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter';
  if (ACT.timing && enter && !e.repeat) { timingTap(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (ACT.mash && enter && !e.repeat) { mashTap(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (ACT.aim && enter && !e.repeat) { aimFire(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (ACT.dodge && !ACT.dodge.done) {
    const d = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.code];
    if (d) { dodgeInput(d); e.preventDefault(); e.stopImmediatePropagation(); }
  }
}, true);

// テスト よう
window.actTest = {
  state: () => ({ timing: !!ACT.timing, dodge: ACT.dodge && ACT.dodge.dir, mash: !!ACT.mash, aim: !!ACT.aim, combo: ACT.combo }),
  tapGood() { if (!ACT.timing) return false; ACT.timing.t0 = performance.now() - ACT.period * 1000 * ((Math.PI / 2 - Math.PI * 0.35) / (Math.PI * 2)); timingTap(); return true; },
};
