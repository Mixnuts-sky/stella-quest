'use strict';
// =====================================================================
//  ステラクエスト：たたかいの テンポ と こえ（いちばん さいごに よむ）
//  ・まほうの えんしゅつ ちゅう は もんだいの パネル を けす（「水」などの もじ が かくれない ように）
//  ・まほうを うったら、えんしゅつ が おわってから すこし とまる（Enter で すぐ つぎへ、まつ と PACE.holdSec びょう で つぎへ）
//      もんだい・たたかいの おわり（askQuestion / endBattle / levelFx / offerNanmon）を ためておいて、あとで よぶ
//  ・「うぇーおー」が でてきたら、アザラシ みたいな ひくい こえ で「うぇーおー」
//  ・ペンタブレット：ペンの ボタン（みぎクリック）で 1かく もどす、なかクリック で こたえる
//  しよう：docs/GAME_SPEC.md「9.6 たたかいの テンポ」
// =====================================================================

const PACE = { holdSec: 10 };
try { const t = localStorage.getItem('stella:test:holdSec'); if (t) PACE.holdSec = +t; } catch { /* テスト よう の せってい（ふだん は ない） */ }
const HOLD = { active: false, fxEnd: 0, pending: null };

function startHold() { Object.assign(HOLD, { active: true, fxEnd: 0, pending: null }); }
function releaseHold() {
  if (!HOLD.active) return;
  HOLD.active = false;
  if (S.waitEnter === releaseHold) S.waitEnter = null;
  $('nextBtn').hidden = true;
  if (S.heroSay) S.heroSay.dur = S.heroSay.t + 0.4;
  const fn = HOLD.pending; HOLD.pending = null;
  if (fn) fn();
}

// まほうの えんしゅつ（FX）が はじまったら とめる じゅんび、あたったら Enter で すすめる
const baseAddFxPace = addFx;
addFx = function (o) {
  if (ST.battle && o.onHit) {
    startHold();
    const hit = o.onHit;
    o.onHit = () => { hit(); if (HOLD.active) { S.waitEnter = releaseHold; $('nextBtn').hidden = false; } };
    const end = o.end;
    o.end = (f) => {
      if (end) end(f);
      if (HOLD.active) HOLD.fxEnd = S.t;
      if (!FX.length) document.body.classList.remove('miracle'); // えんしゅつ が おわったら もんだい（と「Enter で つぎへ」）を もどす
    };
    document.body.classList.add('miracle'); // えんしゅつ ちゅう は もんだいの パネル を けして、まほう を いちばん まえ に
  }
  return baseAddFxPace(o);
};
// えんしゅつ が おわって holdSec びょう たったら じぶんで すすむ。とまっている あいだ は ふきだし を のこす
const baseStepSpellsPace = stepSpells;
stepSpells = function (dt) {
  baseStepSpellsPace(dt);
  if (!HOLD.active) return;
  if (S.heroSay) S.heroSay.dur = Math.max(S.heroSay.dur, S.heroSay.t + 0.6);
  if (HOLD.fxEnd && S.t - HOLD.fxEnd >= PACE.holdSec) releaseHold();
};
// とまっている あいだ に よばれた ものは あとで
function gate(fn) {
  return function (...args) {
    if (HOLD.active) { HOLD.pending = () => fn.apply(this, args); return; }
    return fn.apply(this, args);
  };
}
askQuestion = gate(askQuestion);
endBattle = gate(endBattle);
levelFx = gate(levelFx);
offerNanmon = gate(offerNanmon);
// たたかいの そと に でたら やめる
const baseSetSceneHold = setScene;
setScene = function (...a) { HOLD.active = false; HOLD.pending = null; return baseSetSceneHold(...a); };

// ---------------------------------------------------------------------
//  うぇーおー の こえ：ノコギリ なみ を 2つの フォルマント（こえの ひびき）に とおして「うぇー」「おー」
// ---------------------------------------------------------------------
function weoVoice() {
  const ac = audio();
  if (!ac || !soundOn) return;
  const t0 = ac.currentTime + 0.02;
  const out = ac.createGain(); out.gain.value = 0; out.connect(ac.destination);
  const f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), lp = ac.createBiquadFilter();
  f1.type = 'bandpass'; f1.Q.value = 6; f2.type = 'bandpass'; f2.Q.value = 9; lp.type = 'lowpass'; lp.frequency.value = 2200;
  const mix = ac.createGain(); mix.gain.value = 1;
  f1.connect(mix); f2.connect(mix); mix.connect(lp); lp.connect(out);
  const osc = ac.createOscillator(); osc.type = 'sawtooth';
  const vib = ac.createOscillator(), vibG = ac.createGain(); vib.frequency.value = 5.5; vibG.gain.value = 4; vib.connect(vibG); vibG.connect(osc.frequency);
  osc.connect(f1); osc.connect(f2);
  // こえの たかさ：ひくめ、さいごは さがる（アザラシ ふう）
  osc.frequency.setValueAtTime(150, t0); osc.frequency.linearRampToValueAtTime(130, t0 + 0.45);
  osc.frequency.setValueAtTime(125, t0 + 0.55); osc.frequency.linearRampToValueAtTime(92, t0 + 1.25);
  // う → え（ー）… お（ー）
  f1.frequency.setValueAtTime(320, t0); f2.frequency.setValueAtTime(800, t0);
  f1.frequency.linearRampToValueAtTime(480, t0 + 0.18); f2.frequency.linearRampToValueAtTime(1750, t0 + 0.18);
  f1.frequency.setValueAtTime(480, t0 + 0.5); f2.frequency.setValueAtTime(1750, t0 + 0.5);
  f1.frequency.linearRampToValueAtTime(520, t0 + 0.62); f2.frequency.linearRampToValueAtTime(880, t0 + 0.62);
  // おおきさ：「うぇー」と「おー」の あいだ に すこし きれめ
  const g = out.gain;
  g.setValueAtTime(0, t0); g.linearRampToValueAtTime(0.5, t0 + 0.06); g.setValueAtTime(0.5, t0 + 0.4); g.linearRampToValueAtTime(0.08, t0 + 0.52);
  g.linearRampToValueAtTime(0.55, t0 + 0.62); g.setValueAtTime(0.55, t0 + 1.05); g.linearRampToValueAtTime(0, t0 + 1.3);
  osc.start(t0); vib.start(t0); osc.stop(t0 + 1.35); vib.stop(t0 + 1.35);
  S.weoSay = { t: 0 };
}
const baseEncounterPace = encounter;
encounter = function (opts = {}) {
  baseEncounterPace(opts);
  const m = S.monster;
  if (m && !m.boss) later(0.55, () => { if (S.monster === m && String(m.name).includes('うぇーおー')) weoVoice(); }); // なまえ は あとから かわる ことが ある（ふしぎな ダンジョン）
};
// こえの ふきだし（てき の あたま の うえ）
const baseDrawMonsterPace = drawMonster;
drawMonster = function () {
  baseDrawMonsterPace();
  const m = S.monster;
  if (!S.weoSay || !m) return;
  S.weoSay.t += 1 / 60;
  if (S.weoSay.t > 1.8) { S.weoSay = null; return; }
  outlinedText('うぇーおー', m.x, GROUND() - m.height - 30 - S.weoSay.t * 8, 30, '#6a8fd6');
};

// ---------------------------------------------------------------------
//  ペンタブレット：ペンの ボタン
//    ふつう ペンの ボタン は「みぎクリック」「なかクリック」に なる（ドライバー の せってい しだい）
//    みぎクリック → 1かく もどす   なかクリック → こたえる
//    （ドライバーで ボタン に キー を わりあてる なら：Backspace＝1かく もどす、Enter＝こたえる）
// ---------------------------------------------------------------------
(function penButtons() {
  const pad = $('padCanvas');
  if (!pad) return;
  pad.addEventListener('contextmenu', (e) => { e.preventDefault(); if (S.mode === 'question' && S.q && S.q.subject === 'kanji') eraseDigit(); });
  pad.addEventListener('auxclick', (e) => { if (e.button === 1 && S.mode === 'question' && S.q && S.q.subject === 'kanji') { e.preventDefault(); submit(); } });
  pad.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // なかクリック の スクロール を とめる
})();
