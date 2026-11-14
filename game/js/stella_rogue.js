'use strict';
// =====================================================================
//  ステラクエスト：ふしぎな ダンジョン（アクション版）
//  ・へや が ならんでいて（4×4〜6×6）、うえ・した・ひだり・みぎ の へや と つうろ で つながる
//  ・なんいど n の ダンジョン は n かい まで。とちゅう は「かいだん」、いちばん した に ボスの おしろ
//  ・スタート・かいだん（おしろ）は ランダム。あるいた ところ だけ みえる（ミニマップ）
//  ・てき は マップの うえ に みえる。ちゅなちゃん が 1ぽ うごくと てき も 1かい うごく。かさなったら たたかい
//  ・おちている アイテム は のると もちもの に はいる。めずらしい アイテム は たからばこ（なぞなぞ）
//  ・おとしあな：HP 1 へって した の かい へ（いちばん した には ない）
//  ・しまじろう は にげる、死神 は かべ を すりぬけて おなじ はやさ で おいかける
//  maze.js の めいろ（mazeUpdate / drawMaze / buildStage …）を ステラ だけ さしかえる。
//  stella_dungeon.js・stella_rare.js・stella_necro.js の あと に よむ
//  しよう：docs/GAME_SPEC.md 14.2〜14.6・14.9
// =====================================================================

const RG_CONF = {
  gridMin: 4, gridMax: 6,   // へや の ならび（よこ・たて）
  cell: 9,                  // 1つ の へや の わく（マス）
  roomRate: 0.82,           // へや に なる わりあい（のこり は つうろ の まがりかど）
  extraLinks: 0.18,         // わ に なる つうろ を ふやす わりあい
  enemyPerRoom: 0.55,       // さいしょ の てき（へや の かず × これ）
  enemyCap: 1.1,            // てき の さいだい（へや の かず × これ）
  spawnEvery: 28,           // この ほすう ごと に てき が 1たい ふえる
  itemPerRoom: 0.5,         // おちている アイテム（へや の かず × これ）
  chests: [1, 2],           // たからばこ の かず
  houseRate: 0.2,           // モンスターハウス が ある かくりつ（なんいど 2 から）
  shimaRate: 0.12,          // しまじろう が でる かくりつ（1かい ごと）
  deathBase: 0.001,         // 死神：10ぽ ごと の かくりつ（あるいた ほすう で ふえる）
  deathGrow: 60,            // この ほすう で かくりつ が もう 1ばい ぶん ふえる
  stepTime: 0.13, dashTime: 0.055, dashAfter: 0.38,
  gaugeSteps: 60,           // ひっさつ ゲージ が まんたん に なる ほすう
};
const RG_FLOOR_ITEMS = [['herb', 60], ['water', 22], ['churu', 18]];
const RG_CHEST_ITEMS = [['revive', 34], ['wing', 20], ['churu', 24], ['water', 22]];
const rgPick = (table) => { let r = Math.random() * table.reduce((s, x) => s + x[1], 0); for (const [k, w] of table) { r -= w; if (r <= 0) return k; } return table[0][0]; };
const RG_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const RG_DIRNAME = { '1,0': 'right', '-1,0': 'left', '0,1': 'down', '0,-1': 'up' };
const rgActive = () => !!(S.maze && S.maze.rogue && ST.data && ST.data.dungeon);
const RG = { cur: null, holdT: 0, holdDir: null, dash: false, lock: 0, dark: 0, omen: null };

// ---------------------------------------------------------------------
//  マップ を つくる
// ---------------------------------------------------------------------
function rgGenerate(diff, floor) {
  const C = RG_CONF.cell;
  const GW = rnd(RG_CONF.gridMin, RG_CONF.gridMax), GH = rnd(RG_CONF.gridMin, RG_CONF.gridMax);
  const TW = GW * C + 1, TH = GH * C + 1;
  const grid = new Uint8Array(TW * TH);            // 0 かべ・1 へや・2 つうろ
  const roomOf = new Int16Array(TW * TH).fill(-1);  // へや の ばんごう
  const at = (x, y) => y * TW + x;
  // へや（または まがりかど）
  const cells = [];
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const ox = gx * C + 1, oy = gy * C + 1;
      if (Math.random() < RG_CONF.roomRate) {
        const w = rnd(3, C - 3), h = rnd(3, C - 3);
        const x = ox + rnd(1, C - 2 - w), y = oy + rnd(1, C - 2 - h);
        cells.push({ gx, gy, x, y, w, h, room: true });
      } else {
        const x = ox + rnd(2, C - 4), y = oy + rnd(2, C - 4);
        cells.push({ gx, gy, x, y, w: 1, h: 1, room: false });
      }
    }
  }
  const cellAt = (gx, gy) => cells[gy * GW + gx];
  // つながり：ぜんぶ の へや に いける き ＋ すこし わ
  const links = new Set(), key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const seen = new Uint8Array(GW * GH), stack = [rnd(0, GW * GH - 1)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const c = stack[stack.length - 1], cx = c % GW, cy = Math.floor(c / GW);
    const nb = RG_DIRS.map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < GW && y < GH && !seen[y * GW + x]);
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny] = pick(nb), n = ny * GW + nx;
    links.add(key(c, n)); seen[n] = 1; stack.push(n);
  }
  for (let c = 0; c < GW * GH; c++) {
    const cx = c % GW, cy = Math.floor(c / GW);
    if (cx + 1 < GW && Math.random() < RG_CONF.extraLinks) links.add(key(c, c + 1));
    if (cy + 1 < GH && Math.random() < RG_CONF.extraLinks) links.add(key(c, c + GW));
  }
  // へや を ほる
  const rooms = [];
  cells.forEach((c) => {
    c.id = c.room ? rooms.length : -1;
    for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) { grid[at(x, y)] = c.room ? 1 : 2; if (c.room) roomOf[at(x, y)] = c.id; }
    if (c.room) rooms.push({ id: c.id, x: c.x, y: c.y, w: c.w, h: c.h, house: false });
  });
  const carve = (x, y) => { if (!grid[at(x, y)]) grid[at(x, y)] = 2; };
  // つうろ（L じ）
  for (const k of links) {
    const [a, b] = k.split('-').map(Number), A = cells[a], B = cells[b];
    if (b - a === 1) { // よこ
      const ay = rnd(A.y, A.y + A.h - 1), by = rnd(B.y, B.y + B.h - 1);
      const sx = A.x + A.w, ex = B.x - 1, mx = rnd(Math.min(sx, ex), Math.max(sx, ex));
      for (let x = sx; x <= mx; x++) carve(x, ay);
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) carve(mx, y);
      for (let x = mx; x <= ex; x++) carve(x, by);
    } else { // たて
      const ax = rnd(A.x, A.x + A.w - 1), bx = rnd(B.x, B.x + B.w - 1);
      const sy = A.y + A.h, ey = B.y - 1, my = rnd(Math.min(sy, ey), Math.max(sy, ey));
      for (let y = sy; y <= my; y++) carve(ax, y);
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) carve(x, my);
      for (let y = my; y <= ey; y++) carve(bx, y);
    }
  }
  if (rooms.length < 3) return rgGenerate(diff, floor); // へや が すくなすぎる
  const cellOfRoom = (r) => cells.find((c) => c.id === r.id);
  const inner = (r) => { const out = []; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push({ x, y }); return out; };
  // スタート と ゴール（かいだん／おしろ）：とおい へや
  const startRoom = pick(rooms);
  const start = pick(inner(startRoom));
  const dist = rgBfs(grid, TW, TH, start);
  const far = rooms.filter((r) => r !== startRoom).map((r) => ({ r, d: dist[at(r.x + (r.w >> 1), r.y + (r.h >> 1))] }))
    .filter((o) => o.d > 0).sort((p, q) => q.d - p.d);
  const goalRoom = pick(far.slice(0, Math.max(1, Math.ceil(far.length / 3)))).r;
  const goal = pick(inner(goalRoom).filter((p) => !rgIsDoorway(grid, roomOf, TW, p.x, p.y)).concat([]).filter(Boolean)) || pick(inner(goalRoom));
  const last = floor >= diff;
  const used = new Set([at(start.x, start.y), at(goal.x, goal.y)]);
  const freeSpot = (roomsPool) => {
    for (let k = 0; k < 60; k++) {
      const r = pick(roomsPool), p = pick(inner(r));
      if (!used.has(at(p.x, p.y))) { used.add(at(p.x, p.y)); return p; }
    }
    return null;
  };
  const others = rooms.filter((r) => r !== startRoom);
  // アイテム・たからばこ
  const items = [];
  for (let i = 0; i < Math.round(rooms.length * RG_CONF.itemPerRoom); i++) { const p = freeSpot(rooms); if (p) items.push({ ...p, id: rgPick(RG_FLOOR_ITEMS) }); }
  const chests = [];
  for (let i = 0, n = rnd(RG_CONF.chests[0], RG_CONF.chests[1]); i < n; i++) { const p = freeSpot(others); if (p) chests.push({ ...p, opened: false, openT: 0 }); }
  // おとしあな（いちばん した の かい には ない）
  const pits = [];
  if (!last) {
    const r = Math.random(), n = r < 0.3 ? 0 : r < 0.8 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const p = freeSpot(others);
      if (p && !rgIsDoorway(grid, roomOf, TW, p.x, p.y)) pits.push({ ...p, found: false });
    }
  }
  // モンスターハウス
  let house = null;
  if (diff >= 2 && Math.random() < RG_CONF.houseRate) {
    const cand = others.filter((r) => r !== goalRoom && r.w * r.h >= 12);
    if (cand.length) { house = pick(cand); house.house = true; }
  }
  return { TW, TH, GW, GH, grid, roomOf, rooms, start, goal, last, items, chests, pits, house: house ? house.id : -1, startRoom: startRoom.id, cellOfRoom };
}

function rgIsDoorway(grid, roomOf, TW, x, y) {
  return RG_DIRS.some(([dx, dy]) => grid[(y + dy) * TW + x + dx] === 2 && roomOf[y * TW + x] >= 0);
}

function rgBfs(grid, TW, TH, from, passable) {
  const dist = new Int32Array(TW * TH).fill(-1);
  const q = [from.y * TW + from.x]; dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % TW, y = (k - x) / TW;
    for (const [dx, dy] of RG_DIRS) {
      const nx = x + dx, ny = y + dy, nk = ny * TW + nx;
      if (nx < 0 || ny < 0 || nx >= TW || ny >= TH || !grid[nk] || dist[nk] >= 0) continue;
      if (passable && !passable(nk)) continue;
      dist[nk] = dist[k] + 1; q.push(nk);
    }
  }
  return dist;
}

// ---------------------------------------------------------------------
//  てき
// ---------------------------------------------------------------------
function rgEnemySprite(subject) {
  const weo = SPR.enemies.find(isWeo), others = SPR.enemies.filter((s) => !isWeo(s));
  let base = subject === 'music' && weo ? weo : others.length ? pick(others) : SPR.enemies[0];
  if (!base) return { spr: null, name: 'まもの', tint: -1 };
  let tint = -1, spr = base;
  if (base.tint) { tint = rnd(0, TINTS.length - 1); spr = tintSprite(base, TINTS[tint].color); }
  return { spr, base: base.name, tint };
}
function rgMakeEnemy(x, y, opts = {}) {
  const kind = opts.kind || 'normal';
  const e = { x, y, fx: x, fy: y, t: 1, dir: 'down', facing: 1, kind, state: opts.state || 'wander', id: rgMakeEnemy.n = (rgMakeEnemy.n || 0) + 1, skip: 0 };
  if (kind === 'normal') {
    e.subject = pickSubject();
    const s = rgEnemySprite(e.subject);
    Object.assign(e, { spr: s.spr, base: s.base, tint: s.tint });
    e.bonus = !!(BONUS_SPR.length && !(typeof isHoikuen === 'function' && isHoikuen()) && Math.random() < BONUS.rate);
    if (e.bonus) { e.spr = pick(BONUS_SPR); e.base = e.spr.name; e.tint = -1; }
  } else if (kind === 'shima') {
    e.spr = (SPR.rares || []).find((s) => s.name === RARE_NAME) || null;
  }
  return e;
}
function rgRestoreEnemy(o) {
  const e = { ...o, fx: o.x, fy: o.y, t: 1 };
  if (o.kind === 'normal') {
    const pool = e.bonus ? BONUS_SPR : SPR.enemies;
    let base = pool.find((s) => s.name === o.base) || pool[0] || null;
    e.spr = base && o.tint >= 0 && base.tint ? tintSprite(base, TINTS[o.tint].color) : base;
  } else if (o.kind === 'shima') e.spr = (SPR.rares || []).find((s) => s.name === RARE_NAME) || null;
  return e;
}

// ---------------------------------------------------------------------
//  かい を はじめる・セーブ
// ---------------------------------------------------------------------
function rgStartFloor(diff, floor, opts = {}) {
  const g = rgGenerate(diff, floor);
  const M = {
    rogue: true, TW: g.TW, TH: g.TH, grid: g.grid, roomOf: g.roomOf, rooms: g.rooms, start: g.start, goal: g.goal, last: g.last,
    floor, items: g.items, chests: g.chests, pits: g.pits, house: g.house, houseWoken: false,
    fog: new Uint8Array(g.TW * g.TH), vis: new Uint8Array(g.TW * g.TH), visited: new Uint8Array(g.TW * g.TH),
    enemies: [], death: null, shima: false, steps: 0, spawnT: 0, heroScreen: null, mapAll: false,
  };
  S.maze = M;
  const startPos = opts.pos && M.grid[opts.pos.y * M.TW + opts.pos.x] ? opts.pos : g.start;
  // てき
  const awayRooms = M.rooms.filter((r) => r.id !== g.startRoom && r.id !== g.house);
  for (let i = 0; i < Math.round(M.rooms.length * RG_CONF.enemyPerRoom); i++) rgSpawnEnemy(awayRooms, startPos);
  if (g.house >= 0) {
    const r = M.rooms[g.house];
    for (let i = 0, n = rnd(5, 7); i < n; i++) {
      const p = rgFreeTile([r], startPos); if (p) M.enemies.push(rgMakeEnemy(p.x, p.y, { state: 'sleep' }));
    }
  }
  const scaleHeld = ST.data.items.includes('scale');
  const shimaRate = RG_CONF.shimaRate * ((CONFIG.rareRate || 0.1) / 0.1);
  if (!scaleHeld && SPR.rares.length && Math.random() < shimaRate) {
    const p = rgFreeTile(awayRooms, startPos);
    if (p) { M.enemies.push(rgMakeEnemy(p.x, p.y, { kind: 'shima' })); M.shima = true; }
  }
  rgPlaceHero(startPos);
  rgSnapshot(true);
}
function rgPlaceHero(p) {
  S.pos = { x: p.x, y: p.y }; S.from = { ...S.pos }; S.moveT = 1; S.facing = 1; S.mazeLock = 0; S.fall = null; S.stepsSinceBattle = 0;
  RG.holdT = 0; RG.dash = false; RG.lock = 0;
  if (typeof heldDirs !== 'undefined') heldDirs.length = 0;
  rgReveal();
}
function rgFreeTile(roomsPool, avoid) {
  const M = S.maze;
  for (let k = 0; k < 80; k++) {
    const r = pick(roomsPool); if (!r) return null;
    const x = rnd(r.x, r.x + r.w - 1), y = rnd(r.y, r.y + r.h - 1);
    if (avoid && Math.abs(avoid.x - x) + Math.abs(avoid.y - y) < 4) continue;
    if (M.enemies.some((e) => e.x === x && e.y === y)) continue;
    if (M.goal.x === x && M.goal.y === y) continue;
    return { x, y };
  }
  return null;
}
function rgSpawnEnemy(roomsPool, avoid) {
  const M = S.maze;
  const pool = (roomsPool || M.rooms).filter((r) => !rgRoomVisible(r));
  const p = rgFreeTile(pool.length ? pool : M.rooms, avoid || S.pos);
  if (p) M.enemies.push(rgMakeEnemy(p.x, p.y));
}
const rgRoomVisible = (r) => { const M = S.maze; return M.vis && M.vis[(r.y) * M.TW + r.x] === 1; };

// その かい の はじめ の ようす を セーブ（つづき は その かい の はじめ から・おなじ マップ）
function rgSnapshot(floorStart) {
  const M = S.maze, d = ST.data;
  if (!M || !d.dungeon) return;
  if (floorStart || !d.dungeon.floorSnap) {
    d.dungeon.floorSnap = {
      TW: M.TW, TH: M.TH, grid: Array.from(M.grid), roomOf: Array.from(M.roomOf), rooms: M.rooms, start: { ...S.pos }, goal: M.goal, last: M.last,
      floor: M.floor, items: M.items.map((o) => ({ ...o })), chests: M.chests.map((o) => ({ ...o })), pits: M.pits.map((o) => ({ ...o })), house: M.house,
      enemies: M.enemies.map((e) => ({ x: e.x, y: e.y, kind: e.kind, state: e.state, subject: e.subject, base: e.base, tint: e.tint, bonus: e.bonus, dir: e.dir, facing: e.facing })),
      shima: M.shima,
    };
  }
  d.dungeon.v = 2;
  d.dungeon.floor = M.floor;
  d.dungeon.gauge = RG.gauge || 0;
  d.hp = S.hp;
}
snapshotDungeon = function () { if (rgActive()) rgSnapshot(false); };

function rgResume(snap) {
  const f = snap.floorSnap;
  const M = {
    rogue: true, TW: f.TW, TH: f.TH, grid: Uint8Array.from(f.grid), roomOf: Int16Array.from(f.roomOf), rooms: f.rooms, start: f.start, goal: f.goal, last: f.last,
    floor: f.floor, items: f.items.map((o) => ({ ...o })), chests: f.chests.map((o) => ({ ...o })), pits: f.pits.map((o) => ({ ...o })), house: f.house, houseWoken: false,
    fog: new Uint8Array(f.TW * f.TH), vis: new Uint8Array(f.TW * f.TH), visited: new Uint8Array(f.TW * f.TH),
    enemies: f.enemies.map(rgRestoreEnemy), death: null, shima: f.shima, steps: 0, spawnT: 0, heroScreen: null, mapAll: false,
  };
  S.maze = M;
  RG.gauge = snap.gauge || 0;
  rgPlaceHero(f.start);
}

// stella_dungeon.js の enterDungeon / resumeDungeon から よばれる
buildStage = function (level) { RG.gauge = 0; RG.omen = null; RG.cur = null; RG.dark = 0; rgStartFloor(level, 1); };
tuneEncounter = function () { CONFIG.encounterChance = 0; };
const baseResumeDungeonRG = resumeDungeon;
resumeDungeon = function () {
  const d = ST.data, snap = d.dungeon;
  if (!snap || snap.v !== 2 || !snap.floorSnap) { // まえの めいろ の セーブ：いちかい め から やりなおし
    if (snap && snap.difficulty) { const diff = snap.difficulty; d.dungeon = null; enterDungeon(diff); return; }
    baseResumeDungeonRG(); return;
  }
  ST.scene = 'dungeon';
  S.level = snap.difficulty;
  CONFIG.maxHp = stMaxHp();
  S.hp = d.hp; S.items = d.items; S.churu = false;
  S.monster = null; S.q = null; RG.cur = null; RG.omen = null; RG.dark = 0;
  rgResume(snap);
  CONFIG.encounterChance = 0;
  setMode('walk');
  showBanner(`${DUNGEONS[snap.difficulty]} ちか${snap.floorSnap.floor}かい（つづき）`);
};

function rgNextFloor(byPit) {
  const d = ST.data, diff = d.dungeon.difficulty, M = S.maze;
  const floor = Math.min(diff, M.floor + 1);
  RG.omen = null;
  rgStartFloor(diff, floor);
  if (byPit) { // おちた ところ は ランダム（スタート の かわり）
    const p = rgFreeTile(S.maze.rooms, null) || S.maze.start;
    rgPlaceHero(p);
    rgSnapshot(true);
  }
  stSave('dungeon');
  showBanner(`ちか ${floor} かい${S.maze.last ? '（さいご の かい）' : ''}`, 2.2);
  if (S.maze.last) later(1.0, () => showToast('この かい の どこかに ボスの おしろ が ある……！', 3));
}

// ---------------------------------------------------------------------
//  みえる ところ
// ---------------------------------------------------------------------
function rgReveal() {
  const M = S.maze, TW = M.TW;
  M.vis.fill(0);
  const mark = (x, y) => { if (x < 0 || y < 0 || x >= TW || y >= M.TH) return; const k = y * TW + x; M.vis[k] = 1; M.fog[k] = 1; };
  const r = M.roomOf[S.pos.y * TW + S.pos.x];
  if (r >= 0) {
    const R = M.rooms[r];
    for (let y = R.y - 1; y <= R.y + R.h; y++) for (let x = R.x - 1; x <= R.x + R.w; x++) mark(x, y);
  }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mark(S.pos.x + dx, S.pos.y + dy);
  if (M.mapAll) M.fog.fill(1);
}
const rgVisible = (x, y) => S.maze.vis[y * S.maze.TW + x] === 1;
const rgHeroRoom = () => S.maze.roomOf[S.pos.y * S.maze.TW + S.pos.x];

// ---------------------------------------------------------------------
//  あるく（maze.js の mazeUpdate の かわり）
// ---------------------------------------------------------------------
const baseMazeUpdateRG = mazeUpdate;
mazeUpdate = function (dt) {
  if (!rgActive()) { baseMazeUpdateRG(dt); return; }
  const M = S.maze;
  M.chests.forEach((c) => { if (c.opened && c.openT < 1) c.openT = Math.min(1, c.openT + dt * 3); });
  M.enemies.forEach((e) => { if (e.t < 1) e.t = Math.min(1, e.t + dt / (RG.dash ? RG_CONF.dashTime : RG_CONF.stepTime)); if (e.say) e.say.t += dt; });
  if (M.death && M.death.t < 1) M.death.t = Math.min(1, M.death.t + dt / (RG.dash ? RG_CONF.dashTime : RG_CONF.stepTime));
  if (RG.cur && !S.monster && S.mode === 'walk') rgAfterBattle();
  if ((typeof ITEMUI !== 'undefined' && ITEMUI.open) || RG.special) return;
  if (RG.lock > 0) { RG.lock -= dt; return; }
  if (S.mazeLock > 0) { S.mazeLock -= dt; return; }
  if (S.moveT < 1) {
    S.moveT = Math.min(1, S.moveT + dt / (RG.dash ? RG_CONF.dashTime : RG_CONF.stepTime));
    if (S.moveT >= 1) rgArrive();
    return;
  }
  const d = heldDirs[heldDirs.length - 1];
  if (!d) { RG.holdT = 0; RG.dash = false; RG.holdDir = null; return; }
  if (d !== RG.holdDir) { RG.holdDir = d; RG.holdT = 0; RG.dash = false; }
  RG.holdT += dt;
  rgTryMove(d);
};

function rgTryMove(d) {
  const M = S.maze, [dx, dy] = DIR_VEC[d], nx = S.pos.x + dx, ny = S.pos.y + dy;
  if (dx) S.facing = dx;
  S.dir = d;
  if (!M.grid[ny * M.TW + nx]) return;
  // てき が いる ところ へ すすむ → たたかい（うしろ から なら せんせい こうげき）
  const e = M.enemies.find((o) => o.x === nx && o.y === ny);
  if (e) { heldDirs.length = 0; rgBattle(e, { preempt: e.dir === d && e.state !== 'sleep' ? true : e.state === 'sleep' }); return; }
  if (M.death && M.death.x === nx && M.death.y === ny) { heldDirs.length = 0; rgDeathBattle(); return; }
  if (RG.holdT >= RG_CONF.dashAfter) RG.dash = true;
  S.from = { ...S.pos }; S.pos = { x: nx, y: ny }; S.moveT = 0;
  if (!RG.dash || M.steps % 2 === 0) SFX.step();
}

function rgArrive() {
  const M = S.maze, k = S.pos.y * M.TW + S.pos.x;
  const prevRoom = M.roomOf[S.from.y * M.TW + S.from.x];
  rgReveal();
  M.steps++; M.visited[k] = 1;
  RG.gauge = Math.min(RG_CONF.gaugeSteps, (RG.gauge || 0) + 1);
  // かいだん・おしろ
  if (S.pos.x === M.goal.x && S.pos.y === M.goal.y) {
    heldDirs.length = 0;
    if (M.last) { encounter({ boss: true }); return; }
    SFX.star();
    RG.lock = 0.6;
    later(0.4, () => rgNextFloor(false));
    return;
  }
  // おとしあな
  const pit = M.pits.find((p) => !p.found && p.x === S.pos.x && p.y === S.pos.y);
  if (pit) { heldDirs.length = 0; rgFall(pit); return; }
  // アイテム を ひろう
  const it = M.items.find((o) => o.x === S.pos.x && o.y === S.pos.y);
  if (it) {
    if (S.items.length < CONFIG.maxItems) {
      S.items.push(it.id); M.items.splice(M.items.indexOf(it), 1);
      SFX.good(); showToast(`「${ITEMS[it.id].name}」を ひろった！`, 2); renderHud();
      if (RG.dash) heldDirs.length = 0;
    } else if (!it.told) { it.told = true; showToast(`「${ITEMS[it.id].name}」が おちている。でも もう もてない！`, 2.4); }
  }
  // モンスターハウス
  const room = M.roomOf[k];
  if (room >= 0 && room === M.house && !M.houseWoken) {
    M.houseWoken = true; heldDirs.length = 0;
    M.enemies.forEach((e) => { if (e.state === 'sleep') e.state = 'chase'; });
    S.shake = 0.6; SFX.roar ? SFX.roar() : SFX.bad();
    showBanner('モンスターハウスだ！', 1.8);
    RG.lock = 0.5;
  }
  // てき の ばん
  if (rgWorldTurn()) return;
  // たからばこ
  const chest = M.chests.find((c) => !c.opened && c.x === S.pos.x && c.y === S.pos.y);
  if (chest) { heldDirs.length = 0; openChest(chest); return; }
  rgOmenStep();
  // ダッシュ は おもしろい ところ で とまる
  if (RG.dash) {
    const enteredRoom = room >= 0 && prevRoom < 0;
    const branches = room < 0 && RG_DIRS.filter(([dx, dy]) => M.grid[(S.pos.y + dy) * M.TW + S.pos.x + dx]).length >= 3;
    const seeEnemy = M.enemies.some((e) => rgVisible(e.x, e.y) && Math.abs(e.x - S.pos.x) + Math.abs(e.y - S.pos.y) <= 6);
    const near = (o) => Math.abs(o.x - S.pos.x) + Math.abs(o.y - S.pos.y) <= 1;
    const seeThing = M.items.some(near) || M.chests.some((c) => !c.opened && near(c)) || near(M.goal);
    if (enteredRoom || branches || seeEnemy || seeThing) { heldDirs.length = 0; RG.dash = false; }
  }
}

// てき が 1かい うごく。たたかい に なったら true
function rgWorldTurn() {
  const M = S.maze, TW = M.TW;
  const hd = rgBfs(M.grid, TW, M.TH, S.pos);
  const heroRoom = rgHeroRoom();
  const occupied = new Set(M.enemies.map((e) => e.y * TW + e.x));
  let hit = null;
  for (const e of M.enemies) {
    if (e.state === 'sleep') continue;
    const k = e.y * TW + e.x, dh = hd[k];
    // みつける：おなじ へや か ちかく
    if (e.state === 'wander' && dh >= 0 && ((heroRoom >= 0 && M.roomOf[k] === heroRoom) || dh <= 3)) {
      e.state = e.kind === 'shima' ? 'flee' : 'chase';
      if (e.kind === 'shima' && !e.said) { e.said = true; e.say = { t: 0 }; heldDirs.length = 0; rgShimaVoice(); }
    }
    let next = null;
    if (e.state === 'chase') {
      next = RG_DIRS.map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy })).filter((p) => M.grid[p.y * TW + p.x] && hd[p.y * TW + p.x] >= 0 && hd[p.y * TW + p.x] < dh)
        .sort(() => Math.random() - 0.5)[0] || null;
    } else if (e.state === 'flee') {
      if ((e.skip = (e.skip + 1) % 3) === 0) continue; // 3かいに 1かい やすむ（おいつめられる ように）
      const cand = RG_DIRS.map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy })).filter((p) => M.grid[p.y * TW + p.x] && hd[p.y * TW + p.x] > dh);
      next = cand.sort((p, q) => hd[q.y * TW + q.x] - hd[p.y * TW + p.x])[0] || null;
    } else { // うろうろ
      if (Math.random() < 0.35) continue;
      const fwd = DIR_VEC[e.dir];
      const opts = RG_DIRS.map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy, dx, dy })).filter((p) => M.grid[p.y * TW + p.x]);
      const straight = opts.find((p) => p.dx === fwd[0] && p.dy === fwd[1]);
      next = straight && Math.random() < 0.7 ? straight : pick(opts) || null;
    }
    if (!next) continue;
    const nk = next.y * TW + next.x;
    if (next.x === S.pos.x && next.y === S.pos.y) { if (e.kind !== 'shima') { rgFace(e, next); hit = hit || e; } continue; }
    if (occupied.has(nk) || (next.x === M.goal.x && next.y === M.goal.y)) continue;
    occupied.delete(k); occupied.add(nk);
    rgFace(e, next);
    e.fx = e.x; e.fy = e.y; e.x = next.x; e.y = next.y; e.t = 0;
  }
  // 死神：かべ を すりぬけて おなじ はやさ で
  if (M.death) {
    const D = M.death, dx = S.pos.x - D.x, dy = S.pos.y - D.y;
    const step = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
    D.fx = D.x; D.fy = D.y; D.x += step[0]; D.y += step[1]; D.t = 0;
    if (step[0]) D.facing = step[0];
    if (D.x === S.pos.x && D.y === S.pos.y) { heldDirs.length = 0; rgDeathBattle(); return true; }
  }
  // てき が ふえる
  M.spawnT++;
  if (M.spawnT >= RG_CONF.spawnEvery) {
    M.spawnT = 0;
    if (M.enemies.filter((e) => e.kind === 'normal').length < Math.round(M.rooms.length * RG_CONF.enemyCap)) rgSpawnEnemy(null, S.pos);
  }
  if (hit) { heldDirs.length = 0; RG.lock = 0.18; later(0.15, () => { if (S.mode === 'walk' && !S.monster) rgBattle(hit, { preempt: false }); }); return true; }
  return false;
}
function rgFace(e, p) {
  const dx = p.x - e.x, dy = p.y - e.y;
  e.dir = RG_DIRNAME[`${dx},${dy}`] || e.dir;
  if (dx) e.facing = dx;
}

// ---------------------------------------------------------------------
//  たたかい
// ---------------------------------------------------------------------
function rgBattle(e, { preempt }) {
  if (S.mode !== 'walk' || S.monster) return;
  RG.cur = e; RG.dash = false;
  if (e.kind === 'shima') { encounter({ rare: true, sym: true }); }
  else {
    encounter({ sym: true, bonus: !!e.bonus });
    const m = S.monster;
    if (m && !m.bonus && e.spr) {
      const pw = ENEMY_POWER[S.level] || ENEMY_POWER[1];
      Object.assign(m, { spr: e.spr, subject: e.subject, tintColor: e.tint >= 0 ? TINTS[e.tint].color : null,
        height: (e.spr.height || 180) * pw.scale, name: pw.prefix + (e.tint >= 0 ? TINTS[e.tint].name + ' ' : '') + (e.base || e.spr.name) });
    }
  }
  const m = S.monster;
  if (m && preempt) {
    m.preempt = true;
    const dmg = Math.min(m.hp - 1, heroAtk());
    if (dmg > 0) { m.hp -= dmg; m.hpShown = m.hp + dmg; }
    later(0.3, () => showToast('せなか から せんせい こうげき！', 2));
  }
}
function rgDeathBattle() {
  if (S.mode !== 'walk' || S.monster) return;
  RG.cur = S.maze.death;
  necroAppear();
}
// たたかい が おわって めいろ に もどった
function rgAfterBattle() {
  const M = S.maze, e = RG.cur;
  RG.cur = null;
  if (!e || !M) return;
  if (e === M.death) { // にげた：すこし はなれた ところ へ
    const ang = Math.random() * Math.PI * 2;
    e.x = S.pos.x + Math.round(Math.cos(ang) * 9); e.y = S.pos.y + Math.round(Math.sin(ang) * 9);
    e.x = Math.max(0, Math.min(M.TW - 1, e.x)); e.y = Math.max(0, Math.min(M.TH - 1, e.y));
    e.fx = e.x; e.fy = e.y; e.t = 1;
    return;
  }
  const i = M.enemies.indexOf(e);
  if (i >= 0 && (RG.lastDefeated || e.kind === 'shima')) M.enemies.splice(i, 1); // しまじろう は にげても きえる
  RG.lastDefeated = false;
}
const baseEndBattleRG = endBattle;
endBattle = function () {
  if (rgActive() && ST.battle && ST.battle.returnTo === 'dungeon') RG.lastDefeated = !!(S.monster && S.monster.state === 'hit');
  baseEndBattleRG();
};

// ---------------------------------------------------------------------
//  おとしあな・ドラゴンの うろこ
// ---------------------------------------------------------------------
function rgFall(pit) {
  pit.found = true;
  S.mazeLock = 1.4; S.fall = { t: 0, pit }; S.shake = 0.5;
  SFX.bad(); note(600, 0, 0.6, { type: 'sine', vol: 0.12, slide: 0.25 });
  later(0.9, () => {
    S.fall = null;
    damageHero();
    ST.data.hp = S.hp;
    if (S.hp <= 0) { levelFx('lose'); return; }
    showToast('おとしあな！ HPが 1 へって した の かい へ おちた……', 2.8);
    rgNextFloor(true);
  });
}
warpToBoss = function () {
  if (!rgActive()) return;
  const M = S.maze;
  M.mapAll = true; M.fog.fill(1);
  SFX.star(); S.flash = 0.7; S.flashColor = '255,240,180';
  showToast(`ドラゴンの うろこ が ひかった！ ${M.last ? 'ボスの おしろ' : 'かいだん'} の ばしょ が わかった！`, 3);
};
gotDragonScale = function () {
  if (S.items.length >= CONFIG.maxItems) { warpToBoss(); return; }
  S.items.push('scale');
  renderHud(); SFX.star();
  showToast('ドラゴンの うろこ を てに いれた！ つかうと ちず が ぜんぶ みえる！', 3);
};

// たからばこ の なかみ（めずらしい アイテム）
const baseRandomItemRG = randomItem;
randomItem = function () { return rgActive() ? rgPick(RG_CHEST_ITEMS) : baseRandomItemRG(); };

// ---------------------------------------------------------------------
//  死神：まえぶれ → あらわれて おいかけてくる
// ---------------------------------------------------------------------
function rgOmenStep() {
  const M = S.maze;
  if (M.death) return;
  if (RG.omen) {
    RG.omen.n++;
    if (RG.omen.n === 8) { showToast('……せなかが ぞくっと した……', 3); rgBell(1); RG.dark = 0.35; }
    if (RG.omen.n >= 14) rgSpawnDeath();
    return;
  }
  if (M.steps % 10 !== 0) return;
  const rate = RG_CONF.deathBase * (1 + M.steps / RG_CONF.deathGrow) * ((NECRO.chance || 0) / 0.01);
  if (NECRO.force || Math.random() < rate) {
    NECRO.force = false;
    RG.omen = { n: 0 };
    showToast('……どこかで かねの おとが きこえる……', 3);
    rgBell(2); RG.dark = 0.2;
  }
}
function rgSpawnDeath() {
  const M = S.maze;
  let best = null;
  for (let k = 0; k < 40; k++) {
    const ang = Math.random() * Math.PI * 2, r = rnd(9, 12);
    const x = Math.max(0, Math.min(M.TW - 1, S.pos.x + Math.round(Math.cos(ang) * r))), y = Math.max(0, Math.min(M.TH - 1, S.pos.y + Math.round(Math.sin(ang) * r)));
    if (!rgVisible(x, y)) { best = { x, y }; break; }
    best = { x, y };
  }
  M.death = { ...best, fx: best.x, fy: best.y, t: 1, facing: 1 };
  RG.omen = null; RG.dark = 0.5;
  heldDirs.length = 0; RG.lock = 1.2; S.shake = 0.5;
  showBanner('みつけた……', 2.2);
  rgBell(3);
}
function rgBell(n) { for (let i = 0; i < n; i++) { note(196, i * 0.9, 1.6, { type: 'sine', vol: 0.12 }); note(392 * 1.01, i * 0.9, 1.2, { type: 'sine', vol: 0.04 }); } }
function rgShimaVoice() { note(330, 0, 0.12, { type: 'square', vol: 0.05 }); note(262, 0.13, 0.25, { type: 'square', vol: 0.05 }); }

// ---------------------------------------------------------------------
//  えがく（maze.js の drawMaze の かわり）
// ---------------------------------------------------------------------
const RG_ITEM_IMG = {};
function rgItemImg(id) {
  if (!RG_ITEM_IMG[id] && ITEM_SVG[id]) { const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ITEM_SVG[id].replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); RG_ITEM_IMG[id] = im; }
  return RG_ITEM_IMG[id];
}
const baseDrawMazeRG = drawMaze;
drawMaze = function () {
  if (!rgActive()) { baseDrawMazeRG(); return; }
  const M = S.maze, th = THEMES[S.level] || THEMES[1], T = 48, TW = M.TW;
  const ease = (t) => (t < 1 ? (1 - Math.cos(t * Math.PI)) / 2 : 1);
  const k = ease(S.moveT);
  const hx = S.from.x + (S.pos.x - S.from.x) * k, hy = S.from.y + (S.pos.y - S.from.y) * k;
  const camX = hx * T + T / 2 - W / 2, camY = hy * T + T / 2 - H / 2;
  ctx.fillStyle = '#140c24'; ctx.fillRect(-30, -30, W + 60, H + 60);
  RG.cam = { x: camX, y: camY };
  ctx.save(); ctx.translate(-camX, -camY);
  const x0 = Math.max(0, Math.floor(camX / T) - 1), x1 = Math.min(TW - 1, Math.ceil((camX + W) / T) + 1);
  const y0 = Math.max(0, Math.floor(camY / T) - 1), y1 = Math.min(M.TH - 1, Math.ceil((camY + H) / T) + 1);
  const floorC = th.path, corC = shade(th.path, -18), wallTop = th.near, wallSide = shade(th.near, -45);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * TW + x;
      if (!M.fog[i]) continue;
      const px = x * T, py = y * T;
      if (M.grid[i]) {
        ctx.fillStyle = M.grid[i] === 1 ? floorC : corC; ctx.fillRect(px, py, T + 1, T + 1);
        if (M.grid[i] === 1 && hash(i) < 0.12) { ctx.fillStyle = th.accent[Math.floor(hash(i + 7) * th.accent.length)]; ctx.beginPath(); ctx.arc(px + 8 + hash(i + 3) * (T - 16), py + 8 + hash(i + 5) * (T - 16), 3, 0, 7); ctx.fill(); }
      } else if (RG_DIRS.some(([dx, dy]) => M.grid[(y + dy) * TW + x + dx]) || [[1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => M.grid[(y + dy) * TW + x + dx])) {
        ctx.fillStyle = wallSide; ctx.fillRect(px, py + T * 0.55, T + 1, T * 0.45 + 1);
        ctx.fillStyle = wallTop; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px + 1, py - 4, T - 2, T * 0.6 + 4, 8) : ctx.rect(px + 1, py - 4, T - 2, T * 0.6 + 4); ctx.fill();
      }
    }
  }
  // みえていない ところ は すこし くらく
  ctx.fillStyle = 'rgba(16,10,34,.42)';
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * TW + x; if (M.fog[i] && !M.vis[i]) ctx.fillRect(x * T, y * T, T, T); }
  const shown = (o) => M.fog[o.y * TW + o.x] && o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1;
  // みつけた おとしあな
  M.pits.forEach((p) => { if (!p.found || !shown(p)) return; ctx.fillStyle = '#1a0f2a'; ctx.beginPath(); ctx.ellipse(p.x * T + T / 2, p.y * T + T / 2 + 3, T * 0.4, T * 0.3, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 3; ctx.stroke(); });
  // アイテム
  M.items.forEach((o) => {
    if (!shown(o)) return;
    const im = rgItemImg(o.id), bob = Math.sin(S.t * 3 + o.x) * 2;
    ctx.fillStyle = 'rgba(30,10,50,.22)'; ctx.beginPath(); ctx.ellipse(o.x * T + T / 2, o.y * T + T * 0.8, T * 0.26, 5, 0, 0, 7); ctx.fill();
    if (im && im.complete) ctx.drawImage(im, o.x * T + T * 0.18, o.y * T + T * 0.1 + bob, T * 0.64, T * 0.64);
  });
  // たからばこ
  M.chests.forEach((c) => { if (shown(c)) drawChest(c.x * T + T / 2, c.y * T + T * 0.72, T * 0.8, c.openT, { glow: c.opened ? null : 'rgba(255,215,60,.8)' }); });
  // かいだん・おしろ
  if (shown(M.goal)) {
    const gx = M.goal.x * T, gy = M.goal.y * T;
    if (M.last) {
      ctx.save(); ctx.translate(gx + T / 2, gy + T * 0.95); ctx.scale(0.17, 0.17); drawCastle(0, 0, BOSS_STAGES[S.level], S.level >= CONFIG.maxLevel); ctx.restore();
      outlinedText('ボス', gx + T / 2, gy - T * 0.95, 17, '#ff4f6a');
    } else rgDrawStairs(gx, gy, T);
  }
  // てき・ちゅなちゃん・死神（うえ から じゅん）
  const objs = [];
  M.enemies.forEach((e) => {
    if (!(rgVisible(e.x, e.y) || rgVisible(e.fx, e.fy)) && !M.mapAllEnemies) return;
    const ek = ease(e.t), ex = e.fx + (e.x - e.fx) * ek, ey = e.fy + (e.y - e.fy) * ek;
    objs.push({ y: ey, draw: () => rgDrawEnemy(e, ex, ey, T) });
  });
  objs.push({ y: hy, draw: () => rgDrawHero(hx, hy, T) });
  if (M.death) {
    const D = M.death, dk = ease(D.t), dx = D.fx + (D.x - D.fx) * dk, dy = D.fy + (D.y - D.fy) * dk;
    objs.push({ y: dy + 0.5, draw: () => rgDrawDeath(dx, dy, T) });
  }
  objs.sort((p, q) => p.y - q.y).forEach((o) => o.draw());
  ctx.restore();
  M.heroScreen = { x: hx * T + T / 2 - camX, y: hy * T + T * 0.3 - camY };
  // 死神 が いる あいだ は まわり が くらい
  const darkGoal = M.death ? 0.55 : RG.omen ? 0.3 : 0;
  RG.dark += (darkGoal - RG.dark) * 0.03;
  if (RG.dark > 0.01) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(20,0,20,0)'); g.addColorStop(1, `rgba(20,0,20,${RG.dark})`);
    ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  }
  rgDrawMinimap();
  if (typeof drawSpecialFx === 'function') drawSpecialFx();
};

function rgDrawStairs(gx, gy, T) {
  ctx.save(); ctx.translate(gx, gy);
  ctx.fillStyle = '#2a1d3a'; ctx.fillRect(4, 4, T - 8, T - 8);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = shade('#c9b79c', -i * 18); ctx.fillRect(8 + i * 4, 8 + i * 9, T - 16 - i * 8, 8); }
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(4, 4, T - 8, T - 8);
  ctx.restore();
  outlinedText('かいだん', gx + T / 2, gy - 8, 13, '#ffd84a');
}
function rgDrawHero(hx, hy, T) {
  let bob = S.moveT < 1 ? Math.abs(Math.sin(S.moveT * Math.PI)) * 5 : Math.sin(S.t * 3) * 1.5, sc = 1;
  if (S.fall) { S.fall.t += 1 / 60; const k2 = Math.min(1, S.fall.t / 0.6); sc = 1 - k2 * 0.8; bob = -k2 * 20; }
  const sx = hx * T + T / 2, sy = hy * T + T * 0.92 - bob;
  ctx.fillStyle = 'rgba(30,10,50,.25)'; ctx.beginPath(); ctx.ellipse(sx, hy * T + T * 0.9, T * 0.32, 6, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(sx, sy); ctx.scale((S.facing < 0 ? -1 : 1) * sc, sc);
  const hh = T * 1.55, spr = SPR.hero;
  if (spr) ctx.drawImage(spr.canvas, -hh * spr.w / spr.h / 2, -hh, hh * spr.w / spr.h, hh);
  ctx.restore();
}
function rgDrawEnemy(e, ex, ey, T) {
  const spr = e.spr, sx = ex * T + T / 2, sy = ey * T + T * 0.92;
  const hh = T * (e.kind === 'shima' ? 1.5 : 1.25) * (e.state === 'sleep' ? 0.92 : 1);
  ctx.fillStyle = 'rgba(30,10,50,.25)'; ctx.beginPath(); ctx.ellipse(sx, ey * T + T * 0.9, T * 0.3, 5, 0, 0, 7); ctx.fill();
  if (e.bonus && Math.random() < 0.12) spawn('twinkle', sx - RG.cam.x + rnd(-14, 14), sy - RG.cam.y - rnd(10, hh), { color: '#fff3a0', size: rnd(5, 9) });
  ctx.save(); ctx.translate(sx, sy - (e.state === 'chase' ? Math.abs(Math.sin(S.t * 8 + e.id)) * 3 : 0));
  ctx.scale(e.facing < 0 ? -1 : 1, 1);
  if (e.bonus) { ctx.shadowColor = 'rgba(255,220,90,.95)'; ctx.shadowBlur = 16; }
  if (spr) ctx.drawImage(spr.canvas, -hh * spr.w / spr.h / 2, -hh, hh * spr.w / spr.h, hh);
  else { ctx.fillStyle = '#b07ad8'; ctx.beginPath(); ctx.arc(0, -T * 0.4, T * 0.35, 0, 7); ctx.fill(); }
  ctx.restore();
  if (e.state === 'sleep') outlinedText('Zz', sx + T * 0.35, sy - hh - 4 - Math.sin(S.t * 2) * 3, 13, '#8a5cd1');
  else if (e.state === 'chase' && e.kind === 'normal') outlinedText('！', sx + T * 0.3, sy - hh - 2, 18, '#ff4f6a');
  if (e.kind === 'shima' && e.say && e.say.t < 3.2) rgDrawShimaSay(sx, sy - hh - 10);
}
// ふきだし「今日（きょう）は もう 終（お）わったよ！！」（ルビ つき）
function rgDrawShimaSay(x, y) {
  const parts = [['今日', 'きょう'], ['は もう ', ''], ['終', 'お'], ['わったよ！！', '']];
  ctx.save();
  ctx.font = '900 17px "Zen Maru Gothic", sans-serif';
  const widths = parts.map(([t]) => ctx.measureText(t).width), w = widths.reduce((a, b) => a + b, 0) + 28, h = 46;
  const bx = x - w / 2, by = y - h - 12;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, w, h, 14) : ctx.rect(bx, by, w, h); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 8, by + h - 1); ctx.lineTo(x, by + h + 12); ctx.lineTo(x + 8, by + h - 1); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 6, by + h - 4, 12, 5);
  let cx = bx + 14;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  parts.forEach(([t, ruby], i) => {
    ctx.font = '900 17px "Zen Maru Gothic", sans-serif'; ctx.fillStyle = INK;
    ctx.fillText(t, cx, by + h - 10);
    if (ruby) { ctx.font = '700 9px "Zen Maru Gothic", sans-serif'; ctx.fillStyle = '#c0407a'; ctx.textAlign = 'center'; ctx.fillText(ruby, cx + widths[i] / 2, by + 15); ctx.textAlign = 'left'; }
    cx += widths[i];
  });
  ctx.restore();
}
function rgDrawDeath(dx, dy, T) {
  const spr = NECRO.spr.necroTrue, sx = dx * T + T / 2, sy = dy * T + T * 0.9 + Math.sin(S.t * 2.4) * 4;
  const hh = T * 1.9;
  ctx.save(); ctx.globalAlpha = 0.88;
  ctx.shadowColor = 'rgba(255,40,90,.9)'; ctx.shadowBlur = 22;
  if (spr) { ctx.translate(sx, sy); ctx.scale(S.maze.death.facing < 0 ? -1 : 1, 1); ctx.drawImage(spr.canvas, -hh * spr.w / spr.h / 2, -hh, hh * spr.w / spr.h, hh); }
  else { ctx.fillStyle = '#2a0a2a'; ctx.beginPath(); ctx.arc(sx, sy - T * 0.6, T * 0.5, 0, 7); ctx.fill(); }
  ctx.restore();
  if (Math.random() < 0.3) spawn('twinkle', sx - RG.cam.x + rnd(-20, 20), sy - RG.cam.y - rnd(0, hh), { color: '#ff3a6a', size: rnd(4, 8) });
}

function rgDrawMinimap() {
  const M = S.maze;
  const cell = Math.min(4, 170 / M.TW), w = M.TW * cell, h = M.TH * cell;
  const x = W - w - 14, y = 66;
  ctx.save();
  ctx.fillStyle = 'rgba(20,12,40,.72)'; ctx.strokeStyle = 'rgba(255,250,243,.9)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 6, y - 6, w + 12, h + 12, 8) : ctx.rect(x - 6, y - 6, w + 12, h + 12); ctx.fill(); ctx.stroke();
  for (let ty = 0; ty < M.TH; ty++) for (let tx = 0; tx < M.TW; tx++) {
    const k = ty * M.TW + tx;
    if (!M.fog[k] || !M.grid[k]) continue;
    ctx.fillStyle = M.grid[k] === 1 ? '#e9e2f2' : '#b9aecb'; ctx.fillRect(x + tx * cell, y + ty * cell, cell + 0.3, cell + 0.3);
  }
  const dot = (o, c, r = 1) => { ctx.fillStyle = c; ctx.fillRect(x + o.x * cell - (r - 1) * cell / 2, y + o.y * cell - (r - 1) * cell / 2, cell * r, cell * r); };
  M.items.forEach((o) => { if (M.fog[o.y * M.TW + o.x]) dot(o, '#4ecbff'); });
  M.chests.forEach((c) => { if (M.fog[c.y * M.TW + c.x] && !c.opened) dot(c, '#ffc93c', 1.4); });
  M.pits.forEach((p) => { if (p.found) dot(p, '#ff5c8a'); });
  if (M.fog[M.goal.y * M.TW + M.goal.x]) {
    if (M.last) drawStar(x + M.goal.x * cell + cell / 2, y + M.goal.y * cell + cell / 2, cell * 2.4, '#ff4f6a');
    else dot(M.goal, '#ffd84a', 2);
  }
  M.enemies.forEach((e) => { if (rgVisible(e.x, e.y)) dot(e, e.kind === 'shima' ? '#ffb02e' : '#ff4f6a', 1.3); });
  if (M.death) dot(M.death, '#c040ff', 2);
  if (Math.sin(S.t * 8) > -0.3) { ctx.fillStyle = '#4ee0b0'; ctx.beginPath(); ctx.arc(x + S.pos.x * cell + cell / 2, y + S.pos.y * cell + cell / 2, cell + 1, 0, 7); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------------
//  HUD：ばしょ の なまえ に「ちか ○かい」
// ---------------------------------------------------------------------
const baseRenderHudRG = stRenderHud;
stRenderHud = function () {
  baseRenderHudRG();
  if (rgActive() && !$('stHud').hidden) $('stPlace').textContent = `${DUNGEONS[ST.data.dungeon.difficulty]} ちか${S.maze.floor}かい`;
};

// ---------------------------------------------------------------------
//  テスト よう
// ---------------------------------------------------------------------
window.rogueTest = {
  // いま の ばしょ から target（{x,y}）まで の すすみかた（てき は よける）
  pathTo(target, avoidEnemies = true) {
    const M = S.maze, TW = M.TW;
    const block = new Set(avoidEnemies ? M.enemies.map((e) => e.y * TW + e.x) : []);
    M.pits.forEach((p) => { if (!(p.x === target.x && p.y === target.y)) block.add(p.y * TW + p.x); });
    const prev = new Map(), start = S.pos.y * TW + S.pos.x, q = [start]; prev.set(start, null);
    for (let h = 0; h < q.length; h++) {
      const k = q[h];
      if (k === target.y * TW + target.x) {
        const dirs = []; let c = k;
        while (prev.get(c)) { const [from, d] = prev.get(c); dirs.unshift(d); c = from; }
        return dirs;
      }
      const x = k % TW, y = (k - x) / TW;
      for (const [d, [dx, dy]] of Object.entries(DIR_VEC)) {
        const nk = (y + dy) * TW + x + dx;
        if (!M.grid[nk] || prev.has(nk) || (block.has(nk) && nk !== target.y * TW + target.x)) continue;
        if (M.goal.y * TW + M.goal.x === nk && !(target.x === M.goal.x && target.y === M.goal.y)) continue;
        prev.set(nk, [k, d]); q.push(nk);
      }
    }
    return [];
  },
  goal: () => ({ ...S.maze.goal }),
  clearEnemies() { S.maze.enemies.length = 0; },
  noSpawn() { RG_CONF.spawnEvery = 1e9; },
  // ちゅなちゃん の となり に てき を おく（dir の むき に）
  putEnemy(dx, dy, opts = {}) {
    const M = S.maze, x = S.pos.x + dx, y = S.pos.y + dy;
    if (!M.grid[y * M.TW + x]) return false;
    const e = rgMakeEnemy(x, y, opts); if (opts.dir) e.dir = opts.dir;
    M.enemies.push(e); rgReveal(); return true;
  },
  openDir() { const M = S.maze; for (const [d, [dx, dy]] of Object.entries(DIR_VEC)) if (M.grid[(S.pos.y + dy) * M.TW + S.pos.x + dx] && !M.enemies.some((e) => e.x === S.pos.x + dx && e.y === S.pos.y + dy)) return d; return null; },
  teleport(x, y) { rgPlaceHero({ x, y }); },
  nearGoal() { // ゴール の となり に いく
    const M = S.maze, g = M.goal;
    for (const [dx, dy] of RG_DIRS) if (M.grid[(g.y + dy) * M.TW + g.x + dx]) { rgPlaceHero({ x: g.x + dx, y: g.y + dy }); return RG_DIRNAME[`${-dx},${-dy}`]; }
    return null;
  },
  info: () => ({ floor: S.maze.floor, last: S.maze.last, rooms: S.maze.rooms.length, enemies: S.maze.enemies.length, items: S.maze.items.length, chests: S.maze.chests.length, pits: S.maze.pits.length, TW: S.maze.TW, TH: S.maze.TH }),
};
