'use strict';
// =====================================================================
//  ステラクエスト：おしろ のぼり（よこ から みる アスレチック）
//  ・ふつう の ダンジョン の さいご の かい で ボス の おしろ に つくと はじまる
//    （むげん の とう・タイムアタック では ない）
//  ・←→ で あるく、ジャンプ ボタン（スペース・↑）で ジャンプ。つる は ↑↓ で のぼる・おりる
//  ・あしば：ふつう・うごく あしば・つる。とげ と こうもり に さわる と いちばん した から やりなおし（ダメージ なし）
//  ・てっぺん の とびら に つくと ボス の たたかい
//  ・なんいど が たかい ほど たかく、うごく あしば・とげ・こうもり が ふえる
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
  later(1.2, () => showToast('←→ で あるく・「ジャンプ」で とぶ・つる は ↑↓。とげ と こうもり に きをつけて！', 4));
  SFX.star();
  return true;
}
function climbBuild(d) {
  const C = CLIMB, n = C.rows(d), worldH = n * C.rowGap + 260, ground = worldH - 40;
  const plats = [{ x: 0, w: C.worldW, y: ground, kind: 'ground' }], vines = [], spikes = [], bats = [];
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
      vines.push({ x: vx, top: rowY(r + 2) - 80, bottom: rowY(r) - 20 }); // うえ の あしば より すこし うえ まで（よこ に とびうつれる）
      const w2 = Math.max(96, rnd(140, 190) - d * 8);
      const nx2 = Math.max(w2 / 2 + 20, Math.min(C.worldW - w2 / 2 - 20, vx + (vx > C.worldW / 2 ? -1 : 1) * (w2 / 2 + 30)));
      plats.push({ x: nx2 - w2 / 2, w: w2, y: rowY(r + 2), kind: 'plain' });
      cx = nx2; r += 3;
      continue;
    }
    const moving = !top && r > 2 && Math.random() < 0.16 + d * 0.04;
    const p = { x: nx - w / 2, w, y: rowY(r), kind: top ? 'top' : moving ? 'move' : 'plain' };
    if (moving) { p.bx = p.x; p.range = rnd(70, 130); p.sp = 0.9 + Math.random() * 0.5 + d * 0.06; p.ph = Math.random() * 6; }
    plats.push(p);
    if (!top && !moving && r > 2 && w >= 150 && Math.random() < 0.14 + d * 0.035) spikes.push({ plat: p, x: p.x + (Math.random() < 0.5 ? 0 : w - 44), w: 44 });
    if (!top && d >= 2 && r > 3 && Math.random() < 0.08 + d * 0.03) bats.push({ y: rowY(r) - C.rowGap * 0.55, x: rnd(60, C.worldW - 60), dir: pick([-1, 1]), sp: rnd(90, 140) + d * 12, ph: Math.random() * 6 });
    cx = nx; r++;
  }
  const topPlat = plats[plats.length - 1];
  const start = { x: 120, y: ground };
  return { d, plats, vines, spikes, bats, worldH, ground, topPlat, door: { x: topPlat.x + topPlat.w / 2, y: topPlat.y }, start,
    hero: { x: start.x, y: start.y, vx: 0, vy: 0, on: plats[0], climb: null, facing: 1, coyote: 0, buffer: 0 }, camY: worldH, t: 0, best: 0, fails: 0, done: false, hurtT: 0 };
}

// ---------------------------------------------------------------------
//  うごかす
// ---------------------------------------------------------------------
const climbHeld = (d) => heldDirs.includes(d);
function climbJump() {
  const C = RG.climb;
  if (!C || C.done) return;
  C.hero.buffer = CLIMB.buffer;
}
function climbUpdate(dt) {
  const C = RG.climb, K = CLIMB, h = C.hero;
  if (!C) return;
  dt = Math.min(dt, 1 / 30);
  C.t += dt;
  if ((typeof ITEMUI !== 'undefined' && ITEMUI.open) || C.done) return;
  // うごく あしば・こうもり
  C.plats.forEach((p) => { if (p.kind === 'move') { const ox = p.x; p.x = p.bx + Math.sin(C.t * p.sp + p.ph) * p.range; p.dx = p.x - ox; } });
  C.bats.forEach((b) => { b.x += b.dir * b.sp * dt; if (b.x < 40 || b.x > K.worldW - 40) { b.dir *= -1; b.x = Math.max(40, Math.min(K.worldW - 40, b.x)); } });
  if (C.hurtT > 0) { C.hurtT -= dt; if (C.hurtT <= 0) climbRespawn(); return; }
  const L = climbHeld('left'), R = climbHeld('right'), U = climbHeld('up'), D = climbHeld('down');
  if (h.buffer > 0) h.buffer -= dt;
  // つる
  const vine = C.vines.find((v) => Math.abs(h.x - v.x) < 24 && h.y - 10 <= v.bottom + 30 && h.y - K.heroH * 0.5 >= v.top - 10);
  if (!h.climb && vine && (U || D) && !(D && h.on)) { h.climb = vine; h.vx = 0; h.vy = 0; h.on = null; }
  if (h.climb) {
    const v = h.climb;
    h.x += (v.x - h.x) * Math.min(1, dt * 14);
    h.vy = U ? -K.climbV : D ? K.climbV : 0;
    h.y += h.vy * dt;
    if (h.y - K.heroH * 0.5 < v.top) h.y = v.top + K.heroH * 0.5;
    if (h.buffer > 0) { h.buffer = 0; h.climb = null; h.vy = -K.jumpV * 0.9; h.vx = (L ? -1 : R ? 1 : h.facing) * K.speed * 0.6; climbJumpSfx(); }
    else if (L || R) { h.climb = null; h.facing = L ? -1 : 1; }
    else if (h.y > v.bottom + 30) h.climb = null;
    if (h.climb) { climbCheckHazards(); climbCamera(dt); return; }
  }
  // よこ
  h.vx = L ? -K.speed : R ? K.speed : 0;
  if (L) h.facing = -1; if (R) h.facing = 1;
  if (h.on && h.on.kind === 'move' && h.on.dx) h.x += h.on.dx;
  h.x = Math.max(K.heroW / 2, Math.min(K.worldW - K.heroW / 2, h.x + h.vx * dt));
  // ジャンプ（↑ でも とべる。つる の そば では のぼる）
  if (U && !vine && h.on) h.buffer = Math.max(h.buffer, 0.01);
  if (h.on) h.coyote = K.coyote; else h.coyote -= dt;
  if (h.buffer > 0 && h.coyote > 0) { h.buffer = 0; h.coyote = 0; h.vy = -K.jumpV; h.on = null; climbJumpSfx(); }
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
      const land = C.plats.find((p) => prevY <= p.y + 2 && h.y >= p.y && h.x >= p.x - K.heroW * 0.4 && h.x <= p.x + p.w + K.heroW * 0.4);
      if (land) { h.y = land.y; h.vy = 0; h.on = land; note(260, 0, 0.05, { type: 'triangle', vol: 0.04 }); }
    }
  }
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
  if (spike || bat) climbHurt(spike ? 'とげ' : 'こうもり');
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
  Object.assign(h, { x: C.start.x, y: C.start.y, vx: 0, vy: 0, on: C.plats[0], climb: null, facing: 1, buffer: 0 });
  heldDirs.length = 0;
}
function climbGoal() {
  const C = RG.climb;
  C.done = true; heldDirs.length = 0;
  SFX.levelUp ? SFX.levelUp() : SFX.star();
  showBanner('てっぺん だ！ ボス の へや へ！', 1.8);
  later(1.6, () => { if (RG.climb !== C) return; RG.climb = null; encounter({ boss: true }); });
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
    const wood = p.kind === 'move';
    ctx.fillStyle = wood ? '#b07a4a' : p.kind === 'top' ? '#d9c38a' : '#9a8ab8';
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(p.x, p.y, p.w, 20, 6) : ctx.rect(p.x, p.y, p.w, 20); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,10,50,.35)'; ctx.lineWidth = 2;
    for (let x = p.x + (wood ? 22 : 36); x < p.x + p.w - 8; x += wood ? 22 : 36) { ctx.beginPath(); ctx.moveTo(x, p.y + 3); ctx.lineTo(x, p.y + 17); ctx.stroke(); }
    if (wood) { ctx.fillStyle = '#ffd84a'; [p.x + 8, p.x + p.w - 8].forEach((x) => { ctx.beginPath(); ctx.arc(x, p.y + 10, 4, 0, 7); ctx.fill(); }); }
  });
  // とげ
  C.spikes.forEach((sp) => {
    ctx.fillStyle = '#d9dde8'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const x = sp.x + i * 11; ctx.beginPath(); ctx.moveTo(x, sp.plat.y); ctx.lineTo(x + 5.5, sp.plat.y - 16); ctx.lineTo(x + 11, sp.plat.y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
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
  ctx.restore();
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
leaveDungeon = function (kind) { RG.climb = null; baseLeaveDungeonClimb(kind); };

// テスト よう
window.climbTest = {
  state() { const C = RG.climb; return C && { x: C.hero.x, y: C.hero.y, on: !!C.hero.on, climb: !!C.hero.climb, done: C.done, fails: C.fails, rows: C.plats.length, best: C.best, hurt: C.hurtT > 0 }; },
  toTop() { const C = RG.climb; Object.assign(C.hero, { x: C.door.x - 60, y: C.topPlat.y, on: C.topPlat, vy: 0 }); },
  hurt() { climbHurt('とげ'); },
  start: climbStart,
  enable() { CLIMB_ON = true; },
  build: climbBuild,
};
