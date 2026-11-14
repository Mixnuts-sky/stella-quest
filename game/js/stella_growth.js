'use strict';
// =====================================================================
//  ステラクエスト：そだてる（ほし の かけら と つえ の きょうか・にゃんこ）
//  ・ほし の かけら：どの ダンジョン でも。ボス（なんいど ぶん）・たからばこ（ときどき）。むげん の とう の ボス は ふかい ほど
//  ・ぶきや で つえ を ＋1〜＋3（かけら 3・6・10こ）。せいかい の ダメージ が ＋ の ぶん ふえる
//  ・にゃんこ：いえ で チュール を あげると レベル 1〜5。ふつう の たたかい でも ときどき たすけ に くる
//  stella_endless.js の あと に よむ。しよう：docs/GAME_SPEC.md 15.2・15.3
// =====================================================================

const GROW = {
  plusCost: [3, 6, 10],     // ＋1・＋2・＋3 に する かけら
  chestShard: 0.25,         // たからばこ で かけら が でる かくりつ
  catExp: [0, 1, 3, 6, 10], // レベル 1〜5 に なる まで の チュール（ごうけい）
  catChance: 0.06,          // レベル × これ で たすけ に くる
};

// ---------------------------------------------------------------------
//  ほし の かけら
// ---------------------------------------------------------------------
function addShards(n) {
  const d = ST.data;
  d.shards = (d.shards || 0) + n;
  [1568, 2093, 2637].forEach((f, i) => note(f, i * 0.07, 0.2, { type: 'sine', vol: 0.06 }));
  stSave();
}
// ふつう の ダンジョン の ボス：なんいど ぶん
const baseDungeonClearGrow = dungeonClear;
dungeonClear = function () {
  const endless = typeof isEndless === 'function' && isEndless();
  const diff = !endless && ST.data.dungeon ? ST.data.dungeon.difficulty : 0;
  baseDungeonClearGrow();
  if (endless || !diff) return;
  addShards(diff);
  if (typeof DLG !== 'undefined' && DLG.lines) DLG.lines.push({ who: '', text: `✨ ほし の かけら を ${diff}こ てに いれた！（いま ${ST.data.shards}こ）` });
};
// たからばこ：なぞなぞ が せいかい なら ときどき かけら も
const baseAnswerRiddleGrow = answerRiddle;
answerRiddle = function (i) {
  const R = S.riddle, ok = R && !R.done && i === R.answer;
  baseAnswerRiddleGrow(i);
  if (ok && ST.data && inDungeon() && Math.random() < GROW.chestShard) {
    addShards(1);
    $('riddleResult').insertAdjacentHTML('beforeend', '<small class="shard-get">✨ ほし の かけら も 1こ はいっていた！</small>');
  }
};

// ---------------------------------------------------------------------
//  つえ の きょうか（ぶきや）
// ---------------------------------------------------------------------
const staffPlus = (name = ST.data.equip) => ((ST.data.staffPlus || {})[name] || 0);
const baseOpenWeaponShopGrow = openWeaponShop;
openWeaponShop = function (msg = '') {
  baseOpenWeaponShopGrow(msg);
  const d = ST.data, p = $('stPanel'), at = p.querySelector('.shop-msg');
  if (!at) return;
  const plus = staffPlus(), cost = GROW.plusCost[plus];
  p.querySelectorAll('.wcard .wname').forEach((el) => { const n = staffPlus(el.textContent); if (n) el.insertAdjacentHTML('beforeend', ` <b class="wplus">＋${n}</b>`); });
  at.insertAdjacentHTML('beforebegin', `<div class="grow-row"><span>✨ ほし の かけら <b>${d.shards || 0}</b>こ</span>
    <span>そうび：${d.equip} <b class="wplus">＋${plus}</b></span>
    ${cost ? `<button type="button" class="buy" id="plusBtn" ${(d.shards || 0) >= cost ? '' : 'disabled'}>つよく する（かけら ${cost}こ）</button>` : '<span class="wmax">いちばん つよい！</span>'}</div>`);
  const b = $('plusBtn');
  if (b) b.addEventListener('click', () => upgradeStaff());
};
function upgradeStaff() {
  const d = ST.data, plus = staffPlus(), cost = GROW.plusCost[plus];
  if (!cost || (d.shards || 0) < cost) return;
  d.shards -= cost;
  d.staffPlus = { ...(d.staffPlus || {}), [d.equip]: plus + 1 };
  SFX.levelUp(); stSave();
  openWeaponShop(`「${d.equip}」が ＋${plus + 1} に なった！ まほう が つよく なるよ！`);
  stRenderHud();
}
// せいかい の ダメージ に ＋ の ぶん（アルト の れんしゅう は のぞく）
const baseOnSpellHitGrow = onSpellHit;
onSpellHit = function () {
  const m = S.monster, plus = ST.data && ST.battle && !ST.battle.practice && m && !m.nanmon ? staffPlus() : 0;
  if (plus) m.hp = m.boss ? Math.max(1, m.hp - plus) : Math.max(0, m.hp - plus);
  baseOnSpellHitGrow();
};
const baseUpdateUIGrow = updateUI;
updateUI = function () {
  baseUpdateUIGrow();
  const a = $('stAtk');
  if (a && ST.data) { const p = staffPlus(); a.textContent = p ? `${heroAtk()}＋${p}` : heroAtk(); }
};

// ---------------------------------------------------------------------
//  にゃんこ を そだてる
// ---------------------------------------------------------------------
const catOf = () => { const d = ST.data; if (!d.cat) d.cat = { lv: 1, exp: 0 }; return d.cat; };
function openCat(msg = '') {
  const c = catOf(), d = ST.data, have = d.items.filter((x) => x === 'churu').length;
  const next = GROW.catExp[c.lv];
  const p = stPanel(`<div class="shop-head"><span class="shop-title">🐈 にゃんこ</span><span class="shop-arca">レベル <b class="cat-lv">${c.lv}</b></span></div>
    <div class="cat-box"><div class="cat-face">${'🐾'.repeat(c.lv)}</div>
      <div class="shop-talk">${c.lv >= 5 ? 'さいこう の レベル！ たくさん たすけて くれるよ！' : `あと チュール ${next - c.exp}こ で レベル ${c.lv + 1}`}</div>
      <small>レベル が あがると、ダンジョン で ときどき たすけ に くる（いま ${Math.round(c.lv * GROW.catChance * 100)}%）</small></div>
    <div class="shop-msg">${msg}</div>
    <div class="shop-foot two"><button type="button" class="buy feed" ${have && c.lv < 5 ? '' : 'disabled'}>チュール を あげる（${have}こ）</button><button type="button" class="close">とじる（Esc）</button></div>`);
  p.querySelector('.feed').addEventListener('click', feedCat);
  p.querySelector('.close').addEventListener('click', closePanel);
}
function feedCat() {
  const d = ST.data, c = catOf(), i = d.items.indexOf('churu');
  if (i < 0 || c.lv >= 5) return;
  d.items.splice(i, 1);
  c.exp++;
  SFX.meow();
  let msg = 'にゃ〜ん♪ おいしそう に たべた！';
  if (c.exp >= GROW.catExp[c.lv]) { c.lv++; msg = `🎉 にゃんこ が レベル ${c.lv} に なった！`; SFX.levelUp(); }
  stSave(); renderHud(); stRenderHud();
  openCat(msg);
}
// いえ の しろねこ を しらべると にゃんこ の がめん
(() => {
  const spot = INTERIORS.house.spots.find((s) => s.id === 'cat');
  if (spot) { spot.label = 'にゃんこ'; spot.act = () => { SFX.meow(); openCat(); }; }
})();

// ふつう の たたかい で ときどき たすけ に くる（はじめ に にゃんこ パンチ）
const baseEncounterGrow = encounter;
encounter = function (opts = {}) {
  baseEncounterGrow(opts);
  const m = S.monster;
  if (!m || m.boss || m.necro || m.nanmon || !ST.battle || ST.battle.practice || !inDungeon() || S.churu) return;
  const lv = catOf().lv;
  if (Math.random() < lv * GROW.catChance) m.catAssist = lv;
};
const baseStartBattleTurnGrow = startBattleTurn;
startBattleTurn = function () {
  const m = S.monster;
  if (!m || !m.catAssist || m.catAssistDone) { baseStartBattleTurnGrow(); return; }
  m.catAssistDone = true;
  catEnter(['てつだう', 'にゃ！']);
  later(1.0, () => {
    if (S.monster !== m) return;
    m.hp = Math.max(1, m.hp - m.catAssist); m.hitFlash = 1; S.shake = 0.4;
    SFX.meow(); SFX.boom && SFX.boom();
    for (let i = 0; i < 14; i++) spawn('star', m.x, GROUND() - m.height * 0.5, { vx: rnd(-260, 260), vy: rnd(-320, 40), color: '#ffb3e0' });
    catSay(['にゃんこ', `パンチ！ −${m.catAssist}`]);
  });
  later(2.4, () => { catLeave(); if (S.monster === m) baseStartBattleTurnGrow(); });
};
// ボス の ピンチ で たすけ に くる とき：レベル が たかい と こうげき も
const baseCatHelpGrow = catHelp;
catHelp = function (next) {
  const lv = ST.data ? catOf().lv : 1, m = S.monster;
  baseCatHelpGrow(next);
  if (lv > 1 && m && m.boss) later(2.0, () => { if (S.monster === m && m.hp > 1) { m.hp = Math.max(1, m.hp - (lv - 1)); m.hitFlash = 1; SFX.meow(); catSay(['にゃんこ', `キック！ −${lv - 1}`]); } });
};

// テスト よう
window.growTest = { addShards, staffPlus, upgradeStaff, openCat, feedCat, catOf };
