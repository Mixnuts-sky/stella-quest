'use strict';
// =====================================================================
//  え の きりぬき（さんすう・かんじ・おんがく・タイトル きょうつう）
//  しゃしんの かみの しろい ところ・かげ・つくえ・なまえの もじ を とうめいに する
// =====================================================================
// えの きりぬき（げんこうの ピクセルで しめす）。かいてない えは ぜんたいを つかう
//   crop: [x, y, はば, たかさ]  erase: けす ところ
//   minPart: これより ちいさい かたまりは けす（いちばん おおきい かたまりに たいする わりあい）
//   sat / ratio / gap: うすい いろえんぴつの えは sat を ちいさく、ratio を おおきく、gap を おおきく
//   height: ゲームでの たかさ   mouth: くちの いち（ボスの ひ）
//   tint: しろい え を でる たびに ランダムな いろに する（いろちがい）
//   rotate: よこむきに とった しゃしんを まわす（-90: ひだりまわり、90: みぎまわり。crop・erase は まわす まえの いち）
const IMAGE_OPTIONS = {
  'IMG_3632.jpeg': { crop: [80, 14, 690, 1116], erase: [[606, 900, 200, 250]], minPart: 0.03 },
  '3にんかぞくだぶるすらいむ.jpeg': { crop: [14, 0, 600, 1025], erase: [[0, 0, 80, 360], [540, 930, 100, 120]], sat: 0.06, ratio: 0.93, gap: 5, height: 200 },
  'ぐれーぷすらいむ.jpeg': { crop: [60, 20, 640, 880], rotate: 90, height: 150 },
  'らすぼすどらぎょ.jpeg': { crop: [18, 0, 862, 960], erase: [[0, 0, 40, 290], [0, 572, 150, 430]], mouth: [175, 232] },
  'にゃんこ.jpeg': { crop: [150, 160, 670, 540], height: 115 },
  'かずぅ.jpeg': { crop: [0, 135, 980, 745], erase: [[790, 135, 190, 220], [900, 135, 80, 745], [0, 840, 120, 40]], rotate: 90, gap: 4, minPart: 0.04 },
  'みなり.jpeg': { crop: [130, 40, 560, 1000], erase: [[560, 700, 200, 400]], sat: 0.06, ratio: 0.94, gap: 5, minPart: 0.04 },
  'うぇーおー.jpeg': { crop: [100, 200, 640, 800], rotate: 90, height: 150, tint: true },
  'しまじろう.jpeg': { crop: [30, 50, 830, 920], erase: [[30, 50, 130, 360]], minPart: 0.05, height: 300 }, // まわりの しゅうちゅうせん は ちいさい かけら として けす
  'セイレーン.jpeg': { crop: [0, 0, 720, 925], rotate: -90, height: 190 },
  'にんぎょのしまのひみつ.jpeg': { rotate: -90, minPart: 0.05, height: 200 },
};

// まわり r ピクセルの いちばん おおきい（isMax）/ ちいさい あたい
function morph(src, w, h, r, isMax) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  const better = isMax ? (a, b) => (a > b ? a : b) : (a, b) => (a < b ? a : b);
  const init = isMax ? -Infinity : Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = init;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = better(m, src[y * w + k]);
      tmp[y * w + x] = m;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = init;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = better(m, tmp[k * w + x]);
      out[y * w + x] = m;
    }
  }
  return out;
}

function buildSprite(img, opt = {}) {
  if (opt.rotate) {
    // きりぬいてから まわした え を あたらしい しゃしん として あつかう
    const [rx, ry, rw, rh] = opt.crop || [0, 0, img.naturalWidth, img.naturalHeight];
    const r = document.createElement('canvas');
    r.width = rh; r.height = rw;
    const rg = r.getContext('2d');
    // erase（まわす まえの いち）は しろで ぬってから まわす
    const src = document.createElement('canvas'); src.width = rw; src.height = rh;
    const sg = src.getContext('2d');
    sg.drawImage(img, rx, ry, rw, rh, 0, 0, rw, rh);
    sg.fillStyle = '#ffffff';
    (opt.erase || []).forEach(([ex, ey, ew, eh]) => sg.fillRect(ex - rx, ey - ry, ew, eh));
    rg.translate(rh / 2, rw / 2); rg.rotate(opt.rotate * Math.PI / 180);
    rg.drawImage(src, -rw / 2, -rh / 2, rw, rh);
    return buildSprite(r, { ...opt, rotate: 0, crop: null, erase: null, mouth: null });
  }
  const [cx, cy, cw, ch] = opt.crop || [0, 0, img.naturalWidth || img.width, img.naturalHeight || img.height];
  const sc = 0.5;
  const w = Math.round(cw * sc), h = Math.round(ch * sc), n = w * h;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.drawImage(img, cx, cy, cw, ch, 0, 0, w, h);
  const id = g.getImageData(0, 0, w, h), d = id.data;

  const lum = new Float32Array(n), sat = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    lum[i] = r * 0.299 + gg * 0.587 + b * 0.114;
    sat[i] = mx ? (mx - mn) / mx : 0;
  }
  // かみの あかるさ（しゃしんの かみは すこし はいいろ）
  // erase で しろく ぬった ところ（まっしろ）は かぞえない
  const sorted = Float32Array.from(lum.filter((v) => v < 253)).sort();
  const paper = Math.max(1, sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : 255);
  // かげが あっても せんを みつけられるように、まわりの かみの あかるさと くらべる
  const bg = morph(morph(lum, w, h, 10, true), w, h, 10, false);
  const ink = new Float32Array(n);
  const satTh = opt.sat ?? 0.12, ratioTh = opt.ratio ?? 0.88;
  for (let i = 0; i < n; i++) {
    ink[i] = (sat[i] > satTh || lum[i] < paper * 0.55 || lum[i] / Math.max(bg[i], 1) < ratioTh) ? 1 : 0;
  }
  const wall = morph(ink, w, h, opt.gap ?? 3, true); // せんの すきまを ふさぐ

  // そとがわから かみを ぬりつぶして さがす
  const isBg = new Uint8Array(n);
  const stack = new Int32Array(n); let sp = 0;
  const push = (i) => { if (!isBg[i] && !wall[i]) { isBg[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const i = stack[--sp], x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < n - w) push(i + w);
  }

  // erase の ばしょ（つくえ・もじ・かげ）を けす
  (opt.erase || []).forEach(([ex, ey, ew, eh]) => {
    const ax = Math.max(0, Math.round((ex - cx) * sc)), bx = Math.min(w, Math.round((ex + ew - cx) * sc));
    const ay = Math.max(0, Math.round((ey - cy) * sc)), by = Math.min(h, Math.round((ey + eh - cy) * sc));
    for (let y = ay; y < by; y++) for (let x = ax; x < bx; x++) isBg[y * w + x] = 1;
  });

  // もじや ごみ（ちいさい かたまり）を けす
  {
    const label = new Int32Array(n).fill(-1);
    const areas = [];
    for (let s = 0; s < n; s++) {
      if (isBg[s] || label[s] >= 0) continue;
      const id2 = areas.length; let area = 0;
      label[s] = id2; stack[sp++] = s;
      while (sp) {
        const i = stack[--sp], x = i % w; area++;
        const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < n - w ? i + w : -1];
        for (const j of nb) if (j >= 0 && !isBg[j] && label[j] < 0) { label[j] = id2; stack[sp++] = j; }
      }
      areas.push(area);
    }
    const big = areas.reduce((a, b) => Math.max(a, b), 0);
    const minPart = opt.minPart ?? 0.12;
    for (let i = 0; i < n; i++) if (!isBg[i] && areas[label[i]] < big * minPart) isBg[i] = 1;
  }

  // はいいろの かみを しろく する（こい せんは こいまま）
  const curve = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) curve[v] = 255 * Math.pow(Math.min(1, v / paper), 1.5);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let i = 0; i < n; i++) {
    if (isBg[i]) { d[i * 4 + 3] = 0; continue; }
    for (let k = 0; k < 3; k++) d[i * 4 + k] = curve[d[i * 4 + k]];
    const x = i % w, y = (i / w) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  g.putImageData(id, 0, 0);
  if (x1 <= x0 || y1 <= y0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);

  // あたったときに ひかる しろい かげえ
  const white = document.createElement('canvas');
  white.width = out.width; white.height = out.height;
  const wg = white.getContext('2d');
  wg.drawImage(out, 0, 0); wg.globalCompositeOperation = 'source-in'; wg.fillStyle = '#ffffff'; wg.fillRect(0, 0, white.width, white.height);

  const toLocal = ([X, Y]) => ({ x: ((X - cx) * sc - x0) / out.width, y: ((Y - cy) * sc - y0) / out.height });
  return { canvas: out, white, w: out.width, h: out.height, height: opt.height, tint: !!opt.tint, mouth: opt.mouth ? toLocal(opt.mouth) : null };
}

// いろちがい：しろい ところに いろを かける（せんは くろいまま）
const TINTS = [
  { name: 'あか', color: '#ff7a7a' }, { name: 'あお', color: '#6fa8ff' }, { name: 'みどり', color: '#6fdc8c' },
  { name: 'きいろ', color: '#ffd84a' }, { name: 'ピンク', color: '#ff9ad5' }, { name: 'むらさき', color: '#b98aff' },
  { name: 'オレンジ', color: '#ffad5a' }, { name: 'みずいろ', color: '#7fe3f0' },
];
function tintSprite(spr, color) {
  const c = document.createElement('canvas'); c.width = spr.w; c.height = spr.h;
  const g = c.getContext('2d');
  g.drawImage(spr.canvas, 0, 0);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(spr.canvas, 0, 0);
  return { ...spr, canvas: c };
}

function loadImage(item) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const s = buildSprite(img, IMAGE_OPTIONS[item.file] || {});
        s.name = item.name;
        resolve(s);
      } catch (err) { console.error(item.file, err); resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = item.src;
  });
}
