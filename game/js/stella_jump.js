'use strict';
// =====================================================================
//  ステラクエスト：ジャンプ・がけ・しげみ（ふしぎな ダンジョン）
//  ・ジャンプ ボタン（スペース キー）：むいて いる ほう へ 2マス とぶ。1ターン つかう
//    とびこえ られる：おとしあな・がけ・てき（しまじろう・死神 も）
//    とびこえ られない：かべ・しげみ。おりる ところ が かべ・がけ・しげみ・てき なら とべない
//  ・がけ：ジャンプ で しか わたれない 1マス の あな（まっすぐ な つうろ に ときどき）。てき も わたれない
//  ・しげみ：けんし かずぅ が なかま なら きって すすめる（ときどき なにか でてくる）。
//    いなければ とおれない。しげみ が なくても ぜんぶ の へや に いける ところ に だけ おく
//  stella_rogue.js の あと に よむ。しよう：docs/GAME_SPEC.md 15.10
// =====================================================================

const JUMP = { gaps: [0.35, 0.8], bushes: [1, 3], bushItem: 0.3 }; // がけ：0こ・1こ・2こ に なる さかいめ／しげみ の かず／きると なにか でる かくりつ
let JUMP_FEAT = true;
try { if (localStorage.getItem('stella:test:feat') === '0') JUMP_FEAT = false; } catch { /* テスト よう（ふだん は ない） */ }

const rgGapAt = (x, y) => { const M = S.maze; return !!(M && M.gaps && M.gaps.some((g) => g.x === x && g.y === y)); };
const rgBushAt = (x, y) => { const M = S.maze; return (M && M.bushes && M.bushes.find((b) => b.x === x && b.y === y)) || null; };
const hasParty = (id) => !!(ST.data && (ST.data.party || []).includes(id));

// ---------------------------------------------------------------------
//  つくる：がけ と しげみ（その かい の はじめ に）
// ---------------------------------------------------------------------
function rgMakeFeatures() {
  const M = S.maze, TW = M.TW, TH = M.TH, g = M.grid;
  M.gaps = []; M.bushes = [];
  if (!JUMP_FEAT || M.rest) return;
  const at = (x, y) => (x < 0 || y < 0 || x >= TW || y >= TH ? 0 : g[y * TW + x]);
  const busy = (x, y) => (x === S.pos.x && y === S.pos.y) || (x === M.goal.x && y === M.goal.y) || M.items.some((o) => o.x === x && o.y === y) ||
    M.chests.some((o) => o.x === x && o.y === y) || M.pits.some((o) => o.x === x && o.y === y) || M.enemies.some((o) => o.x === x && o.y === y);
  const near = (x, y, list, d) => list.some((o) => Math.abs(o.x - x) + Math.abs(o.y - y) <= d);
  // まっすぐ な つうろ（よこ が かべ）。len は まえ と うしろ に つうろ が つづく かず
  const straight = (x, y, len) => [[1, 0], [0, 1]].some(([dx, dy]) => {
    for (let k = -len; k <= len; k++) if (!at(x + dx * k, y + dy * k)) return false;            // まえ うしろ は とおれる
    for (let k = -1; k <= 1; k++) if (at(x + dx * k + dy, y + dy * k + dx) || at(x + dx * k - dy, y + dy * k - dx)) return false; // よこ は かべ
    return true;
  });
  const cand = [];
  for (let y = 1; y < TH - 1; y++) for (let x = 1; x < TW - 1; x++) if (g[y * TW + x] === 2 && !busy(x, y)) cand.push({ x, y });
  cand.sort(() => Math.random() - 0.5);
  // がけ：おりる ところ まで まっすぐ（まえ うしろ 2マス）
  const r = Math.random(), nGap = r < JUMP.gaps[0] ? 0 : r < JUMP.gaps[1] ? 1 : 2;
  for (const p of cand) {
    if (M.gaps.length >= nGap) break;
    if (straight(p.x, p.y, 2) && !near(p.x, p.y, M.gaps, 4) && Math.abs(p.x - S.pos.x) + Math.abs(p.y - S.pos.y) > 3) M.gaps.push({ x: p.x, y: p.y });
  }
  // しげみ：なくても ぜんぶ の へや・かいだん・たからばこ に いける ところ だけ（がけ は とべる ので とおれる あつかい）
  const nBush = rnd(JUMP.bushes[0], JUMP.bushes[1]);
  const targets = [M.goal, ...M.chests, ...M.items, ...M.rooms.map((rm) => ({ x: rm.x, y: rm.y }))];
  const ok = (set) => { const d = rgBfs(g, TW, TH, S.pos, (k) => !set.has(k)); return targets.every((t) => d[t.y * TW + t.x] >= 0); };
  const set = new Set();
  for (const p of cand) {
    if (M.bushes.length >= nBush) break;
    if (rgGapAt(p.x, p.y) || near(p.x, p.y, M.gaps, 2) || near(p.x, p.y, M.bushes, 3) || !straight(p.x, p.y, 1)) continue;
    const k = p.y * TW + p.x; set.add(k);
    if (ok(set)) M.bushes.push({ x: p.x, y: p.y }); else set.delete(k);
  }
}
// rgStartFloor の さいご の セーブ（rgSnapshot(true)）の まえ に つくる
const baseSnapshotJump = rgSnapshot;
rgSnapshot = function (floorStart) {
  const M = S.maze;
  if (M && floorStart && !M.gaps) rgMakeFeatures();
  baseSnapshotJump(floorStart);
  const f = ST.data.dungeon && ST.data.dungeon.floorSnap;
  if (f && M && (floorStart || !f.gaps)) { f.gaps = (M.gaps || []).map((o) => ({ ...o })); f.bushes = (M.bushes || []).map((o) => ({ ...o })); }
};
const baseResumeJump = rgResume;
rgResume = function (snap) {
  baseResumeJump(snap);
  const f = snap.floorSnap, M = S.maze;
  M.gaps = (f.gaps || []).map((o) => ({ ...o })); M.bushes = (f.bushes || []).map((o) => ({ ...o }));
};

// ---------------------------------------------------------------------
//  あるく：がけ・しげみ で とまる
// ---------------------------------------------------------------------
let jumpToldT = -9;
const jumpTell = (msg) => { if (S.t - jumpToldT > 2.2) { jumpToldT = S.t; showToast(msg, 2.4); } };
const baseTryMoveJump = rgTryMove;
rgTryMove = function (d) {
  const [dx, dy] = DIR_VEC[d], nx = S.pos.x + dx, ny = S.pos.y + dy;
  if (rgGapAt(nx, ny)) {
    if (dx) S.facing = dx; S.dir = d; heldDirs.length = 0;
    jumpTell('がけ だ！「ジャンプ」で とびこえよう');
    return;
  }
  const b = rgBushAt(nx, ny);
  if (b) {
    if (dx) S.facing = dx; S.dir = d; heldDirs.length = 0;
    if (hasParty('kazu')) cutBush(b);
    else jumpTell('しげみ で とおれない……。けんし が いたら きって くれる かも？');
    return;
  }
  baseTryMoveJump(d);
};
function cutBush(b) {
  const M = S.maze, T = 48;
  M.bushes.splice(M.bushes.indexOf(b), 1);
  const sx = b.x * T + T / 2 - RG.cam.x, sy = b.y * T + T / 2 - RG.cam.y;
  for (let i = 0; i < 18; i++) spawn('twinkle', sx + rnd(-16, 16), sy + rnd(-16, 16), { color: pick(['#5fcf6a', '#9be36b', '#ffffff']), size: rnd(6, 12) });
  note(1400, 0, 0.06, { type: 'sawtooth', vol: 0.05, slide: 0.4 }); note(900, 0.08, 0.08, { type: 'sawtooth', vol: 0.04, slide: 0.5 });
  if (typeof partySay === 'function') partySay('kazu', 'まかせて！ えいっ！');
  let msg = 'かずぅ が しげみ を きった！';
  if (Math.random() < JUMP.bushItem) {
    if (S.items.length < CONFIG.maxItems && Math.random() < 0.6) { const id = rgPick(RG_FLOOR_ITEMS); M.items.push({ x: b.x, y: b.y, id }); msg += ` なか から「${ITEMS[id].name}」が でてきた！`; }
    else { const a = 5 + rnd(0, 5) * (ST.data.dungeon ? ST.data.dungeon.difficulty || 1 : 1); ST.data.arca += a; coinSound(); stRenderHud(); msg += ` ${a} アルカ が おちていた！`; }
  }
  showToast(msg, 2.6);
  RG.lock = 0.35;
  rgWorldTurn();
}

// ---------------------------------------------------------------------
//  ジャンプ
// ---------------------------------------------------------------------
function rgJump() {
  if (!rgActive() || S.mode !== 'walk' || S.monster || RG.special || S.moveT < 1 || RG.lock > 0 || S.mazeLock > 0 || RG.climb) return false;
  if (typeof ITEMUI !== 'undefined' && ITEMUI.open) return false;
  const M = S.maze, d = S.dir || (S.facing < 0 ? 'left' : 'right'), [dx, dy] = DIR_VEC[d];
  const mx = S.pos.x + dx, my = S.pos.y + dy, lx = S.pos.x + dx * 2, ly = S.pos.y + dy * 2;
  const floor = (x, y) => x >= 0 && y >= 0 && x < M.TW && y < M.TH && M.grid[y * M.TW + x];
  if (!floor(mx, my) || rgBushAt(mx, my)) { jumpTell(rgBushAt(mx, my) ? 'しげみ は たかくて とびこえ られない' : 'かべ が あって とべない'); return false; }
  const who = (x, y) => M.enemies.some((e) => e.x === x && e.y === y) || (M.death && M.death.x === x && M.death.y === y);
  if (!floor(lx, ly) || rgGapAt(lx, ly) || rgBushAt(lx, ly) || who(lx, ly)) { jumpTell('おりる ところ が ない……'); return false; }
  heldDirs.length = 0; RG.dash = false; RG.holdT = 0;
  S.from = { ...S.pos }; S.pos = { x: lx, y: ly }; S.moveT = 0; RG.jumping = true;
  note(520, 0, 0.16, { type: 'sine', vol: 0.07, slide: 1.8 });
  return true;
}
const baseArriveJump = rgArrive;
rgArrive = function () {
  if (RG.jumping) {
    RG.jumping = false;
    note(300, 0, 0.06, { type: 'triangle', vol: 0.05 });
    const hs = S.maze.heroScreen;
    if (hs) for (let i = 0; i < 6; i++) spawn('twinkle', hs.x + rnd(-20, 20), hs.y + 40, { color: '#e9e2f2', size: rnd(4, 7) });
  }
  baseArriveJump();
};

// ---------------------------------------------------------------------
//  かく（stella_rogue.js の drawMaze から よばれる）
// ---------------------------------------------------------------------
function rgFeatDraw(shown, T) {
  const M = S.maze;
  (M.gaps || []).forEach((p) => {
    if (!shown(p)) return;
    const x = p.x * T, y = p.y * T;
    ctx.fillStyle = '#0c0618'; ctx.fillRect(x, y, T, T);
    const gr = ctx.createLinearGradient(0, y, 0, y + T); gr.addColorStop(0, 'rgba(90,60,40,.9)'); gr.addColorStop(0.35, 'rgba(12,6,24,0)');
    ctx.fillStyle = gr; ctx.fillRect(x, y, T, T);
    ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(x, y + 4); for (let i = 1; i <= 4; i++) ctx.lineTo(x + i * T / 4, y + 4 + (i % 2 ? 4 : 0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + T - 3); for (let i = 1; i <= 4; i++) ctx.lineTo(x + i * T / 4, y + T - 3 - (i % 2 ? 4 : 0)); ctx.stroke();
  });
  (M.bushes || []).forEach((b) => {
    if (!shown(b)) return;
    const cx = b.x * T + T / 2, cy = b.y * T + T * 0.62;
    [[-12, 4, 14, '#2f8a3e'], [12, 4, 14, '#2f8a3e'], [0, -8, 17, '#3fa84c'], [-8, -2, 12, '#4fbf5a'], [9, -4, 11, '#5fcf6a']].forEach(([dx, dy, r, c]) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx + dx, cy + dy, r, 0, 7); ctx.fill();
    });
    ctx.strokeStyle = '#1d5a28'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy - 8, 17, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.fillStyle = '#ff7aa8'; [[-6, -14], [8, -6], [-12, 2]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 2.5, 0, 7); ctx.fill(); });
  });
}
function rgFeatMini(dot) {
  const M = S.maze;
  (M.gaps || []).forEach((p) => { if (M.fog[p.y * M.TW + p.x]) dot(p, '#3a2a4d', 1.2); });
  (M.bushes || []).forEach((p) => { if (M.fog[p.y * M.TW + p.x]) dot(p, '#3fa84c', 1.2); });
}
// てき は がけ・しげみ に はいれない（stella_rogue.js の rgWorldTurn の occupied に たす）
function rgFeatBlocked() {
  const M = S.maze;
  return [...(M.gaps || []), ...(M.bushes || [])].map((o) => o.y * M.TW + o.x);
}

// ---------------------------------------------------------------------
//  ボタン・キー
// ---------------------------------------------------------------------
addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat || !rgActive() || S.mode !== 'walk' || RG.special || RG.climb) return;
  if (typeof ITEMUI !== 'undefined' && ITEMUI.open) return;
  rgJump(); e.preventDefault(); e.stopImmediatePropagation();
}, true);

// テスト よう
window.jumpTest = {
  jump: rgJump,
  gap(x, y) { S.maze.gaps = S.maze.gaps || []; S.maze.gaps.push({ x, y }); },
  bush(x, y) { S.maze.bushes = S.maze.bushes || []; S.maze.bushes.push({ x, y }); },
  make: rgMakeFeatures,
  enable() { JUMP_FEAT = true; },
};
