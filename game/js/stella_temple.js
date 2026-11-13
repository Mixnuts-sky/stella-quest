'use strict';
// =====================================================================
//  ステラクエスト：ほしの しんでん「ステラリウム」と ちゅなちゃんの すがた
//    ・なんいど5 を はじめて クリアすると とびらが ひかる
//    ・7つの へやに なぞ が 1つずつ。といた へやは セーブ（flags.templeRoom）
//    ・ぜんぶ とくと セブンスター・レインボーエターナル ＋ きゅうきょくの ほしまほうつかい
//  しよう：docs/GAME_SPEC.md「10. 星の神殿」「12. ちゅなちゃんの見た目」
// =====================================================================

// ---------------------------------------------------------------------
//  すがた（form）：え を まるい ひかりの わくで きりとって SPR.hero に する
// ---------------------------------------------------------------------
const FORM_SPR = { normal: null, cache: {} };
function buildFormSprite(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const S2 = 420, r = 180, c = document.createElement('canvas');
      c.width = S2; c.height = S2;
      const g = c.getContext('2d');
      const glow = g.createRadialGradient(S2 / 2, S2 / 2, r * 0.8, S2 / 2, S2 / 2, S2 / 2);
      glow.addColorStop(0, 'rgba(255,240,170,.9)'); glow.addColorStop(1, 'rgba(255,200,255,0)');
      g.fillStyle = glow; g.fillRect(0, 0, S2, S2);
      g.save(); g.beginPath(); g.arc(S2 / 2, S2 / 2, r, 0, 7); g.clip();
      const k = (r * 2) / Math.min(img.width, img.height);
      g.drawImage(img, S2 / 2 - (img.width * k) / 2, S2 / 2 - (img.height * k) / 2, img.width * k, img.height * k);
      g.restore();
      g.lineWidth = 10; g.strokeStyle = '#ffd84a'; g.beginPath(); g.arc(S2 / 2, S2 / 2, r, 0, 7); g.stroke();
      g.lineWidth = 3; g.strokeStyle = '#fff6d6'; g.beginPath(); g.arc(S2 / 2, S2 / 2, r - 7, 0, 7); g.stroke();
      const white = document.createElement('canvas'); // まちで ふちどり に つかう シルエット
      white.width = S2; white.height = S2;
      const wg = white.getContext('2d'); wg.fillStyle = '#fff'; wg.beginPath(); wg.arc(S2 / 2, S2 / 2, r + 5, 0, 7); wg.fill();
      resolve({ canvas: c, white, w: S2, h: S2 });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
// ふつうの すがた：かったぶきを もっている え に する（はじめの つえ は かいた え の まま）
//   STAFF_ERASE：え の つえ の ところ（げんこう IMG_3632.jpeg の ピクセル。sprites.js の crop [80, 14] と 0.5ばい で スプライトの いちに なおす）
const STAFF_ERASE = [[632, 465], [780, 465], [780, 610], [660, 610], [652, 700], [635, 900], [625, 1135], [480, 1135], [525, 950], [565, 820], [600, 730], [604, 690], [612, 600], [632, 600]];
const STAFF_HAND = { x: 570, y: 695, r: 34 };      // つえを にぎる て（つえの うえに もういちど かく）
const STAFF_BOX = { cx: 600, bottom: 1120, h: 620 }; // あたらしい つえを おく ところ
const toSpr = (x, y) => [(x - 80) / 2, (y - 14) / 2];
function buildStaffSprite(base, url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = base.canvas.width; c.height = base.canvas.height;
      const g = c.getContext('2d');
      g.drawImage(base.canvas, 0, 0);
      g.globalCompositeOperation = 'destination-out'; // かいた つえ を けす
      g.beginPath(); STAFF_ERASE.forEach(([x, y], i) => { const [sx, sy] = toSpr(x, y); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); }); g.closePath(); g.fill();
      g.globalCompositeOperation = 'source-over';
      const h = STAFF_BOX.h / 2, w = h * img.width / img.height, [cx, by] = toSpr(STAFF_BOX.cx, STAFF_BOX.bottom);
      g.drawImage(img, cx - w / 2, by - h, w, h);
      // て を つえ の まえに
      const [hx, hy] = toSpr(STAFF_HAND.x, STAFF_HAND.y), hr = STAFF_HAND.r / 2;
      g.save(); g.beginPath(); g.arc(hx, hy, hr, 0, 7); g.clip(); g.drawImage(base.canvas, 0, 0); g.restore();
      const white = document.createElement('canvas'); white.width = c.width; white.height = c.height;
      const wg = white.getContext('2d'); wg.drawImage(c, 0, 0); wg.globalCompositeOperation = 'source-in'; wg.fillStyle = '#fff'; wg.fillRect(0, 0, c.width, c.height);
      resolve({ ...base, canvas: c, white });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

let formBusy = false;
function stApplyForm() {
  if (!ST.data || !SPR.hero || formBusy) return;
  if (!FORM_SPR.normal) FORM_SPR.normal = SPR.hero;
  const form = ST.data.form || 'normal';
  let key = form, url = STIMG.forms && STIMG.forms[form], build = buildFormSprite;
  if (form === 'normal' || !url) {
    const staff = STIMG.staffs && STIMG.staffs[ST.data.equip];
    if (!staff) { SPR.hero = FORM_SPR.normal; return; }
    key = 'staff:' + ST.data.equip; url = staff; build = (u) => buildStaffSprite(FORM_SPR.normal, u);
  }
  if (FORM_SPR.cache[key]) { SPR.hero = FORM_SPR.cache[key]; return; }
  formBusy = true;
  build(url).then((spr) => { formBusy = false; if (spr) { FORM_SPR.cache[key] = spr; SPR.hero = spr; } });
}
setInterval(stApplyForm, 300); // え の よみこみは あとから おわるので、ときどき たしかめる

// ---------------------------------------------------------------------
//  しんでんの ばめん
// ---------------------------------------------------------------------
const TPL = { lit: 0, finale: 0, room: 1 };
const tplFlags = () => ST.data.flags;
ST_PLACE.temple = 'ほしの しんでん ステラリウム';

SCENES.temple = {
  enter() { TPL.finale = 0; TPL.room = tplFlags().templeRoom || 1; TPL.lit = TPL.room - 1; },
  update(dt) { if (TPL.finale) TPL.finale += dt; },
  draw() { drawTemple(); },
};

function drawTemple() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a1446'); g.addColorStop(1, '#43307a');
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  const tin = typeof BIMG !== 'undefined' && BIMG.inside.templeIn;
  const v = typeof interiorView === 'function' ? interiorView({ img: 'templeIn' }) : null;
  if (tin && v && bimgReady(tin)) { // しんでんの なか の え（stella_interior.js）
    ctx.drawImage(tin, v.ox, v.oy, v.iw * v.s, v.ih * v.s);
    ctx.fillStyle = 'rgba(20,10,50,.18)'; ctx.fillRect(-30, -30, W + 60, H + 60);
  } else for (let i = 0; i < 4; i++) { // はしら
    const x = W * (0.1 + i * 0.27);
    ctx.fillStyle = 'rgba(220,210,255,.18)'; ctx.fillRect(x - 26, H * 0.18, 52, H * 0.7);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x - 34, H * 0.18, 68, 14); ctx.fillRect(x - 34, H * 0.86, 68, 14);
  }
  // てんじょうの 7つの ほし（といた ぶんだけ ひかる）
  const colors = ['#ff5a5a', '#ff9a3a', '#ffd84a', '#5fd06a', '#5ab4ff', '#9a6aff', '#ff8fd0'];
  for (let i = 0; i < 7; i++) {
    const x = W * (0.2 + i * 0.1), y = H * 0.1 + Math.sin(i * 1.3) * 10;
    const on = i < TPL.lit || TPL.finale > 0;
    if (on) {
      const gl = ctx.createRadialGradient(x, y, 0, x, y, 40);
      gl.addColorStop(0, colors[i] + 'cc'); gl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, 40, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = on ? 1 : 0.35;
    drawStar(x, y, on ? 18 + Math.sin(S.t * 3 + i) * 2 : 14, on ? colors[i] : '#8a80b0');
    ctx.globalAlpha = 1;
  }
  // へやの なまえ
  if (!TPL.finale && TPL.room <= 7) {
    ctx.font = '900 26px "Dela Gothic One", sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8'; ctx.fillText(`だい ${TPL.room} の へや`, W / 2, H * 0.24);
  }
  // さいだん と ちゅなちゃん（え が ある ときは あおい じゅうたん の うえ）
  const onImg = tin && v && bimgReady(tin);
  const fx = onImg ? v.ox + 185 * v.s : W / 2, fy = onImg ? v.oy + 330 * v.s : H * 0.86, hh = onImg ? 70 * v.s : 230; // あおい じゅうたん の うえ
  ctx.fillStyle = 'rgba(255,240,200,.25)'; ctx.beginPath(); ctx.ellipse(fx, fy, hh * 0.6, hh * 0.12, 0, 0, 7); ctx.fill();
  const spr = SPR.hero;
  if (spr) {
    const w = hh * spr.w / spr.h, bob = Math.sin(S.t * 2) * 3;
    ctx.drawImage(spr.canvas, fx - w / 2, fy - hh - bob, w, hh);
  }
  // さいごの ひかり
  if (TPL.finale) {
    const k = Math.min(1, TPL.finale / 1.5);
    const col = ctx.createLinearGradient(W / 2 - 120, 0, W / 2 + 120, 0);
    col.addColorStop(0, 'rgba(255,255,220,0)'); col.addColorStop(0.5, `rgba(255,255,230,${0.75 * k})`); col.addColorStop(1, 'rgba(255,255,220,0)');
    ctx.fillStyle = col; ctx.fillRect(W / 2 - 120, 0, 240, H);
    if (Math.random() < 0.5) spawn('twinkle', W / 2 + rnd(-120, 120), rnd(H * 0.2, H * 0.9), { color: pick(colors), size: rnd(8, 18) });
  }
}

// ---------------------------------------------------------------------
//  はいる・でる
// ---------------------------------------------------------------------
function enterTemple() {
  const f = tplFlags();
  if (!f.templeOpen) { stDialog(['ふるい しんでんだ。', 'とびらは かたく とざされている……']); return; }
  if (f.templeCleared) {
    stDialog(['しんでんの なかで 7つの ほしが しずかに かがやいている。', ['ちゅなちゃん', 'ほしさん、ありがとう！']]);
    return;
  }
  const first = !f.templeVisited;
  f.templeVisited = true;
  setScene('temple');
  stSave('temple');
  const intro = first
    ? [['？？？', '5つの しれんを のりこえし ものよ……'], ['？？？', 'ほしの ちからを てにしたければ'], ['？？？', '7つの なぞを ときあかせ……'], ['', 'ほしの しんでん ステラリウムに はいった！']]
    : [['', 'ほしの しんでん ステラリウム。'], ['', `だい ${TPL.room} の へやから つづきだ。`]];
  stDialog(intro, startRoom);
}
function leaveTemple() {
  closePanelSilently();
  TPL.finale = 0; particles.length = 0; // しんでんの キラキラを まちに もちこまない
  setScene('town', { pos: { x: 4, y: 5 } });
}

function startRoom() {
  TPL.room = tplFlags().templeRoom || 1;
  const r = ROOMS[TPL.room - 1];
  stDialog(r.intro.map((t) => (Array.isArray(t) ? t : ['', t])), r.open);
}

// なぞを といた
function solved() {
  closePanelSilently();
  SFX.star();
  TPL.lit = TPL.room;
  const f = tplFlags();
  f.templeRoom = TPL.room + 1;
  stSave('temple');
  if (TPL.room >= 7) { finaleTemple(); return; }
  showBanner(`⭐ ${TPL.room}つめの ほしが ひかった！`, 1.8);
  later(2, () => { TPL.room++; startRoom(); });
}

// なぞの パネル（そとへ でる ボタン つき。Escape でも でる）
const TP = { keys: null };
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function puzzlePanel(title, body) {
  TP.keys = null;
  const p = stPanel(`<div class="shop-head"><div class="shop-title">⭐ ${title}</div></div>${body}
    <div class="shop-msg"></div>
    <div class="shop-foot"><button type="button" class="close tp-out">しんでんの そとへ でる</button></div>`, leaveTemple);
  p.querySelector('.tp-out').addEventListener('click', closePanel);
  return p;
}
const tpMsg = (t, bad) => shopMsg(t, bad);
function nope(t) { tpMsg(t, true); SFX.wrong ? SFX.wrong() : note(200, 0, 0.25, { type: 'square', vol: 0.06 }); const c = $('stPanel').querySelector('.st-card'); if (c) { c.classList.remove('tp-shake'); void c.offsetWidth; c.classList.add('tp-shake'); } }
STELLA_KEY_HOOKS.unshift((e) => {
  if (ST.scene !== 'temple' || S.mode !== 'panel' || !TP.keys) return false;
  return TP.keys(e) === true;
});

// ---------------------------------------------------------------------
//  7つの なぞ
// ---------------------------------------------------------------------
const ROOMS = [
  // 1. きえた ほし
  { intro: ['ゆかに ほしの もようが ならんでいる。', 'ひとつだけ ほしが きえている……'], open() {
    let input = '';
    const p = puzzlePanel('だい1の なぞ', `<div class="tp-stars">${[2, 4, 6, '？', 10].map((n) => `<span class="tp-star${n === '？' ? ' q' : ''}">${n}</span>`).join('')}</div>
      <div class="tp-q">きえた ほしは いくつだ？</div>
      <div class="tp-ans" id="tpAns">&nbsp;</div>
      <div class="tp-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join('')}<button type="button" data-n="x">けす</button><button type="button" class="buy" data-n="ok">こたえる</button></div>`);
    const show = () => { p.querySelector('#tpAns').textContent = input || ' '; };
    const press = (k) => {
      if (k === 'x') input = input.slice(0, -1);
      else if (k === 'ok') { if (!input) return; if (+input === 8) { solved(); return; } nope('ちがうみたい……。2・4・6 … どう ふえている？'); input = ''; }
      else if (input.length < 2) input += k;
      show();
    };
    p.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => press(b.dataset.n)));
    TP.keys = (e) => {
      const m = e.code.match(/^(?:Digit|Numpad)(\d)$/);
      if (m) { press(m[1]); return true; }
      if (e.key === 'Backspace') { press('x'); return true; }
      if (e.key === 'Enter' && document.activeElement && document.activeElement.dataset.n === undefined) { press('ok'); return true; }
      return false;
    };
  } },
  // 2. いしばん
  { intro: ['へやの まんなかに いしばんが ならんでいる。'], open() {
    let pick2 = [];
    const p = puzzlePanel('だい2の なぞ', `<div class="tp-q">よぞらに かがやく ものは？</div>
      <div class="tp-ans" id="tpAns">&nbsp;</div>
      <div class="tp-tiles">${['ひ', 'し', 'み', 'き', 'ず', 'ほ'].map((c) => `<button type="button" class="tp-tile" data-c="${c}">${c}</button>`).join('')}</div>`);
    p.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => {
      pick2.push(b.dataset.c); note(660 + pick2.length * 120, 0, 0.15, { type: 'sine', vol: 0.1 });
      p.querySelector('#tpAns').textContent = pick2.join(' ');
      if (pick2.length === 2) {
        if (pick2.join('') === 'ほし') { later(0.4, solved); return; }
        later(0.5, () => { nope('いしばんが もとに もどった……'); pick2 = []; p.querySelector('#tpAns').textContent = ' '; });
      }
    }));
  } },
  // 3. ドレミ
  { intro: ['かべに おとの いしが ならんでいる。', 'でも じゅんばんが バラバラだ……', 'おとを ただしい じゅんばんに ならべよう！'], open() {
    const NOTES = [['ド', 523], ['レ', 587], ['ミ', 659], ['ファ', 698], ['ソ', 784], ['ラ', 880], ['シ', 988], ['ド', 1047]];
    const want = NOTES.map((n) => n[0]);
    let got = [];
    const order = shuffle(NOTES.map((n, i) => i));
    const p = puzzlePanel('だい3の なぞ', `<div class="tp-q">おとを ひくい じゅんに ならべよう</div>
      <div class="tp-ans" id="tpAns">&nbsp;</div>
      <div class="tp-tiles">${order.map((i) => `<button type="button" class="tp-tile tp-note" data-i="${i}">${NOTES[i][0]}</button>`).join('')}</div>`);
    p.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
      const [name, f] = NOTES[+b.dataset.i];
      note(f, 0, 0.35, { type: 'triangle', vol: 0.14 });
      if (name !== want[got.length] || b.disabled) { got = []; p.querySelectorAll('[data-i]').forEach((x) => { x.disabled = false; }); p.querySelector('#tpAns').textContent = ' '; nope('おとが ばらばらに もどった……。ド からだよ'); return; }
      got.push(name); b.disabled = true;
      p.querySelector('#tpAns').textContent = got.join(' ');
      if (got.length === want.length) { NOTES.forEach(([, fq], i) => note(fq, 0.6 + i * 0.12, 0.2, { type: 'sine', vol: 0.1 })); later(1.8, solved); }
      else { const nx = p.querySelector('[data-i]:not([disabled])'); if (nx) nx.focus(); }
    }));
  } },
  // 4. わかれみち
  { intro: ['みちの はじめに もじが きざまれている。', '「ほしと ひとつに」'], open() {
    const CH = [['たいよう', '☀️'], ['つき', '🌙'], ['ほし', '⭐'], ['くも', '☁️'], ['き', '🌳']];
    let step = 0;
    const p = puzzlePanel('だい4の なぞ', `<div class="tp-q">「ほしと ひとつに」</div>
      <div class="tp-ans" id="tpAns"></div>
      <div class="tp-tiles" id="tpRoads"></div>`);
    const draw = () => {
      p.querySelector('#tpAns').textContent = `わかれみち ${step + 1} / 3`;
      const roads = shuffle(CH.slice());
      p.querySelector('#tpRoads').innerHTML = roads.map(([n, e]) => `<button type="button" class="tp-tile tp-road" data-r="${n}"><span>${e}</span><small>${n}</small></button>`).join('');
      p.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.r === 'ほし') { step++; SFX.step(); note(880 + step * 110, 0, 0.2, { type: 'sine', vol: 0.1 }); if (step >= 3) { later(0.3, solved); return; } tpMsg('みちが つづいている……'); draw(); }
        else { step = 0; nope('……あれ？ さいしょの ばしょに もどってしまった！'); draw(); }
      }));
      const f = p.querySelector('[data-r]'); if (f) f.focus();
    };
    draw();
  } },
  // 5. ほしを かく
  { intro: ['ゆかに おおきな まほうじんが ある。', 'まほうじんに ほしを かこう！'], open() {
    let strokes = [], cur = null, miss = 0;
    const p = puzzlePanel('だい5の なぞ', `<div class="tp-q">ほしの かたちを かこう</div>
      <canvas class="tp-draw" id="tpDraw" width="360" height="360"></canvas>
      <div class="shop-foot"><button type="button" id="tpErase">けす</button><button type="button" class="buy" id="tpDone">できた！</button></div>`);
    const cv = p.querySelector('#tpDraw'), g = cv.getContext('2d');
    const redraw = () => {
      g.clearRect(0, 0, 360, 360);
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 3; g.beginPath(); g.arc(180, 180, 160, 0, 7); g.stroke();
      if (miss >= 2) { // おてほん
        g.setLineDash([8, 10]); g.strokeStyle = 'rgba(255,230,120,.6)'; g.lineWidth = 6; g.beginPath();
        for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; g.lineTo(180 + Math.cos(a) * 140, 180 + Math.sin(a) * 140); }
        g.stroke(); g.setLineDash([]);
      }
      g.strokeStyle = '#ffe27a'; g.lineWidth = 10; g.lineCap = 'round'; g.lineJoin = 'round';
      strokes.concat(cur ? [cur] : []).forEach((s) => { g.beginPath(); s.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); });
    };
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 360 / r.width, (e.clientY - r.top) * 360 / r.height]; };
    cv.addEventListener('pointerdown', (e) => { cur = [pos(e)]; cv.setPointerCapture(e.pointerId); redraw(); });
    cv.addEventListener('pointermove', (e) => { if (cur) { cur.push(pos(e)); redraw(); } });
    const up = () => { if (cur) { if (cur.length > 1) strokes.push(cur); cur = null; redraw(); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    p.querySelector('#tpErase').addEventListener('click', () => { strokes = []; redraw(); });
    p.querySelector('#tpDone').addEventListener('click', () => {
      if (isStarShape(strokes)) { tpMsg('まほうじんが ひかった！'); later(0.6, solved); return; }
      miss++; strokes = []; redraw();
      nope(miss >= 2 ? 'てんせんを なぞってみよう！' : 'まほうじんは ひかなかった……。とがった ところが 5つの ほしだよ');
    });
    TPL.drawTest = (s) => { strokes = s; redraw(); }; // テストよう
    redraw();
  } },
  // 6. とびらを たたく
  { intro: ['かべに これまでの しれんの えが ならんでいる。', 'すうじ・ことば・おんがく・めいろ・かたち……', 'おくに おおきな とびらが ある。', '「ほしの かずだけ とびらを たたけ」'], open() {
    let knocks = 0, timer = 0;
    const p = puzzlePanel('だい6の なぞ', `<div class="tp-pics">${[['🔢', 'すうじ'], ['📜', 'ことば'], ['🎵', 'おんがく'], ['🌀', 'めいろ'], ['⭐', 'かたち']].map(([e, n]) => `<span><b>${e}</b>${n}</span>`).join('')}</div>
      <div class="tp-q">「ほしの かずだけ とびらを たたけ」</div>
      <button type="button" class="tp-door" id="tpDoor">🚪<small>とびらを たたく</small></button>`);
    const judge = () => {
      if (knocks === 5) { tpMsg('ギギギ……とびらが ひらいた！'); later(0.6, solved); }
      else { nope('……なにも おこらない。'); }
      knocks = 0;
    };
    p.querySelector('#tpDoor').addEventListener('click', () => {
      knocks++; noise(0, 0.12, 0.25, 180); note(110, 0, 0.15, { type: 'square', vol: 0.08 });
      tpMsg('コン！'.repeat(knocks));
      const my = ++timer;
      later(1.5, () => { if (my === timer && S.mode === 'panel' && TPL.room === 6) judge(); });
    });
  } },
  // 7. にじの ボタン
  { intro: [['', 'さいごの しれんです'], ['', 'ほしは ひとつでは かがやけません'], ['', 'ほしに ひかりを とどけてください']], open() {
    const COLORS = [['あか', '#ff4a4a'], ['オレンジ', '#ff9a2a'], ['きいろ', '#ffd83a'], ['みどり', '#3fc05a'], ['あお', '#3a8aff'], ['むらさき', '#9a5aff'], ['ピンク', '#ff7ac8']];
    let got = 0;
    const p = puzzlePanel('だい7の なぞ', `<div class="tp-rainbow"></div>
      <div class="tp-q">ほしに ひかりを とどけよう</div>
      <div class="tp-ans" id="tpAns">&nbsp;</div>
      <div class="tp-tiles">${shuffle(COLORS.map((c, i) => i)).map((i) => `<button type="button" class="tp-tile tp-color" data-col="${i}" style="background:${COLORS[i][1]}" aria-label="${COLORS[i][0]}"></button>`).join('')}</div>`);
    p.querySelectorAll('[data-col]').forEach((b) => b.addEventListener('click', () => {
      if (+b.dataset.col !== got) {
        got = 0; p.querySelectorAll('[data-col]').forEach((x) => { x.disabled = false; x.classList.remove('on'); });
        p.querySelector('#tpAns').textContent = ' ';
        nope('ひかりが きえてしまった……。みぎうえの にじを よく みよう'); return;
      }
      note(523 * Math.pow(2, got / 7), 0, 0.3, { type: 'sine', vol: 0.12 });
      b.disabled = true; b.classList.add('on'); got++;
      p.querySelector('#tpAns').textContent = '⭐'.repeat(got);
      if (got === 7) later(0.6, solved);
      else { const nx = p.querySelector('[data-col]:not([disabled])'); if (nx) nx.focus(); }
    }));
  } },
];

// ほしの かたち？：ちゅうしんから みた いちばん とおい てん を かくどごとに しらべ、
// とがった ところ（やま）が 4〜6こ あって、へこみが ふかければ ほし
function isStarShape(strokes) {
  const pts = strokes.flat();
  if (pts.length < 2) return false;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (size < 80) return false;
  // せんの うえの てんを こまかく ふやす
  const dense = [];
  strokes.forEach((s) => s.forEach((p, i) => {
    if (!i) { dense.push(p); return; }
    const q = s[i - 1], n = Math.ceil(Math.hypot(p[0] - q[0], p[1] - q[1]) / 3);
    for (let k = 1; k <= n; k++) dense.push([q[0] + (p[0] - q[0]) * k / n, q[1] + (p[1] - q[1]) * k / n]);
  }));
  if (dense.length < 30) return false;
  const N = 72, r = new Array(N).fill(0);
  dense.forEach(([x, y]) => {
    const b = Math.floor(((Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI)) * N) % N;
    r[b] = Math.max(r[b], Math.hypot(x - cx, y - cy));
  });
  const filled = r.filter((v) => v > 0).length;
  if (filled < N * 0.7) return false;
  // あいている ところは となりで うめる・なめらかに する
  for (let pass = 0; pass < N; pass++) for (let i = 0; i < N; i++) if (!r[i]) r[i] = r[(i + 1) % N] || r[(i + N - 1) % N];
  const sm = r.map((_, i) => (r[(i + N - 1) % N] + r[i] * 2 + r[(i + 1) % N]) / 4);
  const max = Math.max(...sm), min = Math.min(...sm);
  if (min / max > 0.68) return false; // まる・しかく
  const th = min + (max - min) * 0.55;
  let peaks = 0;
  for (let i = 0; i < N; i++) {
    let top = sm[i] >= th;
    for (let d = -4; d <= 4 && top; d++) if (d && sm[(i + d + N) % N] > sm[i]) top = false;
    if (top && !(sm[(i + N - 1) % N] === sm[i])) peaks++;
  }
  return peaks >= 4 && peaks <= 6;
}

// ---------------------------------------------------------------------
//  ぜんぶ といた！
// ---------------------------------------------------------------------
function finaleTemple() {
  later(0.8, () => stDialog([['', '7つの ほしが そろいました'], ['', 'あなたの ちえが ほしの ちからを めざめさせました']], () => {
    TPL.finale = 0.01; SFX.levelUp(); S.flash = 0.6; S.flashColor = '255,250,220';
    setMode('cut');
    later(1.6, () => {
      const d = ST.data;
      d.form = 'ultimate';
      const w = 'セブンスター・レインボーエターナル';
      if (!d.weapons.includes(w)) d.weapons.push(w);
      if (weaponOf(d.equip).atk < weaponOf(w).atk) d.equip = w;
      d.flags.templeCleared = true;
      stApplyForm();
      S.flash = 1; SFX.star();
      stSave('temple');
      stRenderHud();
    });
    later(3, () => {
      setMode('st');
      stDialog([['', 'おめでとう！'], ['', 'あなたは 7つの ほしに みとめられました！'], ['', 'きゅうきょくの ほしまほうを しゅうとく！']], showUltimate);
    });
  }));
}
function showUltimate() {
  const img = STIMG.forms && STIMG.forms.ultimate;
  const wimg = STIMG.weapons && STIMG.weapons['セブンスター・レインボーエターナル'];
  const p = stPanel(`<div class="shop-head"><div class="shop-title">🌈 きゅうきょくの ほしまほうつかい</div></div>
    <div class="tp-reward">${img ? `<img src="${img}" alt="きゅうきょくの ほしまほうつかい ちゅなちゃん">` : ''}${wimg ? `<img class="w" src="${wimg}" alt="">` : ''}</div>
    <div class="tp-q">セブンスター・レインボーエターナル を てに いれた！<br><small>こうげきりょく ${weaponOf('セブンスター・レインボーエターナル').atk}</small></div>
    <div class="shop-foot"><button type="button" class="buy close">やったー！</button></div>`, leaveTemple);
  p.querySelector('.close').addEventListener('click', closePanel);
}

// まちの しんでんの とびら
const baseEnterBuildingTemple = enterBuilding;
enterBuilding = function (b) {
  if (b.id === 'temple') { enterTemple(); return; }
  baseEnterBuildingTemple(b);
};
