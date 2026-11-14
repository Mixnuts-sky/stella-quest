'use strict';
// =====================================================================
//  ステラクエスト：レアてき と ボーナスてき（stella_dungeon.js の あと に よむ）
//  ・レアてき：しまじろう だけ（デザイン/レア敵/しまじろう.jpeg）。おおきく「どんっ」と おちてくる
//      たおすと「ゴゴゴゴ…」と いいながら、したから すこしずつ きり に なって きえる
//  ・ボーナスてき：セイレーン・にんぎょのしまのひみつ（デザイン/レア敵/ の のこり 2まい）
//      ふつうの てき として すこし すくなめ に でる（BONUS.rate）。でるとき キラキラ
//      もんだい は さんすう か かんじ。たおすと アルカ 1.5ばい（「ボーナス！」と わかる ように）
//  しよう：docs/GAME_SPEC.md「9.56 レアてき と ボーナスてき」
// =====================================================================

const RARE_NAME = 'しまじろう';
const BONUS = { rate: 0.12, mult: 1.5 }; // ふつうの てき の うち ボーナスてき に なる わりあい・アルカ の ばいりつ
try { const t = localStorage.getItem('stella:test:bonusRate'); if (t !== null) BONUS.rate = +t; } catch { /* テスト よう（ふだん は ない） */ }
let BONUS_SPR = [];

// え を わける：レアてき は しまじろう だけ、のこり は ボーナスてき
function splitRareSprites() {
  if (!SPR.rares.length) return false;
  const shima = SPR.rares.filter((s) => s.name === RARE_NAME);
  if (!shima.length) return true; // しまじろう の え が ない ときは いままで どおり
  BONUS_SPR = SPR.rares.filter((s) => s.name !== RARE_NAME);
  SPR.rares = shima;
  return true;
}
(function waitSprites() { if (!splitRareSprites()) setTimeout(waitSprites, 200); })();

// ---------------------------------------------------------------------
//  でてくる とき
// ---------------------------------------------------------------------
const baseEncounterRare = encounter;
encounter = function (opts = {}) {
  baseEncounterRare(opts);
  const m = S.monster;
  if (!m || m.boss || m.necro || m.nanmon) return;
  if (m.rare && m.spr && m.spr.name === RARE_NAME) {
    // おおきく、そら から「どんっ」
    m.height = 300; m.big = true; m.vy = 900; m.y = -500; m.x = W * 0.74; // もんだい の パネル に かさならない ように みぎ へ
    return;
  }
  // ボーナスてき（ダンジョン の ふつうの てき だけ。ほいくえん は うぇーおー だけ なので でない）
  if (!m.rare && inDungeon() && ST.battle && ST.battle.returnTo === 'dungeon' && BONUS_SPR.length
      && !(typeof isHoikuen === 'function' && isHoikuen()) && (opts.sym ? opts.bonus : (opts.bonus || Math.random() < BONUS.rate))) { // マップ の てき は はじめ から きまっている
    const spr = pick(BONUS_SPR), pw = ENEMY_POWER[S.level] || ENEMY_POWER[1];
    Object.assign(m, { spr, bonus: true, tintColor: null, name: spr.name, height: (spr.height || 190) * pw.scale,
      power: { ...pw, aura: 'rgba(255,215,90,.95)', filter: null, anger: false, horns: false, crown: false },
      subject: Math.random() < 0.6 ? 'math' : 'kanji' });
    S.flash = 0.6; S.flashColor = '255,244,190';
    for (let i = 0; i < 46; i++) spawn(i % 2 ? 'twinkle' : 'rainbow', ENEMY_X() + rnd(-120, 120), GROUND() - rnd(20, 260), { vx: rnd(-160, 160), vy: rnd(-260, -40), hue: rnd(0, 360), color: pick(['#fff3a0', '#ffffff', '#ffd6f0']), size: rnd(8, 18) });
    chimeBonus();
  }
};
// もんだい の うえ の なまえ に「✨ ボーナス」
const baseAskRare = askQuestion;
askQuestion = function () {
  baseAskRare();
  const m = S.monster;
  if (m && m.bonus && !$('monName').querySelector('.bonus-tag')) $('monName').insertAdjacentHTML('afterbegin', '<span class="bonus-tag">✨ ボーナス アルカ 1.5ばい</span> ');
};
function chimeBonus() { [1046, 1318, 1568, 2093].forEach((f, i) => note(f, i * 0.07, 0.25, { type: 'sine', vol: 0.07 })); }

// ボーナスてき は ずっと すこし キラキラ
const baseUpdateRare = update;
update = function (dt) {
  baseUpdateRare(dt);
  const m = S.monster;
  if (m && m.bonus && m.alpha > 0 && Math.random() < dt * 6) spawn('twinkle', m.x + rnd(-80, 80), GROUND() - rnd(10, m.height), { color: pick(['#fff3a0', '#ffffff']), size: rnd(6, 12) });
  if (m && m.big) stepBigRare(m, dt);
};

// しまじろう：「どんっ」と ついたら ゆれる。たおされたら したから きり に
function stepBigRare(m, dt) {
  if (m.landed && !m.thudDone) {
    m.thudDone = true;
    S.shake = 1.4; SFX.bossLand();
    note(55, 0, 0.5, { type: 'sine', vol: 0.3, slide: 0.6 });
    for (let i = 0; i < 22; i++) spawn('puff', m.x + rnd(-170, 170), GROUND() - rnd(0, 24), { vx: rnd(-220, 220), vy: rnd(-90, -10) });
    m.dooon = { t: 0 };
  }
  if (m.dooon) { m.dooon.t += dt; if (m.dooon.t > 1.2) m.dooon = null; }
  // 「バーーーッ」：たたかい の はじめ と、こうげき して くる とき に 手 を パタパタ
  if (m.thudDone && !m.baaStart) { m.baaStart = true; m.baa = { t: -1.0 }; } // どんっ！ の あと
  if (m.state === 'attack' && !m.baaAtk) { m.baaAtk = true; m.baa = { t: 0 }; }
  if (m.state !== 'attack') m.baaAtk = false;
  if (m.baa) {
    const before = m.baa.t;
    m.baa.t += dt;
    if (before < 0 && m.baa.t >= 0) baaVoice();
    if (m.baa.t > BAA_SEC) m.baa = null;
  }
  if (m.state === 'hit' && !m.fade) {
    m.fade = { t: 0 }; m.alpha = 0.999;
    document.body.classList.add('miracle'); // きえる ところ を もんだい の パネル で かくさない
    rumble();
  }
  if (m.fade) {
    m.fade.t += dt;
    m.alpha = 0.999; // game.js の「ポン」（alpha === 1 の とき）を おこさない
    if (m.fade.t < FADE_SEC) document.body.classList.add('miracle'); // まほう の えんしゅつ が おわっても、きえきる まで もんだい は かくす
    const k = Math.min(1, m.fade.t / FADE_SEC), lineY = GROUND() - m.height * k;
    for (let i = 0; i < 5; i++) spawn('puff', m.x + rnd(-m.height * 0.38, m.height * 0.38), lineY + rnd(-10, 20), { vx: rnd(-50, 50), vy: rnd(-90, -30) });
  }
}
const FADE_SEC = 2.6;
function rumble() { // ゴゴゴゴ…
  note(48, 0, FADE_SEC, { type: 'sawtooth', vol: 0.09, vib: 6 });
  noise(0, FADE_SEC, 0.12, 120);
}

// しまじろう を かく：おちてくる ときは そのまま、たおされたら した から きえていく
const baseDrawMonsterRare = drawMonster;
drawMonster = function () {
  const m = S.monster;
  if (!m || !m.big) { baseDrawMonsterRare(); return; }
  if (m.state === 'hit' && m.fade) {
    const k = Math.min(1, m.fade.t / FADE_SEC), cut = GROUND() + 10 - m.height * k;
    const saved = m.state; m.state = 'idle'; // 「つぶれる」かたち では なく そのまま
    ctx.save();
    ctx.beginPath(); ctx.rect(-30, -60, W + 60, cut + 60); ctx.clip();
    ctx.globalAlpha = 1 - k * 0.3;
    baseDrawMonsterRare();
    ctx.restore();
    m.state = saved;
    const shake = (Math.random() - 0.5) * 6;
    outlinedText('ゴゴゴゴゴゴゴ…', m.x + shake, GROUND() - m.height * 0.55, 44, '#8a6a4a');
    return;
  }
  const baa = m.baa && m.baa.t >= 0 && m.state !== 'hit' ? m.baa : null;
  if (baa) drawBaaHands(m, baa.t, true);
  const x0 = m.x;
  if (baa) m.x += Math.sin(S.t * 70) * 7; // ぶるぶる
  baseDrawMonsterRare();
  m.x = x0;
  if (baa) drawBaaHands(m, baa.t, false);
  if (m.dooon) outlinedText('どんっ！', m.x - m.height * 0.62, GROUND() - m.height * 0.4, 60 + m.dooon.t * 10, '#e2588f');
  if (baa) drawBaaText(m, baa.t);
};

// ---------------------------------------------------------------------
//  しまじろう の「バーーーッ」（て を たくさん だして パタパタ）
// ---------------------------------------------------------------------
const BAA_SEC = 2.2;
const BAA_HANDS = [ // からだ の まわり（ちゅうしん から の むき・きょり・おおきさ・うしろ か）
  [-2.5, 0.62, 1.0, true], [-2.0, 0.7, 0.9, false], [-1.4, 0.66, 1.05, true], [-0.9, 0.62, 0.85, false],
  [-0.45, 0.7, 1.0, true], [0.0, 0.68, 0.9, false], [0.45, 0.66, 1.0, true], [0.95, 0.6, 0.85, false],
  [-2.85, 0.5, 0.8, false], [-0.2, 0.52, 0.8, true], [-1.75, 0.5, 0.8, false], [0.7, 0.5, 0.75, true],
];
function drawBaaHands(m, t, back) {
  const cx = m.x, cy = GROUND() - m.height * 0.55, R = m.height * 0.62;
  const grow = Math.min(1, t / 0.18) * (t > BAA_SEC - 0.3 ? Math.max(0, (BAA_SEC - t) / 0.3) : 1);
  BAA_HANDS.forEach(([a, d, sz, isBack], i) => {
    if (isBack !== back) return;
    const flap = Math.sin(S.t * 38 + i * 1.7) * 0.55;
    const ang = a - Math.PI / 2 + Math.PI / 2 + flap * 0.25;
    const x = cx + Math.cos(ang) * R * d * (0.9 + 0.1 * Math.sin(S.t * 30 + i)), y = cy + Math.sin(ang) * R * d * 0.95;
    drawBaaHand(x, y, ang + Math.PI / 2 + flap, m.height * 0.2 * sz * grow);
  });
}
function drawBaaHand(x, y, rot, s) {
  if (s <= 1) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#fbe7c2'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, s * 0.07); ctx.lineJoin = 'round';
  // うで
  ctx.beginPath(); ctx.moveTo(-s * 0.18, s * 0.25); ctx.lineTo(-s * 0.14, s * 0.9); ctx.lineTo(s * 0.14, s * 0.9); ctx.lineTo(s * 0.18, s * 0.25); ctx.fill(); ctx.stroke();
  // ゆび（4ほん ＋ おやゆび）
  for (let k = 0; k < 4; k++) {
    const fx = (k - 1.5) * s * 0.16;
    ctx.beginPath(); ctx.ellipse(fx, -s * 0.28, s * 0.075, s * 0.2, (k - 1.5) * 0.12, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(s * 0.3, s * 0.02, s * 0.07, s * 0.17, 0.9, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.3, s * 0.27, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawBaaText(m, t) {
  const k = Math.min(1, t / 0.15), wob = (Math.random() - 0.5) * 6;
  ctx.save();
  ctx.globalAlpha = t > BAA_SEC - 0.3 ? Math.max(0, (BAA_SEC - t) / 0.3) : 1;
  const x = m.x - m.height * 0.78 + wob, y = GROUND() - m.height * 0.95;
  ctx.font = `900 ${Math.round(58 * k)}px "Dela Gothic One", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 9; ctx.strokeStyle = '#ffffff'; ctx.fillStyle = INK; ctx.lineJoin = 'round';
  'バーーーッ'.split('').forEach((ch, i) => { // たて がき
    const yy = y + i * 54 * k, rot = ch === 'ー' ? Math.PI / 2 : 0;
    ctx.save(); ctx.translate(x, yy); ctx.rotate(rot); ctx.strokeText(ch, 0, 0); ctx.fillText(ch, 0, 0); ctx.restore();
  });
  ctx.restore();
}
function baaVoice() { noise(0, 1.2, 0.07, 900); note(160, 0, 0.9, { type: 'sawtooth', vol: 0.05, vib: 14 }); }
// 「どんっ」の あと すこし まって から もんだい（すぐ だと もんだい の パネル で かくれる）
const baseStartBattleTurnRare = startBattleTurn;
startBattleTurn = function () {
  const m = S.monster;
  if (m && m.big && !m.waited) { m.waited = true; later(2.9, () => { if (S.monster === m) baseStartBattleTurnRare(); }); return; } // どんっ → バーーーッ の あと
  baseStartBattleTurnRare();
};
// きえおわる まで まって から たたかい を おえる
const baseOnSpellHitRare = onSpellHit;
onSpellHit = function () {
  const m = S.monster;
  baseOnSpellHitRare();
  if (m && m.big && m.state === 'hit') {
    const fx = timers.findIndex((t) => t.fn === endBattle);
    if (fx >= 0) timers[fx].t = Math.max(timers[fx].t, FADE_SEC + 0.6);
  }
};

// ---------------------------------------------------------------------
//  ボーナスてき を たおした：アルカ 1.5ばい
// ---------------------------------------------------------------------
const baseEndBattleRare = endBattle;
endBattle = function () {
  const m = S.monster, b = ST.battle;
  const bonusWin = !!(m && m.bonus && m.state === 'hit' && b && b.returnTo === 'dungeon');
  const before = ST.data ? ST.data.arca : 0;
  baseEndBattleRare();
  if (!bonusWin) return;
  const base = ST.data.arca - before, extra = Math.round(base * (BONUS.mult - 1));
  ST.data.arca += extra;
  snapshotDungeon(); stSave('dungeon'); stRenderHud();
  chimeBonus(); later(0.25, coinSound);
  showBanner(`✨ ボーナス！ アルカ ${BONUS.mult}ばい ✨`, 2.2);
  showToast(`${m.name}を たおした！ ${base} ＋ ボーナス ${extra} ＝ ${base + extra} アルカ！`, 3.2);
  S.lastBonus = { base, extra }; // テストよう
};
