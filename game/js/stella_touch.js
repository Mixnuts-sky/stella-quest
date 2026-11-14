// =====================================================================
//  ステラクエスト：そうさ ボタン（パソコン も iPhone・iPad も おなじ ならび）
//  ・ひだりした：十字ボタン（#stPad）
//  ・みぎした：おおきい ボタン（#stOk）。まち・たてもの では「しらべる」、ダンジョン では「ひっさつ」
//  ・その うえ：ちいさい「アイテム」ボタン（#stItemBtn）→ アイテム がめん（stella_items.js）
//  ・ダンジョン では ひだり に「ジャンプ」ボタン（#stJump、スペース キー）（stella_jump.js・stella_climb.js）
//  ボタンは キーボードの キー（やじるし・Enter）の イベントを つくって ながすだけ なので、
//  あるく しくみ（stella_town.js / stella_interior.js / maze.js）は キーボードと おなじ。
//  しよう：docs/GAME_SPEC.md 9.9・14.1
// =====================================================================
const IS_TOUCH = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
if (IS_TOUCH) document.body.classList.add('touch');

const TOUCH_KEYS = {
  up: { key: 'ArrowUp', code: 'ArrowUp' }, down: { key: 'ArrowDown', code: 'ArrowDown' },
  left: { key: 'ArrowLeft', code: 'ArrowLeft' }, right: { key: 'ArrowRight', code: 'ArrowRight' },
  ok: { key: 'Enter', code: 'Enter' },
  jump: { key: ' ', code: 'Space' },
};
function touchKey(type, name) {
  const k = TOUCH_KEYS[name];
  dispatchEvent(new KeyboardEvent(type, { key: k.key, code: k.code, bubbles: true, cancelable: true }));
}

// いま あるける ばめん か（まち・たてもの・ダンジョン）
const ctlWalkScene = () => typeof ST !== 'undefined' && ST.data && (
  (S.mode === 'st' && (ST.scene === 'town' || ST.scene === 'interior')) ||
  (S.mode === 'walk' && typeof inDungeon === 'function' && inDungeon() && !S.monster));
const ctlInDungeonWalk = () => S.mode === 'walk' && typeof inDungeon === 'function' && inDungeon();

(function buildControls() {
  const game = $('game');
  const pad = document.createElement('div');
  pad.id = 'stPad'; pad.className = 'dpad st-pad'; pad.hidden = true;
  pad.innerHTML = `<button type="button" data-k="up" class="up" aria-label="うえ">▲</button>
    <button type="button" data-k="left" class="left" aria-label="ひだり">◀</button>
    <button type="button" data-k="right" class="right" aria-label="みぎ">▶</button>
    <button type="button" data-k="down" class="down" aria-label="した">▼</button>`;
  const ok = document.createElement('button');
  ok.id = 'stOk'; ok.type = 'button'; ok.className = 'st-ok'; ok.hidden = true;
  ok.dataset.k = 'ok'; ok.innerHTML = '<span class="lbl">しらべる</span><span class="gauge"><i></i></span>';
  const itemBtn = document.createElement('button');
  itemBtn.id = 'stItemBtn'; itemBtn.type = 'button'; itemBtn.className = 'st-item-btn'; itemBtn.hidden = true;
  itemBtn.innerHTML = '🎒 アイテム';
  const jump = document.createElement('button');
  jump.id = 'stJump'; jump.type = 'button'; jump.className = 'st-jump'; jump.hidden = true; jump.dataset.k = 'jump'; jump.textContent = 'ジャンプ';
  game.appendChild(pad); game.appendChild(ok); game.appendChild(itemBtn); game.appendChild(jump);

  [...pad.querySelectorAll('button'), ok, jump].forEach((b) => {
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
  itemBtn.addEventListener('click', () => { if (typeof audio === 'function') audio(); if (typeof openItemPanel === 'function') openItemPanel(); itemBtn.blur(); });

  // あるける ばめん の とき だけ だす
  let last = '';
  const sync = () => {
    const panelOpen = (typeof ITEMUI !== 'undefined' && ITEMUI.open) || (typeof RG !== 'undefined' && RG.special);
    const show = ctlWalkScene() && !panelOpen;
    const dg = ctlInDungeonWalk();
    const key = `${show}|${dg}`;
    if (key !== last) {
      pad.hidden = ok.hidden = itemBtn.hidden = !show;
      jump.hidden = !(show && dg);
      ok.classList.toggle('special', dg);
      ok.querySelector('.lbl').textContent = dg ? 'ひっさつ' : 'しらべる';
      last = key;
    }
    if (dg && typeof specialGauge === 'function') {
      const g = specialGauge();
      const lv = typeof specialLevel === 'function' ? specialLevel() : (g >= 1 ? 1 : 0), lbl = lv ? `ひっさつ ${'★'.repeat(lv)}` : 'ひっさつ';
      ok.querySelector('.gauge i').style.width = `${Math.round(g * 100)}%`;
      ok.classList.toggle('full', lv >= 1);
      const le = ok.querySelector('.lbl'); if (le.textContent !== lbl) le.textContent = lbl;
    }
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
