// =====================================================================
//  ステラクエスト：タッチ そうさ（iPhone・iPad など キーボードの ない きかい）
//  まち・たてものの なか で 十字ボタン と「しらべる」ボタン を だす。
//  ボタンは キーボードの キー（やじるし・Enter）の イベントを つくって ながすだけ なので、
//  あるく しくみ（stella_town.js / stella_interior.js）は そのまま つかえる。
//  ダンジョンの めいろ は maze.js の 十字ボタン（#dpad）を つかう。
//  stella_town.js・stella_interior.js の あとに よむ。
// =====================================================================
const IS_TOUCH = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
if (IS_TOUCH) document.body.classList.add('touch');

const TOUCH_KEYS = {
  up: { key: 'ArrowUp', code: 'ArrowUp' }, down: { key: 'ArrowDown', code: 'ArrowDown' },
  left: { key: 'ArrowLeft', code: 'ArrowLeft' }, right: { key: 'ArrowRight', code: 'ArrowRight' },
  ok: { key: 'Enter', code: 'Enter' },
};
function touchKey(type, name) {
  const k = TOUCH_KEYS[name];
  dispatchEvent(new KeyboardEvent(type, { key: k.key, code: k.code, bubbles: true, cancelable: true }));
}

(function buildTouchPad() {
  const game = $('game');
  const pad = document.createElement('div');
  pad.id = 'stPad'; pad.className = 'dpad st-pad'; pad.hidden = true;
  pad.innerHTML = `<button type="button" data-k="up" class="up" aria-label="うえ">▲</button>
    <button type="button" data-k="left" class="left" aria-label="ひだり">◀</button>
    <button type="button" data-k="right" class="right" aria-label="みぎ">▶</button>
    <button type="button" data-k="down" class="down" aria-label="した">▼</button>`;
  const ok = document.createElement('button');
  ok.id = 'stOk'; ok.type = 'button'; ok.className = 'st-ok'; ok.hidden = true;
  ok.dataset.k = 'ok'; ok.textContent = 'しらべる';
  game.appendChild(pad); game.appendChild(ok);

  [...pad.querySelectorAll('button'), ok].forEach((b) => {
    let down = false;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (typeof audio === 'function') audio(); // iPhone は さわった とき に おとを ならせる ように する
      down = true; touchKey('keydown', b.dataset.k);
      try { b.setPointerCapture(e.pointerId); } catch { /* なにもしない */ }
    });
    const up = () => { if (!down) return; down = false; touchKey('keyup', b.dataset.k); };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, up));
    b.addEventListener('contextmenu', (e) => e.preventDefault()); // ながおし の メニューを ださない
  });

  // あるける ばめん の とき だけ だす
  let last = null;
  const sync = () => {
    const show = IS_TOUCH && typeof ST !== 'undefined' && ST.data && S.mode === 'st' && (ST.scene === 'town' || ST.scene === 'interior');
    if (show !== last) { pad.hidden = ok.hidden = !show; last = show; }
    requestAnimationFrame(sync);
  };
  requestAnimationFrame(sync);
})();

// たてむき の とき は「よこに してね」
(function rotateHint() {
  const d = document.createElement('div');
  d.id = 'stRotate'; d.className = 'st-rotate';
  d.innerHTML = '<div class="st-rotate-icon">📱↻</div><div>がめんを よこに してね</div>';
  document.body.appendChild(d);
})();
