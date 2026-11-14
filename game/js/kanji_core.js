'use strict';
// =====================================================================
//  かんじの ぶひん（かきとり パッド・はんてい・にがて きろく・もんだいの ひょうじ）
//  けんし かずぅ（kanji.js）と ステラクエスト（stella_subjects.js）で つかう。
//  KANJI_HOOKS で にがての ほぞんさき と こうげきの しゅるい を かえられる。
// =====================================================================

const KANJI_CONFIG = {
  strictOrder: false,     // true: かきじゅんが ちがうと まちがい / false: アドバイス だけ
  tolerance: 0.26,        // 1かくの ずれの ゆるさ（おおきいほど ゆるい。こどもの すこし きたない じ でも とおる くらい）
  maxDev: 0.33,            // 1かくの なかで いちばん ずれた ところの げんかい（まがる・まがらない の ちがいを みる）
  orderTolerance: 1.0,    // かきじゅんが ちがう ときの かたちの ゆるさ（tolerance に かける。ちがう じ は 1.0 でも とおらない ことを kanji_test で たしかめた）
  checkHane: true,        // はね を みる
  checkTouch: true,       // くっつける・はなす を みる
  touchWarnGap: 0,        // くっつける ところ が この すきま まで なら けいこく だけ で せいかい（0 なら しない。ステラクエスト は 0.16）
  apartWarn: false,       // はなす ところ が くっついても けいこく だけ で せいかい（ステラクエスト）
  overcomeStreak: 3,      // にがて かんじを なんかい つづけて せいかい したら こくふく
  hintSeconds: 2.5,       // 難易度2の「おてほん」を みせる びょう
  retryOnce: false,       // true：1かいめ の まちがい は こたえ を みせず、ダメージ だけ うけて もういちど かける（ステラクエスト）
};

const KANJI_HOOKS = {
  attackKinds: undefined, // resolveAnswer に わたす こうげき（undefined なら game.js の まほう）
  loadWeak: null,         // にがての よみこみ（null なら localStorage）
  saveWeak: null,
};

const KLIST = window.KANJI_LIST || [];
const KSTROKES = window.KANJI_STROKES || {};
const isKanji = (ch) => /[一-鿿々]/.test(ch);

// =====================================================================
//  にがて かんじ（この パソコンの ブラウザに きろく）
// =====================================================================
const WEAK_KEY = 'kanji-ken:weak';
function loadWeak() { if (KANJI_HOOKS.loadWeak) return KANJI_HOOKS.loadWeak(); try { return JSON.parse(localStorage.getItem(WEAK_KEY)) || {}; } catch { return {}; } }
function saveWeak(w) { if (KANJI_HOOKS.saveWeak) { KANJI_HOOKS.saveWeak(w); return; } try { localStorage.setItem(WEAK_KEY, JSON.stringify(w)); } catch { /* ほぞん できなくても あそべる */ } }
const weakWeight = (w) => (w && !w.overcome ? w.miss : 0);

// まちがえたら miss を ふやす。にがて かんじを つづけて せいかい したら こくふく
function recordResult(ch, ok) {
  const weak = loadWeak();
  let w = weak[ch];
  let overcame = false;
  if (!ok) {
    w = w || { miss: 0, streak: 0 };
    w.miss++; w.streak = 0; w.overcome = false;
    const d = new Date(); w.last = `${d.getMonth() + 1}/${d.getDate()}`;
  } else if (w && !w.overcome) {
    w.streak++;
    if (w.streak >= KANJI_CONFIG.overcomeStreak) { w.overcome = true; overcame = true; }
  }
  if (w) { weak[ch] = w; saveWeak(weak); }
  return overcame;
}

// =====================================================================
//  もんだい
// =====================================================================
// ことばを かんじの かたまりと かなに わけて、かんじの うえの よみを きめる
function splitWord(word, reading) {
  const segs = [];
  for (const ch of word) {
    const k = isKanji(ch);
    const last = segs[segs.length - 1];
    if (last && last.kanji === k) last.text += ch; else segs.push({ kanji: k, text: ch });
  }
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp('^' + segs.map((s) => (s.kanji ? '(.+?)' : esc(s.text))).join('') + '$').exec(reading);
  let g = 1;
  segs.forEach((s) => { if (s.kanji) s.ruby = m ? m[g++] : null; });
  return { segs, aligned: !!m };
}

// sentence: true なら みじかい ぶんの あなうめ（entry.sentence に ことばが ふくまれている とき）
function buildQuestion(entry, fromWeak = false, sentence = false) {
  const chars = [...entry.word];
  const targets = chars.map((ch, i) => (isKanji(ch) ? i : -1)).filter((i) => i >= 0);
  let sent = null;
  if (sentence && entry.sentence && entry.sentence.includes(entry.word)) {
    const i = entry.sentence.indexOf(entry.word);
    sent = { before: entry.sentence.slice(0, i), after: entry.sentence.slice(i + entry.word.length) };
  }
  return { subject: 'kanji', entry, chars, targets, step: 0, results: {}, fromWeak, sentence: sent, ...splitWord(entry.word, entry.reading) };
}

let recentWords = [];
function pickEntry(pool) {
  const fresh = pool.filter((e) => !recentWords.includes(e.word));
  const e = pick(fresh.length ? fresh : pool);
  recentWords = [e.word, ...recentWords].slice(0, Math.min(5, Math.max(0, pool.length - 1)));
  return e;
}

const curChar = (q) => q.chars[q.targets[q.step]];

function startTarget() {
  pad.strokes = []; pad.current = null; pad.reveal = null; pad.hintUntil = 0; pad.hintUsed = false;
  renderWord();
  renderPadUi();
  sizePad();
}

// かずの かんじ（一〜十・百・千）だけ の ところ は、よみがな の かわりに すうじ を だす（「に」より「2」が わかりやすい）
const KANJI_DIGIT = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function kanjiNumber(text) {
  if (!text || ![...text].every((c) => KANJI_DIGIT[c] || c === '十' || c === '百' || c === '千')) return null;
  let total = 0, cur = 0;
  for (const c of text) {
    if (KANJI_DIGIT[c]) cur = KANJI_DIGIT[c];
    else { const u = c === '十' ? 10 : c === '百' ? 100 : 1000; total += (cur || 1) * u; cur = 0; }
  }
  return total + cur;
}
function renderWord() {
  const q = S.q;
  if (!q) return;
  let idx = 0, html = '';
  for (const s of q.segs) {
    if (!s.kanji) { html += `<span class="kana">${s.text}</span>`; idx += [...s.text].length; continue; }
    let boxes = '';
    for (const ch of s.text) {
      const t = q.targets.indexOf(idx);
      const res = q.results[t];
      let cls = 'kbox', text = ch;
      if (res === 'ok') cls += ' done';
      else if (res === 'miss') cls += ' miss';
      else if (res === 'rest') cls += ' rest';
      else if (t === q.step && S.mode === 'question') { cls += ' now'; text = ''; }
      boxes += `<span class="${cls}">${res ? text : (cls.includes('now') ? '' : ch)}</span>`;
      idx++;
    }
    const num = kanjiNumber(s.text), rt = num !== null ? `<b class="num-rt">${num}</b>` : s.ruby;
    html += rt ? `<ruby><span class="run">${boxes}</span><rt>${rt}</rt></ruby>` : `<span class="run">${boxes}</span>`;
  }
  if (q.sentence) html = `<span class="sent">${q.sentence.before}</span>${html}<span class="sent">${q.sentence.after}</span>`;
  $('wordBox').classList.toggle('is-sentence', !!q.sentence);
  $('wordBox').innerHTML = (q.aligned ? '' : `<div class="whole-reading">${q.entry.reading}</div>`) + html;
}

// もんだいを だす じゅんび（guide: 'none' / 'trace'、hint: 「おてほん」ボタンを だすか）
function kanjiSetup(q, { guide = 'none', hint = false } = {}) {
  pad.guideMode = guide;
  pad.hintAvailable = hint && guide === 'none';
  startTarget();
}

// =====================================================================
//  かきとり パッド
// =====================================================================
const padCanvas = $('padCanvas');
const pctx = padCanvas.getContext('2d');
const pad = { strokes: [], current: null, guideMode: 'none', hintAvailable: false, hintUsed: false, hintUntil: 0, reveal: null, size: 300 };

function sizePad() {
  const css = padCanvas.clientWidth || 300;
  const dpr = window.devicePixelRatio || 1;
  if (padCanvas.width !== Math.round(css * dpr)) { padCanvas.width = Math.round(css * dpr); padCanvas.height = Math.round(css * dpr); }
  pad.size = css;
}
addEventListener('resize', sizePad);

const padPoint = (e) => {
  const r = padCanvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
};
padCanvas.addEventListener('pointerdown', (e) => {
  if (S.mode !== 'question' || e.button > 0) return; // ペンの ボタン・みぎクリック では かかない
  audio();
  padCanvas.setPointerCapture(e.pointerId);
  pad.current = [padPoint(e)];
  e.preventDefault();
});
padCanvas.addEventListener('pointermove', (e) => {
  if (!pad.current) return;
  const p = padPoint(e), last = pad.current[pad.current.length - 1];
  if (Math.hypot(p.x - last.x, p.y - last.y) > 0.004) pad.current.push(p);
});
const endStroke = () => {
  if (!pad.current) return;
  // ちょんと おした だけ（うごいていない）は かくに しない
  if (pad.current.length >= 2) { pad.strokes.push(pad.current); note(700 + pad.strokes.length * 40, 0, .05, { type: 'sine', vol: .05 }); }
  pad.current = null;
  renderPadUi();
};
padCanvas.addEventListener('pointerup', endStroke);
padCanvas.addEventListener('pointercancel', endStroke);

function renderPadUi() {
  $('padCount').textContent = `${pad.strokes.length}かく`;
  const q = S.q, asking = S.mode === 'question';
  $('padTitle').textContent = !q ? '' : pad.reveal ? `「${pad.reveal.ch}」の かきじゅん`
    : pad.guideMode === 'trace' ? 'うすい じを なぞって かこう' : 'ここに かんじを かいてね';
  $('undoBtn').disabled = !asking || !pad.strokes.length;
  $('clearBtn').disabled = !asking || !pad.strokes.length;
  $('okBtn').disabled = !asking || !pad.strokes.length;
  $('hintBtn').hidden = !pad.hintAvailable;
  $('hintBtn').disabled = !asking || pad.hintUsed;
}

$('undoBtn').addEventListener('click', () => eraseDigit());
$('clearBtn').addEventListener('click', () => { if (S.mode === 'question') { pad.strokes = []; renderPadUi(); } });
$('okBtn').addEventListener('click', () => submit());
$('hintBtn').addEventListener('click', () => {
  if (S.mode !== 'question' || pad.hintUsed) return;
  pad.hintUsed = true; pad.hintUntil = performance.now() + KANJI_CONFIG.hintSeconds * 1000;
  renderPadUi();
});

// Backspace / けす で 1かく もどす
function kanjiErase() {
  if (S.mode !== 'question') return;
  pad.strokes.pop(); renderPadUi();
}

const refStrokes = (ch) => (KSTROKES[ch] || []).map((arr) => {
  const pts = [];
  for (let i = 0; i < arr.length; i += 2) pts.push({ x: arr[i] / 109, y: arr[i + 1] / 109 });
  return pts;
});

function drawPolyline(c, pts, upto = 1) {
  if (!pts.length) return;
  const n = Math.max(1, Math.round((pts.length - 1) * upto));
  c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i <= n && i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.stroke();
}

function drawPad(now) {
  const W2 = padCanvas.width, c = pctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, W2, W2);
  c.save();
  c.scale(W2, W2); // 0〜1 の ざひょう
  c.lineCap = 'round'; c.lineJoin = 'round';
  // たの じの ガイド
  c.strokeStyle = '#eadff0'; c.lineWidth = 0.006; c.setLineDash([0.02, 0.02]);
  c.beginPath(); c.moveTo(0.5, 0.04); c.lineTo(0.5, 0.96); c.moveTo(0.04, 0.5); c.lineTo(0.96, 0.5); c.stroke();
  c.setLineDash([]);

  const q = S.q;
  const ch = pad.reveal ? pad.reveal.ch : q ? curChar(q) : null;
  const ref = ch ? refStrokes(ch) : [];
  // おてほん（なぞりがき・ヒント）
  const hintAlpha = pad.hintUntil > now ? Math.min(1, (pad.hintUntil - now) / 600) : 0;
  const guideAlpha = pad.reveal ? 0 : pad.guideMode === 'trace' ? 1 : hintAlpha;
  if (guideAlpha > 0 && ref.length) {
    c.globalAlpha = guideAlpha;
    c.strokeStyle = '#e4d8ee'; c.lineWidth = 0.075;
    ref.forEach((s) => drawPolyline(c, s));
    strokeNumbers(c, ref, '#b9a2d6');
    c.globalAlpha = 1;
  }
  // かいた せん
  c.strokeStyle = '#2a1838'; c.lineWidth = 0.05;
  c.globalAlpha = pad.reveal ? 0.18 : 1;
  pad.strokes.forEach((s) => drawPolyline(c, s));
  if (pad.current) drawPolyline(c, pad.current);
  c.globalAlpha = 1;
  // まちがえた ときの おてほんの かきじゅん（じゅんばんに かく）
  if (pad.reveal && ref.length) {
    const per = 0.55, total = ref.length * per + 1.2;
    const t = ((now - pad.reveal.start) / 1000) % total;
    c.strokeStyle = '#e8203c'; c.lineWidth = 0.06;
    ref.forEach((s, i) => {
      const k = Math.max(0, Math.min(1, (t - i * per) / per));
      if (k > 0) drawPolyline(c, s, k);
    });
    strokeNumbers(c, ref.filter((_, i) => t >= i * per), '#e8203c');
  }
  c.restore();
}

function strokeNumbers(c, ref, color) {
  c.font = '900 0.055px "Zen Maru Gothic", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  ref.forEach((s, i) => {
    const p = s[0];
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(p.x - 0.035, p.y - 0.035, 0.032, 0, 7); c.fill();
    c.fillStyle = color; c.fillText(String(i + 1), p.x - 0.035, p.y - 0.033);
  });
}

(function padLoop() {
  try { if (!$('writePad').hidden) drawPad(performance.now()); } catch (err) { console.error(err); }
  requestAnimationFrame(padLoop);
})();

// =====================================================================
//  はんてい：かいた せんを おてほんの せんと 1かくずつ くらべる
// =====================================================================
function resamplePts(pts, n = 24) {
  const seg = [];
  for (let i = 0; i < pts.length - 1; i++) seg.push(Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y));
  const total = seg.reduce((a, b) => a + b, 0);
  if (!total) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const out = [];
  let acc = 0, k = 0;
  for (let j = 0; j < n; j++) {
    const target = total * j / (n - 1);
    while (k < seg.length - 1 && acc + seg[k] < target) { acc += seg[k]; k++; }
    const t = seg[k] ? Math.min(1, (target - acc) / seg[k]) : 0;
    out.push({ x: pts[k].x + (pts[k + 1].x - pts[k].x) * t, y: pts[k].y + (pts[k + 1].y - pts[k].y) * t });
  }
  return out;
}

// ぜんたいの おおきさと いちを そろえる（まんなか・ながい ほうの へんが 1）
function normalize(strokes) {
  const all = strokes.flat();
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.max(maxX - minX, maxY - minY) || 1, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return strokes.map((st) => st.map((p) => ({ x: (p.x - cx) / s, y: (p.y - cy) / s })));
}

const meanDist = (a, b) => a.reduce((sum, p, i) => sum + Math.hypot(p.x - b[i].x, p.y - b[i].y), 0) / a.length;
const maxDist = (a, b) => a.reduce((m, p, i) => Math.max(m, Math.hypot(p.x - b[i].x, p.y - b[i].y)), 0);

// ---- はね：さいごの ところで するどく まがって いるか ----
// せんの 70〜86% の むき と、92%〜おわり の むき が おおきく ちがえば はね
// （まがりかど［冂 や 乙］を はね と まちがえない ように、さいごの ほうだけ みる）
function hookOf(pts, minAngle) {
  const n = pts.length, a = pts[Math.floor(n * 0.7)], b = pts[Math.floor(n * 0.86)], c = pts[Math.floor(n * 0.92)], d = pts[n - 1];
  const v1 = { x: b.x - a.x, y: b.y - a.y }, v2 = { x: d.x - c.x, y: d.y - c.y };
  const l1 = Math.hypot(v1.x, v1.y), l2 = Math.hypot(v2.x, v2.y);
  if (l1 < 0.02 || l2 < 0.008) return null;
  const cos = (v1.x * v2.x + v1.y * v2.y) / (l1 * l2);
  return cos < Math.cos(minAngle * Math.PI / 180) ? { x: v2.x / l2, y: v2.y / l2 } : null;
}

// てぶれを ならす（となりの てんと へいきん。はしは そのまま）
// かいた せん の はね：さいご の きまった ながさ（0.035）の むき が、その まえ の むき から 35ど いじょう まがっていれば はね
//   ながい たてせん の さき の みじかい はね（「子」の 2かくめ など）も みつけられる
function tailHook(pts) {
  const n = pts.length;
  if (n < 6) return null;
  const d = pts[n - 1];
  let i = n - 2, len = 0;
  while (i > 0 && len < 0.035) { len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); i--; }
  const c = pts[i], v2 = { x: d.x - c.x, y: d.y - c.y }, l2 = Math.hypot(v2.x, v2.y);
  const a = pts[Math.max(0, Math.floor(i * 0.6))], v1 = { x: c.x - a.x, y: c.y - a.y }, l1 = Math.hypot(v1.x, v1.y);
  if (l1 < 0.05 || l2 < 0.015) return null;
  const cos = (v1.x * v2.x + v1.y * v2.y) / (l1 * l2);
  return cos < Math.cos(35 * Math.PI / 180) ? { x: v2.x / l2, y: v2.y / l2 } : null;
}
function smooth(pts) {
  return pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p
    : { x: (pts[i - 1].x + p.x * 2 + pts[i + 1].x) / 4, y: (pts[i - 1].y + p.y * 2 + pts[i + 1].y) / 4 }));
}

// ---- 2つの せんの いちばん ちかい きょり（0 なら ふれている・まじわっている）----
function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
function crosses(a, b, c, d) {
  const cr = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return cr(a, b, c) * cr(a, b, d) < 0 && cr(c, d, a) * cr(c, d, b) < 0;
}
function strokeGap(A, B) {
  let m = Infinity;
  for (let i = 0; i < A.length - 1; i++) {
    for (let j = 0; j < B.length - 1; j++) if (crosses(A[i], A[i + 1], B[j], B[j + 1])) return 0;
  }
  for (const p of A) for (let j = 0; j < B.length - 1; j++) m = Math.min(m, segDist(p, B[j], B[j + 1]));
  for (const p of B) for (let i = 0; i < A.length - 1; i++) m = Math.min(m, segDist(p, A[i], A[i + 1]));
  return m;
}

// かいた せんを おてほんと くらべる。
//   かたち は ゆるめ（すこし きたない・はみだし は OK）、はね と くっつける・はなす は しっかり みる
function judgeKanji(ch, userStrokes) {
  const refRaw = refStrokes(ch);
  if (!refRaw.length) return { ok: true, note: 'nodata' };
  if (userStrokes.length !== refRaw.length) return { ok: false, reason: 'count', expected: refRaw.length, got: userStrokes.length };
  const U = normalize(userStrokes.map((s) => resamplePts(s)));
  const R = normalize(refRaw.map((s) => resamplePts(s)));
  const tol = KANJI_CONFIG.tolerance, n = R.length;
  // ① かたち：かきじゅん どおりか、じゅんばんは ちがっても かたちが あっているか
  let map = null, order = true, reversed = false; // map[おてほんの かく] = かいた かく
  const revOf = []; // revOf[おてほんの かく] = ぎゃくむきに かいた
  const close = (u, r) => meanDist(u, r) < tol && maxDist(u, r) < KANJI_CONFIG.maxDev;
  if (R.every((r, i) => close(U[i], r))) map = R.map((_, i) => i);
  else {
    const pairs = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        pairs.push({ u: i, r: j, d: meanDist(U[i], R[j]), rev: false });
        pairs.push({ u: i, r: j, d: meanDist([...U[i]].reverse(), R[j]), rev: true });
      }
    }
    pairs.sort((a, b) => a.d - b.d);
    const usedU = new Set(), usedR = new Set(), match = [];
    for (const p of pairs) {
      if (usedU.has(p.u) || usedR.has(p.r)) continue;
      usedU.add(p.u); usedR.add(p.r); match.push(p);
    }
    // かきじゅんが ちがう ときは、にた じ（川と小 など）と まちがえない ように きびしめに みる
    if (!match.every((p) => p.d < tol * KANJI_CONFIG.orderTolerance && maxDist(p.rev ? [...U[p.u]].reverse() : U[p.u], R[p.r]) < KANJI_CONFIG.maxDev)) return { ok: false, reason: 'shape' };
    if (KANJI_CONFIG.strictOrder) return { ok: false, reason: 'order' };
    map = []; match.forEach((p) => { map[p.r] = p.u; revOf[p.r] = p.rev; });
    order = false; reversed = match.some((p) => p.rev);
  }
  // こまかい ところは ふでの むきを そろえて 48てんで みる
  const uFine = normalize(userStrokes.map((s) => resamplePts(s, 48)));
  // ぎゃくむきに かいた かくは むきを もどしてから はね を みる（かきじゅんの まちがい として アドバイス だけ）
  for (let j = 0; j < n; j++) if (revOf[j]) uFine[map[j]] = [...uFine[map[j]]].reverse();
  const rFine = normalize(refRaw.map((s) => resamplePts(s, 48)));
  // ② はね
  if (KANJI_CONFIG.checkHane) {
    for (let j = 0; j < n; j++) {
      const rh = hookOf(rFine[j], 70);
      if (!rh) continue;
      const same = (h) => h && h.x * rh.x + h.y * rh.y >= 0.3; // おなじ ほうこうに はねているか
      // てぶれを ならして みる（ふつう の はね）か、さいご の ながさ で みる（ながい せん の みじかい はね）
      if (!same(hookOf(smooth(uFine[map[j]]), 35)) && !same(tailHook(uFine[map[j]]))) return { ok: false, reason: 'hane', stroke: j };
    }
  }
  const warn = [];
  // ③ くっつける・はなす（すこしの すきま・はみだし は ゆるす）
  if (KANJI_CONFIG.checkTouch) {
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const rg = strokeGap(rFine[a], rFine[b]);
        if (rg > 0.03 && rg < 0.12) continue; // おてほんでも びみょうな ところは みない
        const ug = strokeGap(uFine[map[a]], uFine[map[b]]);
        if (rg <= 0.03 && ug > 0.08) {
          if (ug <= KANJI_CONFIG.touchWarnGap) warn.push({ reason: 'touch', a, b }); // ほぼ くっついている → けいこく だけ
          else return { ok: false, reason: 'touch', a, b };
        }
        if (rg >= 0.12 && ug < 0.012) {
          if (KANJI_CONFIG.apartWarn) warn.push({ reason: 'apart', a, b });
          else return { ok: false, reason: 'apart', a, b };
        }
      }
    }
  }
  return { ok: true, order, reversed, warn };
}
window.judgeKanji = judgeKanji; // テスト よう

// ちがう かんじ を かいた とき：おなじ かくすう の かんじ の なか で、かいた かたち に あう もの を さがす
function guessKanji(strokes, notCh) {
  const n = strokes.length;
  for (const c of Object.keys(KSTROKES)) {
    if (c === notCh || KSTROKES[c].length !== n) continue;
    if (judgeKanji(c, strokes).ok) return c;
  }
  return null;
}
window.guessKanji = guessKanji; // テスト よう

// =====================================================================
//  こたえる（かきおわったら Enter / こたえる）
// =====================================================================
function kanjiSubmit() {
  if (S.mode !== 'question' || !S.q) return;
  if (!pad.strokes.length) { $('qmsg').textContent = 'かいてから こたえてね'; $('qmsg').className = 'qmsg'; return; }
  const q = S.q, ch = curChar(q);
  const res = judgeKanji(ch, pad.strokes);
  if (res.ok) {
    q.results[q.step] = 'ok';
    if (res.order === false) q.orderWarn = (q.orderWarn || []).concat(ch); // かきじゅん ちがい は けいこく だけ（せいかい）
    (res.warn || []).forEach((w) => { q.touchWarn = (q.touchWarn || []).concat(`「${ch}」の ${w.a + 1}かくめと ${w.b + 1}かくめは ${w.reason === 'touch' ? 'くっつけよう' : 'はなして かこう'}`); });
    const overcame = recordResult(ch, true);
    if (overcame) q.overcame = (q.overcame || []).concat(ch);
    if (q.step < q.targets.length - 1) {
      // つぎの じ へ
      q.step++;
      note(988, 0, .12, { type: 'sine', vol: .12 }); note(1319, .08, .15, { type: 'sine', vol: .1 });
      $('qmsg').textContent = 'いいね！ つぎの じ も かこう'; $('qmsg').className = 'qmsg good';
      startTarget();
      return;
    }
    setMode('answered');
    renderWord(); renderPadUi();
    resolveAnswer(true, '', KANJI_HOOKS.attackKinds);
    if (q.overcame) $('qmsg').textContent += ` にがて こくふく！「${q.overcame.join('・')}」`;
    if (q.orderWarn) {
      const w = document.createElement('span');
      w.className = 'order-warn';
      w.textContent = `⚠ 「${q.orderWarn.join('・')}」の かきじゅんが ちがうよ！ ただしい かきじゅんを おぼえよう`;
      $('qmsg').appendChild(w);
      note(440, 0.1, 0.15, { type: 'triangle', vol: 0.08 }); note(370, 0.25, 0.2, { type: 'triangle', vol: 0.08 }); // ピコン（けいこく）
    }
    if (q.touchWarn) { // ほぼ くっついている など：せいかい だけど けいこく
      const w = document.createElement('span');
      w.className = 'order-warn';
      w.textContent = `⚠ ${q.touchWarn.join('、')}`;
      $('qmsg').appendChild(w);
      if (!q.orderWarn) { note(440, 0.1, 0.15, { type: 'triangle', vol: 0.08 }); note(370, 0.25, 0.2, { type: 'triangle', vol: 0.08 }); }
    }
    return;
  }
  // 1かいめ の まちがい：こたえ は みせない。てき の こうげき（ダメージ）を うけて、おなじ じ を もういちど
  const m = S.monster;
  const other = guessKanji(pad.strokes, ch);
  q.otherKanji = other;
  if (KANJI_CONFIG.retryOnce && !q.retried && m && !m.nanmon && S.hp > (m.rare ? 2 : 1)) {
    q.retried = true;
    const why = other ? `それは「${other}」だね。ちがう かんじ を かいたみたい`
      : res.reason === 'count' ? `${res.expected}かく だよ（${res.got}かく かいたよ）`
      : res.reason === 'hane' ? `${res.stroke + 1}かくめは さいごを はねるよ`
        : res.reason === 'touch' ? `${res.a + 1}かくめと ${res.b + 1}かくめは くっつけよう`
          : res.reason === 'apart' ? `${res.a + 1}かくめと ${res.b + 1}かくめは はなして かこう`
            : 'かたちが すこし ちがうみたい';
    $('qmsg').textContent = `おしい！ ${why}。もういちど かいてみよう！`;
    $('qmsg').className = 'qmsg bad';
    SFX.bad();
    m.state = 'attack'; m.t = 0;
    if (m.boss) { SFX.roar(); later(0.3, SFX.breath); }
    later(m.boss ? 0.7 : 0.3, damageHero);
    later(m.boss ? 1.4 : 0.8, () => { if (S.monster === m && m.state === 'attack') { m.state = 'idle'; m.t = 0; } });
    pad.strokes = []; pad.current = null;
    renderPadUi();
    return;
  }
  recordResult(ch, false);
  q.results[q.step] = 'miss';
  for (let t = q.step + 1; t < q.targets.length; t++) q.results[t] = 'rest';
  setMode('answered');
  pad.reveal = { ch, start: performance.now() };
  renderWord(); renderPadUi();
  const why = other ? `それは「${other}」だよ。こたえは「${ch}」` : res.reason === 'count' ? `「${ch}」は ${res.expected}かく だよ（${res.got}かく かいたよ）`
    : res.reason === 'order' ? `「${ch}」の かきじゅんを たしかめよう`
      : res.reason === 'hane' ? `「${ch}」の ${res.stroke + 1}かくめは さいごを はねるよ`
        : res.reason === 'touch' ? `「${ch}」の ${res.a + 1}かくめと ${res.b + 1}かくめは くっつけよう`
          : res.reason === 'apart' ? `「${ch}」の ${res.a + 1}かくめと ${res.b + 1}かくめは はなして かこう`
            : `ただしい「${ch}」の かきかたを みてみよう`;
  resolveAnswer(false, `おしい！ ${why}`);
}
