'use strict';
// =====================================================================
//  ステラクエスト：えいご を かいて こたえる（4ほん せん）
//  なんいど：1「びー」の おおもじ／2「びー」の こもじ／3 B を みて こもじ／
//            4 🐶 dog の はじめ の もじ／5 🐱 c?t の まんなか／6 🐶 を みて「dog」を 3もじ
//  ・アルファベット 52もじ の かきかた の みほん（せん と えんこ）を つくる
//  ・かいた かたち は かきじゅん・むき に かんけい なく、てん の あつまり で みほん と くらべる（$P）
//    おおもじ の もんだい は おおもじ だけ、こもじ の もんだい は こもじ だけ の なか で いちばん にている か
//  ・ほいくえん の えいご は いままで どおり えらぶ
//  stella_english.js・stella_hoikuen.js の あと に よむ。しよう：docs/GAME_SPEC.md 14.10
// =====================================================================

// ---------------------------------------------------------------------
//  みほん：x は よこ、y は 4ほん せん の だん（0 いちばん うえ・1・2 きほん の せん・3 いちばん した）
// ---------------------------------------------------------------------
const arcP = (cx, cy, rx, ry, a0, a1, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
const cat = (...parts) => parts.flat();
const ring = (cx, cy, rx, ry) => arcP(cx, cy, rx, ry, -60, -420, 20);
const LETTER_STROKES = {
  A: [[[0, 2], [0.6, 0], [1.2, 2]], [[0.3, 1.2], [0.9, 1.2]]],
  B: [[[0, 0], [0, 2]], cat([[0, 0]], arcP(0.55, 0.5, 0.5, 0.5, -90, 90), [[0, 1]]), cat([[0, 1]], arcP(0.6, 1.5, 0.55, 0.5, -90, 90), [[0, 2]])],
  C: [arcP(0.7, 1, 0.7, 1, -45, -315, 20)],
  D: [[[0, 0], [0, 2]], cat([[0, 0]], arcP(0.3, 1, 0.8, 1, -90, 90, 18), [[0, 2]])],
  E: [[[1, 0], [0, 0], [0, 2], [1, 2]], [[0, 1], [0.8, 1]]],
  F: [[[1, 0], [0, 0], [0, 2]], [[0, 1], [0.8, 1]]],
  G: [cat(arcP(0.7, 1, 0.7, 1, -45, -315, 20), [[1.2, 1.1], [0.75, 1.1]])],
  H: [[[0, 0], [0, 2]], [[1, 0], [1, 2]], [[0, 1], [1, 1]]],
  I: [[[0.5, 0], [0.5, 2]], [[0.1, 0], [0.9, 0]], [[0.1, 2], [0.9, 2]]],
  J: [cat([[0.8, 0], [0.8, 1.5]], arcP(0.4, 1.5, 0.4, 0.45, 0, 180, 10))],
  K: [[[0, 0], [0, 2]], [[1, 0], [0, 1.1], [1, 2]]],
  L: [[[0, 0], [0, 2], [0.9, 2]]],
  M: [[[0, 2], [0, 0], [0.6, 1.4], [1.2, 0], [1.2, 2]]],
  N: [[[0, 2], [0, 0], [1, 2], [1, 0]]],
  O: [ring(0.7, 1, 0.7, 1)],
  P: [[[0, 0], [0, 2]], cat([[0, 0]], arcP(0.55, 0.5, 0.5, 0.5, -90, 90), [[0, 1]])],
  Q: [ring(0.7, 1, 0.7, 1), [[0.8, 1.5], [1.4, 2.1]]],
  R: [[[0, 0], [0, 2]], cat([[0, 0]], arcP(0.55, 0.5, 0.5, 0.5, -90, 90), [[0, 1]]), [[0.45, 1], [1.1, 2]]],
  S: [cat(arcP(0.6, 0.5, 0.55, 0.5, -20, -270, 12), arcP(0.6, 1.5, 0.55, 0.5, -90, 160, 12))],
  T: [[[0, 0], [1.2, 0]], [[0.6, 0], [0.6, 2]]],
  U: [cat([[0, 0], [0, 1.4]], arcP(0.6, 1.4, 0.6, 0.6, 180, 0, 12), [[1.2, 0]])],
  V: [[[0, 0], [0.6, 2], [1.2, 0]]],
  W: [[[0, 0], [0.4, 2], [0.8, 0.6], [1.2, 2], [1.6, 0]]],
  X: [[[0, 0], [1.1, 2]], [[1.1, 0], [0, 2]]],
  Y: [[[0, 0], [0.6, 1]], [[1.2, 0], [0.6, 1], [0.6, 2]]],
  Z: [[[0, 0], [1.1, 0], [0, 2], [1.1, 2]]],
  a: [ring(0.42, 1.5, 0.42, 0.5), [[0.86, 1], [0.86, 2]]],
  b: [[[0, 0], [0, 2]], ring(0.42, 1.5, 0.42, 0.5)],
  c: [arcP(0.45, 1.5, 0.45, 0.5, -40, -320, 16)],
  d: [ring(0.42, 1.5, 0.42, 0.5), [[0.86, 0], [0.86, 2]]],
  e: [cat([[0.05, 1.5], [0.9, 1.5]], arcP(0.45, 1.5, 0.45, 0.5, 0, -320, 16))],
  f: [cat(arcP(0.6, 0.4, 0.3, 0.4, -10, -180, 8), [[0.3, 2]]), [[0, 1], [0.7, 1]]],
  g: [ring(0.42, 1.5, 0.42, 0.5), cat([[0.86, 1], [0.86, 2.5]], arcP(0.46, 2.5, 0.4, 0.42, 0, 160, 8))],
  h: [[[0, 0], [0, 2]], cat([[0, 1.45]], arcP(0.42, 1.45, 0.42, 0.42, 180, 360, 8), [[0.84, 2]])],
  i: [[[0.2, 1], [0.2, 2]], [[0.2, 0.55], [0.22, 0.6]]],
  j: [cat([[0.5, 1], [0.5, 2.6]], arcP(0.25, 2.6, 0.25, 0.3, 0, 180, 8)), [[0.5, 0.55], [0.52, 0.6]]],
  k: [[[0, 0], [0, 2]], [[0.8, 1], [0, 1.6], [0.8, 2]]],
  l: [[[0.2, 0], [0.2, 2]]],
  m: [[[0, 1], [0, 2]], cat([[0, 1.35]], arcP(0.3, 1.35, 0.3, 0.32, 180, 360, 6), [[0.6, 2]]), cat([[0.6, 1.35]], arcP(0.9, 1.35, 0.3, 0.32, 180, 360, 6), [[1.2, 2]])],
  n: [[[0, 1], [0, 2]], cat([[0, 1.4]], arcP(0.4, 1.4, 0.4, 0.38, 180, 360, 8), [[0.8, 2]])],
  o: [ring(0.45, 1.5, 0.45, 0.5)],
  p: [[[0, 1], [0, 3]], ring(0.44, 1.5, 0.44, 0.5)],
  q: [ring(0.42, 1.5, 0.42, 0.5), [[0.86, 1], [0.86, 3]]],
  r: [[[0, 1], [0, 2]], cat([[0, 1.45]], arcP(0.38, 1.45, 0.38, 0.4, 180, 300, 6))],
  s: [cat(arcP(0.35, 1.25, 0.32, 0.25, -20, -270, 10), arcP(0.35, 1.75, 0.32, 0.25, -90, 160, 10))],
  t: [cat([[0.3, 0.35], [0.3, 1.8]], arcP(0.55, 1.8, 0.25, 0.2, 180, 20, 6)), [[0, 1], [0.65, 1]]],
  u: [cat([[0, 1], [0, 1.6]], arcP(0.4, 1.6, 0.4, 0.4, 180, 0, 8)), [[0.8, 1], [0.8, 2]]],
  v: [[[0, 1], [0.45, 2], [0.9, 1]]],
  w: [[[0, 1], [0.3, 2], [0.6, 1.3], [0.9, 2], [1.2, 1]]],
  x: [[[0, 1], [0.8, 2]], [[0.8, 1], [0, 2]]],
  y: [[[0, 1], [0.45, 2]], [[0.9, 1], [0.2, 3]]],
  z: [[[0, 1], [0.8, 1], [0, 2], [0.8, 2]]],
};
// べつ の かきかた（いくつか ある もじ）
const LETTER_ALT = {
  I: [[[[0.5, 0], [0.5, 2]]]],
  a: [[cat(arcP(0.42, 1.5, 0.42, 0.5, -20, -380, 18), [[0.86, 2]])]],
  d: [[cat(arcP(0.42, 1.5, 0.42, 0.5, -20, -380, 18), [[0.86, 0], [0.86, 2]])]],
  q: [[cat(arcP(0.42, 1.5, 0.42, 0.5, -20, -380, 18), [[0.86, 3]])]],
  t: [[[[0.3, 0.35], [0.3, 2]], [[0, 1], [0.65, 1]]]],
  y: [[cat([[0, 1], [0, 1.6]], arcP(0.4, 1.6, 0.4, 0.4, 180, 0, 8)), cat([[0.8, 1], [0.8, 2.5]], arcP(0.4, 2.5, 0.4, 0.45, 0, 160, 8))]],
  u: [[cat([[0, 1], [0, 1.6]], arcP(0.4, 1.6, 0.4, 0.4, 180, 0, 8), [[0.8, 1], [0.8, 2]])]],
};

// ---------------------------------------------------------------------
//  $P（てん の あつまり で くらべる）
// ---------------------------------------------------------------------
const P_N = 32;
function pCloud(strokes) {
  const pts = [];
  strokes.forEach((s, id) => s.forEach(([x, y]) => pts.push({ x, y, id })));
  if (pts.length < 2) return null;
  // ながさ で ならす
  let len = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].id === pts[i - 1].id) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const I = len / (P_N - 1) || 1, out = [{ ...pts[0] }];
  let D = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].id !== pts[i - 1].id) continue;
    let d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (D + d >= I) {
      const k = (I - D) / d, q = { x: pts[i - 1].x + k * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + k * (pts[i].y - pts[i - 1].y), id: pts[i].id };
      out.push(q); pts.splice(i, 0, q); D = 0;
    } else D += d;
  }
  while (out.length < P_N) out.push({ ...pts[pts.length - 1] });
  out.length = P_N;
  // おおきさ を そろえて まんなか へ（たて よこ の わりあい は そのまま）
  const xs = out.map((p) => p.x), ys = out.map((p) => p.y);
  const s = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
  const cx = xs.reduce((a, b) => a + b) / P_N, cy = ys.reduce((a, b) => a + b) / P_N;
  return out.map((p) => ({ x: (p.x - cx) / s, y: (p.y - cy) / s }));
}
function pCloudDist(a, b, start) {
  const matched = new Uint8Array(P_N);
  let sum = 0, i = start;
  do {
    let best = Infinity, idx = -1;
    for (let j = 0; j < P_N; j++) if (!matched[j]) { const d = (a[i].x - b[j].x) ** 2 + (a[i].y - b[j].y) ** 2; if (d < best) { best = d; idx = j; } }
    matched[idx] = 1;
    const w = 1 - ((i - start + P_N) % P_N) / P_N;
    sum += w * Math.sqrt(best);
    i = (i + 1) % P_N;
  } while (i !== start);
  return sum;
}
function pMatch(a, b) {
  const step = Math.floor(Math.pow(P_N, 0.5));
  let min = Infinity;
  for (let i = 0; i < P_N; i += step) min = Math.min(min, pCloudDist(a, b, i), pCloudDist(b, a, i));
  return min;
}
const LETTER_CLOUDS = {};
Object.entries(LETTER_STROKES).forEach(([ch, st]) => { LETTER_CLOUDS[ch] = [pCloud(st), ...(LETTER_ALT[ch] || []).map(pCloud)]; });

// かいた もの を みわける：set（おおもじ か こもじ）の なか で ちかい じゅん
function rankLetters(strokes, upper) {
  const c = pCloud(strokes);
  if (!c) return [];
  return Object.keys(LETTER_CLOUDS).filter((ch) => (ch === ch.toUpperCase()) === upper)
    .map((ch) => ({ ch, d: Math.min(...LETTER_CLOUDS[ch].map((t) => pMatch(c, t))) })).sort((p, q) => p.d - q.d);
}
const ENGW = { maxDist: 9, near: 1.3, rank: 3, okDist: 0 }; // 2026-11-15：ゆるく（かたち が あって いれば OK） // rank：なんばん まで の ちかさ なら せいかい／okDist：この ちかさ いない なら じゅんい に かかわらず せいかい
function judgeLetter(strokes, target) {
  const r = rankLetters(strokes, target === target.toUpperCase());
  if (!r.length) return { ok: false, best: null };
  const mine = r.find((o) => o.ch === target);
  const pos = r.findIndex((o) => o.ch === target);
  const ok = !!mine && mine.d <= ENGW.maxDist && (pos === 0 || mine.d <= ENGW.okDist || (pos < ENGW.rank && mine.d <= r[0].d * ENGW.near));
  return { ok, best: r[0].ch, d: mine ? mine.d : null, rank: r.slice(0, 3) };
}

window.engwTest = { rank: rankLetters, judge: judgeLetter, strokes: LETTER_STROKES, alt: LETTER_ALT };

// ---------------------------------------------------------------------
//  もんだい
// ---------------------------------------------------------------------
function engWriteQuestion(lv) {
  const base = { subject: 'english', spellSubject: 'english', engw: true, tag: 'えいご・かく', kind: 'engw' };
  if (lv <= 2) {
    const i = rnd(0, 25), ans = lv === 1 ? UPPER[i] : LOWER[i];
    return { ...base, target: ans, promptHtml: `「${ABC_READ[i]}」の ${lv === 1 ? 'おおもじ' : 'こもじ'} を かこう`, symbol: ans, speak: () => speakEn(UPPER[i]) };
  }
  if (lv === 3) {
    const i = rnd(0, 25);
    return { ...base, target: LOWER[i], promptHtml: `<b class="eng-big">${UPPER[i]}</b> の こもじ を かこう`, symbol: LOWER[i], speak: () => speakEn(UPPER[i]) };
  }
  if (lv === 4) {
    const w = pick(FIRST_WORDS);
    return { ...base, target: w[0], promptHtml: `<span class="eng-pic">${w[2]}</span> <b>${w[1].replace(/^./, '?')}</b> はじめ の もじ を かこう`, symbol: w[0], speak: () => speakEn(`${w[1]}. ${w[1]}.`, 0.7), word: w[1] };
  }
  if (lv === 5) {
    const w = pick(CVC);
    return { ...base, target: w[0][1], promptHtml: `<span class="eng-pic">${w[1]}</span> <b class="eng-word">${w[0][0]}<u>&nbsp;?&nbsp;</u>${w[0][2]}</b> まんなか の もじ を かこう`, symbol: w[0][1], speak: () => speakEn(`${w[0]}. ${w[0]}.`, 0.6), word: w[0] };
  }
  const w = pick(CVC);
  return { ...base, target: w[0], promptHtml: `<span class="eng-pic">${w[1]}</span> この ことば を 3もじ で かこう`, symbol: w[0], speak: () => speakEn(`${w[0]}. ${w[0]}.`, 0.6), word: w[0] };
}

// ---------------------------------------------------------------------
//  かく ところ（4ほん せん。3もじ の ときは マス が 3つ）
// ---------------------------------------------------------------------
const EW = { strokes: [], cur: null, cells: 1, reveal: false };
(function buildEngPad() {
  const box = document.createElement('div');
  box.id = 'engwBox'; box.className = 'engw-box';
  box.innerHTML = '<div id="engwPrompt" class="engw-prompt"></div><button id="engwVoice" type="button" class="choice-voice on">🔊 もういちど きく</button>';
  $('quiz').insertBefore(box, $('qmsg'));
  $('engwVoice').addEventListener('click', () => { if (S.q && S.q.speak) S.q.speak(); });
  const pad = document.createElement('div');
  pad.id = 'engPad'; pad.className = 'write-pad eng-pad'; pad.setAttribute('data-avoid', ''); pad.hidden = true;
  pad.innerHTML = '<div class="pad-head"><span>4ほん せん に かいてね</span><span id="engCount">0かく</span></div>'
    + '<canvas id="engCanvas"></canvas>'
    + '<div class="pad-btns"><button id="engUndo" type="button">1かく けす</button><button id="engClear" type="button">ぜんぶ けす</button><button id="engOk" class="ok" type="button">こたえる</button></div>';
  $('game').appendChild(pad);
  const cv = $('engCanvas');
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  cv.addEventListener('pointerdown', (e) => { if (S.mode !== 'question' || !S.q || !S.q.engw) return; e.preventDefault(); EW.cur = [pos(e)]; EW.strokes.push(EW.cur); try { cv.setPointerCapture(e.pointerId); } catch { /* なし */ } drawEngPad(); });
  cv.addEventListener('pointermove', (e) => { if (!EW.cur) return; EW.cur.push(pos(e)); drawEngPad(); });
  const end = () => { if (!EW.cur) return; if (EW.cur.length === 1) EW.cur.push([EW.cur[0][0] + 0.004, EW.cur[0][1] + 0.004]); EW.cur = null; SFX.key(); drawEngPad(); };
  ['pointerup', 'pointercancel'].forEach((ev) => cv.addEventListener(ev, end));
  $('engUndo').addEventListener('click', () => { if (S.mode === 'question') { EW.strokes.pop(); drawEngPad(); } });
  $('engClear').addEventListener('click', () => { if (S.mode === 'question') { EW.strokes = []; drawEngPad(); } });
  $('engOk').addEventListener('click', () => engSubmit());
})();

// 4ほん せん の たかさ（キャンバス の たて 0〜1）：うえ から 0.14・0.38・0.62・0.86
const EW_LINES = [0.14, 0.38, 0.62, 0.86];
function drawEngPad() {
  const cv = $('engCanvas'), r = cv.getBoundingClientRect();
  if (!r.width) return;
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  const g = cv.getContext('2d'), w = cv.width, h = cv.height;
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#fffdf8'; g.fillRect(0, 0, w, h);
  EW_LINES.forEach((y, i) => {
    g.strokeStyle = i === 2 ? '#e2588f' : '#c9b8dc'; g.lineWidth = (i === 2 ? 2.4 : 1.6) * dpr; g.setLineDash(i === 1 ? [6 * dpr, 6 * dpr] : []);
    g.beginPath(); g.moveTo(0, y * h); g.lineTo(w, y * h); g.stroke();
  });
  g.setLineDash([]);
  for (let c = 1; c < EW.cells; c++) { g.strokeStyle = '#d9cfe3'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(w * c / EW.cells, 0); g.lineTo(w * c / EW.cells, h); g.stroke(); }
  // こたえ（まちがえた とき）
  if (EW.reveal && S.q) {
    const chars = [...S.q.target];
    chars.forEach((ch, i) => drawLetterGuide(g, ch, i, chars.length, w, h, 'rgba(226,88,143,.55)'));
  }
  g.strokeStyle = '#3a2a4d'; g.lineWidth = 5 * dpr; g.lineCap = 'round'; g.lineJoin = 'round';
  EW.strokes.forEach((s) => { g.beginPath(); s.forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h))); g.stroke(); });
  $('engCount').textContent = `${EW.strokes.length}かく`;
}
function drawLetterGuide(g, ch, i, n, w, h, color) {
  const unit = (EW_LINES[1] - EW_LINES[0]) * h, cellW = w / n;
  const st = LETTER_STROKES[ch], xs = st.flat().map((p) => p[0]), lw = Math.max(...xs) - Math.min(...xs);
  const ox = i * cellW + (cellW - lw * unit) / 2;
  g.strokeStyle = color; g.lineWidth = 6 * dpr; g.lineCap = 'round'; g.lineJoin = 'round';
  st.forEach((s) => { g.beginPath(); s.forEach(([x, y], k) => (k ? g.lineTo(ox + x * unit, EW_LINES[0] * h + y * unit) : g.moveTo(ox + x * unit, EW_LINES[0] * h + y * unit))); g.stroke(); });
}

function askEngWrite(m, q) {
  S.q = q; S.input = '';
  EW.strokes = []; EW.cur = null; EW.cells = q.target.length; EW.reveal = false;
  if (typeof stopPhrase === 'function') stopPhrase();
  $('quiz').dataset.subj = 'engw';
  const who = m.boss ? `ボス ${enemyTag(m)}！` : m.rare ? `レア ${enemyTag(m)} が あらわれた！` : `${enemyTag(m)} が あらわれた！`;
  $('monName').innerHTML = `${who} <span class="subj-tag english">${q.tag}</span>`;
  $('quiz').classList.toggle('boss', !!m.boss);
  $('engwPrompt').innerHTML = caseMark(q.promptHtml);
  $('qmsg').textContent = ''; $('qmsg').className = 'qmsg';
  $('nextBtn').hidden = true; $('hint').hidden = true;
  S.hintNext = false;
  $('engPad').classList.toggle('wide', EW.cells > 1);
  setMode('question');
  requestAnimationFrame(drawEngPad);
  if (q.speak) q.speak();
}

// ストローク を マス ごと に わけて さいてん
function engSubmit() {
  const q = S.q;
  if (S.mode !== 'question' || !q || !q.engw || !EW.strokes.length) return;
  const n = EW.cells, groups = Array.from({ length: n }, () => []);
  EW.strokes.forEach((s) => { const cx = s.reduce((a, p) => a + p[0], 0) / s.length; groups[Math.min(n - 1, Math.max(0, Math.floor(cx * n)))].push(s); });
  const cr = $('engCanvas').getBoundingClientRect(), asp = (cr.width || 1) / (cr.height || 1), du = EW_LINES[1] - EW_LINES[0];
  const toLetter = (st) => st.map((s) => s.map(([x, y]) => [x * asp / du, (y - EW_LINES[0]) / du])); // 4ほん せん の だん（よこ も おなじ たんい）
  const res = [...q.target].map((ch, i) => (groups[i].length ? judgeLetter(toLetter(groups[i]), ch) : { ok: false, best: null }));
  const ok = res.every((r) => r.ok);
  q.judged = res;
  // 1かいめ の まちがい：こたえ は みせず、ダメージ を うけて もういちど（かんじ と おなじ。あっている もじ は のこす）
  const m = S.monster;
  if (!ok && !q.retried && m && !m.nanmon && S.hp > (m.rare ? 2 : 1)) {
    q.retried = true;
    if (ST.data && ST.battle) { const wq = (ST.data.weakQ = ST.data.weakQ || { math: {}, english: {} }); wq.english[q.target] = Math.min(5, (wq.english[q.target] || 0) + 2); } // にがて に のこす
    const bad = res.map((r, i) => (r.ok ? -1 : i)).filter((i) => i >= 0);
    EW.strokes = EW.strokes.filter((st) => { const cx = st.reduce((a2, pt) => a2 + pt[0], 0) / st.length; return !bad.includes(Math.min(n - 1, Math.max(0, Math.floor(cx * n)))); });
    drawEngPad();
    $('qmsg').textContent = `おしい！ ${n > 1 ? `${bad.map((i) => i + 1).join('・')}もじめ が すこし ちがう みたい。` : 'かたち が すこし ちがう みたい。'}もういちど かいてみよう！`;
    $('qmsg').className = 'qmsg bad';
    SFX.bad();
    m.state = 'attack'; m.t = 0;
    if (m.boss) { SFX.roar(); later(0.3, SFX.breath); }
    later(m.boss ? 0.7 : 0.3, damageHero);
    later(m.boss ? 1.4 : 0.8, () => { if (S.monster === m && m.state === 'attack') { m.state = 'idle'; m.t = 0; } });
    if (q.speak) later(0.9, q.speak);
    return;
  }
  setMode('answered');
  if (!ok) { EW.reveal = true; drawEngPad(); }
  resolveAnswer(ok, `おしい！ こたえは「${q.target}」だよ`);
  if (q.word) speakEn(q.word, 0.6); else if (!ok && q.speak) q.speak();
}

// えいご（ほいくえん いがい）は かいて こたえる
const baseAskEngWrite = askQuestion;
askQuestion = function () {
  const m = S.monster;
  $('engPad').hidden = true;
  if (!ST.battle || !m || m.nanmon || isHoikuen() || battleSubject(m) !== 'english') { baseAskEngWrite(); return; }
  const lv = Math.min(6, ST.battle.difficulty + (m.boss || m.rare ? 1 : 0));
  askEngWrite(m, engWriteQuestion(lv));
};
const baseUpdateUIEngw = updateUI;
updateUI = function () {
  baseUpdateUIEngw();
  const show = !!(S.q && S.q.engw && (S.mode === 'question' || S.mode === 'answered') && S.monster);
  $('engPad').hidden = !show;
  if (show) requestAnimationFrame(drawEngPad);
};
addEventListener('keydown', (e) => {
  if (S.mode !== 'question' || !S.q || !S.q.engw) return;
  if ((e.key === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) { engSubmit(); e.preventDefault(); e.stopImmediatePropagation(); }
  else if (e.key === 'Backspace') { EW.strokes.pop(); drawEngPad(); e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

// テスト よう：みほん どおり に かく（wrong なら ちがう もじ）
engwTest.write = (text, wrong) => {
  const chars = [...text], n = chars.length;
  EW.strokes = [];
  const cr = $('engCanvas').getBoundingClientRect(), asp = (cr.width || 1) / (cr.height || 1), du = EW_LINES[1] - EW_LINES[0];
  chars.forEach((ch, i) => {
    const c2 = wrong ? (ch === ch.toUpperCase() ? (ch === 'O' ? 'X' : 'O') : (ch === 'o' ? 'x' : 'o')) : ch;
    LETTER_STROKES[c2].forEach((s) => EW.strokes.push(s.map(([x, y]) => [(i + 0.25) / n + x * du / asp, EW_LINES[0] + y * du])));
  });
  drawEngPad();
};
