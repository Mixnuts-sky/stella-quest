'use strict';
// =====================================================================
//  いろえんぴつ ふう：プログラムで かいた え（けしき・たてもの・めいろ・たからばこ など）を
//  ちゅなちゃんの え の ような いろえんぴつ の ふんいき に する
//    ・ぬりつぶし（fill / fillRect）の うえに えんぴつの すじ（かみの しろ が すける）を かさねる
//    ・せん（stroke）にも おなじ すじ を かさねて、かすれた せん に する
//    ・がめん ぜんたいに かみの ざらざら（#cv の うえに .paper-grain）
//  かみに かいた え（drawImage）と もじ（fillText）は そのまま。メインの #cv だけ（え の きりぬき よう の canvas には かけない）
//  けすとき：PENCIL.on = false
// =====================================================================

const PENCIL = { on: true, hatch: null, grain: null };

(function setupPencil() {
  const main = document.getElementById('cv');
  if (!main) return;
  const rnd01 = (() => { let s = 12345; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(); // まいかい おなじ もよう

  // えんぴつの すじ：ざらざらを ななめに のばした こまかい すじ（あかるい ところ＝かみ が すける、くらい ところ＝しん の あと）
  const S2 = 192, hatch = document.createElement('canvas'); hatch.width = hatch.height = S2;
  const hg = hatch.getContext('2d'), hd = hg.createImageData(S2, S2);
  const noise = new Float32Array(S2 * S2).map(() => rnd01());
  const ang = -1.0, dx = Math.cos(ang), dy = Math.sin(ang), L = 7;
  for (let y = 0; y < S2; y++) {
    for (let x = 0; x < S2; x++) {
      let sum = 0;
      for (let k = -L; k <= L; k++) {
        const sx = ((Math.round(x + dx * k) % S2) + S2) % S2, sy = ((Math.round(y + dy * k) % S2) + S2) % S2;
        sum += noise[sy * S2 + sx];
      }
      const t = (sum / (2 * L + 1) - 0.5) * 7; // すじの こさ（-1〜1 くらい）
      const i = (y * S2 + x) * 4;
      if (t > 0) { hd.data[i] = 255; hd.data[i + 1] = 255; hd.data[i + 2] = 255; hd.data[i + 3] = Math.min(125, t * 125); }
      else { hd.data[i] = 50; hd.data[i + 1] = 30; hd.data[i + 2] = 70; hd.data[i + 3] = Math.min(60, -t * 60); }
    }
  }
  hg.putImageData(hd, 0, 0);
  // かみの ざらざら（がめん ぜんたい）
  const grain = document.createElement('canvas'); grain.width = grain.height = 256;
  const gg = grain.getContext('2d'), id = gg.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const v = 200 + rnd01() * 55;
    id.data[i * 4] = v; id.data[i * 4 + 1] = v - 4; id.data[i * 4 + 2] = v - 10; id.data[i * 4 + 3] = 255;
  }
  gg.putImageData(id, 0, 0);
  const paper = document.createElement('div');
  paper.className = 'paper-grain';
  paper.style.backgroundImage = `url(${grain.toDataURL()})`;
  main.insertAdjacentElement('afterend', paper);

  // いろ が うすい（とうめい）・くらい ほど すじ を よわく（くらい ところに しろい すじ は あめ みたい に みえる）
  const probe = document.createElement('canvas').getContext('2d');
  const strength = new Map();
  const strengthOf = (style) => {
    if (typeof style !== 'string') { // グラデーション：いろの へいきん。ひろい ところ（そら など）なので うすく
      const st = style && style.pencilStops;
      return st && st.length ? 0.5 * st.reduce((x, c) => x + strengthOf(c), 0) / st.length : 0.3;
    }
    let v = strength.get(style);
    if (v !== undefined) return v;
    probe.fillStyle = '#000'; probe.fillStyle = style;
    const c = probe.fillStyle; // '#rrggbb' か 'rgba(r, g, b, a)'
    let r, g, b, a = 1;
    if (c[0] === '#') { r = parseInt(c.slice(1, 3), 16); g = parseInt(c.slice(3, 5), 16); b = parseInt(c.slice(5, 7), 16); }
    else { [r, g, b, a] = c.slice(c.indexOf('(') + 1, -1).split(',').map(Number); }
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    v = a * Math.min(1, Math.max(0.08, (lum - 40) / 150));
    if (strength.size > 2000) strength.clear();
    strength.set(style, v);
    return v;
  };

  const origAddStop = CanvasGradient.prototype.addColorStop; // グラデーションの いろ を おぼえておく
  CanvasGradient.prototype.addColorStop = function (o, color) {
    (this.pencilStops || (this.pencilStops = [])).push(color);
    return origAddStop.call(this, o, color);
  };

  const C = CanvasRenderingContext2D.prototype;
  const origFill = C.fill, origFillRect = C.fillRect, origStroke = C.stroke;
  let pattern = null, busy = false;
  // かさねる ときの こさ（0 なら かさねない）
  const amount = (ctx, style) => {
    if (!PENCIL.on || busy || ctx.canvas !== main) return 0;
    if (!pattern) pattern = ctx.createPattern(hatch, 'repeat');
    const k = strengthOf(style) * ctx.globalAlpha;
    return k < 0.06 ? 0 : k;
  };
  const over = (ctx, k, prop, draw) => {
    busy = true;
    ctx.save(); ctx[prop] = pattern; ctx.shadowColor = 'transparent'; ctx.globalAlpha = k;
    draw();
    ctx.restore(); busy = false;
  };
  C.fillRect = function (x, y, w, h) {
    origFillRect.call(this, x, y, w, h);
    if (Math.abs(w * h) < 30) return;
    const k = amount(this, this.fillStyle);
    if (k) over(this, k, 'fillStyle', () => origFillRect.call(this, x, y, w, h));
  };
  C.fill = function (...args) {
    origFill.apply(this, args);
    const k = amount(this, this.fillStyle);
    if (k) over(this, k, 'fillStyle', () => origFill.apply(this, args));
  };
  C.stroke = function (...args) {
    origStroke.apply(this, args);
    if (this.lineWidth < 1.5) return;
    const k = amount(this, this.strokeStyle);
    if (k) over(this, Math.max(k, 0.5), 'strokeStyle', () => origStroke.apply(this, args));
  };
  PENCIL.hatch = hatch; PENCIL.grain = grain;
})();
