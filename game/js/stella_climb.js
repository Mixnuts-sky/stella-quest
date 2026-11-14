'use strict';
// =====================================================================
//  ステラクエスト：おしろ のぼり（よこ から みる アスレチック）
//  ・ふつう の ダンジョン の さいご の かい で ボス の おしろ に つくと はじまる
//    （むげん の とう・タイムアタック では ない）
//  ・←→ で あるく、ジャンプ ボタン（スペース・↑）で ジャンプ。つる は ↑↓ で のぼる・おりる
//  ・あしば：ふつう・よこ に うごく・たて に うごく・のると くずれる・つる
//  ・しかけ：とげ・こうもり・まわる ひのぼう・した から せまる とげ の ゆか
//  ・つる の いちばん うえ は あしば（のぼりきる と のれる）
//    どれか に さわる と いちばん した から やりなおし（ダメージ なし）
//  ・てっぺん の とびら に つくと ボス の たたかい（おしろ の おくじょう の けしき）
//  ・なんいど が たかい ほど たかく、しかけ が ふえる・かべ が はやい
//  ・ジャンプ ボタン を フリック すると その むき に とぶ（stella_touch.js）
//  stella_rogue.js・stella_endless.js の あと に よむ。しよう：docs/GAME_SPEC.md 15.12
// =====================================================================

const CLIMB = {
  worldW: 900,        // よこ の ひろさ（この はば が がめん の はば に なる）
  rowGap: 112,        // あしば の たかさ の かんかく
  rows: (d) => 9 + d * 2,
  grav: 2000, jumpV: 800, speed: 250, climbV: 170,
  coyote: 0.1, buffer: 0.14,
  heroW: 26, heroH: 70,
};
let CLIMB_ON = true;
try { if (localStorage.getItem('stella:test:climb') === '0') CLIMB_ON = false; } catch { /* テスト よう（ふだん は ない） */ }

// ---------------------------------------------------------------------
//  はじめる・つくる
// ---------------------------------------------------------------------
function climbStart() {
  if (!CLIMB_ON || (typeof isEndless === 'function' && isEndless()) || (typeof TA !== 'undefined' && TA.run)) return false;
  const d = (ST.data.dungeon && ST.data.dungeon.difficulty) || 1;
  RG.climb = climbBuild(d);
  heldDirs.length = 0;
  showBanner('おしろ を のぼろう！', 2);
  later(1.2, () => showToast('←→ で あるく・「ジャンプ」で とぶ・つる は ↑↓。ひのぼう・くずれる あしば・せまる とげ の ゆか に きをつけて！', 4.5));
  SFX.star();
  return true;
}
function climbBuild(d) {
  const C = CLIMB, n = C.rows(d), worldH = n * C.rowGap + 260, ground = worldH - 40;
  const plats = [{ x: 0, w: C.worldW, y: ground, kind: 'ground' }], vines = [], spikes = [], bats = [], firebars = [];
  let cx = C.worldW / 2, r = 1;
  const rowY = (k) => ground - k * C.rowGap;
  while (r <= n) {
    const top = r === n;
    const w = top ? 300 : Math.max(96, rnd(150, 210) - d * 9);
    // まえ の あしば から とどく ところ（よこ に 120〜230）
    let nx = cx + pick([-1, 1]) * rnd(120, 230);
    if (nx < w / 2 + 20 || nx > C.worldW - w / 2 - 20) nx = cx + (cx > C.worldW / 2 ? -1 : 1) * rnd(120, 230);
    nx = Math.max(w / 2 + 20, Math.min(C.worldW - w / 2 - 20, nx));
    if (top) nx = C.worldW / 2;
    // つる：この あしば から 2だん うえ まで
    if (!top && r > 2 && r + 2 < n && Math.random() < 0.2) {
      const p = { x: nx - w / 2, w, y: rowY(r), kind: 'plain' };
      plats.push(p);
      const vx = nx + (Math.random() < 0.5 ? -1 : 1) * (w / 2 - 18);
      // つる の いちばん うえ は ちいさい あしば（のぼりきる と のれる）。となり の あしば と つながって いる
      const side = vx > C.worldW / 2 ? -1 : 1;
      const w2 = Math.max(96, rnd(140, 190) - d * 8);
      const nx2 = Math.max(w2 / 2 + 20, Math.min(C.worldW - w2 / 2 - 20, vx + side * (w2 / 2 + 30)));
      const e2 = nx2 - side * w2 / 2; // となり の あしば の つる に ちかい ほう の はし
      const lo = Math.min(vx - 30, e2), hi = Math.max(vx + 30, e2);
      const tp = { x: lo, w: hi - lo, y: rowY(r + 2), kind: 'plain', vineTop: true };
      plats.push(tp);
      vines.push({ x: vx, top: rowY(r + 2) - C.heroH * 0.5 - 6, bottom: rowY(r) - 20, plat: tp });
      plats.push({ x: nx2 - w2 / 2, w: w2, y: rowY(r + 2), kind: 'plain' });
      cx = nx2; r += 3;
      continue;
    }
    // あしば の しゅるい：よこ に うごく・たて に うごく・くずれる
    let kind = top ? 'top' : 'plain';
    if (!top && r > 2) {
      const q = Math.random();
      if (q < 0.11 + d * 0.025) kind = 'move';
      else if (q < 0.19 + d * 0.04) kind = 'vmove';
      else if (q < 0.28 + d * 0.05) kind = 'crumble';
    }
    // まわる ひのぼう：ひろい ふつう の あしば の まんなか
    const fire = kind === 'plain' && r > 2 && Math.random() < 0.08 + d * 0.035;
    const pw = fire ? 250 : w;
    if (fire) nx = Math.max(pw / 2 + 20, Math.min(C.worldW - pw / 2 - 20, nx));
    const p = { x: nx - pw / 2, w: pw, y: rowY(r), kind };
    if (kind === 'move') { p.bx = p.x; p.range = rnd(70, 130); p.sp = 0.9 + Math.random() * 0.5 + d * 0.06; p.ph = Math.random() * 6; }
    if (kind === 'vmove') { p.by = p.y; p.range = rnd(35, 55); p.sp = 1.0 + Math.random() * 0.4 + d * 0.05; p.ph = Math.random() * 6; }
    if (kind === 'crumble') { p.st = 0; p.timer = 0; } // 0 ふつう・1 ぐらぐら・2 おちて ない
    plats.push(p);
    if (fire) firebars.push({ x: nx, y: p.y - 4, n: 4, gap: 20, sp: (1.15 + Math.random() * 0.35 + d * 0.06) * pick([-1, 1]), ph: Math.random() * 6 });
    else if (kind === 'plain' && r > 2 && w >= 150 && Math.random() < 0.14 + d * 0.035) spikes.push({ plat: p, x: p.x + (Math.random() < 0.5 ? 0 : w - 44), w: 44 });
    if (!top && d >= 2 && r > 3 && Math.random() < 0.08 + d * 0.03) bats.push({ y: rowY(r) - C.rowGap * 0.55, x: rnd(60, C.worldW - 60), dir: pick([-1, 1]), sp: rnd(90, 140) + d * 12, ph: Math.random() * 6 });
    cx = nx; r++;
  }
  const topPlat = plats[plats.length - 1];
  const start = { x: 120, y: ground };
  return { d, plats, vines, spikes, bats, firebars, worldH, ground, topPlat, wall: climbWall(d), door: { x: topPlat.x + topPlat.w / 2, y: topPlat.y }, start,
    hero: { x: start.x, y: start.y, vx: 0, vy: 0, on: plats[0], climb: null, facing: 1, coyote: 0, buffer: 0 }, camY: worldH, t: 0, best: 0, fails: 0, done: false, hurtT: 0 };
}

// した から せまる かべ（2だん のぼったら うごきだす）
const climbWall = (d) => ({ on: false, y: Infinity, sp: 30 + d * 5 });

// ---------------------------------------------------------------------
//  うごかす
// ---------------------------------------------------------------------
const climbHeld = (d) => heldDirs.includes(d);
// dir：フリック した むき（left・right は その むき へ、up・down は まっすぐ うえ）
function climbJump(dir) {
  const C = RG.climb;
  if (!C || C.done) return;
  C.hero.buffer = CLIMB.buffer;
  C.hero.bufDir = dir === 'left' ? -1 : dir === 'right' ? 1 : dir ? 0 : null;
}
function climbUpdate(dt) {
  const C = RG.climb, K = CLIMB, h = C.hero;
  if (!C) return;
  dt = Math.min(dt, 1 / 30);
  C.t += dt;
  if ((typeof ITEMUI !== 'undefined' && ITEMUI.open) || C.done) return;
  // うごく あしば・こうもり
  C.plats.forEach((p) => {
    if (p.kind === 'move') { const ox = p.x; p.x = p.bx + Math.sin(C.t * p.sp + p.ph) * p.range; p.dx = p.x - ox; }
    else if (p.kind === 'vmove') { const oy = p.y; p.y = p.by + Math.sin(C.t * p.sp + p.ph) * p.range; p.dy = p.y - oy; }
    else if (p.kind === 'crumble' && p.st) {
      p.timer -= dt;
      if (p.timer > 0) return;
      if (p.st === 1) { p.st = 2; p.timer = 2.6; if (h.on === p) h.on = null; note(140, 0, 0.25, { type: 'sawtooth', vol: 0.05, slide: 0.5 }); }
      else p.st = 0;
    }
  });
  C.bats.forEach((b) => { b.x += b.dir * b.sp * dt; if (b.x < 40 || b.x > K.worldW - 40) { b.dir *= -1; b.x = Math.max(40, Math.min(K.worldW - 40, b.x)); } });
  if (C.hurtT > 0) { C.hurtT -= dt; if (C.hurtT <= 0) climbRespawn(); return; }
  // せまる かべ
  const Wl = C.wall;
  if (!Wl.on && h.y < C.ground - CLIMB.rowGap * 2 + 4) { Wl.on = true; showToast('ゴゴゴ……！ した から とげ の ゆか が せまって くる！ いそいで のぼろう！', 3); S.shake = 0.4; }
  if (Wl.on) {
    const viewH = H / (W / K.worldW);
    Wl.y = Math.max(C.topPlat.y + 170, Math.min(Wl.y - Wl.sp * dt, h.y + viewH * 0.75));
  }
  const L = climbHeld('left'), R = climbHeld('right'), U = climbHeld('up'), D = climbHeld('down');
  if (h.buffer > 0) h.buffer -= dt;
  // つる
  const vine = C.vines.find((v) => Math.abs(h.x - v.x) < 24 && h.y - 10 <= v.bottom + 30 && h.y - K.heroH * 0.5 >= v.top - 10);
  if (!h.climb && vine && (U || D) && !(D && h.on && h.on !== vine.plat) && !(U && h.on === vine.plat)) { h.climb = vine; h.vx = 0; h.vy = 0; h.on = null; if (D) h.y += 4; }
  if (h.climb) {
    const v = h.climb;
    h.x += (v.x - h.x) * Math.min(1, dt * 14);
    h.vy = U ? -K.climbV : D ? K.climbV : 0;
    h.y += h.vy * dt;
    if (h.y - K.heroH * 0.5 < v.top) h.y = v.top + K.heroH * 0.5;
    if (U && v.plat && h.y <= v.plat.y + 8) { h.y = v.plat.y; h.on = v.plat; h.climb = null; h.vy = 0; } // のぼりきった → うえ の あしば に のる
    if (h.buffer > 0) {
      const bd = h.bufDir;
      h.buffer = 0; h.climb = null; h.vy = -K.jumpV * 0.9; h.airDir = bd == null ? 0 : bd;
      h.vx = (L ? -1 : R ? 1 : bd != null ? bd : h.facing) * K.speed * 0.6; climbJumpSfx();
    }
    else if (L || R) { h.climb = null; h.facing = L ? -1 : 1; }
    else if (h.y > v.bottom + 30) h.climb = null;
    if (h.climb) { climbCheckHazards(); climbCamera(dt); return; }
  }
  // よこ（フリック で とんだ ときは そら で その むき に すすむ）
  const ad = h.on ? 0 : (h.airDir || 0);
  h.vx = L ? -K.speed : R ? K.speed : ad * K.speed;
  if (L || ad < 0) h.facing = -1; if (R || ad > 0) h.facing = 1;
  if (h.on && h.on.kind === 'move' && h.on.dx) h.x += h.on.dx;
  h.x = Math.max(K.heroW / 2, Math.min(K.worldW - K.heroW / 2, h.x + h.vx * dt));
  // ジャンプ（↑ でも とべる。つる の そば では のぼる）
  if (U && !vine && h.on) h.buffer = Math.max(h.buffer, 0.01);
  if (h.on) h.coyote = K.coyote; else h.coyote -= dt;
  if (h.buffer > 0 && h.coyote > 0) {
    h.buffer = 0; h.coyote = 0; h.vy = -K.jumpV; h.on = null; h.airDir = h.bufDir || 0; climbJumpSfx();
    if (h.bufDir) h.facing = h.bufDir;
  }
  // たて
  const prevY = h.y;
  if (h.on) {
    if (h.x < h.on.x - K.heroW * 0.4 || h.x > h.on.x + h.on.w + K.heroW * 0.4) h.on = null; // はし から おちる
    else h.y = h.on.y;
  }
  if (!h.on) {
    h.vy = Math.min(h.vy + K.grav * dt, 1400);
    h.y += h.vy * dt;
    if (h.vy > 0) {
      const land = C.plats.find((p) => p.st !== 2 && prevY <= p.y + 2 + Math.max(0, -(p.dy || 0)) && h.y >= p.y && h.x >= p.x - K.heroW * 0.4 && h.x <= p.x + p.w + K.heroW * 0.4);
      if (land) { h.y = land.y; h.vy = 0; h.on = land; h.airDir = 0; note(260, 0, 0.05, { type: 'triangle', vol: 0.04 }); }
    }
  }
  // くずれる あしば：のったら ぐらぐら → おちる
  if (h.on && h.on.kind === 'crumble' && !h.on.st) { h.on.st = 1; h.on.timer = 0.6; note(220, 0, 0.12, { type: 'square', vol: 0.03, slide: 0.8 }); }
  C.best = Math.max(C.best, (C.ground - h.y) / (C.ground - C.topPlat.y));
  climbCheckHazards();
  // てっぺん の とびら
  if (h.on === C.topPlat && Math.abs(h.x - C.door.x) < 40) climbGoal();
  climbCamera(dt);
}
function climbJumpSfx() { note(520, 0, 0.14, { type: 'sine', vol: 0.06, slide: 1.7 }); }
function climbCamera(dt) {
  const C = RG.climb, s = W / CLIMB.worldW, viewH = H / s;
  const goal = Math.max(0, Math.min(C.worldH - viewH, C.hero.y - viewH * 0.62));
  C.camY = C.camY >= C.worldH ? goal : C.camY + (goal - C.camY) * Math.min(1, dt * 6);
}
function climbCheckHazards() {
  const C = RG.climb, h = C.hero, K = CLIMB;
  const top = h.y - K.heroH * 0.85, l = h.x - K.heroW * 0.4, r = h.x + K.heroW * 0.4;
  const spike = C.spikes.find((sp) => h.on === sp.plat && r > sp.x + 6 && l < sp.x + sp.w - 6);
  const bat = C.bats.find((b) => Math.abs(b.x - h.x) < 30 && b.y + Math.sin(C.t * 3 + b.ph) * 14 > top && b.y + Math.sin(C.t * 3 + b.ph) * 14 < h.y);
  const fire = C.firebars.some((f) => climbFireBalls(f, C.t).some(([x, y]) => x > l - 9 && x < r + 9 && y > top - 9 && y < h.y + 2));
  const wall = C.wall.on && h.y > C.wall.y - 4;
  if (spike || bat || fire || wall) climbHurt(spike ? 'とげ' : bat ? 'こうもり' : fire ? 'ひのぼう' : 'とげ の ゆか');
}
// ひのぼう の ひのたま の ばしょ
function climbFireBalls(f, t) {
  const a = t * f.sp + f.ph, out = [];
  for (let i = 1; i <= f.n; i++) out.push([f.x + Math.cos(a) * i * f.gap, f.y + Math.sin(a) * i * f.gap]);
  return out;
}
function climbHurt(what) {
  const C = RG.climb;
  if (C.hurtT > 0) return;
  C.hurtT = 1.0; C.fails++;
  S.shake = 0.6; S.flash = 0.5; S.flashColor = '255,80,60';
  SFX.bad();
  showToast(`いたっ！ ${what} に あたった……。いちばん した から やりなおし！`, 2.6);
}
function climbRespawn() {
  const C = RG.climb, h = C.hero;
  Object.assign(h, { x: C.start.x, y: C.start.y, vx: 0, vy: 0, on: C.plats[0], climb: null, facing: 1, buffer: 0, airDir: 0 });
  C.wall = climbWall(C.d);
  C.plats.forEach((p) => { if (p.kind === 'crumble') { p.st = 0; p.timer = 0; } });
  heldDirs.length = 0;
}
function climbGoal() {
  const C = RG.climb;
  C.done = true; heldDirs.length = 0;
  SFX.levelUp ? SFX.levelUp() : SFX.star();
  showBanner('てっぺん だ！ ボス の へや へ！', 1.8);
  later(1.6, () => { if (RG.climb !== C) return; RG.climb = null; S.roofBattle = true; encounter({ boss: true }); });
}

// ---------------------------------------------------------------------
//  かく
// ---------------------------------------------------------------------
function climbDraw() {
  const C = RG.climb, K = CLIMB, s = W / K.worldW, viewH = H / s, cam = C.camY >= C.worldH ? Math.max(0, C.worldH - viewH) : C.camY;
  const th = THEMES[S.level] || THEMES[1];
  // かべ
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2a2044'); bg.addColorStop(1, '#3d2f5c');
  ctx.fillStyle = bg; ctx.fillRect(-30, -30, W + 60, H + 60);
  ctx.save(); ctx.scale(s, s); ctx.translate(0, -cam);
  const y0 = Math.floor(cam / 40) * 40;
  ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 2;
  for (let y = y0; y < cam + viewH + 40; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(K.worldW, y); ctx.stroke();
    for (let x = ((y / 40) % 2) * 40; x < K.worldW; x += 80) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 40); ctx.stroke(); }
  }
  // まど（ほし が みえる）
  for (let y = Math.floor(cam / 360) * 360 + 150; y < cam + viewH + 200; y += 360) {
    [150, 750].forEach((x, i) => {
      const wx = x + (Math.floor(y / 360) % 2 ? 0 : (i ? -40 : 40));
      ctx.fillStyle = '#120c26'; ctx.beginPath(); ctx.moveTo(wx - 26, y + 50); ctx.lineTo(wx - 26, y); ctx.arc(wx, y, 26, Math.PI, 0); ctx.lineTo(wx + 26, y + 50); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#6a5a8a'; ctx.lineWidth = 4; ctx.stroke();
      drawStar(wx + 6, y + 8, 5, '#fff3a0');
    });
  }
  // つる
  C.vines.forEach((v) => {
    ctx.strokeStyle = '#3fa84c'; ctx.lineWidth = 6; ctx.beginPath();
    for (let y = v.top; y <= v.bottom; y += 8) { const x = v.x + Math.sin(y * 0.06) * 5; y === v.top ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.fillStyle = '#5fcf6a';
    for (let y = v.top + 10; y < v.bottom; y += 26) { const x = v.x + Math.sin(y * 0.06) * 5, side = (y / 26) % 2 < 1 ? 1 : -1; ctx.beginPath(); ctx.ellipse(x + side * 9, y, 9, 5, side * 0.5, 0, 7); ctx.fill(); }
  });
  // あしば
  C.plats.forEach((p) => {
    if (p.y < cam - 40 || p.y > cam + viewH + 60) return;
    if (p.kind === 'ground') { ctx.fillStyle = '#5a4a7a'; ctx.fillRect(p.x, p.y, p.w, 60); ctx.fillStyle = shade(th.path, -10); ctx.fillRect(p.x, p.y, p.w, 10); return; }
    const wood = p.kind === 'move' || p.kind === 'vmove', crumb = p.kind === 'crumble';
    if (crumb && p.st === 2) { // おちて いる あいだ は うすい わく だけ
      ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,250,243,.25)'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.w, 20); ctx.restore();
      return;
    }
    ctx.save();
    if (crumb && p.st === 1) ctx.translate(Math.sin(C.t * 70) * 2.5, 0);
    ctx.fillStyle = wood ? '#b07a4a' : crumb ? '#c9a27a' : p.kind === 'top' ? '#d9c38a' : '#9a8ab8';
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(p.x, p.y, p.w, 20, 6) : ctx.rect(p.x, p.y, p.w, 20); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,10,50,.35)'; ctx.lineWidth = 2;
    if (crumb) { // ひび
      ctx.beginPath();
      for (let x = p.x + 18; x < p.x + p.w - 10; x += 30) { ctx.moveTo(x, p.y + 2); ctx.lineTo(x + 6, p.y + 9); ctx.lineTo(x - 2, p.y + 13); ctx.lineTo(x + 4, p.y + 19); }
      ctx.stroke();
    } else for (let x = p.x + (wood ? 22 : 36); x < p.x + p.w - 8; x += wood ? 22 : 36) { ctx.beginPath(); ctx.moveTo(x, p.y + 3); ctx.lineTo(x, p.y + 17); ctx.stroke(); }
    if (wood) { ctx.fillStyle = '#ffd84a'; [p.x + 8, p.x + p.w - 8].forEach((x) => { ctx.beginPath(); ctx.arc(x, p.y + 10, 4, 0, 7); ctx.fill(); }); }
    if (p.kind === 'vmove') { ctx.fillStyle = '#fff3a0'; const mx = p.x + p.w / 2; ctx.beginPath(); ctx.moveTo(mx, p.y + 3); ctx.lineTo(mx - 6, p.y + 9); ctx.lineTo(mx + 6, p.y + 9); ctx.closePath(); ctx.moveTo(mx, p.y + 17); ctx.lineTo(mx - 6, p.y + 11); ctx.lineTo(mx + 6, p.y + 11); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  });
  // とげ
  C.spikes.forEach((sp) => {
    ctx.fillStyle = '#d9dde8'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const x = sp.x + i * 11; ctx.beginPath(); ctx.moveTo(x, sp.plat.y); ctx.lineTo(x + 5.5, sp.plat.y - 16); ctx.lineTo(x + 11, sp.plat.y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  });
  // まわる ひのぼう
  C.firebars.forEach((f) => {
    if (f.y < cam - 120 || f.y > cam + viewH + 120) return;
    ctx.fillStyle = '#6a5a8a'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(f.x, f.y, 10, 0, 7); ctx.fill(); ctx.stroke();
    climbFireBalls(f, C.t).forEach(([x, y]) => {
      const gr = ctx.createRadialGradient(x, y, 1, x, y, 13);
      gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.45, '#ffb02e'); gr.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.fill();
    });
  });
  // とびら（ボス の へや）
  const dr = C.door;
  ctx.fillStyle = '#5a1f2c'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(dr.x - 34, dr.y); ctx.lineTo(dr.x - 34, dr.y - 70); ctx.arc(dr.x, dr.y - 70, 34, Math.PI, 0); ctx.lineTo(dr.x + 34, dr.y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(dr.x + 18, dr.y - 46, 4, 0, 7); ctx.fill();
  outlinedText('ボス', dr.x, dr.y - 118, 22, '#ff4f6a');
  // こうもり
  ctx.font = '34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  C.bats.forEach((b) => { const y = b.y + Math.sin(C.t * 3 + b.ph) * 14; if (y < cam - 40 || y > cam + viewH + 40) return; ctx.save(); ctx.translate(b.x, y); ctx.scale(b.dir > 0 ? -1 : 1, 1); ctx.fillText('🦇', 0, 0); ctx.restore(); });
  // ちゅなちゃん
  const h = C.hero, spr = SPR.hero, hh = K.heroH * 1.25;
  if (!(C.hurtT > 0 && Math.floor(C.t * 12) % 2)) {
    ctx.fillStyle = 'rgba(30,10,50,.25)'; if (h.on) { ctx.beginPath(); ctx.ellipse(h.x, h.y, 18, 5, 0, 0, 7); ctx.fill(); }
    ctx.save(); ctx.translate(h.x, h.y + 2); ctx.scale(h.facing < 0 ? -1 : 1, 1);
    if (!h.on && !h.climb) ctx.rotate(h.vy < 0 ? -0.08 : 0.08);
    if (spr) ctx.drawImage(spr.canvas, -hh * spr.w / spr.h / 2, -hh, hh * spr.w / spr.h, hh);
    else { ctx.fillStyle = '#ff6fa8'; ctx.fillRect(-12, -K.heroH, 24, K.heroH); }
    ctx.restore();
  }
  // せまる かべ（うえ に とげ）
  const Wl = C.wall;
  if (Wl.on && Wl.y < cam + viewH + 40) {
    const wy = Wl.y;
    ctx.fillStyle = '#4a1630'; ctx.fillRect(-10, wy, K.worldW + 20, cam + viewH - wy + 60);
    ctx.strokeStyle = 'rgba(255,120,120,.25)'; ctx.lineWidth = 2;
    for (let y = wy + 24; y < cam + viewH + 40; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(K.worldW, y); ctx.stroke(); }
    ctx.fillStyle = '#d9dde8'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (let x = 0; x < K.worldW; x += 30) { ctx.beginPath(); ctx.moveTo(x, wy + 2); ctx.lineTo(x + 15, wy - 22); ctx.lineTo(x + 30, wy + 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  }
  ctx.restore();
  // かべ が ちかい：がめん の した が あかく ひかる
  if (Wl.on) {
    const dist = (Wl.y - h.y) * s;
    if (dist < H * 0.9) {
      const a = Math.max(0, Math.min(1, 1 - dist / (H * 0.9))) * (0.6 + 0.4 * Math.sin(C.t * 8));
      const gr = ctx.createLinearGradient(0, H - 110, 0, H);
      gr.addColorStop(0, 'rgba(255,40,60,0)'); gr.addColorStop(1, `rgba(255,40,60,${0.55 * a})`);
      ctx.fillStyle = gr; ctx.fillRect(0, H - 110, W, 110);
    }
  }
  // たかさ メーター
  const mx = W - 34, my = 80, mh = Math.min(260, H - 200);
  ctx.fillStyle = 'rgba(20,12,40,.7)'; ctx.strokeStyle = 'rgba(255,250,243,.9)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(mx - 9, my - 6, 18, mh + 12, 9) : ctx.rect(mx - 9, my - 6, 18, mh + 12); ctx.fill(); ctx.stroke();
  const k = Math.max(0, Math.min(1, (C.ground - h.y) / (C.ground - C.topPlat.y)));
  ctx.fillStyle = 'rgba(255,216,74,.35)'; ctx.fillRect(mx - 5, my + mh * (1 - C.best), 10, mh * C.best);
  ctx.fillStyle = '#4ee0b0'; ctx.beginPath(); ctx.arc(mx, my + mh * (1 - k), 7, 0, 7); ctx.fill();
  drawStar(mx, my - 18, 9, '#ff4f6a');
}

// ---------------------------------------------------------------------
//  キー・おわり
// ---------------------------------------------------------------------
addEventListener('keydown', (e) => {
  if (!RG.climb || S.mode !== 'walk') return;
  if (e.code === 'Space' && !e.repeat) climbJump(); // ↑ は climbUpdate で（つる の そば では のぼる）
  if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); } // ひっさつ は つかえない
}, true);
const baseLeaveDungeonClimb = leaveDungeon;
leaveDungeon = function (kind) { RG.climb = null; S.roofBattle = false; baseLeaveDungeonClimb(kind); };

// ---------------------------------------------------------------------
//  ボス せん の けしき：おしろ を のぼった ときは おくじょう
// ---------------------------------------------------------------------
const baseDrawWorldClimb = drawWorld;
drawWorld = function () {
  if (!S.roofBattle) { baseDrawWorldClimb(); return; }
  if (!S.monster && S.mode === 'walk') { S.roofBattle = false; baseDrawWorldClimb(); return; }
  S.castleX = null; // おしろ の まえ の え は ださない
  drawRoofWorld();
  const k = S.miracleBg || 0; // ミラクル・フィナーレ（stella_spells.js と おなじ）
  if (k > 0) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    ['#ffb3b3', '#ffd9a8', '#fff3a8', '#c8f5c0', '#b8dcff', '#d8c4ff', '#ffc4e8'].forEach((c, i) => g.addColorStop(i / 6, c));
    ctx.save(); ctx.globalAlpha = 0.85 * k; ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60); ctx.restore();
  }
};
function drawRoofWorld() {
  const gy = GROUND(), t = S.t || 0;
  // よぞら（たかい ところ なので くも が した に みえる）
  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, '#120c33'); sky.addColorStop(1, '#5b3f9a');
  ctx.fillStyle = sky; ctx.fillRect(-30, -30, W + 60, H + 60);
  for (let i = 0; i < 60; i++) {
    ctx.globalAlpha = 0.35 + 0.55 * Math.abs(Math.sin(t * 1.3 + i));
    drawStar(hash(i + 300) * W, hash(i + 77) * gy * 0.75, 1.5 + hash(i + 5) * 3, '#fff7c2');
  }
  ctx.globalAlpha = 1;
  const mg = ctx.createRadialGradient(W * 0.8, gy * 0.22, 10, W * 0.8, gy * 0.22, 70);
  mg.addColorStop(0, '#fffbe0'); mg.addColorStop(0.55, '#ffe9a0'); mg.addColorStop(1, 'rgba(255,233,160,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(W * 0.8, gy * 0.22, 70, 0, 7); ctx.fill();
  // した に ながれる くも
  ctx.fillStyle = 'rgba(220,210,255,.35)';
  for (let i = 0; i < 9; i++) {
    const x = ((hash(i + 40) * W * 1.4 + t * (12 + i * 2)) % (W + 300)) - 150, y = gy - 60 - hash(i + 9) * 60, s = 0.8 + hash(i + 2) * 0.8;
    ctx.beginPath(); ctx.arc(x, y, 30 * s, 0, 7); ctx.arc(x + 34 * s, y - 10 * s, 36 * s, 0, 7); ctx.arc(x + 70 * s, y, 28 * s, 0, 7); ctx.fill();
  }
  // うしろ の とう（ボス の とう）
  const wall = '#6a5a8a', dark = '#4a3c66', roof = '#5a1030';
  ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = INK;
  [[W * 0.12, 210, 70], [W * 0.88, 230, 76], [W * 0.5, 300, 96]].forEach(([x, h, w], i) => {
    ctx.fillStyle = i === 2 ? dark : wall;
    ctx.fillRect(x - w / 2, gy - 60 - h, w, h + 60); ctx.strokeRect(x - w / 2, gy - 60 - h, w, h + 60);
    ctx.fillStyle = roof;
    ctx.beginPath(); ctx.moveTo(x - w / 2 - 12, gy - 60 - h); ctx.lineTo(x, gy - 60 - h - w * 1.1); ctx.lineTo(x + w / 2 + 12, gy - 60 - h); ctx.closePath(); ctx.fill(); ctx.stroke();
    const fy = gy - 60 - h - w * 1.1;
    ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x, fy - 30); ctx.stroke();
    ctx.fillStyle = '#7a1fd0'; const wave = Math.sin(t * 6 + i) * 4;
    ctx.beginPath(); ctx.moveTo(x, fy - 30); ctx.lineTo(x + 28, fy - 22 + wave); ctx.lineTo(x, fy - 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.ellipse(x, gy - 60 - h + 50, 10, 15, 0, 0, 7); ctx.fill();
  });
  // おくじょう の さく（ぎざぎざ の かべ）
  const py = gy - 70;
  ctx.fillStyle = wall; ctx.fillRect(-30, py, W + 60, 70); ctx.strokeRect(-30, py, W + 60, 70);
  for (let x = -20; x < W + 30; x += 64) { ctx.fillRect(x, py - 30, 36, 32); ctx.strokeRect(x, py - 30, 36, 32); }
  ctx.strokeStyle = 'rgba(30,10,50,.3)'; ctx.lineWidth = 2;
  for (let y = py + 22; y < gy; y += 22) { ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(W + 30, y); ctx.stroke(); }
  // たいまつ
  [W * 0.3, W * 0.7].forEach((x, i) => {
    ctx.fillStyle = '#3a2a4d'; ctx.fillRect(x - 4, py - 4, 8, 34);
    const fl = 1 + Math.sin(t * 14 + i * 2) * 0.15;
    const gr = ctx.createRadialGradient(x, py - 12, 2, x, py - 12, 26 * fl);
    gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.4, '#ffb02e'); gr.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, py - 12, 26 * fl, 0, 7); ctx.fill();
  });
  // いしだたみ の ゆか
  ctx.fillStyle = '#5c4a90'; ctx.fillRect(-30, gy - 8, W + 60, H - gy + 40);
  ctx.fillStyle = '#7b68ad'; ctx.fillRect(-30, gy + 14, W + 60, 34);
  ctx.strokeStyle = 'rgba(30,10,50,.25)'; ctx.lineWidth = 2;
  for (let x = -30; x < W + 40; x += 56) { ctx.beginPath(); ctx.moveTo(x, gy + 14); ctx.lineTo(x, gy + 48); ctx.stroke(); }
  // ボス せん は すこし くらく
  if (S.monster && S.monster.boss && S.monster.state !== 'defeated') { ctx.fillStyle = 'rgba(40,10,60,.22)'; ctx.fillRect(-30, -30, W + 60, H + 60); }
}

// テスト よう
window.climbTest = {
  state() { const C = RG.climb; return C && { x: C.hero.x, y: C.hero.y, on: !!C.hero.on, onKind: C.hero.on && C.hero.on.kind, climb: !!C.hero.climb, done: C.done, fails: C.fails, rows: C.plats.length, best: C.best, hurt: C.hurtT > 0, wall: C.wall.on ? C.wall.y : null, vx: C.hero.vx }; },
  toTop() { const C = RG.climb; Object.assign(C.hero, { x: C.door.x - 60, y: C.topPlat.y, on: C.topPlat, vy: 0 }); },
  hurt() { climbHurt('とげ'); },
  start: climbStart,
  enable() { CLIMB_ON = true; },
  build: climbBuild,
  jump: climbJump,
  wallNear() { const C = RG.climb; C.wall.on = true; C.wall.y = C.hero.y + 2; },
};
