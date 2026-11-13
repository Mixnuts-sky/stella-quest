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
      && !(typeof isHoikuen === 'function' && isHoikuen()) && (opts.bonus || Math.random() < BONUS.rate)) {
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
  baseDrawMonsterRare();
  if (m.dooon) outlinedText('どんっ！', m.x - m.height * 0.62, GROUND() - m.height * 0.4, 60 + m.dooon.t * 10, '#e2588f');
};
// 「どんっ」の あと すこし まって から もんだい（すぐ だと もんだい の パネル で かくれる）
const baseStartBattleTurnRare = startBattleTurn;
startBattleTurn = function () {
  const m = S.monster;
  if (m && m.big && !m.waited) { m.waited = true; later(1.3, () => { if (S.monster === m) baseStartBattleTurnRare(); }); return; }
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
