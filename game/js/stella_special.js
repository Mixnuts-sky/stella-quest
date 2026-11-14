'use strict';
// =====================================================================
//  ステラクエスト：ひっさつ わざ（ふしぎな ダンジョン）＝ まほうじん
//  ・あるくと ゲージ が たまる。SP.stage ほ ごと に 1だん、さいだい 3だん
//  ・ひっさつ ボタン（Enter）→ さいしょ に おおきな ○（まほうじん）→ なか に かたち →「はつどう」ボタン（Enter）で きまる
//      1だん：○ だけ ＝ HP ぜんかいふく ／ ○＋△ ＝ ほのお が いちばん ちかい てき を 1ぴき たおす
//      2だん：○＋☆ ＝ がめん に みえる てき を ぜんぶ たおす ／ ○＋× ＝ ちがう へや へ ワープ
//      3だん：○＋ちいさい○＋△3つ（め の かたち は かいても よい）＝ にゃんこ が かけめぐって ちず と アイテム が ぜんぶ わかる
//             ○＋うずまき（□ を いっしょ に かいても よい）＝ この かい の てき ぜんぶ に ほのお
//  ・つかうと その わざ の だん の ぶん ゲージ が へる
//  ・死神 には きかない。しまじろう は よける。たおした てき の アルカ は はんぶん
//  stella_rogue.js の あと に よむ。しよう：docs/GAME_SPEC.md 14.7
// =====================================================================

const SP = { stage: 80 }; // 1だん に いる ほすう
RG_CONF.gaugeSteps = SP.stage * 3;
const SP_MOVES = {
  heal:  { lv: 1, name: 'きらきら ヒール',       inner: null,     label: 'まる だけ',          desc: 'HP を ぜんぶ かいふく',               color: '#4ecbff', dur: 1.4 },
  fire:  { lv: 1, name: 'ほのお の まほう',       inner: 'tri',    label: 'まる ＋ さんかく',    desc: 'いちばん ちかい てき を 1ぴき たおす', color: '#ff7a3c', dur: 1.7 },
  star:  { lv: 2, name: 'スター シャワー',       inner: 'star',   label: 'まる ＋ ほし',        desc: 'がめん に みえる てき を ぜんぶ',     color: '#ffd84a', dur: 1.9 },
  warp:  { lv: 2, name: 'ワープ',                inner: 'cross',  label: 'まる ＋ ばつ',        desc: 'ちがう へや へ ワープ',               color: '#b98cff', dur: 1.7 },
  cat:   { lv: 3, name: 'にゃんこ だいこうしん', inner: 'cat',    label: 'にゃんこ の もよう', desc: 'ちいさい まる と さんかく 3つ：ちず と アイテム が ぜんぶ わかる',   color: '#ff9ad5', dur: 3.0 },
  blaze: { lv: 3, name: 'だいかえん',            inner: 'swirl',  label: 'まる ＋ うずまき',    desc: 'この かい の てき を ぜんぶ',         color: '#ff4f3c', dur: 2.3 },
};
const specialGauge = () => (rgActive() ? Math.min(1, (RG.gauge || 0) / RG_CONF.gaugeSteps) : 0);
const specialLevel = () => (rgActive() ? Math.min(3, Math.floor((RG.gauge || 0) / SP.stage)) : 0);
const SPECIAL = { strokes: [], cur: null, ring: null, timer: 0, fx: null, raf: 0 };

// ---------------------------------------------------------------------
//  まほうじん の え（パネル と ダンジョン の あしもと）
// ---------------------------------------------------------------------
function spInner(g, kind, r) {
  g.beginPath();
  const poly = (n, rot, rr) => { for (let i = 0; i < n; i++) { const a = rot + i * 2 * Math.PI / n, x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
  if (kind === 'tri') poly(3, -Math.PI / 2, r * 0.8);
  else if (kind === 'hexa') { poly(3, -Math.PI / 2, r * 0.8); poly(3, Math.PI / 2, r * 0.8); }
  else if (kind === 'square') poly(4, -Math.PI / 4, r * 0.75);
  else if (kind === 'star') { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5, x = Math.cos(a) * r * 0.8, y = Math.sin(a) * r * 0.8; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); }
  else if (kind === 'cat') { // ちいさい まる・め・さんかく 3つ
    g.arc(0, 0, r * 0.36, 0, 7); g.stroke(); g.beginPath();
    g.moveTo(-r * 0.78, -r * 0.05); g.quadraticCurveTo(0, -r * 0.62, r * 0.78, -r * 0.05); g.quadraticCurveTo(0, r * 0.52, -r * 0.78, -r * 0.05); g.stroke(); g.beginPath();
    [[-0.5, -0.62, 1], [0.5, -0.62, 1], [0, 0.72, -1]].forEach(([x, y, d]) => { g.moveTo(r * (x - 0.16), r * (y - d * 0.1)); g.lineTo(r * (x + 0.16), r * (y - d * 0.1)); g.lineTo(r * x, r * (y + d * 0.2)); g.closePath(); });
  }
  else if (kind === 'swirl') { // しかく と うずまき
    poly(4, -Math.PI / 4, r * 0.75); g.stroke(); g.beginPath();
    for (let i = 0; i <= 60; i++) { const t = i / 60, a = -Math.PI / 2 + t * Math.PI * 4.5, rr = r * (0.48 - 0.42 * t), x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  }
  else if (kind === 'cross') { const d = r * 0.55; g.moveTo(-d, -d); g.lineTo(d, d); g.moveTo(d, -d); g.lineTo(-d, d); }
  g.stroke();
}
function drawMagicCircle(g, x, y, r, rot, kind, color, alpha = 1, flat = 1) {
  if (alpha <= 0) return;
  g.save(); g.translate(x, y); g.scale(1, flat); g.globalAlpha = alpha;
  g.strokeStyle = color; g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 16; g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = Math.max(2.5, r * 0.06); g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
  g.lineWidth = Math.max(1.5, r * 0.025); g.beginPath(); g.arc(0, 0, r * 0.84, 0, 7); g.stroke();
  g.rotate(rot);
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.arc(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, r * (i % 3 ? 0.022 : 0.04) + 1, 0, 7); g.fill(); }
  g.lineWidth = Math.max(2.5, r * 0.05);
  if (kind) spInner(g, kind, r * 0.84);
  g.restore();
}
const spIcon = (kind, color) => {
  const inner = { tri: '<path d="M20 9 L29.5 25.5 L10.5 25.5 Z"/>', hexa: '<path d="M20 8 L30 25 L10 25 Z M20 32 L10 15 L30 15 Z"/>', square: '<rect x="12" y="12" width="16" height="16"/>',
    star: '<path d="M20 8 L27 30 L9 16 L31 16 L13 30 Z"/>', cross: '<path d="M13 13 L27 27 M27 13 L13 27"/>', cat: '<circle cx="20" cy="20" r="5.5"/><path d="M8 20 Q20 11 32 20 Q20 28 8 20 M12 12 L17 12 L14.5 16 Z M23 12 L28 12 L25.5 16 Z M17.5 28 L22.5 28 L20 32 Z"/>', swirl: '<rect x="12" y="12" width="16" height="16"/><path d="M20 12.5 C26 12.5 27 21 22.5 23.5 C18.5 25.5 15.5 21 18 18.5 C19.5 17 21.5 18.5 20.5 20"/>' }[kind] || '';
  return `<svg viewBox="0 0 40 40"><g fill="none" stroke="${color}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><circle cx="20" cy="20" r="16"/>${inner}</g></svg>`;
};

// ---------------------------------------------------------------------
//  パネル
// ---------------------------------------------------------------------
(function buildSpecialPanel() {
  const el = document.createElement('div');
  el.id = 'spPanel'; el.className = 'overlay st-panel sp-panel'; el.hidden = true;
  el.innerHTML = `<div class="st-card sp-card">
    <div class="shop-head"><span class="shop-title">✨ まほうじん</span><span class="shop-arca" id="spLv"></span></div>
    <div class="sp-body">
      <canvas id="spCanvas" class="sp-draw" width="360" height="360"></canvas>
      <div class="sp-list" id="spList"></div>
    </div>
    <div class="sp-msg" id="spMsg"></div>
    <div class="shop-foot sp-foot"><button type="button" class="buy sp-go" id="spGo">はつどう！（Enter）</button><button type="button" class="redo" id="spRedo">かきなおす</button><button type="button" class="close">やめる（Esc）</button></div>
  </div>`;
  $('game').appendChild(el);
  el.querySelector('.close').addEventListener('click', closeSpecial);
  $('spGo').addEventListener('click', spJudge);
  $('spRedo').addEventListener('click', () => { SPECIAL.ring = null; SPECIAL.strokes = []; spMsg('まず おおきな まる（まほうじん）を かいてね'); spSyncButtons(); });
  const cv = el.querySelector('#spCanvas');
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    SPECIAL.cur = [pos(e)];
    try { cv.setPointerCapture(e.pointerId); } catch { /* なし */ }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!SPECIAL.cur) return;
    SPECIAL.cur.push(pos(e));
    if (SPECIAL.cur.length % 6 === 0) note(900 + SPECIAL.cur.length * 3, 0, 0.04, { type: 'sine', vol: 0.03 });
  });
  const end = () => {
    const s = SPECIAL.cur;
    if (!s) return;
    SPECIAL.cur = null;
    if (!SPECIAL.ring) { // さいしょ は まる
      const f = spFeat(s);
      if (!spRingOk(f)) { spMsg('まず おおきな まる（まほうじん）を かいてね', true); SFX.bad(); return; }
      if (f.r < cv.width * 0.18) { spMsg('もっと おおきな まる に してね', true); SFX.bad(); return; }
      SPECIAL.ring = { x: f.cx, y: f.cy, r: f.r };
      [659, 880, 1175].forEach((fq, i) => note(fq, i * 0.07, 0.2, { type: 'sine', vol: 0.07 }));
      spMsg('まほうじん が できた！ なか に かたち を かいて「はつどう」（なにも かかない と かいふく）');
      spSyncButtons();
      return;
    }
    SPECIAL.strokes.push(s);
    spMsg('かけたら「はつどう！」を おしてね');
  };
  ['pointerup', 'pointercancel'].forEach((ev) => cv.addEventListener(ev, end));
})();

function spMsg(t, bad = false) { $('spMsg').textContent = t; $('spMsg').className = bad ? 'sp-msg bad' : 'sp-msg'; }
function spSyncButtons() {
  $('spGo').disabled = !SPECIAL.ring;
  $('spRedo').disabled = !SPECIAL.ring;
}
function spRenderList() {
  const lv = specialLevel();
  $('spLv').innerHTML = `ゲージ <b class="sp-stars">${'★'.repeat(lv)}${'☆'.repeat(3 - lv)}</b>`;
  let html = '';
  for (let n = 1; n <= 3; n++) {
    const ms = Object.values(SP_MOVES).filter((m) => m.lv === n);
    html += `<div class="sp-row${lv < n ? ' lock' : ''}"><span class="sp-lvtag">${'★'.repeat(n)}</span>${ms.map((m) => `<div class="sp-ex">${spIcon(m.inner, m.color)}<b>${m.label}</b><small>${m.desc}</small></div>`).join('')}</div>`;
  }
  $('spList').innerHTML = html;
}
// かいて いる あいだ の え（まほうじん は ゆっくり まわる）
function spDrawPanel() {
  if ($('spPanel').hidden) return;
  const cv = $('spCanvas'), g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  const R = SPECIAL.ring;
  if (R) drawMagicCircle(g, R.x, R.y, R.r, performance.now() / 2400, null, '#ffd84a');
  g.save();
  g.strokeStyle = '#fff3a0'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = '#ffd84a'; g.shadowBlur = 14;
  SPECIAL.strokes.concat(SPECIAL.cur ? [SPECIAL.cur] : []).forEach((s) => { g.beginPath(); s.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); });
  g.restore();
  SPECIAL.raf = requestAnimationFrame(spDrawPanel);
}

function openSpecial() {
  if (!rgActive() || S.mode !== 'walk' || S.monster || RG.special || S.moveT < 1 || RG.climb) return;
  if (specialLevel() < 1) {
    const rest = SP.stage - (RG.gauge || 0);
    showToast(`ひっさつ ゲージ が 1だん たまったら つかえるよ（あと ${rest} ほ）`, 2);
    return;
  }
  RG.special = true; heldDirs.length = 0;
  SPECIAL.strokes = []; SPECIAL.cur = null; SPECIAL.ring = null;
  spMsg('まず おおきな まる（まほうじん）を かいてね');
  spRenderList(); spSyncButtons();
  $('spPanel').hidden = false;
  cancelAnimationFrame(SPECIAL.raf); spDrawPanel();
  [784, 988, 1175].forEach((f, i) => note(f, i * 0.08, 0.2, { type: 'sine', vol: 0.07 }));
}
function closeSpecial() { RG.special = false; $('spPanel').hidden = true; cancelAnimationFrame(SPECIAL.raf); }

// 「はつどう」→ なか の かたち で わざ を きめる（なにも かいて いない ＝ かいふく）
function spJudge() {
  if (!SPECIAL.ring) { spMsg('まず おおきな まる（まほうじん）を かいてね', true); SFX.bad(); return; }
  const move = SPECIAL.strokes.length ? spClassifyInner(SPECIAL.strokes) : 'heal';
  if (!move) { SPECIAL.strokes = []; spMsg('う〜ん、わからない かたち……なか を もういちど かいてね', true); SFX.bad(); return; }
  spTryCast(move);
}
function spTryCast(move) {
  const mv = SP_MOVES[move];
  if (specialLevel() < mv.lv) { SPECIAL.strokes = []; spMsg(`「${mv.name}」は ゲージ が ${'★'.repeat(mv.lv)} いるよ`, true); SFX.bad(); return; }
  castSpecial(move);
}

// ---------------------------------------------------------------------
//  かたち を みわける
// ---------------------------------------------------------------------
const spSegX = (a, b, c, d) => {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
function spFeat(raw) {
  if (!raw || raw.length < 5) return null;
  let len = 0;
  for (let i = 1; i < raw.length; i++) len += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]);
  if (len < 50) return null;
  const N = 48, seg = len / (N - 1), pts = [raw[0]];
  let acc = 0, prev = raw[0];
  for (let i = 1; i < raw.length && pts.length < N; i++) {
    const cur = raw[i]; let d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    while (acc + d >= seg && pts.length < N) {
      const k = (seg - acc) / d, np = [prev[0] + (cur[0] - prev[0]) * k, prev[1] + (cur[1] - prev[1]) * k];
      pts.push(np); prev = np; d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]); acc = 0;
    }
    acc += d; prev = cur;
  }
  while (pts.length < N) pts.push(raw[raw.length - 1]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys), w = Math.max(...xs) - minX, h = Math.max(...ys) - minY, diag = Math.hypot(w, h) || 1;
  const ends = Math.hypot(raw[0][0] - raw[raw.length - 1][0], raw[0][1] - raw[raw.length - 1][1]);
  const closed = ends / diag < 0.35;
  // かど
  const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const turn = [];
  for (let i = 3; i < N - 3; i++) {
    let t = ang(pts[i], pts[i + 3]) - ang(pts[i - 3], pts[i]);
    while (t > Math.PI) t -= Math.PI * 2; while (t < -Math.PI) t += Math.PI * 2;
    turn.push(Math.abs(t));
  }
  let corners = 0;
  for (let i = 0; i < turn.length; i++) if (turn[i] > 1.3 && turn[i] >= (turn[i - 1] || 0) && turn[i] >= (turn[i + 1] || 0)) { corners++; i += 2; }
  // まわった かず（うずまき は 2かい くらい まわる）
  let wind = 0;
  for (let i = 1; i < N - 1; i++) { let t = ang(pts[i], pts[i + 1]) - ang(pts[i - 1], pts[i]); while (t > Math.PI) t -= Math.PI * 2; while (t < -Math.PI) t += Math.PI * 2; wind += t; }
  // まるさ
  const cx = minX + w / 2, cy = minY + h / 2;
  const rs = pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy)), r = rs.reduce((a, b) => a + b) / N;
  const dev = Math.sqrt(rs.reduce((a, q) => a + (q - r) ** 2, 0) / N) / (r || 1);
  // じぶん と まじわる かず（ほし は 5）
  let cross = 0;
  for (let i = 0; i < N - 2; i++) for (let j = i + 2; j < N - 1; j++) { if (i === 0 && j === N - 2) continue; if (spSegX(pts[i], pts[i + 1], pts[j], pts[j + 1])) cross++; }
  // とつほう の めんせき ÷ かこむ しかく（さんかく 0.5・まる 0.79・しかく 1）
  const sp = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), xo = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of sp) { while (lo.length >= 2 && xo(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of sp.slice().reverse()) { while (up.length >= 2 && xo(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const hull = lo.slice(0, -1).concat(up.slice(0, -1));
  let area = 0;
  for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; area += a[0] * b[1] - b[0] * a[1]; }
  return { closed, corners, dev, cross, fill: Math.abs(area) / 2 / ((w * h) || 1), wind: Math.abs(wind), straight: ends / len, cx, cy, r, w, h, a: raw[0], b: raw[raw.length - 1] };
}
// さいしょ の おおきな まる（かさねて かいて も よい）
const spRingOk = (f) => !!f && (spClassify(f) === 'circle' || (f.dev < 0.3 && Math.min(f.w, f.h) / Math.max(f.w, f.h) > 0.5 && (f.closed || f.wind > Math.PI * 1.6)));
function spClassify(f) {
  if (!f) return null;
  if (f.straight > 0.85 && !f.closed) return 'line';
  if (f.cross >= 3 || (f.cross >= 2 && f.closed && f.corners >= 4)) return 'star';
  if (f.cross <= 2 && f.wind > Math.PI * (f.closed ? 3.0 : 2.2) && f.dev > 0.18) return 'swirl'; // うずまき（さいご が もどって きて も よい）
  if (!f.closed) return null;
  if (f.fill < 0.66 && f.corners >= 2) return 'tri';
  if (f.fill > 0.86 || (f.corners >= 2 && f.fill > 0.7)) return 'square';
  if (f.dev < 0.3 && Math.min(f.w, f.h) / Math.max(f.w, f.h) > 0.5) return 'circle';
  if (f.corners >= 3) return f.fill < 0.72 ? 'tri' : 'square';
  return null;
}
function spClassifyInner(strokes) {
  const fs = strokes.map(spFeat), ks = fs.map(spClassify);
  const cnt = (k) => ks.filter((x) => x === k).length, poly = cnt('tri') + cnt('square');
  // にゃんこ：ちいさい まる ＋ さんかく 3つ（め は なんでも）。すこし くずれて いても よい
  if (cnt('tri') >= 3 || (ks.length >= 3 && cnt('circle') >= 1 && cnt('tri') >= 2) || (ks.length >= 4 && poly >= 2)) return 'cat';
  if (ks.includes('swirl') && ks.length <= 3) return 'blaze'; // うずまき（□ も いっしょ で よい）
  if (ks.length === 1) return { tri: 'fire', star: 'star' }[ks[0]] || null;
  if (ks.length === 2) {
    const lineish = (f) => !!f && !f.closed && f.straight > 0.7;
    if (lineish(fs[0]) && lineish(fs[1]) && spSegX(fs[0].a, fs[0].b, fs[1].a, fs[1].b)) return 'warp';
  }
  return null;
}

// ---------------------------------------------------------------------
//  わざ を だす
// ---------------------------------------------------------------------
const spScreen = (o) => ({ x: o.x * 48 + 24 - RG.cam.x, y: o.y * 48 + 26 - RG.cam.y });
const spOnScreen = (e) => { const p = spScreen(e); return rgVisible(e.x, e.y) && p.x > -24 && p.x < W + 24 && p.y > -24 && p.y < H + 48; };
function castSpecial(move) {
  const M = S.maze, mv = SP_MOVES[move];
  if (!mv) return;
  closeSpecial();
  RG.gauge = Math.max(0, (RG.gauge || 0) - mv.lv * SP.stage);
  showBanner(`✨ ${mv.name}！ ✨`, 1.8);
  const F = SPECIAL.fx = { move, t: 0, dur: mv.dur, shots: [], cats: [] };
  RG.lock = mv.dur;
  [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.06, 0.22, { type: 'triangle', vol: 0.07 }));
  const mobs = M.enemies.slice();
  if (move === 'heal') {
    later(0.6, () => { S.flash = 0.5; S.flashColor = '200,240,255'; S.hp = stMaxHp(); ST.data.hp = S.hp; healEffect(); renderHud(); stRenderHud(); showToast('HP が ぜんぶ かいふく した！', 2.2); stSave(); });
  } else if (move === 'fire') {
    const t = mobs.filter((e) => e.kind !== 'shima').sort((a, b) => (Math.abs(a.x - S.pos.x) + Math.abs(a.y - S.pos.y)) - (Math.abs(b.x - S.pos.x) + Math.abs(b.y - S.pos.y)))[0];
    if (t) F.shots.push({ e: t, x: t.x, y: t.y, t0: 0.55, fly: 0.55, kind: 'fire' });
    later(1.15, () => spDefeat(t ? [t] : [], 'この かい に てき は いなかった……'));
  } else if (move === 'star') {
    const ts = mobs.filter(spOnScreen);
    ts.forEach((e, i) => F.shots.push({ e, x: e.x, y: e.y, t0: 0.5 + i * 0.06, fly: 0.5, kind: 'star', from: 'sky' }));
    later(1.2 + ts.length * 0.06, () => spDefeat(ts, 'がめん に てき は いなかった……'));
  } else if (move === 'blaze') {
    mobs.forEach((e, i) => F.shots.push({ e, x: e.x, y: e.y, t0: 0.5 + (i % 8) * 0.07, fly: 0.55, kind: 'fire', from: 'sky' }));
    later(0.45, () => { S.shake = 0.7; SFX.boom && SFX.boom(); });
    later(1.4, () => spDefeat(mobs, 'この かい に てき は いなかった……'));
  } else if (move === 'warp') {
    later(0.8, () => {
      const p = spWarpTile();
      S.flash = 0.8; S.flashColor = '230,210,255'; SFX.star();
      if (!p) { showToast('ワープ できる へや が なかった……', 2.2); return; }
      rgPlaceHero(p); RG.lock = mv.dur - 0.8;
      showToast('ちがう へや に ワープ した！', 2.2);
      snapshotDungeon(); stSave('dungeon');
    });
  } else if (move === 'cat') {
    for (let i = 0; i < 18; i++) { const dir = i % 2 ? 1 : -1; F.cats.push({ dir, y: rnd(60, H - 40), t0: 0.4 + Math.random() * 1.4, sp: rnd(520, 820), sz: rnd(30, 48) }); }
    later(0.5, () => { SFX.meow(); later(0.5, () => SFX.meow()); later(1.1, () => SFX.meow()); });
    later(2.5, () => {
      M.mapAll = true; M.fog.fill(1);
      SFX.star(); S.flash = 0.5; S.flashColor = '255,220,240';
      showToast('にゃんこ たち が ちず を ぜんぶ しらべて きた！ アイテム の ばしょ も わかるよ', 3.2);
      snapshotDungeon(); stSave('dungeon');
    });
  }
}
// てき を たおす（しまじろう は よける・死神 には きかない）
function spDefeat(list, none) {
  const M = S.maze;
  const shima = list.filter((e) => e.kind === 'shima'), down = list.filter((e) => e.kind !== 'shima' && M.enemies.includes(e));
  let arca = 0;
  down.forEach((e) => {
    M.enemies.splice(M.enemies.indexOf(e), 1);
    arca += Math.round(ARCA_REWARD[ST.data.dungeon.difficulty][0] / 2);
    const p = spScreen(e);
    for (let k = 0; k < 14; k++) spawn('star', p.x, p.y, { vx: rnd(-260, 260), vy: rnd(-380, -80) });
  });
  if (down.length) { SFX.poof(); ST.data.arca += arca; coinSound(); stRenderHud(); }
  const msg = down.length ? `てき を ${down.length}たい たおした！ ${arca} アルカ（ひっさつ は はんぶん）` : none;
  showToast(shima.length ? `${msg}　しまじろう は ひょいっと よけた！` : msg, 2.8);
  if (M.death) later(0.6, () => showToast('死神 には ききめ が ない……！', 2.4));
  snapshotDungeon(); stSave('dungeon');
}
function spWarpTile() {
  const M = S.maze, here = rgHeroRoom();
  let pool = M.rooms.filter((r) => r.id !== here && r.id !== M.house);
  if (!pool.length) pool = M.rooms.filter((r) => r.id !== here);
  for (let k = 0; k < 120 && pool.length; k++) {
    const r = pick(pool), x = rnd(r.x, r.x + r.w - 1), y = rnd(r.y, r.y + r.h - 1);
    const at = (o) => o.x === x && o.y === y;
    if (!M.grid[y * M.TW + x] || M.enemies.some(at) || M.items.some(at) || M.chests.some(at) || M.pits.some(at) || at(M.goal) || (M.death && at(M.death))) continue;
    return { x, y };
  }
  return null;
}

// わざ の えんしゅつ（drawMaze の さいご に よばれる。がめん の ざひょう）
function drawSpecialFx() {
  const F = SPECIAL.fx;
  if (!F) return;
  F.t += 1 / 60;
  if (F.t > F.dur) { SPECIAL.fx = null; return; }
  const mv = SP_MOVES[F.move], hs = S.maze.heroScreen || { x: W / 2, y: H / 2 };
  const fade = Math.min(1, F.t * 4) * Math.max(0, Math.min(1, (F.dur - F.t) / 0.4));
  ctx.save();
  // あしもと の まほうじん
  drawMagicCircle(ctx, hs.x, hs.y + 30, 36 + Math.min(1, F.t * 3) * 54, F.t * 1.8, mv.inner, mv.color, fade, 0.45);
  if (F.t < 0.7) for (let i = 0; i < 2; i++) spawn('twinkle', hs.x + rnd(-70, 70), hs.y + 30 + rnd(-24, 24), { color: mv.color, size: rnd(6, 12) });
  if (F.move === 'heal' && F.t > 0.4 && F.t < 1.1) for (let i = 0; i < 3; i++) spawn('twinkle', hs.x + rnd(-50, 50), hs.y + rnd(-70, 30), { color: pick(['#bff0ff', '#ffffff', '#ffd6f0']), size: rnd(8, 16) });
  if (F.move === 'blaze' && F.t > 0.4 && F.t < 1.7) { ctx.fillStyle = `rgba(255,90,30,${0.16 * Math.sin((F.t - 0.4) / 1.3 * Math.PI)})`; ctx.fillRect(0, 0, W, H); }
  // ほのお・ほし を とばす
  F.shots.forEach((s) => {
    const k = (F.t - s.t0) / s.fly;
    if (k < 0 || s.done) return;
    const to = spScreen(s);
    if (k >= 1) {
      s.done = true;
      for (let i = 0; i < 16; i++) spawn('twinkle', to.x + rnd(-10, 10), to.y + rnd(-10, 10), { color: s.kind === 'fire' ? pick(['#ff7a3c', '#ffd84a', '#ff4f3c']) : pick(['#fff3a0', '#ffd84a', '#ffffff']), size: rnd(8, 16) });
      if (s.kind === 'fire') SFX.boom ? SFX.boom() : SFX.poof(); else note(1568, 0, 0.12, { type: 'sine', vol: 0.06 });
      return;
    }
    const fr = s.from === 'sky' ? { x: to.x + 120, y: -40 } : { x: hs.x, y: hs.y - 10 };
    const x = fr.x + (to.x - fr.x) * k, y = fr.y + (to.y - fr.y) * k - (s.from === 'sky' ? 0 : Math.sin(k * Math.PI) * 80);
    if (s.kind === 'fire') {
      const gr = ctx.createRadialGradient(x, y, 2, x, y, 22);
      gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.4, '#ffb02e'); gr.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 22, 0, 7); ctx.fill();
      spawn('twinkle', x + rnd(-6, 6), y + rnd(-6, 6), { color: pick(['#ff7a3c', '#ffd84a']), size: rnd(5, 10) });
    } else drawStar(x, y, 16, '#fff3a0');
  });
  // にゃんこ が かけめぐる
  ctx.font = '40px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  F.cats.forEach((c) => {
    const tt = F.t - c.t0;
    if (tt < 0) return;
    const x = c.dir > 0 ? -60 + tt * c.sp : W + 60 - tt * c.sp;
    if (x < -80 || x > W + 80) return;
    const y = c.y + Math.abs(Math.sin(tt * 14)) * -10;
    ctx.save(); ctx.translate(x, y); ctx.scale(c.dir > 0 ? -1 : 1, 1); ctx.font = `${Math.round(c.sz)}px sans-serif`; ctx.fillText('🐈', 0, 0); ctx.restore();
    if (Math.random() < 0.2) spawn('twinkle', x - c.dir * 20, y + 14, { color: '#ffb3e0', size: rnd(4, 8) });
  });
  if (F.move === 'warp' && F.t > 0.4 && F.t < 1.2) {
    const a = Math.sin((F.t - 0.4) / 0.8 * Math.PI);
    const gr = ctx.createLinearGradient(hs.x - 40, 0, hs.x + 40, 0);
    gr.addColorStop(0, 'rgba(185,140,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${0.85 * a})`); gr.addColorStop(1, 'rgba(185,140,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(hs.x - 40, 0, 80, hs.y + 50);
  }
  ctx.restore();
}

// キー：ダンジョン で Enter ＝ ひっさつ。かく がめん は Esc で とじる
addEventListener('keydown', (e) => {
  if (RG.special) {
    if (e.key === 'Escape') { closeSpecial(); e.preventDefault(); }
    else if ((e.key === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) { spJudge(); e.preventDefault(); }
    e.stopImmediatePropagation();
    return;
  }
  if ((e.key === 'Enter' || e.code === 'NumpadEnter') && !e.repeat && rgActive() && S.mode === 'walk' && !S.monster) {
    openSpecial(); e.preventDefault(); e.stopImmediatePropagation();
  }
}, true);

// テスト よう
window.specialTest = { fill(lv = 3) { RG.gauge = SP.stage * lv; }, level: specialLevel, classify: (s) => spClassify(spFeat(s)), inner: spClassifyInner, cast: castSpecial };
