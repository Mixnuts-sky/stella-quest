'use strict';
// =====================================================================
//  ステラクエスト：まほう
//  ・ふつうの こうげき：もんだいの しゅるい（さんすう・かんじ・おんがく）× こうげきりょく で 21しゅるい
//      こうげきりょく 1 / 2 / 3 / 4 / 5 / 6 / 10（7〜9 は 6、10いじょう は 10 と おなじ）
//  ・ボスの とどめ（がったい わざ）：こうげきりょく で 7しゅるい。
//      その ボスせん で せいかい した「すうじ・かんじ・おんぷ」（1しゅるい 1つ）が まわって とんでいく
//  game.js の cast（ふつうの こうげき）と startCharge（とどめ）を ステラの たたかい だけ さしかえる。
//  えんしゅつ は FX（じぶんで うごいて じぶんで かく もの）。hitAt で onHit（ダメージ）を よぶ。
//  しよう：docs/GAME_SPEC.md「9.5 まほう」
// =====================================================================

// こうげきりょく → だんかい 1〜7（1・2・3・4・5・6・10）
const atkLevel = (atk) => (atk >= 10 ? 7 : Math.max(1, Math.min(6, atk)));
const SPELL_NAMES = { // ' ' で ふきだしの ぎょうを わける
  math: ['ナンバー ボール', 'プラス フレア', 'マイナス アクア', 'プラマイ サンダー', 'プラマイナンバー エクスプロージョン', 'ナンバー ストーム', 'インフィニティ ゼロ'],
  kanji: ['火炎', '水爆', '雷鳴', '木霊', '元素融合', '光龍', '天地創造'],
  english: ['エービーシー ショット', 'フォニックス ボム', 'スペル スパーク', 'ワード ストーム', 'レター エクスプロージョン', 'アルファベット ギャラクシー', 'ワールド フィナーレ'],
  music: ['ドレミ ショット', 'リズム サークル', 'メロディ フレア', 'ドレミ ストーム', 'ハーモニー ベル', 'スター シンフォニー', 'レインボー フィナーレ'],
};
const MIRACLE_NAMES = ['ミラクル・ショット', 'ミラクル・フォール', 'ミラクル・ストーム', 'ミラクル・スター', 'ミラクル・レインボー', 'ミラクル・ワンダーランド', 'ミラクル・フィナーレ'];
const SUBJ_COLOR = { math: '#ff5a8a', kanji: '#3a7fe0', music: '#b06aff', english: '#14a38a' };

// ---------------------------------------------------------------------
//  FX：じぶんで うごいて かく えんしゅつ
// ---------------------------------------------------------------------
const FX = [];
function addFx(o) { o.t = 0; o.hit = false; FX.push(o); return o; }
// あたらしい たたかい では、まえの たたかい の のこり（とちゅう で でた とき の まほう）を けす
const baseEncounterFx = encounter;
encounter = function (opts) { FX.length = 0; spells.length = 0; document.body.classList.remove('miracle'); return baseEncounterFx(opts); };
const baseStepSpellsFx = stepSpells;
stepSpells = function (dt) {
  baseStepSpellsFx(dt);
  for (let i = FX.length - 1; i >= 0; i--) {
    const f = FX[i];
    f.t += dt;
    if (f.update) f.update(dt, f);
    if (!f.hit && f.hitAt !== undefined && f.t >= f.hitAt) {
      f.hit = true;
      if (f.onImpact) f.onImpact(f);
      if (S.monster) S.monster.hitFlash = 1;
      if (f.onHit) f.onHit();
    }
    if (f.t >= f.dur) { FX.splice(i, 1); if (f.end) f.end(f); }
  }
};
const baseDrawSpellsFx = drawSpells;
drawSpells = function () {
  baseDrawSpellsFx();
  for (const f of FX) { ctx.save(); f.draw(f); ctx.restore(); }
};

// ---------------------------------------------------------------------
//  かく どうぐ
// ---------------------------------------------------------------------
const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const ph = (t, a, b) => clamp01((t - a) / (b - a)); // t が a→b の あいだ 0→1
const arcPos = (p, q, k, h) => ({ x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k) - Math.sin(k * Math.PI) * h });
const FONT = '"Dela Gothic One", "Zen Maru Gothic", sans-serif';

function glowText(text, x, y, size, color, glowColor = color, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `900 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = glowColor; ctx.shadowBlur = size * 0.6;
  ctx.lineWidth = Math.max(3, size * 0.12); ctx.strokeStyle = '#fff';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
  ctx.restore();
}
function glowAt(x, y, color, r) { ctx.save(); ctx.translate(x, y); glow(color, r); ctx.restore(); }
function chime(freqs, step = 0.08, opt = {}) { freqs.forEach((f, i) => note(f, i * step, opt.dur || 0.25, { type: opt.type || 'sine', vol: opt.vol || 0.1 })); }
const hsl = (h, l = 62) => `hsl(${((h % 360) + 360) % 360},95%,${l}%)`;
const sayName = (name, color, sub) => { S.heroSay = { lines: name.split(' '), color, t: 0, dur: 1.9, sub: sub || null, subColor: color }; };
// わざの まえ に だす「レベル」と「まほうの しゅるい」（つよく なったら どう なるか たのしみに なる ように）
//   こうげきりょく 1〜5 → レベル1〜5、6 → きゅうきょく、10 → しゅうえん
const SPELL_KIND = { math: 'すうじまほう', kanji: 'もじまほう', music: 'おとまほう', english: 'えいごまほう', miracle: 'がったいまほう' };
const spellRank = (lv, kind) => `${lv >= 7 ? 'しゅうえん' : lv === 6 ? 'きゅうきょく' : `レベル${lv}`} ${SPELL_KIND[kind]}`;
function boomFx(x, y, color, n = 24) {
  for (let i = 0; i < n; i++) spawn('star', x, y, { vx: rnd(-380, 380), vy: rnd(-420, 120), size: rnd(10, 22), color });
  S.shake = Math.max(S.shake, 0.6);
}
// かんじが うかぶ（つえの うえ）
function drawSign(text, t, color, until = 0.55) {
  const tip = staffTip(), k = ph(t, 0, 0.3), out = ph(t, until, until + 0.25);
  const size = 70 * (0.5 + 0.5 * ease(k)) * (1 + out * 0.4);
  glowAt(tip.x, tip.y - 110, color, 90 * k);
  glowText(text, tip.x, tip.y - 110 - out * 20, size, color, color, k * (1 - out));
}
// おんぷ
function drawNote(x, y, size, color, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  glowText('♪', 0, 0, size, color);
  ctx.restore();
}

// ---------------------------------------------------------------------
//  さんすうの まほう
// ---------------------------------------------------------------------
function mathSpell(lv, onHit) {
  const from = staffTip(), to = enemyCenter(), q = S.q || {};
  if (lv === 1) { // ナンバーボール：ひかる すうじが あつまって たまに なって とぶ
    const digits = String(q.ans !== undefined ? q.ans : rnd(0, 99)).split('').concat(['1', '2', '3', '5', '8', '0', '7']).slice(0, 9);
    const parts = digits.map((d, i) => ({ d, a: (i / digits.length) * Math.PI * 2, r: rnd(100, 160), hue: i * 40 }));
    chime([660, 880, 1046, 1318], 0.07);
    return addFx({ hitAt: 0.95, dur: 1.35, onHit,
      onImpact: () => { boomFx(to.x, to.y, '#ffe27a', 20); SFX.star(); },
      draw: (f) => {
        const k1 = ease(ph(f.t, 0, 0.5));
        if (f.t < 0.5) parts.forEach((p) => glowText(p.d, lerp(from.x + Math.cos(p.a + f.t * 3) * p.r, from.x, k1), lerp(from.y + Math.sin(p.a + f.t * 3) * p.r, from.y - 20, k1), 30, hsl(p.hue)));
        else if (!f.hit) {
          const p = arcPos({ x: from.x, y: from.y - 20 }, to, ph(f.t, 0.5, 0.95), 70);
          glowAt(p.x, p.y, '#ffe27a', 70);
          ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, 7); ctx.fill();
          parts.slice(0, 4).forEach((d, i) => glowText(d.d, p.x + Math.cos(f.t * 9 + i * 1.6) * 16, p.y + Math.sin(f.t * 9 + i * 1.6) * 16, 18, '#ff7a2a', '#fff'));
        } else { // すうじが はじける
          const k = ph(f.t, 0.95, 1.35);
          parts.forEach((p) => glowText(p.d, to.x + Math.cos(p.a) * 160 * k, to.y + Math.sin(p.a) * 160 * k, 26, hsl(p.hue), hsl(p.hue), 1 - k));
        }
      } });
  }
  if (lv === 2 || lv === 3) { // 2：プラスフレア（＋の ほのお）/ 3：マイナスアクア（−の みず）
    const plus = lv === 2;
    plus ? SFX.fire() : SFX.water();
    return addFx({ hitAt: 0.65, dur: 1.0, onHit,
      update: (dt, f) => {
        if (f.hit || !f.p) return;
        if (plus) for (let i = 0; i < 3; i++) spawn('ember', f.p.x, f.p.y, { vx: rnd(-80, 20), vy: rnd(-100, -10) });
        else if (Math.random() < 0.8) spawn('drop', f.p.x, f.p.y, { vx: rnd(-80, 0), vy: rnd(-50, 50) });
      },
      onImpact: () => {
        for (let i = 0; i < 30; i++) spawn(plus ? 'ember' : 'drop', to.x, to.y, { vx: rnd(-300, 300), vy: rnd(-340, 100), size: rnd(8, 16) });
        S.flash = 0.4; S.flashColor = plus ? '255,140,90' : '140,200,255'; S.shake = Math.max(S.shake, 0.4);
      },
      draw: (f) => {
        if (f.hit) return;
        const p = f.p = arcPos(from, to, ease(ph(f.t, 0, 0.65)), 60);
        ctx.translate(p.x, p.y); ctx.rotate(f.t * 8);
        glow(plus ? '#ff6a2a' : '#55a8ff', 70);
        const L = 34, w = 14;
        ctx.fillStyle = plus ? '#ff3b2f' : '#2f7dff';
        ctx.fillRect(-L, -w / 2 - 3, L * 2, w + 6);
        if (plus) ctx.fillRect(-w / 2 - 3, -L, w + 6, L * 2);
        ctx.fillStyle = plus ? '#ffd84a' : '#bfe6ff';
        ctx.fillRect(-L + 6, -w / 2 + 2, L * 2 - 12, w - 4);
        if (plus) ctx.fillRect(-w / 2 + 2, -L + 6, w - 4, L * 2 - 12);
      } });
  }
  if (lv === 4) { // プラマイ サンダー：＋と−が そらで あわさって かみなり に なって おちる
    let bolt = [], last = 0;
    const top = { x: to.x, y: 40 };
    const makeBolt = () => { bolt = [{ x: top.x, y: top.y }]; for (let y = top.y; y < to.y; y += 36) bolt.push({ x: to.x + rnd(-40, 40) * (1 - y / to.y), y }); bolt.push({ x: to.x, y: to.y }); };
    later(0.7, () => { noise(0, 0.45, 0.3, 2600); note(70, 0, 0.5, { type: 'sawtooth', vol: 0.14 }); });
    return addFx({ hitAt: 0.75, dur: 1.25, onHit,
      onImpact: () => { S.flash = 0.85; S.flashColor = '255,255,210'; S.shake = 0.8; for (let i = 0; i < 24; i++) spawn('star', to.x, to.y, { vx: rnd(-300, 300), vy: rnd(-360, 60), size: rnd(8, 16), color: pick(['#ff7a5a', '#7ab8ff', '#fff27a']) }); },
      draw: (f) => {
        if (f.t < 0.6) { // ＋と−が そらへ のぼる
          const k = ease(ph(f.t, 0, 0.55));
          const a = arcPos(from, { x: top.x - 40 * (1 - k), y: top.y }, k, 60), b = arcPos(from, { x: top.x + 40 * (1 - k), y: top.y }, k, -20);
          glowText('＋', a.x, a.y, 56, '#ff3b2f', '#ffb04a');
          glowText('−', b.x, b.y, 56, '#2f7dff', '#9fd4ff');
          return;
        }
        if (f.t < 0.72) { glowAt(top.x, top.y, '#fff7a0', 90 * ph(f.t, 0.6, 0.72)); return; } // あわさって ひかる
        if (f.t > 1.15) return;
        if (f.t - last > 0.05) { makeBolt(); last = f.t; }
        ctx.globalAlpha = 1 - ph(f.t, 0.95, 1.15);
        ctx.shadowColor = '#fff7a0'; ctx.shadowBlur = 30; ctx.lineJoin = 'round';
        [[16, '#c08aff'], [6, '#ffffff']].forEach(([w, c]) => {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); bolt.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
        });
      } });
  }
  if (lv === 5) { // プラマイナンバー エクスプロージョン：＋と−と こたえた すうじ が あわさって ばくはつ
    const digits = String(q.ans !== undefined ? q.ans : rnd(1, 99));
    SFX.fire(); later(0.1, SFX.water);
    return addFx({ hitAt: 0.8, dur: 1.45, onHit,
      onImpact: () => { boomFx(to.x, to.y, '#ffd84a', 34); S.flash = 0.7; S.flashColor = '255,240,200'; SFX.boom(); },
      draw: (f) => {
        if (f.t < 0.75) {
          const k = ease(ph(f.t, 0, 0.75));
          const a = arcPos(from, to, k, 160), b = arcPos(from, to, k, -110);
          glowText('＋', a.x, a.y, 64, '#ff3b2f', '#ffb04a');
          glowText('−', b.x, b.y, 64, '#2f7dff', '#9fd4ff');
          const c = arcPos(from, to, k, 40);
          glowText(digits, c.x, c.y, 54, '#ffb000', '#fff3a0');
        } else { // ばくはつの わ
          const k = ph(f.t, 0.75, 1.45);
          ctx.globalAlpha = 1 - k;
          glowAt(to.x, to.y, '#fff3c0', 60 + 200 * k);
          ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 14 * (1 - k) + 2;
          ctx.beginPath(); ctx.arc(to.x, to.y, 40 + 220 * k, 0, 7); ctx.stroke();
          ctx.strokeStyle = '#ff7ab0'; ctx.beginPath(); ctx.arc(to.x, to.y, 20 + 150 * k, 0, 7); ctx.stroke();
        }
      } });
  }
  if (lv === 6) { // ナンバー ストーム：0〜9 の たつまき
    noise(0, 1.2, 0.08, 500);
    return addFx({ hitAt: 0.95, dur: 1.5, onHit,
      onImpact: () => { boomFx(to.x, to.y, '#bff', 24); S.flash = 0.4; S.flashColor = '200,240,255'; },
      draw: (f) => {
        const k = ease(ph(f.t, 0, 0.9)), cx = lerp(from.x + 40, to.x, k), base = GROUND();
        const fade = 1 - ph(f.t, 1.15, 1.5);
        for (let i = 0; i < 30; i++) {
          const h = i / 30, a = f.t * 10 + i * 0.9, r = 20 + h * 90;
          const x = cx + Math.cos(a) * r, y = base - 20 - h * 260, depth = (Math.sin(a) + 1.4) / 2.4;
          glowText(String(i % 10), x, y, 18 + depth * 16, hsl(190 + i * 6, 60), '#fff', fade * (0.4 + 0.6 * depth));
        }
      } });
  }
  // インフィニティ ゼロ：たくさんの ∞ が りゅうせい に なって おちる
  const meteors = Array.from({ length: 16 }, (_, i) => ({ s: i * 0.06, x0: to.x + rnd(200, 520), y0: -rnd(60, 200), dx: rnd(-70, 70), dy: rnd(-60, 60), hue: i * 23 }));
  chime([523, 659, 784, 1046, 1318, 1568], 0.09, { vol: 0.08 });
  return addFx({ hitAt: 1.3, dur: 1.8, onHit,
    onImpact: () => { boomFx(to.x, to.y, '#fff3a0', 40); S.flash = 0.85; S.flashColor = '255,250,220'; SFX.boom(); },
    draw: (f) => meteors.forEach((m) => {
      const k = ph(f.t, m.s, m.s + 0.45);
      if (k <= 0 || k >= 1) { if (k >= 1 && f.t < m.s + 0.7) glowAt(to.x + m.dx, to.y + m.dy, hsl(m.hue), 60 * (1 - ph(f.t, m.s + 0.45, m.s + 0.7))); return; }
      const x = lerp(m.x0, to.x + m.dx, k), y = lerp(m.y0, to.y + m.dy, k);
      ctx.strokeStyle = hsl(m.hue, 75); ctx.lineWidth = 5; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (m.x0 - x) * 0.25, y + (m.y0 - y) * 0.25); ctx.stroke();
      ctx.globalAlpha = 1;
      glowText('∞', x, y, 40, hsl(m.hue), '#fff');
    }) });
}

// ---------------------------------------------------------------------
//  かんじの まほう：もじが うかんで から まほう
// ---------------------------------------------------------------------
function kanjiSpell(lv, onHit) {
  const from = staffTip(), to = enemyCenter(), m = S.monster;
  chime([784, 1046], 0.12, { vol: 0.08 });
  if (lv === 1) { // 火炎：ひ の もじ → おおきな ひの たま
    later(0.5, SFX.fire);
    return addFx({ hitAt: 1.05, dur: 1.4, onHit,
      update: (dt, f) => { if (f.p && !f.hit) for (let i = 0; i < 4; i++) spawn('ember', f.p.x, f.p.y, { vx: rnd(-90, 30), vy: rnd(-110, -10), size: rnd(8, 14) }); },
      onImpact: () => { for (let i = 0; i < 40; i++) spawn('ember', to.x, to.y, { vx: rnd(-320, 320), vy: rnd(-360, 120), size: rnd(10, 18) }); S.flash = 0.45; S.flashColor = '255,140,90'; S.shake = 0.5; },
      draw: (f) => {
        drawSign('火', f.t, '#ff3b2f');
        if (f.t < 0.55 || f.hit) return;
        const p = f.p = arcPos({ x: from.x, y: from.y - 110 }, to, ease(ph(f.t, 0.55, 1.05)), 40);
        ctx.translate(p.x, p.y);
        const fl = 1 + Math.sin(S.t * 50) * 0.1;
        glow('#ff6a2a', 80 * fl);
        ctx.fillStyle = '#ff3b2f'; blob(44 * fl); ctx.fillStyle = '#ffa53a'; blob(30 * fl); ctx.fillStyle = '#fff1a6'; blob(14 * fl);
      } });
  }
  if (lv === 2) { // 水爆：みず の もじ → みずの ばくはつ
    later(0.5, SFX.water);
    return addFx({ hitAt: 0.95, dur: 1.6, onHit,
      onImpact: () => { for (let i = 0; i < 50; i++) spawn('drop', to.x, to.y, { vx: rnd(-380, 380), vy: rnd(-460, 80), size: rnd(6, 12) }); S.flash = 0.45; S.flashColor = '140,200,255'; S.shake = 0.6; SFX.boom(); },
      draw: (f) => {
        drawSign('水', f.t, '#2f7dff');
        if (f.t < 0.55) return;
        if (!f.hit) {
          const p = arcPos({ x: from.x, y: from.y - 110 }, to, ease(ph(f.t, 0.55, 0.95)), 30);
          glowAt(p.x, p.y, '#55a8ff', 60);
          ctx.fillStyle = '#2f7dff'; ctx.beginPath(); ctx.arc(p.x, p.y, 28, 0, 7); ctx.fill();
          ctx.fillStyle = '#bfe6ff'; ctx.beginPath(); ctx.arc(p.x - 7, p.y - 7, 10, 0, 7); ctx.fill();
          return;
        }
        const k = ph(f.t, 0.95, 1.6);
        ctx.globalAlpha = 1 - k;
        [0, 0.15, 0.3].forEach((d) => {
          const kk = clamp01(k - d);
          ctx.strokeStyle = '#55a8ff'; ctx.lineWidth = 12 * (1 - kk) + 2;
          ctx.beginPath(); ctx.ellipse(to.x, to.y, 40 + 230 * kk, 20 + 120 * kk, 0, 0, 7); ctx.stroke();
        });
        glowAt(to.x, to.y, '#bfe6ff', 200 * (1 - k));
      } });
  }
  if (lv === 3) { // 雷鳴：かみなり が おちる
    let bolt = [], last = 0;
    const makeBolt = () => { bolt = [{ x: to.x + rnd(-30, 30), y: -40 }]; for (let y = 0; y < to.y; y += 40) bolt.push({ x: to.x + rnd(-45, 45) * (1 - y / to.y), y }); bolt.push({ x: to.x, y: to.y }); };
    later(0.6, () => { noise(0, 0.5, 0.35, 2600); note(60, 0, 0.6, { type: 'sawtooth', vol: 0.15 }); });
    return addFx({ hitAt: 0.65, dur: 1.25, onHit,
      onImpact: () => { S.flash = 0.9; S.flashColor = '255,255,210'; S.shake = 0.9; for (let i = 0; i < 26; i++) spawn('star', to.x, to.y, { vx: rnd(-300, 300), vy: rnd(-360, 60), size: rnd(8, 16), color: '#fff27a' }); },
      draw: (f) => {
        drawSign('雷', f.t, '#e0a800');
        if (f.t < 0.6 || f.t > 1.1) return;
        if (f.t - last > 0.05) { makeBolt(); last = f.t; }
        ctx.globalAlpha = 1 - ph(f.t, 0.9, 1.1);
        ctx.shadowColor = '#fff7a0'; ctx.shadowBlur = 30; ctx.lineJoin = 'round';
        [[16, '#fff27a'], [6, '#ffffff']].forEach(([w, c]) => {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); bolt.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
        });
      } });
  }
  if (lv === 4) { // 木霊：き の せいれい が てきを つつむ
    const spirits = Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * Math.PI * 2, s: i * 0.05 }));
    later(0.55, () => chime([392, 494, 587, 784], 0.1, { type: 'triangle', vol: 0.1 }));
    return addFx({ hitAt: 1.25, dur: 1.65, onHit,
      update: (dt, f) => { if (f.t > 0.9 && f.t < 1.4 && Math.random() < 0.6) spawn('leaf', to.x + rnd(-90, 90), to.y + rnd(-90, 90), { vx: rnd(-80, 80), vy: rnd(-80, 40) }); },
      onImpact: () => { for (let i = 0; i < 30; i++) spawn('leaf', to.x, to.y, { vx: rnd(-300, 300), vy: rnd(-320, 80) }); S.flash = 0.4; S.flashColor = '180,255,190'; S.shake = 0.4; },
      draw: (f) => {
        drawSign('木', f.t, '#2f9c4a');
        if (f.t < 0.55) return;
        const wrap = ph(f.t, 0.95, 1.3), fade = 1 - ph(f.t, 1.3, 1.65);
        spirits.forEach((sp) => { // まるい せいれい（め と はっぱ）
          const k = ease(ph(f.t, 0.55 + sp.s, 0.95 + sp.s)), a = sp.a + f.t * 4, r = 110 * (1 - wrap * 0.5);
          const goal = { x: to.x + Math.cos(a) * r, y: to.y + Math.sin(a) * r * 0.7 };
          const p = k < 1 ? arcPos({ x: from.x, y: from.y - 110 }, goal, k, 60) : goal;
          ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y);
          glow('#9fe8a0', 34);
          ctx.fillStyle = '#7fd67f'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill();
          ctx.fillStyle = '#3a7a3a'; ctx.beginPath(); ctx.arc(-5, -2, 2.5, 0, 7); ctx.arc(5, -2, 2.5, 0, 7); ctx.fill();
          ctx.fillStyle = '#4fbf4f'; ctx.beginPath(); ctx.ellipse(4, -18, 5, 9, 0.5, 0, 7); ctx.fill();
          ctx.restore();
        });
        if (wrap > 0) { // つる が まきつく
          ctx.globalAlpha = fade; ctx.strokeStyle = '#3fae4f'; ctx.lineWidth = 6;
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(to.x, to.y - 40 + i * 40, 90 - wrap * 20, 26, 0, f.t * 3 + i, f.t * 3 + i + Math.PI * 1.6 * wrap); ctx.stroke(); }
        }
      } });
  }
  if (lv === 5) { // 元素融合：火・水・雷・木 が まざりあって だいばくはつ
    const els = [['火', '#ff3b2f'], ['水', '#2f7dff'], ['雷', '#e0a800'], ['木', '#2f9c4a']];
    chime([523, 659, 784, 988], 0.1, { vol: 0.08 });
    later(1.0, () => note(90, 0, 0.8, { type: 'sawtooth', vol: 0.12, vib: 4 }));
    return addFx({ hitAt: 1.05, dur: 1.75, onHit,
      onImpact: () => { boomFx(to.x, to.y, '#ffffff', 36); els.forEach(([, c]) => { for (let i = 0; i < 10; i++) spawn('star', to.x, to.y, { vx: rnd(-420, 420), vy: rnd(-460, 160), size: rnd(10, 20), color: c }); }); S.flash = 0.9; S.flashColor = '255,255,240'; SFX.boom(); },
      draw: (f) => {
        const tip = staffTip();
        if (f.t < 1.0) {
          const appear = ph(f.t, 0, 0.3), k = ease(ph(f.t, 0.35, 1.0));
          els.forEach(([ch, c], i) => {
            const a = (i / 4) * Math.PI * 2 + f.t * (3 + k * 6), r = 80 * (1 - k) + 10;
            const cx = lerp(tip.x, to.x, k), cy = lerp(tip.y - 110, to.y, k) - Math.sin(k * Math.PI) * 60;
            glowText(ch, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 46 + k * 10, c, c, appear);
          });
          return;
        }
        const e = ph(f.t, 1.0, 1.75);
        ctx.globalAlpha = 1 - e;
        els.forEach(([, c], i) => { ctx.strokeStyle = c; ctx.lineWidth = 12 * (1 - e) + 2; ctx.beginPath(); ctx.arc(to.x, to.y, 40 + (180 + i * 50) * e, 0, 7); ctx.stroke(); });
        glowAt(to.x, to.y, '#ffffff', 100 + 260 * e);
      } });
  }
  if (lv === 6) { // 光龍：きんいろの りゅう が てきを つらぬく
    const path = (s) => ({ x: lerp(from.x - 60, W + 260, s), y: to.y - 120 * Math.sin(s * Math.PI * 2.2) * (1 - s * 0.6) - 40 * (1 - s) });
    const sHit = (to.x - (from.x - 60)) / (W + 260 - (from.x - 60));
    const head = (t) => ease(ph(t, 0.55, 1.6));
    let hitT = 0.55; for (let t = 0.55; t < 1.6; t += 0.01) if (head(t) >= sHit) { hitT = t; break; }
    later(0.55, () => chime([392, 523, 659, 784, 1046], 0.06, { type: 'triangle', vol: 0.1 }));
    return addFx({ hitAt: hitT, dur: 1.9, onHit,
      onImpact: () => { boomFx(to.x, to.y, '#ffd84a', 30); S.flash = 0.6; S.flashColor = '255,236,150'; },
      draw: (f) => {
        drawSign('光', f.t, '#e0a800');
        if (f.t < 0.55) return;
        const h = head(f.t), fade = 1 - ph(f.t, 1.6, 1.9);
        for (let i = 22; i >= 0; i--) {
          const s = h - i * 0.022; if (s < 0) continue;
          const p = path(s), r = (i === 0 ? 34 : 26 - i * 0.8);
          ctx.globalAlpha = fade;
          glowAt(p.x, p.y, '#ffe27a', r * 2.2);
          ctx.fillStyle = i % 2 ? '#ffd84a' : '#fff3a0'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(6, r), 0, 7); ctx.fill();
          if (i === 0) { // あたま：つの と め
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x + 12, p.y - 8, 6, 0, 7); ctx.fill();
            ctx.fillStyle = '#c2410c'; ctx.beginPath(); ctx.arc(p.x + 13, p.y - 8, 3, 0, 7); ctx.fill();
            ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p.x - 6, p.y - 26); ctx.lineTo(p.x - 26, p.y - 54); ctx.moveTo(p.x + 6, p.y - 28); ctx.lineTo(p.x + 2, p.y - 60); ctx.stroke();
          }
        }
      } });
  }
  // 天地創造：そら と だいち から ひかり が ばくはつ
  later(0.55, () => note(110, 0, 1.2, { type: 'sawtooth', vol: 0.1, vib: 4 }));
  return addFx({ hitAt: 1.1, dur: 1.9, onHit,
    onImpact: () => { boomFx(to.x, to.y, '#ffffff', 40); for (let i = 0; i < 60; i++) spawn('rainbow', to.x, to.y, { vx: rnd(-500, 500), vy: rnd(-500, 300), hue: rnd(0, 360) }); S.flash = 1; S.flashColor = '255,255,240'; SFX.boom(); },
    draw: (f) => {
      drawSign('天地', f.t, '#8a5cd1', 0.6);
      if (f.t < 0.6) return;
      const k = ease(ph(f.t, 0.6, 1.1)), gy = GROUND();
      const beam = (y0, y1, w, c) => { const g = ctx.createLinearGradient(to.x - w, 0, to.x + w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, c); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(to.x - w, Math.min(y0, y1), w * 2, Math.abs(y1 - y0)); };
      if (f.t < 1.1) {
        beam(-30, lerp(-30, to.y, k), 50, 'rgba(255,250,200,.9)');
        beam(gy + 40, lerp(gy + 40, to.y, k), 50, 'rgba(200,255,220,.9)');
      } else {
        const e = ph(f.t, 1.1, 1.9);
        ctx.globalAlpha = 1 - e;
        glowAt(to.x, to.y, '#ffffff', 120 + 400 * e);
        ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(to.x, to.y, 60 + 360 * e, 0, 7); ctx.stroke();
      }
    } });
}

// ---------------------------------------------------------------------
//  おんがくの まほう
// ---------------------------------------------------------------------
const NOTE_HZ = [523, 587, 659, 698, 784, 880, 988, 1046];
function musicSpell(lv, onHit) {
  const from = staffTip(), to = enemyCenter();
  if (lv === 1) { // ドレミ ショット：ド・レ・ミ が おんぷ に なって とぶ
    const notes = [['ド', '#ff5a8a'], ['レ', '#ff9a2a'], ['ミ', '#e0b800']];
    notes.forEach((_, i) => later(0.3 + i * 0.15, () => note(NOTE_HZ[i], 0, 0.25, { type: 'triangle', vol: 0.14 })));
    return addFx({ hitAt: 1.0, dur: 1.3, onHit,
      onImpact: () => { for (let i = 0; i < 18; i++) spawn('star', to.x, to.y, { vx: rnd(-280, 280), vy: rnd(-320, 60), size: rnd(10, 18), color: pick(['#ff5a8a', '#ff9a2a', '#ffd84a']) }); },
      draw: (f) => notes.forEach(([n, c], i) => {
        const s = 0.3 + i * 0.15, appear = ph(f.t, i * 0.1, i * 0.1 + 0.15);
        if (f.t < s) { glowText(n, from.x + 10 + i * 34, from.y - 60 - i * 12, 34 * appear, c); return; }
        const k = ph(f.t, s, s + 0.4);
        if (k >= 1) return;
        const p = arcPos({ x: from.x + 10 + i * 34, y: from.y - 60 - i * 12 }, to, ease(k), 50 + i * 20);
        drawNote(p.x, p.y, 46, c, Math.sin(f.t * 12) * 0.3);
      }) });
  }
  if (lv === 2) { // リズム サークル：ごせんふ が てきを つつみこむ
    [0, 0.15, 0.3, 0.45, 0.6, 0.75].forEach((d, i) => later(0.3 + d, () => note(i % 2 ? 784 : 1046, 0, 0.08, { type: 'square', vol: 0.05 }))); // トン・タン
    return addFx({ hitAt: 1.05, dur: 1.4, onHit,
      onImpact: () => { for (let i = 0; i < 20; i++) spawn('star', to.x, to.y, { vx: rnd(-300, 300), vy: rnd(-340, 60), size: rnd(8, 16), color: '#b06aff' }); S.flash = 0.35; S.flashColor = '220,190,255'; },
      draw: (f) => {
        const fly = ease(ph(f.t, 0, 0.4)), wrap = ph(f.t, 0.4, 1.0), fade = 1 - ph(f.t, 1.05, 1.4);
        ctx.globalAlpha = fade; ctx.strokeStyle = '#3a2a4d'; ctx.lineWidth = 3;
        if (f.t < 0.4) { // 5ほんの せん が とんでいく
          const c = arcPos(from, to, fly, 40);
          for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(c.x - 70, c.y - 24 + i * 12); ctx.lineTo(c.x + 70, c.y - 24 + i * 12); ctx.stroke(); }
          drawNote(c.x, c.y - 4, 30, '#b06aff');
          return;
        }
        const r = 170 - 60 * ease(wrap);
        for (let i = 0; i < 5; i++) { // まるく つつむ ごせんふ
          ctx.beginPath(); ctx.ellipse(to.x, to.y, r + i * 9, (r + i * 9) * 0.55, 0, 0, 7); ctx.stroke();
        }
        for (let i = 0; i < 6; i++) { const a = f.t * 5 + i * 1.05; drawNote(to.x + Math.cos(a) * (r + 18), to.y + Math.sin(a) * (r + 18) * 0.55, 30, hsl(260 + i * 25, 60)); }
      } });
  }
  if (lv === 3) { // メロディ フレア：あかい メラメラ おんぷ が まわりを グルグル
    const n = 6;
    chime([659, 784, 988, 784, 659, 988], 0.12, { type: 'triangle', vol: 0.09 });
    return addFx({ hitAt: 1.3, dur: 1.55, onHit,
      update: (dt, f) => { (f.ps || []).forEach((p) => { if (Math.random() < 0.5) spawn('ember', p.x, p.y, { vx: rnd(-40, 40), vy: rnd(-90, -20) }); }); },
      onImpact: () => { for (let i = 0; i < 36; i++) spawn('ember', to.x, to.y, { vx: rnd(-320, 320), vy: rnd(-360, 100), size: rnd(8, 16) }); S.flash = 0.45; S.flashColor = '255,130,100'; S.shake = 0.5; },
      draw: (f) => {
        if (f.hit) { f.ps = []; return; }
        f.ps = [];
        for (let i = 0; i < n; i++) {
          const a = f.t * 7 + (i / n) * Math.PI * 2;
          const orbitR = 120 * (1 - ph(f.t, 1.05, 1.3));
          const orbit = { x: to.x + Math.cos(a) * orbitR, y: to.y + Math.sin(a) * orbitR * 0.55 };
          const p = f.t < 0.4 ? arcPos(from, orbit, ease(f.t / 0.4), 40) : orbit;
          f.ps.push(p);
          drawNote(p.x, p.y, 40, '#ff3b2f', a);
        }
      } });
  }
  if (lv === 4) { // ドレミ ストーム：ド・レ・ミ の おんぷ が たつまき に なって とぶ
    [0, 0.2, 0.4, 0.6, 0.8].forEach((d, i) => later(d, () => note(NOTE_HZ[i % 3], 0, 0.15, { type: 'triangle', vol: 0.1 })));
    noise(0, 1.1, 0.06, 600);
    const lab = ['ド', 'レ', 'ミ'], col = ['#ff5a8a', '#ff9a2a', '#e0b800'];
    return addFx({ hitAt: 0.95, dur: 1.5, onHit,
      onImpact: () => { for (let i = 0; i < 24; i++) spawn('star', to.x, to.y, { vx: rnd(-320, 320), vy: rnd(-360, 60), size: rnd(10, 18), color: pick(col) }); S.flash = 0.4; S.flashColor = '255,220,240'; },
      draw: (f) => {
        const k = ease(ph(f.t, 0, 0.9)), cx = lerp(from.x + 40, to.x, k), base = GROUND();
        const fade = 1 - ph(f.t, 1.15, 1.5);
        for (let i = 0; i < 24; i++) {
          const h = i / 24, a = f.t * 10 + i * 0.9, r = 20 + h * 90;
          const x = cx + Math.cos(a) * r, y = base - 20 - h * 260, depth = (Math.sin(a) + 1.4) / 2.4;
          ctx.globalAlpha = fade * (0.4 + 0.6 * depth);
          if (i % 2) drawNote(x, y, 20 + depth * 18, col[i % 3], a);
          else glowText(lab[(i / 2) % 3], x, y, 18 + depth * 14, col[(i / 2) % 3], '#fff');
        }
      } });
  }
  if (lv === 5) { // ハーモニー ベル：きんいろの ベル と おんぷの なみ
    const bell = { x: from.x + 20, y: from.y - 150 };
    [0, 0.3, 0.6].forEach((d) => later(0.3 + d, () => { note(880, 0, 0.9, { type: 'sine', vol: 0.12 }); note(1320, 0, 0.7, { type: 'sine', vol: 0.06 }); }));
    return addFx({ hitAt: 1.3, dur: 1.65, onHit,
      onImpact: () => { boomFx(to.x, to.y, '#ffd84a', 26); S.flash = 0.5; S.flashColor = '255,240,170'; },
      draw: (f) => {
        const a = ph(f.t, 0, 0.3) * (1 - ph(f.t, 1.3, 1.65));
        ctx.save(); ctx.translate(bell.x, bell.y); ctx.rotate(Math.sin(f.t * 12) * 0.35 * a); ctx.globalAlpha = a;
        glow('#ffe27a', 80);
        ctx.fillStyle = '#ffcf3a'; ctx.strokeStyle = '#a86a00'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-34, 30); ctx.quadraticCurveTo(-30, -36, 0, -38); ctx.quadraticCurveTo(30, -36, 34, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#a86a00'; ctx.beginPath(); ctx.arc(0, 36, 8, 0, 7); ctx.fill();
        ctx.restore();
        [0.45, 0.65, 0.85].forEach((s, w) => {
          const k = ph(f.t, s, s + 0.45);
          if (k <= 0 || k >= 1) return;
          for (let i = -2; i <= 2; i++) {
            const p = arcPos(bell, { x: to.x, y: to.y + i * 40 }, k, 30);
            drawNote(p.x, p.y + i * 10 * Math.sin(k * Math.PI), 34, hsl(40 + w * 20 + i * 8, 55), Math.sin(f.t * 10 + i));
          }
        });
      } });
  }
  if (lv === 6) { // スター シンフォニー：ほし と おんぷ の りゅうせい
    const ms = Array.from({ length: 16 }, (_, i) => ({ s: 0.15 + i * 0.06, star: i % 2 === 0, x0: to.x + rnd(-320, 420), y0: -rnd(40, 160), dx: rnd(-60, 60), dy: rnd(-60, 60), hue: i * 22 }));
    ms.forEach((m, i) => later(m.s + 0.4, () => note(NOTE_HZ[i % 8], 0, 0.15, { type: 'sine', vol: 0.06 })));
    return addFx({ hitAt: 1.25, dur: 1.7, onHit,
      onImpact: () => { boomFx(to.x, to.y, '#fff3a0', 34); S.flash = 0.6; S.flashColor = '255,250,220'; },
      draw: (f) => ms.forEach((m) => {
        const k = ph(f.t, m.s, m.s + 0.45);
        if (k <= 0 || k >= 1) return;
        const x = lerp(m.x0, to.x + m.dx, k), y = lerp(m.y0, to.y + m.dy, k);
        ctx.strokeStyle = hsl(m.hue, 80); ctx.lineWidth = 4; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (m.x0 - x) * 0.3, y + (m.y0 - y) * 0.3); ctx.stroke(); ctx.globalAlpha = 1;
        if (m.star) { ctx.save(); ctx.translate(x, y); ctx.rotate(f.t * 6); glow(hsl(m.hue), 40); drawStar(0, 0, 18, hsl(m.hue)); ctx.restore(); }
        else drawNote(x, y, 36, hsl(m.hue));
      }) });
  }
  // レインボー フィナーレ：にじいろの ピアノ と おんぷの はなび
  const piano = { x: 24, y: 40, w: 340, h: 80 }, keys = 14; // もんだいの パネルに かくれない ひだりうえ
  for (let i = 0; i < 8; i++) later(0.4 + i * 0.07, () => note(NOTE_HZ[i], 0, 0.3, { type: 'triangle', vol: 0.12 }));
  const bursts = Array.from({ length: 6 }, (_, i) => ({ s: 0.95 + i * 0.12, x: to.x + rnd(-150, 150), y: to.y + rnd(-130, 60), hue: i * 60 }));
  return addFx({ hitAt: 1.0, dur: 2.1, onHit,
    onImpact: () => { S.flash = 0.6; S.flashColor = '255,240,250'; SFX.boom(); },
    update: (dt, f) => bursts.forEach((b) => { if (!b.done && f.t >= b.s) { b.done = true; noise(0, 0.15, 0.15, 900); } }),
    draw: (f) => {
      const a = ph(f.t, 0, 0.35) * (1 - ph(f.t, 1.7, 2.1));
      ctx.save(); ctx.globalAlpha = a;
      glowAt(piano.x + piano.w / 2, piano.y + piano.h / 2, '#ffffff', 260);
      for (let i = 0; i < keys; i++) {
        const pressed = Math.floor((f.t - 0.4) / 0.07) === i % 8 ? 6 : 0;
        ctx.fillStyle = hsl(i * (360 / keys), 70);
        ctx.fillRect(piano.x + i * piano.w / keys + 1, piano.y + pressed, piano.w / keys - 2, piano.h);
      }
      ctx.restore();
      bursts.forEach((b) => {
        const k = ph(f.t, b.s, b.s + 0.55);
        if (k <= 0 || k >= 1) return;
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2;
          drawNote(b.x + Math.cos(ang) * 110 * ease(k), b.y + Math.sin(ang) * 110 * ease(k) + k * k * 30, 30, hsl(b.hue + i * 30), 0);
        }
        ctx.globalAlpha = 1;
      });
    } });
}

// ---------------------------------------------------------------------
//  えいごの まほう：アルファベット が とんでいく（レベル が あがる と かず と うごき が はでに）
//    1 ショット（まっすぐ）2 ボム（あたって はじける）3 スパーク（ジグザグ）4 ストーム（たつまき）
//    5 エクスプロージョン（あつまって だいばくはつ）6 ギャラクシー（ほし の うず）7 フィナーレ（そら から ふりそそぐ）
// ---------------------------------------------------------------------
function englishSpell(lv, onHit) {
  const from = staffTip(), to = enemyCenter(), q = S.q || {};
  const word = String(q.symbol || 'ABC').toUpperCase();
  const pool = (word + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ').split('');
  const n = [3, 5, 7, 12, 14, 18, 26][lv - 1];
  const letters = Array.from({ length: n }, (_, i) => ({ ch: pool.at(i % pool.length), s: i * (lv >= 6 ? 0.05 : 0.08), hue: (i * 360) / n, r: rnd(0, 1000) / 1000 }));
  const fly = lv >= 7 ? 1.0 : 0.55, hitAt = Math.max(...letters.map((l) => l.s)) + fly;
  [523, 659, 784, 1046].slice(0, Math.min(4, 1 + Math.ceil(lv / 2))).forEach((f, i) => later(i * 0.1, () => note(f, 0, 0.18, { type: 'triangle', vol: 0.1 })));
  speakEn(word.length <= 3 ? word.split('').join(', ') : word, 1.0);
  return addFx({ hitAt, dur: hitAt + (lv >= 5 ? 0.9 : 0.5), onHit,
    onImpact: () => { boomFx(to.x, to.y, SUBJ_COLOR.english, 14 + lv * 4); S.flash = 0.25 + lv * 0.08; S.flashColor = '200,255,235'; if (lv >= 5) SFX.boom(); },
    draw: (f) => {
      letters.forEach((l, i) => {
        const k = ph(f.t, l.s, l.s + fly);
        if (k <= 0 || k >= 1) return;
        let x, y;
        if (lv >= 7) { x = to.x + (l.r - 0.5) * 500 * (1 - k); y = lerp(-40 - l.r * 120, to.y, ease(k)); } // そら から
        else if (lv === 6) { const a = l.r * 7 + k * 9, rr = 260 * (1 - k); x = to.x + Math.cos(a) * rr; y = to.y + Math.sin(a) * rr * 0.6; } // うず
        else if (lv === 4) { const a = f.t * 10 + i, rr = 60 * (1 - k) + 10; const c = arcPos(from, to, ease(k), 40); x = c.x + Math.cos(a) * rr; y = c.y + Math.sin(a) * rr; } // たつまき
        else { const c = arcPos(from, to, ease(k), lv === 3 ? 0 : 50 + (i % 3) * 30); x = c.x; y = c.y + (lv === 3 ? Math.sin(k * 30 + i) * 22 : 0); }
        ctx.save(); ctx.translate(x, y); ctx.rotate(lv >= 4 ? f.t * 6 + i : 0);
        glowText(l.ch, 0, 0, 30 + lv * 3, hsl(l.hue, 55), '#fff');
        ctx.restore();
      });
      if (f.hit && lv >= 5) { // あつまって ばくはつ
        const e = ph(f.t, hitAt, f.dur);
        ctx.globalAlpha = 1 - e;
        glowAt(to.x, to.y, '#bff5e6', 80 + 260 * e);
        glowText(word, to.x, to.y - 20 - e * 40, 44 + e * 30, SUBJ_COLOR.english, '#fff');
        ctx.globalAlpha = 1;
      }
    } });
}

// ---------------------------------------------------------------------
//  ふつうの こうげき：cast を さしかえる
// ---------------------------------------------------------------------
const baseCastSpells = cast;
cast = function (kind, onHit) {
  const subj = S.q ? (S.q.spellSubject || S.q.subject || 'math') : null; // ほいくえん の もんだい は spellSubject（すうじ→さんすう など）
  if (!ST.battle || !subj || kind === 'star' || kind === 'double') { baseCastSpells(kind, onHit); return; }
  const lv = atkLevel(heroAtk()), name = SPELL_NAMES[subj][lv - 1];
  sayName(name, SUBJ_COLOR[subj], spellRank(lv, subj));
  S.lastSpell = { subj, lv, name, rank: spellRank(lv, subj) }; // テストよう
  (subj === 'kanji' ? kanjiSpell : subj === 'music' ? musicSpell : subj === 'english' ? englishSpell : mathSpell)(lv, onHit);
};

// ---------------------------------------------------------------------
//  ボスの とどめ：がったい わざ（ミラクル）
// ---------------------------------------------------------------------
// せいかい した もの を おぼえる（すうじ・かんじ・おんぷ を 1つずつ。あたらしい ほうに かえる）
const baseResolveAnswerSpells = resolveAnswer;
resolveAnswer = function (ok, wrongMsg, attackKinds) {
  const m = S.monster, q = S.q;
  if (ok && ST.battle && m && m.boss && q) {
    m.syms = m.syms || {};
    if (q.symbol !== undefined) { // ほいくえん：えらんだ すうじ・ひらがな・いろ
      const key = q.symKey || q.spellSubject; // アルファベット は 'abc'
      m.syms[key] = q.symbol;
      (m.symColor = m.symColor || {})[key] = q.symbolColor;
    } else if (q.subject === 'kanji') m.syms.kanji = q.chars[q.targets[0]];
    else if (q.subject === 'music' && typeof NOTE_NAMES !== 'undefined' && q.target) m.syms.music = NOTE_NAMES[q.target.deg];
    else if (q.ans !== undefined) m.syms.math = String(q.ans);
  }
  baseResolveAnswerSpells(ok, wrongMsg, attackKinds);
};

const baseStartChargeSpells = startCharge;
startCharge = function (withCat) {
  const m = S.monster;
  if (!ST.battle || !m || !m.boss) { baseStartChargeSpells(withCat); return; }
  startMiracle(atkLevel(heroAtk()));
};

function miracleSymbols(m) {
  const s = (m && m.syms) || {}, out = [], sc = (m && m.symColor) || {};
  if (s.math) out.push({ text: s.math, color: SUBJ_COLOR.math, size: s.math.length > 2 ? 34 : 46 });
  if (s.kanji) out.push({ text: s.kanji, color: SUBJ_COLOR.kanji, size: 52 });
  if (s.music) out.push(sc.music ? { text: '●', color: sc.music, size: 52 } : { text: '♪' + s.music, color: SUBJ_COLOR.music, size: 36 }); // ほいくえん は いろ
  if (s.english) out.push({ text: s.english, color: SUBJ_COLOR.english, size: s.english.length > 1 ? 40 : 52 }); // えいご
  if (s.abc) out.push({ text: s.abc, color: sc.abc || '#ff7a2a', size: 56 }); // ほいくえん の アルファベット
  if (!out.length) out.push({ text: '★', color: '#e0a800', size: 52 });
  return out;
}

function startMiracle(lv) {
  const m = S.monster, from = staffTip(), to = enemyCenter();
  const head = { x: m.x, y: Math.max(90, GROUND() - m.height - 70) };
  const syms = miracleSymbols(m);
  const name = MIRACLE_NAMES[lv - 1];
  S.lastSpell = { miracle: true, lv, name, rank: spellRank(lv, 'miracle'), syms: syms.map((s) => s.text) }; // テストよう
  // フォール・スター・レインボー・ワンダーランド・フィナーレ は tier 1〜5 で かく
  const tier = { 2: 1, 4: 2, 5: 3, 6: 4, 7: 5 }[lv] || 0;
  S.heroSay = { lines: name.split('・').map((x, i, a) => (i < a.length - 1 ? x + '・' : x)), color: '#e0408a', t: 0, dur: 2.4, sub: spellRank(lv, 'miracle'), subColor: '#e0408a' };
  SFX.charge(1.0);
  document.body.classList.add('miracle'); // もんだいの パネルを けして、ボスの あたまの うえを みせる
  const T = { hit: [1.05, 1.3, 1.6, 1.15, 1.75, 1.75, 2.35][lv - 1], dur: [1.45, 1.8, 2.05, 2.1, 2.7, 3.0, 3.6][lv - 1] };
  // きごうの いち：つえ → ボスの あたまの うえ で まわる
  const symPos = (t, i) => {
    const k = ease(ph(t, 0, 1.0)), c = arcPos({ x: from.x, y: from.y - 30 }, head, k, 80);
    const a = t * 6 + (i / syms.length) * Math.PI * 2, r = 46 + 20 * Math.sin(t * 3);
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.6 };
  };
  const drawSyms = (t, alpha = 1, gather = 0) => syms.forEach((s, i) => {
    let p = symPos(t, i);
    if (gather) p = { x: lerp(p.x, head.x, gather), y: lerp(p.y, head.y, gather) };
    glowAt(p.x, p.y, s.color, 50 * alpha);
    glowText(s.text, p.x, p.y, s.size, s.color, '#fff', alpha);
  });
  const raiseStaff = (f) => { // ちゅなちゃんが つえを かかげる
    if (!f.raised) { f.raised = true; S.hero.jump = 1; chime([523, 659, 784, 1046, 1318], 0.06, { vol: 0.1 }); }
    const k = ph(f.t, 1.0, 1.4);
    glowAt(from.x, from.y - 30, '#fff3a0', 120 * (1 - Math.abs(k - 0.5) * 2) + 30);
    ctx.strokeStyle = 'rgba(255,250,200,.8)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(from.x, from.y - 30); ctx.lineTo(head.x, head.y); ctx.globalAlpha = k * (1 - ph(f.t, 1.4, 1.6)); ctx.stroke(); ctx.globalAlpha = 1;
  };
  const pillar = (f, a, b) => { // にじいろの ひかりの はしら
    const k = ph(f.t, a, a + 0.3) * (1 - ph(f.t, b - 0.3, b));
    if (k <= 0) return;
    const w = 40 + 70 * k, g = ctx.createLinearGradient(m.x - w, 0, m.x + w, 0);
    ['#ff4a4a', '#ff9a2a', '#ffd83a', '#3fc05a', '#3a8aff', '#9a5aff', '#ff7ac8'].forEach((c, i) => g.addColorStop(i / 6, c));
    ctx.globalAlpha = 0.75 * k; ctx.fillStyle = g; ctx.fillRect(m.x - w, -40, w * 2, GROUND() + 40);
    ctx.globalAlpha = 0.9 * k; glowAt(m.x, to.y, '#ffffff', 140 * k);
    ctx.globalAlpha = 1;
  };
  const starRain = (f, a, b, n) => { if (f.t > a && f.t < b) for (let i = 0; i < n; i++) spawn('star', rnd(0, W), -20, { vx: rnd(-60, 60), vy: rnd(300, 520), size: rnd(10, 20), color: hsl(rnd(0, 360), 72) }); };

  addFx({ hitAt: T.hit, dur: T.dur, onHit: onSpellHit,
    onImpact: () => { boomFx(to.x, to.y, '#fff3a0', 40); S.flash = 0.8; S.flashColor = '255,250,230'; SFX.boom(); },
    update: (dt, f) => {
      if (lv === 1) { // ショットが あたる たびに キラッ
        f.shots = f.shots || 0;
        syms.forEach((s, i) => { if (f.shots === i && f.t >= 0.35 + i * 0.25 + 0.18) { f.shots++; note(1320 - i * 200, 0, 0.12, { type: 'square', vol: 0.06 }); for (let k = 0; k < 10; k++) spawn('star', to.x, to.y, { vx: rnd(-260, 260), vy: rnd(-300, 60), size: rnd(8, 14), color: s.color }); } });
      }
      if (lv === 3 && f.t > 0.7 && f.t < 1.7 && Math.random() < 0.5) spawn('leaf', m.x + rnd(-120, 120), GROUND() - rnd(0, m.height), { vx: rnd(-200, 200), vy: rnd(-200, 0) });
      if (tier === 2 && f.t > 1.0 && f.t < 1.7) for (let i = 0; i < 3; i++) spawn('star', head.x + rnd(-160, 160), head.y - 40, { vx: rnd(-40, 40), vy: rnd(200, 380), size: rnd(10, 18), color: hsl(rnd(30, 60), 70) });
      if (tier === 4) starRain(f, 1.6, 2.7, 4);
      if (tier === 5) {
        S.miracleBg = ph(f.t, 1.85, 2.25) * (1 - ph(f.t, 3.2, 3.6));
        if (m) m.fadeK = 0.75 * ph(f.t, 1.9, 2.6);
        if (f.t > 2.0 && f.t < 3.4) for (let i = 0; i < 4; i++) spawn('twinkle', rnd(0, W), rnd(0, H), { color: pick(['#ffffff', '#fff3a0', '#ffb3e0', '#bfe9ff']), size: rnd(8, 18) });
      }
    },
    end: () => { S.miracleBg = 0; },
    draw: (f) => {
      const t = f.t;
      if (lv === 1) { // ショット：1こずつ くるくる まわって すごい はやさで とんでいく
        syms.forEach((s, i) => {
          const s0 = 0.35 + i * 0.25, k = ph(t, s0, s0 + 0.18);
          const start = { x: from.x + 20 + i * 50, y: from.y - 90 };
          if (k >= 1) { if (t < s0 + 0.4) glowAt(to.x, to.y, s.color, 80 * (1 - ph(t, s0 + 0.18, s0 + 0.4))); return; }
          const p = { x: lerp(start.x, to.x, k * k), y: lerp(start.y, to.y, k * k) };
          if (k > 0) { ctx.strokeStyle = s.color; ctx.globalAlpha = 0.5; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(lerp(start.x, p.x, 0.4), lerp(start.y, p.y, 0.4)); ctx.stroke(); ctx.globalAlpha = 1; }
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 20);
          glowText(s.text, 0, 0, s.size, s.color, '#fff', ph(t, i * 0.08, i * 0.08 + 0.2));
          ctx.restore();
        });
        return;
      }
      if (lv === 3) { // ストーム：たつまき に なって てきを つつむ
        const go = ease(ph(t, 0, 0.7)), fade = 1 - ph(t, 1.65, 2.05), base = GROUND();
        const cx = lerp(from.x + 30, m.x, go);
        for (let j = 0; j < 18; j++) {
          const s = syms[j % syms.length], h = j / 18, a = t * 9 + j * 1.1, r = (30 + h * 120) * (0.6 + 0.4 * go);
          const depth = (Math.sin(a) + 1.4) / 2.4;
          glowText(s.text, cx + Math.cos(a) * r, base - 20 - h * (m.height + 80), s.size * (0.5 + 0.4 * depth), s.color, '#fff', fade * (0.35 + 0.65 * depth));
        }
        if (go >= 1) { ctx.globalAlpha = 0.35 * fade; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(m.x, base - 40 - i * 50, 70 + i * 25, 16, 0, t * 6 + i, t * 6 + i + 2.5); ctx.stroke(); } }
        return;
      }
      if (t < 1.0) { drawSyms(t); return; }
      if (tier === 1) { // おちる
        const k = ph(t, 1.0, 1.3);
        if (k < 1) syms.forEach((s, i) => { const p = symPos(1.0, i); glowText(s.text, p.x, lerp(p.y, to.y, ease(k)), s.size * (1 + k * 0.4), s.color, '#fff'); });
        return;
      }
      if (tier === 2) { // ばくはつ して ほしが ふる
        const k = ph(t, 1.0, 1.5);
        drawSyms(1.0, 1 - ph(t, 1.0, 1.15));
        ctx.globalAlpha = 1 - k; glowAt(head.x, head.y, '#fff3a0', 60 + 220 * k);
        ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(head.x, head.y, 30 + 160 * k, 0, 7); ctx.stroke();
        return;
      }
      if (tier === 3 || tier === 4) { // つえを かかげて → がったい → にじの はしら
        raiseStaff(f);
        drawSyms(t, 1 - ph(t, 1.35, 1.55), ph(t, 1.1, 1.5));
        pillar(f, 1.45, f.dur - 0.1);
        return;
      }
      // tier 5：がめん いっぱいの ほし → きえて にじいろ の けしき・キラキラ
      drawSyms(Math.min(t, 1.8), 1 - ph(t, 1.6, 1.85));
      const fill = ph(t, 1.0, 1.75), gone = ph(t, 1.75, 2.1);
      if (fill > 0 && gone < 1) {
        ctx.globalAlpha = 1 - gone;
        const n = Math.floor(220 * fill);
        for (let i = 0; i < n; i++) drawStar(hash(i * 3 + 1) * W, hash(i * 7 + 2) * H, 6 + hash(i + 9) * 14, hsl(hash(i) * 360, 72));
        ctx.globalAlpha = 1;
      }
    } });
}

// ミラクル・フィナーレ：にじいろの けしき と ボスが うすく なる
const baseDrawWorldSpells = drawWorld;
drawWorld = function () {
  baseDrawWorldSpells();
  const k = S.miracleBg || 0;
  if (k <= 0) return;
  const g = ctx.createLinearGradient(0, 0, W, H);
  ['#ffb3b3', '#ffd9a8', '#fff3a8', '#c8f5c0', '#b8dcff', '#d8c4ff', '#ffc4e8'].forEach((c, i) => g.addColorStop(i / 6, c));
  ctx.save(); ctx.globalAlpha = 0.85 * k; ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60); ctx.restore();
};
const baseDrawMonsterSpells = drawMonster;
drawMonster = function () {
  const m = S.monster;
  if (!m || !m.fadeK) { baseDrawMonsterSpells(); return; }
  ctx.save(); ctx.globalAlpha = 1 - m.fadeK; baseDrawMonsterSpells(); ctx.restore();
};

// もんだいの パネルは つぎの もんだい・たたかいの おわり まで けしておく
const baseUpdateUISpells = updateUI;
updateUI = function () {
  baseUpdateUISpells();
  if (document.body.classList.contains('miracle') && (S.mode === 'question' || !S.monster || stActive())) document.body.classList.remove('miracle');
};
