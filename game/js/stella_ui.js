'use strict';
// =====================================================================
//  ステラクエスト：がめん の こまかい ちょうせい（2026-11-15）
//  ・iPhone：れんだ・ダブルタップ で がめん が おおきく ならない ように
//  ・おんがく「ごせんふ に おく」：▲▼ ボタン で おんぷ を うえ・した（タッチ が ずれる とき）
//  ・わざ の なまえ の ふきだし：HP と かお に かさならない ように ちゅなちゃん の うえ へ、さきっぽ なし
//  ・がめん の どこ でも スワイプ で「つぎへ」（Enter と おなじ）
//  stella_action.js の あと に よむ。しよう：docs/GAME_SPEC.md 15.9
// =====================================================================

// ---------------------------------------------------------------------
//  ダブルタップ・ピンチ で ズーム しない
// ---------------------------------------------------------------------
(function noZoom() {
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch <= 320) e.preventDefault(); // すばやい 2かいめ の タップ で ズーム しない（かく ところ は pointer で うごく ので だいじょうぶ）
    lastTouch = now;
  }, { passive: false });
  ['gesturestart', 'gesturechange', 'dblclick'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
})();

// ---------------------------------------------------------------------
//  おんがく：▲▼ で おんぷ を うごかす
// ---------------------------------------------------------------------
(function staffButtons() {
  const side = document.querySelector('#answerBar .bar-side');
  if (!side) return;
  const box = document.createElement('div');
  box.className = 'staff-ud'; box.id = 'staffUd';
  box.innerHTML = '<button type="button" data-k="ArrowUp" aria-label="うえ">▲</button><button type="button" data-k="ArrowDown" aria-label="した">▼</button>';
  side.prepend(box);
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    dispatchEvent(new KeyboardEvent('keydown', { key: b.dataset.k, code: b.dataset.k, bubbles: true }));
    b.blur();
  });
  setInterval(() => { box.hidden = !(S.q && S.q.subject === 'music' && S.q.type === 'place' && S.mode === 'question'); }, 150);
})();

// ---------------------------------------------------------------------
//  わざ の なまえ の ふきだし：ちゅなちゃん の あたま の うえ（HP の うえ）、さきっぽ なし
// ---------------------------------------------------------------------
const baseDrawSpeechUi = drawSpeech;
drawSpeech = function (lines, o) {
  if (ST.battle && o && o.right !== undefined) {
    baseDrawSpeechUi(lines, { ...o, right: undefined, cx: HERO_X(), bottom: GROUND() - 300, tailTo: null, noTail: true });
    return;
  }
  baseDrawSpeechUi(lines, o);
};

// ---------------------------------------------------------------------
//  がめん の どこ でも スワイプ で「つぎへ」
// ---------------------------------------------------------------------
(function swipeNext() {
  let st = null;
  const busy = () => (typeof ACT !== 'undefined' && (ACT.dodge || ACT.aim || ACT.mash || ACT.timing)) || (typeof ITEMUI !== 'undefined' && ITEMUI.open) || (typeof RG !== 'undefined' && RG.special);
  const skip = (t) => t.closest && t.closest('#padCanvas, #engCanvas, #spCanvas, #staffBox, button, .act-layer, #stItemPanel, #spPanel, .st-card, input');
  addEventListener('pointerdown', (e) => { st = skip(e.target) ? null : { x: e.clientX, y: e.clientY, t: performance.now() }; }, true);
  addEventListener('pointerup', (e) => {
    if (!st) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y, fast = performance.now() - st.t < 700;
    st = null;
    if (!fast || Math.hypot(dx, dy) < 60 || busy()) return;
    if (S.waitEnter) { proceed(); return; }
    if (S.mode === 'dialog' && typeof advanceDialog === 'function') advanceDialog();
  }, true);
})();
