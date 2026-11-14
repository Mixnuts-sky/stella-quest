'use strict';
// =====================================================================
//  ステラクエスト：むげん の ダンジョン「ほしふる むげんの とう」
//  ・なんいど6 を クリア した あと、ダンジョン の いりぐち で えらべる
//  ・ふしぎな ダンジョン（stella_rogue.js）が むげん に つづく。5かい ごと に ボス の かい
//  ・ふかい ほど つよい：もんだい は 5かい ごと に なんいど が あがる（26かい から 6）。31かい から HP が ふえる
//  ・もちこみ なし（もちもの は まち に あずける）。アルカ は なか だけ（でると きえる）
//  ・10かい ごと の ボス の あと に「やすみ の へや」（しまじろう の おみせ・やどや）
//  ・HP 0・きかんのはね で まち へ。なんかい まで いけたか を きろく・ランキング
//  stella_action.js の あと に よむ。しよう：docs/GAME_SPEC.md 15.1
// =====================================================================

const ENDLESS = { bossEvery: 5, restEvery: 10, rankKey: 'stella:endless', pending: null };
const isEndless = () => !!(ST.data && ST.data.dungeon && ST.data.dungeon.endless);
const endlessDiff = (floor) => Math.min(6, Math.ceil(floor / ENDLESS.bossEvery));
const endlessMobExtra = (floor) => (floor > 30 ? Math.floor((floor - 31) / 5) + 1 : 0);
const endlessBossHp = (floor) => (floor <= 30 ? bossHpOf(endlessDiff(floor)) : 60 + (floor - 30) * 2);
const ENDLESS_NAME = 'ほしふる むげんの とう';

rgIsLastFloor = (diff, floor) => (isEndless() ? floor % ENDLESS.bossEvery === 0 : floor >= diff);

// ---------------------------------------------------------------------
//  はいる
// ---------------------------------------------------------------------
function enterEndless() {
  const d = ST.data;
  d.endless = { arcaOut: d.arca, items: d.items.slice(), floor: 1 }; // もちもの と アルカ は まち に あずける
  d.arca = 0; d.items.length = 0;
  if (typeof TA !== 'undefined') TA.run = null;
  ST.scene = 'dungeon';
  S.level = 1;
  CONFIG.maxHp = stMaxHp();
  S.hp = d.hp; S.items = d.items; S.churu = false;
  S.monster = null; S.q = null; S.catUsed = false; S.hintNext = false; S.castleX = null;
  d.dungeon = { difficulty: 1, endless: true };
  RG.gauge = 0; RG.omen = null; RG.cur = null; RG.dark = 0;
  rgStartFloor(1, 1);
  CONFIG.encounterChance = 0;
  snapshotDungeon();
  stSave('dungeon');
  setMode('walk');
  showBanner('🌌 むげん の とう ちか1かい', 2.2);
  later(1.2, () => showToast('もちもの と アルカ は まち に あずけた よ。なか の アルカ は なか だけ で つかえる！', 3.4));
}

// いりぐち：なんいど6 クリア で「むげん の とう」
const baseGateEndless = enterDungeonGate;
enterDungeonGate = function () {
  baseGateEndless();
  const p = $('stPanel'), list = p.querySelector('.dlist');
  if (!list) return;
  const d = ST.data, open = d.cleared[6] > 0, best = (d.flags && d.flags.endlessBest) || 0;
  list.insertAdjacentHTML('afterend', `<div class="endless-row">
    <button type="button" class="dg endless ${open ? '' : 'locked'}" id="endlessGo" ${open ? '' : 'disabled'}>
      <span class="dn">∞</span><span class="dname">${open ? `🌌 ${ENDLESS_NAME}` : '？？？'}</span>
      <span class="dstate">${open ? (best ? `さいこう ちか ${best} かい` : 'どこまで いけるかな？') : 'ドラゴンの おしろ を クリア しよう'}</span></button>
    <button type="button" class="ta-rank-btn" id="endlessRank">🏆 むげん の ランキング</button></div>`);
  if (open) $('endlessGo').addEventListener('click', () => { closePanelSilently(); enterEndless(); });
  $('endlessRank').addEventListener('click', () => { closePanelSilently(); showEndlessRanking(0, () => enterDungeonGate()); });
};

// ---------------------------------------------------------------------
//  かい を すすむ
// ---------------------------------------------------------------------
const baseNextFloorEndless = rgNextFloor;
rgNextFloor = function (byPit) {
  if (!isEndless()) { baseNextFloorEndless(byPit); return; }
  const d = ST.data, floor = S.maze.floor + 1, diff = endlessDiff(floor);
  d.dungeon.difficulty = diff; S.level = diff;
  RG.omen = null;
  rgStartFloor(diff, floor);
  if (byPit) { const p = rgFreeTile(S.maze.rooms, null) || S.maze.start; rgPlaceHero(p); rgSnapshot(true); }
  d.endless.floor = floor;
  stSave('dungeon');
  stRenderHud();
  const boss = floor % ENDLESS.bossEvery === 0;
  showBanner(`🌌 ちか ${floor} かい${boss ? '（ボス の かい！）' : ''}`, 2.2);
  if (boss) later(1.0, () => showToast('この かい の どこかに ボスの おしろ が ある……！', 3));
  else if (floor % ENDLESS.bossEvery === 1 && floor > 1) later(1.0, () => showToast(`もんだい が なんいど ${diff} に なった！`, 2.6));
};

// ボス を たおした：かけら・アルカ（なか）→ やすみ の へや か つぎ の かい
const baseDungeonClearEndless = dungeonClear;
dungeonClear = function () {
  if (!isEndless()) { baseDungeonClearEndless(); return; }
  const d = ST.data, floor = S.maze.floor, diff = endlessDiff(floor);
  const arca = Math.round(ARCA_REWARD[diff][1] / 2), shards = Math.ceil(floor / ENDLESS.bossEvery);
  d.arca += arca;
  if (typeof addShards === 'function') addShards(shards);
  SFX.levelUp();
  setMode('walk');
  showBanner(`⭐ ちか ${floor} かい の ボス を たおした！ ⭐`, 2.4);
  later(0.8, () => showToast(`${arca} アルカ（なか だけ）と ほし の かけら ${shards}こ を てに いれた！`, 3));
  d.flags.endlessBest = Math.max(d.flags.endlessBest || 0, floor);
  RG.lock = 1.6;
  later(1.6, () => { if (floor % ENDLESS.restEvery === 0) startRest(); else rgNextFloor(false); });
};

// ボス・ざこ の HP（ふかい ほど つよい）
const baseSpawnBossEndless = spawnBoss;
spawnBoss = function () {
  baseSpawnBossEndless();
  const m = S.monster;
  if (!isEndless() || !m || !ST.battle) return;
  const floor = S.maze ? S.maze.floor : 5;
  m.hp = m.maxHp = m.hpShown = endlessBossHp(floor);
  m.height *= 1 + Math.min(0.35, floor / 150);
  m.endlessFloor = floor;
};
const baseEncounterEndless = encounter;
encounter = function (opts = {}) {
  baseEncounterEndless(opts);
  const m = S.monster;
  if (!isEndless() || !m || m.boss || m.necro || !ST.battle) return;
  const extra = endlessMobExtra(S.maze ? S.maze.floor : 1);
  if (extra) { m.hp += extra; m.maxHp += extra; }
};

// ---------------------------------------------------------------------
//  やすみ の へや（しまじろう の おみせ・やどや）
// ---------------------------------------------------------------------
function startRest() {
  const d = ST.data, floor = S.maze.floor, TW = 13, TH = 11;
  const grid = new Uint8Array(TW * TH), roomOf = new Int16Array(TW * TH).fill(-1);
  for (let y = 2; y <= 8; y++) for (let x = 2; x <= 10; x++) { grid[y * TW + x] = 1; roomOf[y * TW + x] = 0; }
  const M = {
    rogue: true, TW, TH, grid, roomOf, rooms: [{ id: 0, x: 2, y: 2, w: 9, h: 7, house: false }], start: { x: 6, y: 8 }, goal: { x: 6, y: 2 }, last: false,
    floor, items: [], chests: [], pits: [], house: -1, houseWoken: false,
    fog: new Uint8Array(TW * TH).fill(1), vis: new Uint8Array(TW * TH), visited: new Uint8Array(TW * TH),
    enemies: [], death: null, shima: false, steps: 0, spawnT: -1e9, heroScreen: null, mapAll: true,
    rest: { shop: { x: 3, y: 4 }, inn: { x: 9, y: 4 } },
  };
  S.maze = M;
  rgPlaceHero(M.start);
  rgSnapshot(true);
  stSave('dungeon');
  stRenderHud();
  showBanner('☕ やすみ の へや', 2.2);
  later(1.0, () => showToast('しまじろう の おみせ と やどや が あるよ。かいだん で つぎ の かい へ！', 3.2));
}
// やすみ の へや では てき・死神 は でない
const baseOmenEndless = rgOmenStep;
rgOmenStep = function () { if (S.maze && S.maze.rest) return; baseOmenEndless(); };
const baseResumeEndless = resumeDungeon;
resumeDungeon = function () { baseResumeEndless(); if (S.maze && S.maze.rest) { S.maze.spawnT = -1e9; S.maze.fog.fill(1); } };

const baseArriveEndless = rgArrive;
rgArrive = function () {
  baseArriveEndless();
  const M = S.maze;
  if (!M || !M.rest || S.mode !== 'walk') return;
  const at = (o) => o.x === S.pos.x && o.y === S.pos.y;
  if (at(M.rest.shop)) { heldDirs.length = 0; openItemShop(); }
  else if (at(M.rest.inn)) {
    heldDirs.length = 0;
    if (S.hp >= stMaxHp()) { showToast('やどや：HP は まんたん だね！ がんばって！', 2.4); return; }
    S.hp = stMaxHp(); ST.data.hp = S.hp;
    healEffect(); renderHud(); stRenderHud(); stSave('dungeon');
    showToast('やどや で ひとやすみ…… HP が ぜんかいふく！', 2.6);
  }
};
// おみせ を とじたら ダンジョン に もどる（かった とき に がめん を かきなおしても）
const baseOpenItemShopEndless = openItemShop;
openItemShop = function (msg) {
  baseOpenItemShopEndless(msg);
  if (isEndless() && S.maze && S.maze.rest) panelClose = () => { setMode('walk'); stRenderHud(); };
};
// やすみ の へや の ひと（マップ の うえ に かく）
function rgRestObjs(objs, T) {
  const M = S.maze;
  const shima = (SPR.rares || []).find((s) => s.name === RARE_NAME) || (typeof BONUS_SPR !== 'undefined' ? null : null);
  const put = (o, draw) => objs.push({ y: o.y - 0.01, draw });
  put(M.rest.shop, () => {
    const sx = M.rest.shop.x * T + T / 2, sy = M.rest.shop.y * T + T * 0.92, hh = T * 1.4;
    if (shima) ctx.drawImage(shima.canvas, sx - hh * shima.w / shima.h / 2, sy - hh, hh * shima.w / shima.h, hh);
    outlinedText('🍛 おみせ', sx, sy - hh - 6, 14, '#e2588f');
  });
  put(M.rest.inn, () => {
    const sx = M.rest.inn.x * T + T / 2, sy = M.rest.inn.y * T + T * 0.92;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.fillRect(sx - T * 0.4, sy - T * 0.45, T * 0.8, T * 0.4); ctx.strokeRect(sx - T * 0.4, sy - T * 0.45, T * 0.8, T * 0.4);
    ctx.fillStyle = '#ff9ec4'; ctx.fillRect(sx - T * 0.4, sy - T * 0.45, T * 0.3, T * 0.4);
    outlinedText('🛏 やどや', sx, sy - T * 0.7, 14, '#8a5cd1');
  });
}
// ダンジョン で おみせ を ひらいた とき も うしろ に マップ を かく
SCENES.dungeon = { draw() { if (S.maze) drawMaze(); } };

// ---------------------------------------------------------------------
//  でる：もちもの・アルカ を もどして、きろく
// ---------------------------------------------------------------------
const baseLeaveEndless = leaveDungeon;
leaveDungeon = function (kind) {
  const d = ST.data;
  if (!isEndless()) { baseLeaveEndless(kind); return; }
  const reached = S.maze ? S.maze.floor : (d.endless && d.endless.floor) || 1;
  baseLeaveEndless(kind);
  if (d.endless) {
    d.arca = d.endless.arcaOut;
    d.items.length = 0; d.endless.items.forEach((id) => d.items.push(id));
  }
  d.endless = null;
  d.flags.endlessBest = Math.max(d.flags.endlessBest || 0, reached);
  const r = loadEndlessRanking(), entry = { floor: reached, slot: ST.slot, date: new Date().toISOString().slice(0, 10) };
  const list = [...r, entry].sort((a, b) => b.floor - a.floor), rank = list.indexOf(entry) + 1;
  saveEndlessRanking(list.slice(0, 5));
  ENDLESS.pending = { reached, rank: rank <= 5 ? rank : 0 };
  ENDLESS.last = { ...ENDLESS.pending }; // テスト よう
  stSave();
  stRenderHud();
};
// まち に もどった かいわ の さいご に きろく → ランキング
const baseStDialogEndless = stDialog;
stDialog = function (lines, done) {
  const P = ENDLESS.pending;
  if (!P) { baseStDialogEndless(lines, done); return; }
  ENDLESS.pending = null;
  baseStDialogEndless([...lines, `🌌 ちか ${P.reached} かい まで いけた！${P.rank ? `　ランキング ${P.rank}い！` : ''}`, 'あずけていた もちもの と アルカ を うけとった。'],
    () => { if (done) done(); showEndlessRanking(P.rank); });
};

function loadEndlessRanking() { try { return JSON.parse(localStorage.getItem(ENDLESS.rankKey)) || []; } catch { return []; } }
function saveEndlessRanking(r) { try { localStorage.setItem(ENDLESS.rankKey, JSON.stringify(r)); } catch { /* ほぞん できなくても あそべる */ } }
function showEndlessRanking(highlight = 0, back = null) {
  const list = loadEndlessRanking(), medal = ['🥇', '🥈', '🥉', '4', '5'];
  const rows = list.length ? list.map((e, i) => `<tr class="${i + 1 === highlight ? 'me' : ''}"><td>${medal[i]}</td><td class="tt">ちか ${e.floor} かい</td><td>スロット ${e.slot}</td><td>${e.date}</td></tr>`).join('')
    : '<tr><td colspan="4">まだ きろく が ないよ</td></tr>';
  const p = stPanel(`<div class="shop-head"><span class="shop-title">🏆 むげん の とう ランキング</span></div>
    <div class="shop-talk">どこまで ふかく いけたか（ぜんぶ の セーブ いっしょ）</div>
    <table class="ta-table">${rows}</table>
    <div class="shop-foot"><button type="button" class="close">とじる（Esc）</button></div>`, back);
  p.querySelector('.close').addEventListener('click', closePanel);
  p.querySelector('.close').focus();
}

// HUD：ばしょ の なまえ
const baseRenderHudEndless = stRenderHud;
stRenderHud = function () {
  baseRenderHudEndless();
  if (isEndless() && S.maze && S.maze.rogue && !$('stHud').hidden) $('stPlace').textContent = S.maze.rest ? '☕ やすみ の へや' : `🌌 むげん の とう ちか${S.maze.floor}かい`;
};

// テスト よう
window.endlessTest = { enter: enterEndless, rest: startRest, ranking: loadEndlessRanking };
