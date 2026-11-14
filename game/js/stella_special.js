'use strict';
// =====================================================================
//  ステラクエスト：ひっさつ わざ（ふしぎな ダンジョン）
//  ・あるくと ゲージ が たまる（RG_CONF.gaugeSteps ほ で まんたん）
//  ・まんたん で ひっさつ ボタン（Enter）→ ゆび（マウス）で かたち を かく
//      ○ ＝ まわり 2マス の てき を たおす
//      いなずま ＝ へや の なか の てき を ぜんぶ たおす（つうろ では まわり 3マス）
//      ☆ ＝ HP を ぜんかいふく
//  ・死神 には きかない。しまじろう は よける。たおした てき の アルカ は はんぶん
//  stella_rogue.js の あと に よむ。しよう：docs/GAME_SPEC.md 14.7
// =====================================================================

const specialGauge = () => (rgActive() ? Math.min(1, (RG.gauge || 0) / RG_CONF.gaugeSteps) : 0);
const SPECIAL = { pts: [], drawing: false, fx: null };

(function buildSpecialPanel() {
  const el = document.createElement('div');
  el.id = 'spPanel'; el.className = 'overlay st-panel sp-panel'; el.hidden = true;
  el.innerHTML = `<div class="st-card sp-card">
    <div class="shop-head"><span class="shop-title">✨ ひっさつ わざ</span><span class="shop-arca">かたち を かいてね！</span></div>
    <div class="sp-body">
      <canvas id="spCanvas" class="sp-draw" width="360" height="360"></canvas>
      <div class="sp-list">
        <div class="sp-ex"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="none" stroke="#ff6fa8" stroke-width="4"/></svg><b>まる</b><small>まわり 2マス の てき を たおす</small></div>
        <div class="sp-ex"><svg viewBox="0 0 40 40"><path d="M24 3 L12 20 L26 20 L14 37" fill="none" stroke="#ffb02e" stroke-width="4" stroke-linejoin="round"/></svg><b>いなずま</b><small>へや の てき を ぜんぶ たおす</small></div>
        <div class="sp-ex"><svg viewBox="0 0 40 40"><path d="M20 3 L30 35 L4 15 L36 15 L10 35 Z" fill="none" stroke="#4ecbff" stroke-width="3.5" stroke-linejoin="round"/></svg><b>ほし</b><small>HP を ぜんぶ かいふく</small></div>
      </div>
    </div>
    <div class="sp-msg" id="spMsg">ひとふで で かいてね</div>
    <div class="shop-foot"><button type="button" class="close">やめる（Esc）</button></div>
  </div>`;
  $('game').appendChild(el);
  el.querySelector('.close').addEventListener('click', closeSpecial);
  const cv = el.querySelector('#spCanvas'), g = cv.getContext('2d');
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  const redraw = () => {
    g.clearRect(0, 0, cv.width, cv.height);
    g.strokeStyle = '#fff3a0'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = '#ffd84a'; g.shadowBlur = 14;
    g.beginPath(); SPECIAL.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  };
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); SPECIAL.drawing = true; SPECIAL.pts = [pos(e)]; try { cv.setPointerCapture(e.pointerId); } catch { /* なし */ } redraw(); });
  cv.addEventListener('pointermove', (e) => { if (!SPECIAL.drawing) return; SPECIAL.pts.push(pos(e)); redraw(); if (SPECIAL.pts.length % 6 === 0) note(900 + SPECIAL.pts.length * 3, 0, 0.04, { type: 'sine', vol: 0.03 }); });
  const end = () => {
    if (!SPECIAL.drawing) return;
    SPECIAL.drawing = false;
    const shape = recognizeShape(SPECIAL.pts);
    if (!shape) { $('spMsg').textContent = 'う〜ん、わからない かたち……もういちど！'; $('spMsg').className = 'sp-msg bad'; SFX.bad(); return; }
    castSpecial(shape);
  };
  ['pointerup', 'pointercancel'].forEach((ev) => cv.addEventListener(ev, end));
})();

function openSpecial() {
  if (!rgActive() || S.mode !== 'walk' || S.monster || RG.special || S.moveT < 1) return;
  if (specialGauge() < 1) {
    const rest = RG_CONF.gaugeSteps - (RG.gauge || 0);
    showToast(`ひっさつ ゲージ が たまったら つかえるよ（あと ${rest} ほ）`, 2);
    return;
  }
  RG.special = true; heldDirs.length = 0;
  SPECIAL.pts = [];
  const cv = $('spCanvas'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
  $('spMsg').textContent = 'ひとふで で かいてね'; $('spMsg').className = 'sp-msg';
  $('spPanel').hidden = false;
  [784, 988, 1175].forEach((f, i) => note(f, i * 0.08, 0.2, { type: 'sine', vol: 0.07 }));
}
function closeSpecial() { RG.special = false; $('spPanel').hidden = true; }

// ---------------------------------------------------------------------
//  かたち を みわける：とじている か・かど の かず
// ---------------------------------------------------------------------
function recognizeShape(raw) {
  if (!raw || raw.length < 8) return null;
  // ながさ で ならした 48てん に
  const pts = [raw[0]];
  let len = 0;
  for (let i = 1; i < raw.length; i++) len += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]);
  if (len < 120) return null;
  const N = 48, seg = len / (N - 1);
  let acc = 0, prev = raw[0];
  for (let i = 1; i < raw.length && pts.length < N; i++) {
    let cur = raw[i], d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    while (acc + d >= seg && pts.length < N) {
      const k = (seg - acc) / d, np = [prev[0] + (cur[0] - prev[0]) * k, prev[1] + (cur[1] - prev[1]) * k];
      pts.push(np); prev = np; d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]); acc = 0;
    }
    acc += d; prev = cur;
  }
  while (pts.length < N) pts.push(raw[raw.length - 1]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys), diag = Math.hypot(w, h) || 1;
  const closed = Math.hypot(pts[0][0] - pts[N - 1][0], pts[0][1] - pts[N - 1][1]) / diag < 0.3;
  // かど：まえ と うしろ 3てん の むき が おおきく かわる ところ
  const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const turn = [];
  for (let i = 3; i < N - 3; i++) {
    let t = ang(pts[i], pts[i + 3]) - ang(pts[i - 3], pts[i]);
    while (t > Math.PI) t -= Math.PI * 2; while (t < -Math.PI) t += Math.PI * 2;
    turn.push(Math.abs(t));
  }
  let corners = 0;
  for (let i = 0; i < turn.length; i++) {
    if (turn[i] > 1.45 && turn[i] >= (turn[i - 1] || 0) && turn[i] >= (turn[i + 1] || 0)) { corners++; i += 2; }
  }
  if (closed && corners <= 1) {
    // まる：ちゅうしん から の きょり が だいたい おなじ
    const cx = xs.reduce((a, b) => a + b) / N, cy = ys.reduce((a, b) => a + b) / N;
    const rs = pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy)), mean = rs.reduce((a, b) => a + b) / N;
    const dev = Math.sqrt(rs.reduce((a, r) => a + (r - mean) ** 2, 0) / N) / mean;
    return dev < 0.3 ? 'circle' : null;
  }
  if (closed && corners >= 3) return 'star';
  if (!closed && corners >= 2) return 'bolt';
  return null;
}

// ---------------------------------------------------------------------
//  わざ を だす
// ---------------------------------------------------------------------
function castSpecial(shape) {
  const M = S.maze;
  closeSpecial();
  RG.gauge = 0;
  const name = { circle: 'スター サークル', bolt: 'ほしくず サンダー', star: 'きらきら ヒール' }[shape];
  showBanner(`✨ ${name}！ ✨`, 1.8);
  SPECIAL.fx = { shape, t: 0 };
  S.flash = 0.6; S.flashColor = shape === 'star' ? '200,240,255' : '255,240,180';
  RG.lock = 1.2;
  if (shape === 'star') {
    later(0.5, () => { S.hp = stMaxHp(); ST.data.hp = S.hp; healEffect(); renderHud(); stRenderHud(); showToast('HP が ぜんぶ かいふく した！', 2.2); stSave(); });
    return;
  }
  const room = rgHeroRoom();
  const hit = M.enemies.filter((e) => {
    if (shape === 'circle') return Math.max(Math.abs(e.x - S.pos.x), Math.abs(e.y - S.pos.y)) <= 2;
    return room >= 0 ? M.roomOf[e.y * M.TW + e.x] === room : Math.max(Math.abs(e.x - S.pos.x), Math.abs(e.y - S.pos.y)) <= 3;
  });
  const shima = hit.filter((e) => e.kind === 'shima'), down = hit.filter((e) => e.kind !== 'shima');
  SPECIAL.fx.targets = hit.map((e) => ({ x: e.x, y: e.y }));
  later(0.7, () => {
    let arca = 0;
    down.forEach((e) => {
      const i = M.enemies.indexOf(e); if (i >= 0) M.enemies.splice(i, 1);
      arca += Math.round(ARCA_REWARD[ST.data.dungeon.difficulty][0] / 2);
      const sx = e.x * 48 + 24 - RG.cam.x, sy = e.y * 48 + 10 - RG.cam.y;
      for (let k = 0; k < 14; k++) spawn('star', sx, sy, { vx: rnd(-260, 260), vy: rnd(-380, -80) });
    });
    if (down.length) { SFX.poof(); ST.data.arca += arca; coinSound(); stRenderHud(); }
    const msg = down.length ? `てき を ${down.length}たい たおした！ ${arca} アルカ（ひっさつ は はんぶん）` : 'ちかく に てき は いなかった……';
    showToast(shima.length ? `${msg}　しまじろう は ひょいっと よけた！` : msg, 2.8);
    if (M.death) later(0.6, () => showToast('死神 には ききめ が ない……！', 2.4));
    snapshotDungeon(); stSave('dungeon');
  });
}

// わざ の えんしゅつ（drawMaze の さいご に よばれる。がめん の ざひょう）
function drawSpecialFx() {
  const F = SPECIAL.fx;
  if (!F) return;
  F.t += 1 / 60;
  if (F.t > 1.6) { SPECIAL.fx = null; return; }
  const hs = S.maze.heroScreen || { x: W / 2, y: H / 2 };
  ctx.save();
  if (F.shape === 'circle') {
    const r = 30 + F.t * 260, a = Math.max(0, 1 - F.t / 1.4);
    ctx.strokeStyle = `rgba(255,111,168,${a})`; ctx.lineWidth = 12; ctx.shadowColor = '#ff6fa8'; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.arc(hs.x, hs.y + 30, r, 0, 7); ctx.stroke();
    for (let i = 0; i < 10; i++) { const an = i / 10 * Math.PI * 2 + F.t * 3; drawStar(hs.x + Math.cos(an) * r, hs.y + 30 + Math.sin(an) * r, 12, '#fff3a0'); }
  } else if (F.shape === 'bolt') {
    (F.targets || []).concat([{ x: S.pos.x, y: S.pos.y - 2 }]).forEach((p, i) => {
      if (F.t < 0.2 + i * 0.05 || F.t > 1.1) return;
      const sx = p.x * 48 + 24 - RG.cam.x, sy = p.y * 48 + 30 - RG.cam.y;
      ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 7; ctx.shadowColor = '#ffb02e'; ctx.shadowBlur = 26;
      ctx.beginPath(); ctx.moveTo(sx + rnd(-20, 20), -20);
      for (let yy = 0; yy < sy; yy += 60) ctx.lineTo(sx + rnd(-26, 26), yy);
      ctx.lineTo(sx, sy); ctx.stroke();
    });
  } else {
    for (let i = 0; i < 3; i++) if (Math.random() < 0.6) spawn('twinkle', hs.x + rnd(-60, 60), hs.y + rnd(-60, 40), { color: pick(['#bff0ff', '#ffffff', '#ffd6f0']), size: rnd(8, 16) });
  }
  ctx.restore();
}

// キー：ダンジョン で Enter ＝ ひっさつ。かく がめん は Esc で とじる
addEventListener('keydown', (e) => {
  if (RG.special) {
    if (e.key === 'Escape') { closeSpecial(); e.preventDefault(); }
    e.stopImmediatePropagation();
    return;
  }
  if ((e.key === 'Enter' || e.code === 'NumpadEnter') && !e.repeat && rgActive() && S.mode === 'walk' && !S.monster) {
    openSpecial(); e.preventDefault(); e.stopImmediatePropagation();
  }
}, true);

// テスト よう
window.specialTest = { fill() { RG.gauge = RG_CONF.gaugeSteps; }, recognize: recognizeShape, cast: castSpecial };
