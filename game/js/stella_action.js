'use strict';
// =====================================================================
//  ステラクエスト：たたかい の アクション
//  ・ためる こうげき：せいかい の あと、ながおし（Enter・スペース）で パワー を ためる → まんたん で ひかって いる
//    あいだ に はなすと クリティカル（ダメージ 2ばい）。はやく はなす・ためすぎ は ふつう（2026-11-14 に かえた）
//  ・コンボ：はやく こたえると れんぞく。1コンボ ごと に ダメージ ＋1（おそくても そん は しない）
//  ・よける：まちがえた とき、てき の たま が ゆっくり とんで くる。ひかる わ に はいったら
//    がめん の どこ でも タップ（どの キー でも）→ ダメージ 0。はやすぎ・おそすぎ は あたる（2026-11-14 に かえた）
//  ・ボス の おおわざ：ボス の HP が はんぶん に なったら、れんだ で バリア（かず で ダメージ が へる）
//  ・とどめ を ゆび で とばす：ひっぱって はなすと ねらった ほう へ（ボス に むいて いれば あたる）
//  stella_timeattack.js の あと、stella_pace.js の まえ に よむ。しよう：docs/GAME_SPEC.md 14.8
// =====================================================================

const ACT = {
  timingSec: Infinity,   // タイミング こうげき を まつ じかん（2026-11-15：おす まで きえない。テスト だけ みじかく）
  chargeSec: 1.7,        // ながおし で バー が いっぱい に なる まで（びょう）。いっぱい まで いく と ためすぎ（ふつう）
  critZone: [0.78, 0.93], // バー の この あいだ（8〜9わり）で はなすと クリティカル（2026-11-17）
  dodgeTravel: { mob: 2.4, boss: 2.0 }, // たま が とんで くる じかん（びょう）
  dodgeWin: [0.55, 0.93],               // ひかる わ（とぶ みちのり の この あいだ で タップ）
  warnSec: 0.6,                         // たま が とぶ まえ の「こうげき が くる！」（よちょう）
  finalDmg: 2,                        // とどめ の まえ の ボス の さいご の こうげき（よけられない と）
  mashSec: 3.2,          // ボス の おおわざ：れんだ の じかん
  mashGood: [14, 7],     // この かず で ダメージ 0・1（それ より すくない と 2）
  comboSec: { math: 8, kanji: 20, music: 10, english: 15 },
  autoAim: false,        // テスト よう：とどめ を じどう で とばす
  // その とき の ようす
  mult: 1, combo: 0, qStart: 0, pendingTiming: false, dodge: null, dodged: false, mash: null, aim: null, bigPending: false,
};
try {
  const t = localStorage.getItem('stella:test:actionSec');
  if (t !== null) { ACT.timingSec = +t; ACT.mashSec = +t; ACT.warnSec = +t; ACT.dodgeTravel = { mob: 0.3, boss: 0.3 }; ACT.finalDmg = 0; } // テスト は みじかく・さいご の こうげき は ダメージ なし（action で みる）
  if (localStorage.getItem('stella:test:autoAim')) ACT.autoAim = true;
  if (t !== null) ACT.mashAuto = true; // テスト：れんだ は じどう で せいこう
} catch { /* テスト よう（ふだん は ない） */ }

const actOn = () => !!(ST.battle && !ST.battle.practice && S.monster && !S.monster.nanmon); // アルト の れんしゅう には いれない（じゅんばん に とく ため）

// ---------------------------------------------------------------------
//  がめん の ぶひん
// ---------------------------------------------------------------------
(function buildActionUi() {
  const add = (id, cls, html = '') => { const d = document.createElement('div'); d.id = id; d.className = cls; d.hidden = true; d.innerHTML = html; $('game').appendChild(d); return d; };
  add('actTiming', 'act-layer act-timing', '<div class="act-box"><div class="act-cap">ながおし で ためて、ピンク の ところ で はなす！</div><div class="act-bar charge"><i class="fill"></i><i class="crit"></i></div></div>'
    + '<div class="act-circle"><div class="mc"><svg viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linejoin="round"><circle cx="50" cy="50" r="46" stroke-width="3"/><circle cx="50" cy="50" r="38" stroke-width="2" stroke-dasharray="4 5"/><circle cx="50" cy="50" r="30" stroke-width="2.5"/><path d="M50 20 L67.6 74.3 L21.5 40.7 L78.5 40.7 L32.4 74.3 Z" stroke-width="2.5"/></g><g fill="currentColor"><circle cx="50" cy="4" r="3"/><circle cx="96" cy="50" r="3"/><circle cx="50" cy="96" r="3"/><circle cx="4" cy="50" r="3"/></g></svg></div><span>ここ を ながおし</span></div>');
  add('actDodge', 'act-layer act-dodge', '<div class="act-box"><div class="act-cap">こうげき が くる！</div><div class="act-arrow">❗</div></div>');
  add('actMash', 'act-layer act-mash', '<div class="act-box"><div class="act-cap">おおわざ が くる！ れんだ で バリア！</div><div class="act-count">0</div><div class="act-meter"><i></i></div></div>');
  add('actAim', 'act-layer act-aim', '<div class="act-box top"><div class="act-cap">ひっぱって はなして とどめ！</div><small>ちゅなちゃん から うしろ へ ひっぱる → はなす と とんでいく</small></div><canvas id="actAimCv"></canvas>');
  add('actPop', 'act-pop');
  const tl = $('actTiming');
  tl.addEventListener('pointerdown', (e) => { e.preventDefault(); try { tl.setPointerCapture(e.pointerId); } catch { /* なし */ } timingDown(); });
  ['pointerup', 'pointercancel'].forEach((ev) => tl.addEventListener(ev, () => timingUp()));
  $('actMash').addEventListener('pointerdown', (e) => { e.preventDefault(); mashTap(); });
  $('actDodge').addEventListener('pointerdown', (e) => { e.preventDefault(); dodgeInput(); });
  const al = $('actAim');
  al.addEventListener('pointerdown', (e) => { if (!ACT.aim) return; e.preventDefault(); ACT.aim.drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY }; try { al.setPointerCapture(e.pointerId); } catch { /* なし */ } });
  al.addEventListener('pointermove', (e) => { if (ACT.aim && ACT.aim.drag) { ACT.aim.drag.x = e.clientX; ACT.aim.drag.y = e.clientY; drawAim(); } });
  al.addEventListener('pointerup', () => aimRelease());
})();

function actPop(text, color = '#ff6fa8', cls = '') {
  const p = $('actPop');
  p.textContent = text; p.style.color = color; p.hidden = false; p.className = `act-pop ${cls}`;
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
  ACT.timing = { t0: performance.now(), hold: null, done: false, go: () => baseCastAct(kind, onHit) };
  const el = $('actTiming');
  el.classList.remove('full');
  el.querySelector('.act-cap').textContent = 'ながおし で ためて、ピンク の ところ で はなす！';
  el.querySelector('.fill').style.width = '0%';
  const cz = el.querySelector('.crit'); cz.style.left = `${ACT.critZone[0] * 100}%`; cz.style.width = `${(ACT.critZone[1] - ACT.critZone[0]) * 100}%`;
  el.hidden = false;
  stepTiming();
};
const critIn = (k) => k >= ACT.critZone[0] && k <= ACT.critZone[1];
const holdSec = (T) => (T.hold == null ? 0 : (performance.now() - T.hold) / 1000);
function stepTiming() {
  const T = ACT.timing;
  if (!T || T.done) return;
  const el = $('actTiming'), e = holdSec(T);
  const k = Math.min(1, e / ACT.chargeSec);
  el.querySelector('.fill').style.width = `${k * 100}%`;
  if (T.hold != null) {
    const glow = critIn(k);
    if (glow && !T.full) { T.full = true; el.classList.add('full'); el.querySelector('.act-cap').textContent = '✨ いま はなして！ ✨'; [1319, 1760].forEach((f, i) => note(f, i * 0.05, 0.14, { type: 'sine', vol: 0.07 })); }
    else if (!glow && T.full) { el.classList.remove('full'); el.querySelector('.act-cap').textContent = 'ためすぎ……'; }
    else if (!glow && (T.tick = (T.tick || 0) + 1) % 6 === 0) note(500 + k * 700, 0, 0.05, { type: 'triangle', vol: 0.04 });
    if (k >= 1) { finishTiming(false, 'ためすぎ……ふつう'); return; }
  } else if ((performance.now() - T.t0) / 1000 >= ACT.timingSec) { finishTiming(false); return; }
  requestAnimationFrame(stepTiming);
}
function timingDown() {
  const T = ACT.timing;
  if (!T || T.done || T.hold != null) return;
  T.hold = performance.now();
  $('actTiming').classList.add('hold');
}
function timingUp() {
  const T = ACT.timing;
  if (!T || T.done || T.hold == null) return;
  const k = holdSec(T) / ACT.chargeSec;
  finishTiming(critIn(k), k < ACT.critZone[0] ? 'ふつう（もっと ためよう）' : 'ためすぎ……ふつう');
}
function finishTiming(strong, msg = 'ふつう') {
  const T = ACT.timing;
  T.done = true; ACT.timing = null;
  $('actTiming').hidden = true; $('actTiming').classList.remove('full', 'hold');
  ACT.mult = strong ? 2 : 1;
  if (strong) { actPop('つよい！ ダメージ 2ばい！', '#e2588f', 'crit'); [988, 1318, 1760].forEach((f, i) => note(f, i * 0.06, 0.2, { type: 'square', vol: 0.07 })); }
  else actPop(msg, '#7a6890');
  T.go();
}

// あたった：つよい・コンボ の ぶん だけ よけい に へらす
const baseOnSpellHitAct = onSpellHit;
onSpellHit = function () {
  const m = S.monster;
  if (actOn() && m && !(ST.battle && ST.battle.practice && false)) {
    if (ACT.mult > 1) critFx(m);
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

// クリティカル の えんしゅつ（ダメージ 2ばい が あたった とき）
function critFx(m) {
  S.shake = 1.5; S.flash = 1; S.flashColor = '255,244,190';
  m.hitFlash = 1;
  const y = GROUND() - m.height * 0.5;
  for (let i = 0; i < 60; i++) spawn(i % 3 ? 'star' : 'rainbow', m.x + rnd(-40, 40), y + rnd(-40, 40), { vx: rnd(-620, 620), vy: rnd(-620, 260), hue: rnd(0, 360), size: rnd(10, 22), color: pick(['#fff3a0', '#ffffff', '#ffb3e0']) });
  if (SFX.boom) SFX.boom();
  [1568, 2093, 2637, 3136].forEach((f, i) => note(f, 0.05 + i * 0.05, 0.25, { type: 'square', vol: 0.06 }));
  actPop('💥 クリティカル！ 💥', '#ff3a6a', 'crit big');
}

// ---------------------------------------------------------------------
//  スワイプ で よける（まちがえた とき）
// ---------------------------------------------------------------------
function openDodge(m, opts = {}) {
  const D = ACT.dodge = { phase: 'warn', done: false, pending: 0, dmg: opts.dmg || 0, onClose: opts.onClose || null, m, travel: m.boss ? ACT.dodgeTravel.boss : ACT.dodgeTravel.mob, t0: 0 };
  ACT.shield = 0;
  ACT.dodged = false;
  const el = $('actDodge');
  el.classList.add('warn');
  el.querySelector('.act-cap').textContent = opts.final ? '⚠ ボス の さいご の こうげき が くる！' : '⚠ こうげき が くる！ じゅんび して！';
  el.querySelector('.act-arrow').textContent = '❗';
  el.hidden = false;
  note(660, 0, 0.12, { type: 'square', vol: 0.05 }); note(660, 0.18, 0.12, { type: 'square', vol: 0.05 });
  later(ACT.warnSec, () => {
    if (ACT.dodge !== D) return;
    D.phase = 'go'; D.t0 = performance.now();
    el.classList.remove('warn');
    el.querySelector('.act-cap').textContent = 'たま が ひかる わ に はいったら タップ！';
    el.querySelector('.act-arrow').textContent = '';
    note(520, 0, 0.3, { type: 'sawtooth', vol: 0.04, slide: 1.5 });
    stepDodge(D);
  });
}
const dodgeK = (D) => (D.phase === 'go' ? (performance.now() - D.t0) / 1000 / D.travel : 0);
const dodgeIn = (D) => { const k = dodgeK(D); return k >= ACT.dodgeWin[0] && k <= ACT.dodgeWin[1]; };
function stepDodge(D) {
  if (ACT.dodge !== D || D.done) return;
  if (dodgeIn(D) && !D.ding) { D.ding = true; note(1175, 0, 0.1, { type: 'sine', vol: 0.07 }); }
  if (dodgeK(D) > ACT.dodgeWin[1]) { D.done = true; actPop('あたった……', '#e8203c'); closeDodge(); return; } // おそすぎ
  requestAnimationFrame(() => stepDodge(D));
}
// たま と ひかる わ（てき から ちゅなちゃん へ）
const dodgePath = (D) => {
  const m = D.m, a = { x: m.x - 60, y: GROUND() - m.height * 0.55 }, b = { x: HERO_X() + 20, y: GROUND() - 90 };
  return (k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * 50 });
};
function drawDodge() {
  const D = ACT.dodge;
  if (!D || !D.m || D.done) return;
  const at = dodgePath(D), [w0, w1] = ACT.dodgeWin, mid = at((w0 + w1) / 2), e0 = at(w0), e1 = at(w1);
  const R = Math.hypot(e1.x - e0.x, e1.y - e0.y) / 2 + 16, inWin = dodgeIn(D);
  ctx.save();
  ctx.lineWidth = inWin ? 9 : 6; ctx.strokeStyle = inWin ? '#fff3a0' : 'rgba(255,216,74,.75)';
  ctx.shadowColor = '#ffd84a'; ctx.shadowBlur = inWin ? 30 : 12;
  ctx.setLineDash(inWin ? [] : [14, 10]); ctx.lineDashOffset = -performance.now() / 30;
  ctx.beginPath(); ctx.arc(mid.x, mid.y, R, 0, 7); ctx.stroke();
  ctx.setLineDash([]);
  if (inWin) { ctx.fillStyle = 'rgba(255,243,160,.22)'; ctx.fill(); }
  const k = D.phase === 'go' ? Math.min(1, dodgeK(D)) : 0, p = at(k), r = D.phase === 'go' ? 22 : 10 + 10 * Math.abs(Math.sin(performance.now() / 120));
  const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r);
  g.addColorStop(0, '#fff6c0'); g.addColorStop(0.45, '#ff9a2e'); g.addColorStop(1, 'rgba(255,50,30,0)');
  ctx.shadowBlur = 0; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
  if (D.phase === 'go' && Math.random() < 0.6) spawn('twinkle', p.x + rnd(-6, 6), p.y + rnd(-6, 6), { color: pick(['#ff7a3c', '#ffd84a']), size: rnd(4, 8) });
  ctx.restore();
}
const baseDrawMonsterAct = drawMonster;
drawMonster = function () { baseDrawMonsterAct(); drawDodge(); };
function dodgeInput() {
  const D = ACT.dodge;
  if (!D || D.done || D.phase !== 'go') return; // よちょう の あいだ は まだ
  D.done = true;
  const ok = dodgeIn(D);
  if (ok) {
    ACT.dodged = true;
    S.hero.jump = 1;
    actPop('よけた！', '#1f9c74');
    note(1200, 0, 0.12, { type: 'sine', vol: 0.08, slide: 0.6 });
  } else actPop('はやすぎ……', '#e8203c');
  $('actDodge').hidden = true;
  if (ACT.dodged && D.pending === 0) ACT.shield = S.t + 1.2; // こうげき が まだ とどいて いない うち に よけた → この あと の こうげき は あたらない
  closeDodge(); // けっか が きまったら すぐ
}
function closeDodge() {
  const D = ACT.dodge;
  if (!D) return;
  ACT.dodge = null;
  $('actDodge').hidden = true;
  const n = D.pending + (ACT.dodged ? 0 : D.dmg); D.pending = 0;
  if (!ACT.dodged) for (let i = 0; i < n; i++) baseDamageHeroAct();
  if (!ACT.dodged && D.dmg) { S.hero.hurt = 1; S.shake = 1; S.flash = 0.6; S.flashColor = '255,80,60'; actPop(`だいダメージ！ −${D.dmg}`, '#e8203c'); }
  ACT.dodged = false;
  if (D.onClose) D.onClose();
  if (ACT.wantProceed) { ACT.wantProceed = false; later(0.4, () => baseProceedAct()); }
}
// よけている あいだ に「つぎへ」を おしたら、ダメージ が きまって から すすむ
const baseProceedAct = proceed;
proceed = function () { if (ACT.dodge) { ACT.wantProceed = true; return; } baseProceedAct(); };
// こうげき が あたる とき：よける ちゅう なら まって、よけたら 0
const baseDamageHeroAct = damageHero;
damageHero = function () {
  if (ACT.shield && S.t < ACT.shield) { ACT.shield = 0; return; } // よけた あと の こうげき
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
  const m = S.monster;
  const goAim = () => {
    ACT.aim = { go: () => baseStartChargeAct(withCat), drag: null, miss: 0 };
    const el = $('actAim'), cv = $('actAimCv');
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    el.hidden = false;
    drawAim();
    if (ACT.autoAim) later(0.3, () => aimFire());
  };
  if (m && m.boss && !m.finalAtkDone) { // とどめ の まえ に ボス の さいご の こうげき：よけられない と だいダメージ
    m.finalAtkDone = true;
    m.state = 'attack'; m.t = 0;
    if (SFX.roar) SFX.roar();
    openDodge(m, { final: true, dmg: ACT.finalDmg, onClose: () => {
      if (S.monster !== m) return;
      if (S.hp <= 0) { S.monster = null; levelFx('lose'); return; }
      m.state = 'idle';
      later(0.4, goAim);
    } });
    return;
  }
  goAim();
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
  if (ACT.timing && enter) { if (!e.repeat) timingDown(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (ACT.mash && enter && !e.repeat) { mashTap(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (ACT.aim && enter && !e.repeat) { aimFire(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (ACT.dodge && !ACT.dodge.done) { // どの キー でも よける
    const d = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1, Enter: 1, NumpadEnter: 1 }[e.code];
    if (d) { if (!e.repeat) dodgeInput(); e.preventDefault(); e.stopImmediatePropagation(); }
  }
}, true);
addEventListener('keyup', (e) => {
  if (ACT.timing && (e.key === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter')) { timingUp(); e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

// テスト よう
window.actTest = {
  state: () => ({ timing: !!ACT.timing, dodge: !!(ACT.dodge && ACT.dodge.phase === 'go' && !ACT.dodge.done), win: !!(ACT.dodge && dodgeIn(ACT.dodge)), warn: !!(ACT.dodge && ACT.dodge.phase === 'warn'), mash: !!ACT.mash, aim: !!ACT.aim, combo: ACT.combo }),
  tapGood() { if (!ACT.timing) return false; finishTiming(true); return true; },
  hold(sec) { const T = ACT.timing; if (!T) return false; timingDown(); T.hold = performance.now() - sec * 1000; return true; },
  release: () => timingUp(),
  dodgeAt(k) { const D = ACT.dodge; if (!D || D.phase !== 'go') return false; D.t0 = performance.now() - k * D.travel * 1000; return true; },
};
