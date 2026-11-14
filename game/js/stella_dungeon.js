'use strict';
// =====================================================================
//  ステラクエスト：ダンジョン
//  ・まちの みなみの もん で なんいどを えらぶ（クリアした なんいど と その つぎ まで）
//  ・めいろ・たからばこ・おとしあな は maze.js を そのまま つかう
//  ・てき：HP＝なんいど、ボス：HP＝なんいど×3（6だけ ×6）
//  ・ふつうの てき：さんすう 50%・かんじ 30%・おんがく 20%（おんがくは かならず うぇーおー）
//  ・たおすと アルカ。ボスは 2かいめ から はんぶん。レアてきは アルカ なし（ドラゴンの うろこ）
//  ・HP 0 / きかんの はね / クリア で まちへ。どの でかたでも さいだいHP は 5 に もどる
//  ・セーブ：ダンジョンに はいった とき・てきを たおした とき（めいろ ごと）
//  しよう：docs/GAME_SPEC.md「5. アルカ」「6. 強さ」「9. ダンジョン」
// =====================================================================

const DUNGEONS = {
  1: 'はなばたけの そうげん', 2: 'おかしの おか', 3: 'きのこの もり',
  4: 'ゆうやけ こうげん', 5: 'ほしぞらの やま', 6: 'ドラゴンの おしろ',
};
Object.entries(DUNGEONS).forEach(([d, name]) => { THEMES[d].place = name; });
const ARCA_REWARD = { 1: [7, 50], 2: [10, 75], 3: [18, 120], 4: [28, 180], 5: [42, 300], 6: [70, 500] }; // [ざこ, ボス]（2026-11-14 アクション版：ざこ は 7わり）
const SUBJECT_WEIGHTS = [['math', 50], ['kanji', 30], ['music', 20]];
const BATTLES_TO_BOSS = 8; // めいろの おおきさに かかわらず、ボスまでの たたかいが だいたい これくらい

CONFIG.pitOnPath = true; // ボスまでの みちは かならず おとしあなの へや を とおる（maze.js）
const bossHpOf = (d) => (d >= 6 ? 60 : d * 6); // アクション版：たたかい の かず が ふえる ので HP を あげる
const mobHpOf = (d) => d * 2;
const isWeo = (spr) => !!spr && spr.name === 'うぇーおー';
const inDungeon = () => !!(ST.data && ST.data.dungeon);

// こうげきりょくで とどめを きめる
isFinalBlow = function (m) { return !!m && m.boss && m.hp <= (ST.battle ? heroAtk() : 1); };

// ---------------------------------------------------------------------
//  いりぐち：なんいどを えらぶ
// ---------------------------------------------------------------------
enterDungeonGate = function () {
  const d = ST.data, top = Math.min(6, maxCleared(d) + 1);
  const rows = Object.entries(DUNGEONS).map(([n, name]) => {
    n = +n;
    const ok = n <= top, cnt = d.cleared[n] || 0;
    return `<button type="button" class="dg ${ok ? '' : 'locked'}" data-d="${n}" ${ok ? '' : 'disabled'}>
      <span class="dn">${n}</span><span class="dname">${ok ? name : '？？？'}</span>
      <span class="dstate">${cnt ? `★ クリア ${cnt}かい` : ok ? 'まだ クリア していない' : 'まえの ダンジョンを クリアしよう'}</span></button>`;
  }).join('');
  const p = stPanel(`
    <div class="shop-head"><span class="shop-title">🗝 ダンジョン</span><span class="shop-arca">HP ${'♥'.repeat(d.hp)}</span></div>
    <div class="shop-talk">「どの ダンジョンに いく？ クリアした ところと、その つぎ まで いけるぞ！」</div>
    <div class="dlist">${rows}</div>
    <div class="shop-foot"><button type="button" class="close">やめる（Esc）</button></div>`, () => stepHeroBack());
  p.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => { closePanelSilently(); enterDungeon(+b.dataset.d); }));
  p.querySelector('.close').addEventListener('click', closePanel);
  const firstOpen = p.querySelector(`[data-d="${top}"]`); if (firstOpen) firstOpen.focus();
};

// ---------------------------------------------------------------------
//  はいる・でる
// ---------------------------------------------------------------------
function enterDungeon(diff) {
  const d = ST.data;
  ST.scene = 'dungeon';
  S.level = diff;
  CONFIG.maxHp = stMaxHp();
  S.hp = d.hp; S.items = d.items; S.churu = false;
  S.monster = null; S.q = null; S.catUsed = false; S.hintNext = false; S.castleX = null;
  buildStage(diff); // maze.js（S.hp は かえない）
  tuneEncounter();
  d.dungeon = { difficulty: diff };
  snapshotDungeon();
  stSave('dungeon'); // ダンジョンに はいったら セーブ
  setMode('walk');
  showBanner(`${DUNGEONS[diff]}`);
}

// めいろが ひろくても たたかいの かずが おなじ くらいに なるように（ゴールまでの みちのり で わる）
function tuneEncounter() {
  const M = S.maze;
  const dist = bfs(M.grid, M.TW, M.TH, M.start)[M.goal.y * M.TW + M.goal.x];
  CONFIG.encounterChance = Math.min(0.25, BATTLES_TO_BOSS / Math.max(30, dist));
}

// どんな でかた でも：さいだいHP は 5 に もどる・HP は 5 まで
function leaveDungeon(kind) {
  const d = ST.data;
  if (typeof stopPhrase === 'function') stopPhrase();
  d.hp = kind === 'lose' ? 5 : Math.min(5, S.hp);
  d.innBuff = false;
  d.dungeon = null;
  ST.battle = null;
  S.monster = null; S.q = null; S.maze = null; S.cat = null;
  setScene('town', { pos: { x: 14, y: 18 } }); // もんの まえ（ここで セーブ）
}

// ---------------------------------------------------------------------
//  めいろの セーブ（とちゅうから つづき）
// ---------------------------------------------------------------------
function snapshotDungeon() {
  const M = S.maze, d = ST.data;
  if (!M || !d.dungeon) return;
  d.dungeon = {
    difficulty: d.dungeon.difficulty,
    maze: { TW: M.TW, TH: M.TH, grid: Array.from(M.grid), fog: Array.from(M.fog), visited: Array.from(M.visited),
      start: M.start, goal: M.goal, chests: M.chests, rooms: M.rooms, pits: M.pits },
    pos: { ...S.pos }, encounterChance: CONFIG.encounterChance,
  };
  d.hp = S.hp;
}

function resumeDungeon() {
  const d = ST.data, snap = d.dungeon;
  if (!snap || !snap.maze) { d.dungeon = null; setScene('town'); return; }
  ST.scene = 'dungeon';
  S.level = snap.difficulty;
  CONFIG.maxHp = stMaxHp();
  S.hp = d.hp; S.items = d.items;
  const m = snap.maze;
  S.maze = { ...m, grid: Uint8Array.from(m.grid), fog: Uint8Array.from(m.fog), visited: Uint8Array.from(m.visited), heroScreen: null };
  S.pos = { ...snap.pos }; S.from = { ...snap.pos }; S.moveT = 1; S.stepsSinceBattle = 0; S.facing = 1; S.mazeLock = 0; S.fall = null;
  CONFIG.encounterChance = snap.encounterChance || 0.08;
  setMode('walk');
  showBanner(`${DUNGEONS[snap.difficulty]}（つづき）`);
}

function showBanner(text, sec = 2) {
  const b = $('stBanner');
  b.textContent = text; b.hidden = false;
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(showBanner.timer);
  showBanner.timer = setTimeout(() => { b.hidden = true; }, sec * 1000);
}

// ---------------------------------------------------------------------
//  てき
// ---------------------------------------------------------------------
function pickSubject() {
  let r = Math.random() * 100;
  for (const [s, w] of SUBJECT_WEIGHTS) { r -= w; if (r < 0) return s; }
  return 'math';
}

const baseEncounterDungeon = encounter;
encounter = function (opts = {}) {
  if (!inDungeon() || ST.battle) { baseEncounterDungeon(opts); return; }
  const diff = ST.data.dungeon.difficulty;
  ST.battle = { difficulty: diff, returnTo: 'dungeon' };
  CONFIG.maxHp = stMaxHp();
  baseEncounterDungeon(opts);
  if (opts.boss) return; // ボスは spawnBoss の あとで HP を きめる
  const m = S.monster;
  if (!m) return;
  if (!m.rare) {
    m.subject = pickSubject();
    // おんがくは かならず うぇーおー、それいがいでは うぇーおーは でない
    const weo = SPR.enemies.find(isWeo), others = SPR.enemies.filter((s) => !isWeo(s));
    if (m.subject === 'music' && weo && !isWeo(m.spr) || m.subject !== 'music' && isWeo(m.spr) && others.length) {
      let spr = m.subject === 'music' ? weo : pick(others), tint = null;
      if (spr.tint) { tint = pick(TINTS); spr = tintSprite(spr, tint.color); }
      const pw = ENEMY_POWER[S.level];
      Object.assign(m, { spr, tintColor: tint ? tint.color : null, height: (spr.height || 180) * pw.scale,
        name: pw.prefix + (tint ? tint.name + ' ' : '') + spr.name });
    }
  }
  m.hp = m.maxHp = mobHpOf(diff);
};

const baseSpawnBossDungeon = spawnBoss;
spawnBoss = function () {
  baseSpawnBossDungeon();
  if (ST.battle && S.monster) { S.monster.hp = S.monster.maxHp = bossHpOf(ST.battle.difficulty); S.monster.hpShown = S.monster.hp; }
};

// ボス：なんいど6の とどめは かならず「100を こえる たしざん」
const baseBattleSubject = battleSubject;
battleSubject = function (m) {
  if (m.boss && ST.battle && ST.battle.difficulty >= 6 && isFinalBlow(m)) return 'math';
  return baseBattleSubject(m);
};

// ---------------------------------------------------------------------
//  たおした・まけた
// ---------------------------------------------------------------------
const baseEndBattleDungeon = endBattle;
endBattle = function () {
  const b = ST.battle;
  if (!b || b.returnTo !== 'dungeon') { baseEndBattleDungeon(); return; }
  const m = S.monster;
  if (typeof stopPhrase === 'function') stopPhrase();
  const wasRare = m && m.rare, defeated = m && m.state === 'hit';
  S.monster = null; S.q = null; S.castleX = null; ST.battle = null;
  setMode('walk');
  let msg = '';
  if (defeated && !wasRare) {
    const n = ARCA_REWARD[b.difficulty][0];
    ST.data.arca += n;
    msg = `てきを たおした！ ${n} アルカ てに いれた！`;
    coinSound();
  }
  snapshotDungeon();
  stSave('dungeon'); // てきを たおしたら セーブ
  if (wasRare && defeated) gotDragonScale(); // にげられた ときは もらえない
  else if (msg) showToast(msg, 2.4);
};

// ボスを たおした（game.js は 3びょう ごに levelFx('up') か offerNanmon を よぶ）
function dungeonClear() {
  const d = ST.data, diff = d.dungeon.difficulty;
  const first = !(d.cleared[diff] > 0);
  const n = first ? ARCA_REWARD[diff][1] : Math.floor(ARCA_REWARD[diff][1] / 2);
  d.arca += n;
  d.cleared[diff] = (d.cleared[diff] || 0) + 1;
  const lines = [`${DUNGEONS[diff]}の ボスを たおした！`, `ほしの ひかりを ひとつ とりもどした！`, `${n} アルカ てに いれた！${first ? '' : '（2かいめ からは はんぶん）'}`];
  if (first && diff === 5) { d.flags.templeOpen = true; lines.push('……まちの ほうで なにかが ひかった きがする。'); }
  if (first && diff === 6) { d.flags.oldKey = true; lines.push('ボスの いた ところに ふるびた かぎが おちていた！', '「ふるびた かぎ」を てに いれた！'); }
  SFX.levelUp();
  leaveDungeon('clear');
  showBanner('⭐ ダンジョン クリア！ ⭐', 2.4);
  stDialog(lines);
}

function dungeonLose() {
  leaveDungeon('lose');
  stDialog(['ちゅなちゃんは ちからつきてしまった……', 'でも だいじょうぶ！ また ちょうせんしよう！', 'ルミナリアの まちへ もどります']);
}

const baseLevelFxDungeon = levelFx;
levelFx = function (kind) {
  if (!inDungeon()) { baseLevelFxDungeon(kind); return; }
  S.q = null; S.monster = null; ST.battle = null;
  if (kind === 'up') dungeonClear(); else dungeonLose();
};
const baseOfferNanmonDungeon = offerNanmon;
offerNanmon = function () { if (inDungeon()) dungeonClear(); else baseOfferNanmonDungeon(); };

// ---------------------------------------------------------------------
//  アイテム：きかんの はね（ダンジョンで つかうと まちへ）
// ---------------------------------------------------------------------
const baseUseItemDungeon = useItem;
useItem = function (i) {
  if (inDungeon() && S.mode === 'walk' && S.items[i] === 'wing') {
    S.items.splice(i, 1);
    SFX.star();
    leaveDungeon('wing');
    stDialog(['きかんの はねを つかった！', 'ふわっと からだが うかんで……ルミナリアの まちへ もどった。']);
    return;
  }
  baseUseItemDungeon(i);
  if (inDungeon()) { ST.data.hp = S.hp; stRenderHud(); }
};

// ---------------------------------------------------------------------
//  がめん：めいろでは ステラの HUD（HP は S.hp）
// ---------------------------------------------------------------------
const baseRenderHudDungeon = stRenderHud;
stRenderHud = function () {
  baseRenderHudDungeon();
  if (!inDungeon() || !ST.data) return;
  const walking = S.mode === 'walk' || S.mode === 'riddle';
  $('stHud').hidden = !walking;
  if (!walking) return;
  $('stPlace').textContent = `${DUNGEONS[ST.data.dungeon.difficulty]}`;
  const hpKey = `${S.hp}/${stMaxHp()}`;
  if ($('stHp').dataset.k !== hpKey) { $('stHp').dataset.k = hpKey; $('stHp').innerHTML = Array.from({ length: stMaxHp() }, (_, k) => heartSVG(k < S.hp)).join(''); }
};
// maze.js が HP を かえて renderHud を よんだ とき（おとしあな など）も うえの HUD を なおす
const baseRenderHudGameDungeon = renderHud;
renderHud = function () {
  baseRenderHudGameDungeon();
  if (inDungeon() && ST.data && !ST.battle) { ST.data.hp = S.hp; stRenderHud(); }
};
const baseUpdateUIDungeon = updateUI;
updateUI = function () {
  baseUpdateUIDungeon();
  if (inDungeon()) { $('hud').hidden = true; stRenderHud(); }
};
