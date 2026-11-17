'use strict';
// =====================================================================
//  ステラクエスト：ダッシュ と スタミナ・げきから カレー・ひっさつ ゲージ の おしらせ（ふしぎな ダンジョン）
//  ・ダッシュ ボタン（Shift キー）：むいて いる ほう へ 3マス はしる（ボタン を フリック すると その むき）
//    かべ・がけ・しげみ・てき の てまえ で とまる。はしって いる 3マス の あいだ てき は うごかない
//  ・スタミナ：さいだい 5。ダッシュ 1かい で 1 へる。30ぽ あるく ごと に 1 もどる。ダンジョン に はいる とき は まんたん
//  ・げきから カレー：スタミナ が まんたん（ダンジョン で つかう。おちている・アイテムや で かえる）
//  ・ひっさつ ゲージ が 1だん たまる たび に おしらせ
//  stella_items.js の あと、stella_touch.js の まえ に よむ。しよう：docs/GAME_SPEC.md 15.13
// =====================================================================

const DASH = { max: 5, len: 3, regenSteps: 30 };
const staminaOf = () => { const d = ST.data; if (d.stamina == null) d.stamina = DASH.max; return d.stamina; };

// ---------------------------------------------------------------------
//  げきから カレー
// ---------------------------------------------------------------------
ITEMS.spicy = { name: 'げきから カレー', desc: 'ダッシュ の スタミナ が まんたん に なる（ダンジョン で つかう）', weight: 0 };
ITEM_SVG.spicy = `<svg viewBox="0 0 40 40">
  <ellipse cx="20" cy="27" rx="16" ry="8" fill="#ffffff" stroke="#3a2a4d" stroke-width="2.2"/>
  <path d="M8 25 C10 15 20 13 23 17 C26 13 32 16 31 24 C25 29 13 29 8 25Z" fill="#fffaf0" stroke="#3a2a4d" stroke-width="1.6"/>
  <path d="M17 24 C18 17 27 15 31 23 C28 28 21 29 17 24Z" fill="#d8321f" stroke="#3a2a4d" stroke-width="1.6"/>
  <path d="M26 9 C30 9 33 12 32 16 C31 13 28 12 25 13 Z" fill="#ff3b2f" stroke="#3a2a4d" stroke-width="1.4"/>
  <path d="M25 13 C24 10 25 8 27 7" stroke="#2f7d3a" stroke-width="2" fill="none"/>
  <path d="M10 13 q2 -3 0 -6 M15 11 q2 -3 0 -6" stroke="#ff6a2a" stroke-width="2" fill="none"/>
</svg>`;
SHOP_ITEMS.splice(1, 0, { id: 'spicy', price: 25 });

const baseUseItemDash = useItem;
useItem = function (i) {
  const items = ST.data ? ST.data.items : S.items, id = items[i];
  if (id === 'spicy' && S.mode === 'walk' && rgActive()) {
    if (staminaOf() >= DASH.max) { showToast('スタミナ は まんたん だよ'); return; }
    items.splice(i, 1);
    ST.data.stamina = DASH.max;
    S.flash = 0.5; S.flashColor = '255,120,60'; S.shake = 0.3;
    [523, 784, 1047].forEach((f, k) => note(f, k * 0.06, 0.16, { type: 'square', vol: 0.06 }));
    showToast('げきから カレー を たべた！ からーい！ スタミナ が まんたん！', 2.6);
    stSave('dungeon'); renderHud(); stRenderHud();
    return;
  }
  baseUseItemDash(i);
};

// ---------------------------------------------------------------------
//  ダッシュ
// ---------------------------------------------------------------------
const dashFree = (x, y) => {
  const M = S.maze;
  if (x < 0 || y < 0 || x >= M.TW || y >= M.TH || !M.grid[y * M.TW + x]) return false;
  if (typeof rgGapAt === 'function' && (rgGapAt(x, y) || rgBushAt(x, y))) return false;
  if (M.enemies.some((e) => e.x === x && e.y === y) || (M.death && M.death.x === x && M.death.y === y)) return false;
  return true;
};
function rgDash(dir) {
  if (!rgActive() || S.mode !== 'walk' || S.monster || RG.special || RG.climb || RG.run || S.moveT < 1 || RG.lock > 0 || S.mazeLock > 0) return false;
  if (typeof ITEMUI !== 'undefined' && ITEMUI.open) return false;
  const d = dir || S.dir || (S.facing < 0 ? 'left' : 'right'), [dx, dy] = DIR_VEC[d];
  S.dir = d; if (dx) S.facing = dx;
  if (staminaOf() < 1) { showToast('スタミナ が ない……「げきから カレー」で もどるよ（あるいて も すこし ずつ もどる）', 2.6); SFX.bad(); return false; }
  if (!dashFree(S.pos.x + dx, S.pos.y + dy)) { showToast('その さき には はしれない', 1.6); return false; }
  ST.data.stamina--;
  heldDirs.length = 0; RG.holdT = 0;
  RG.run = { dir: d, left: DASH.len, dust: 0 };
  [660, 990].forEach((f, k) => note(f, k * 0.05, 0.08, { type: 'square', vol: 0.05 }));
  dashStep();
  return true;
}
function dashStep() {
  const R = RG.run, [dx, dy] = DIR_VEC[R.dir];
  R.left--;
  S.from = { ...S.pos }; S.pos = { x: S.pos.x + dx, y: S.pos.y + dy }; S.moveT = 0; RG.dash = true;
  SFX.step();
  const hs = S.maze.heroScreen;
  if (hs) for (let i = 0; i < 4; i++) spawn('twinkle', hs.x - dx * 20 + rnd(-10, 10), hs.y + 36 + rnd(-6, 6), { color: '#e9e2f2', size: rnd(4, 8) });
}
// はしって いる あいだ は てき が うごかない
const baseWorldTurnDash = rgWorldTurn;
rgWorldTurn = function () { if (RG.run) return false; return baseWorldTurnDash(); };

const baseArriveDash = rgArrive;
rgArrive = function () {
  const R = RG.run, M = S.maze, lv0 = typeof specialLevel === 'function' ? specialLevel() : 0;
  if (!R) RG.regen = (RG.regen || 0) + 1;
  baseArriveDash();
  // ひっさつ ゲージ が 1だん たまった
  const lv = typeof specialLevel === 'function' ? specialLevel() : 0;
  if (lv > lv0) {
    showToast(`✨ ひっさつ ゲージ が ${'★'.repeat(lv)} に なった！`, 2.2);
    [1047, 1319, 1568].forEach((f, k) => note(f, k * 0.07, 0.18, { type: 'sine', vol: 0.06 }));
    const hs = M.heroScreen;
    if (hs) for (let i = 0; i < 12; i++) spawn('twinkle', hs.x + rnd(-30, 30), hs.y + rnd(-50, 20), { color: pick(['#fff3a0', '#ffd84a', '#ffffff']), size: rnd(6, 12) });
  }
  // あるいて スタミナ が もどる
  if (!R && RG.regen >= DASH.regenSteps) {
    RG.regen = 0;
    if (staminaOf() < DASH.max) { ST.data.stamina++; note(880, 0, 0.08, { type: 'triangle', vol: 0.04 }); }
  }
  if (!R) return;
  // つぎ の 1マス（かいだん・たからばこ・おとしあな・たたかい など で とまる）
  const [dx, dy] = DIR_VEC[R.dir], at = (o) => o.x === S.pos.x && o.y === S.pos.y;
  const stop = R.left <= 0 || S.maze !== M || S.mode !== 'walk' || S.monster || RG.lock > 0 || S.mazeLock > 0 || RG.climb
    || at(M.goal) || M.chests.some(at) || !dashFree(S.pos.x + dx, S.pos.y + dy);
  if (stop) { RG.run = null; RG.dash = false; return; }
  dashStep();
};
// あたらしい かい・まち に もどった とき
const basePlaceHeroDash = rgPlaceHero;
rgPlaceHero = function (...a) { RG.run = null; return basePlaceHeroDash(...a); };
const baseEnterDungeonDash = enterDungeon;
enterDungeon = function (...a) { if (ST.data) ST.data.stamina = DASH.max; RG.regen = 0; return baseEnterDungeonDash(...a); };

// キー：Shift ＝ ダッシュ
addEventListener('keydown', (e) => {
  if ((e.key !== 'Shift') || e.repeat || !rgActive() || S.mode !== 'walk' || RG.special || RG.climb) return;
  if (typeof ITEMUI !== 'undefined' && ITEMUI.open) return;
  rgDash(); e.preventDefault();
}, true);

// ---------------------------------------------------------------------
//  ダッシュ ボタン（ジャンプ の うえ）。タップ ＝ いま の むき・フリック ＝ その むき
// ---------------------------------------------------------------------
(function buildDashButton() {
  const b = document.createElement('button');
  b.id = 'stDash'; b.type = 'button'; b.className = 'st-dash'; b.hidden = true;
  b.innerHTML = '<span class="lbl">ダッシュ</span><span class="pips"></span>';
  $('game').appendChild(b);
  let st = null;
  const fire = (dir) => { if (!st || st.fired) return; st.fired = true; b.classList.add('on'); rgDash(dir); };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (typeof audio === 'function') audio();
    st = { x: e.clientX, y: e.clientY, fired: false };
    try { b.setPointerCapture(e.pointerId); } catch { /* なにもしない */ }
  });
  b.addEventListener('pointermove', (e) => {
    if (!st || st.fired) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (Math.hypot(dx, dy) < 22) return;
    fire(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  const up = () => { if (!st) return; fire(null); st = null; b.classList.remove('on'); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, up));
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  let last = '';
  const sync = () => {
    const panel = (typeof ITEMUI !== 'undefined' && ITEMUI.open) || RG.special;
    const show = !!(ST.data && S.mode === 'walk' && typeof inDungeon === 'function' && inDungeon() && rgActive() && !S.monster && !RG.climb && !panel);
    const n = show ? staminaOf() : 0, key = `${show}|${n}`;
    if (key !== last) {
      last = key; b.hidden = !show;
      b.querySelector('.pips').innerHTML = Array.from({ length: DASH.max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
      b.classList.toggle('empty', n < 1);
    }
    requestAnimationFrame(sync);
  };
  requestAnimationFrame(sync);
})();

// ---------------------------------------------------------------------
//  にゃんこ・つえ の きょうか の ヒント（はじめて の とき だけ）
// ---------------------------------------------------------------------
const baseAddShardsDash = typeof addShards === 'function' ? addShards : null;
if (baseAddShardsDash) {
  addShards = function (...a) {
    const r = baseAddShardsDash(...a);
    if (ST.data && !ST.data.toldShard) { ST.data.toldShard = true; later(2.6, () => showToast('ほし の かけら は まち の「ぶきや」で つえ を つよく（＋1）できるよ！', 4)); }
    return r;
  };
}
const baseLeaveDungeonDash = leaveDungeon;
leaveDungeon = function (...a) {
  const r = baseLeaveDungeonDash(...a);
  const d = ST.data;
  if (d) d.stamina = DASH.max;
  if (d && !d.toldCat && d.items.includes('churu')) { d.toldCat = true; later(3.2, () => showToast('チュール を「ちゅなちゃん の いえ」の しろねこ に あげる と、にゃんこ が つよく なるよ！', 4.2)); }
  return r;
};

// ---------------------------------------------------------------------
//  ダンジョン を あきらめる（HUD の「🏳 あきらめる」）。きかんの はね と おなじ で まち に かえる（アイテム・アルカ は そのまま）
//  しよう：docs/GAME_SPEC.md 15.16
// ---------------------------------------------------------------------
const GIVEUP = { open: false };
(function giveupButton() {
  const b = document.createElement('button');
  b.id = 'giveupBtn'; b.type = 'button'; b.className = 'hud-btn st-giveup-btn'; b.textContent = '🏳 あきらめる'; b.hidden = true;
  const z = $('zukanBtn') || $('stMenuBtn');
  z.insertAdjacentElement('beforebegin', b);
  const lay = document.createElement('div');
  lay.id = 'giveupAsk'; lay.className = 'giveup-layer'; lay.hidden = true;
  lay.innerHTML = `<div class="st-card"><div class="inn-ask">ダンジョン を あきらめて まち に かえる？<small>もちもの と アルカ は そのまま。つぎ は さいしょ の かい から だよ</small></div>
    <div class="shop-foot two"><button type="button" class="buy yes">かえる</button><button type="button" class="close no">まだ がんばる</button></div></div>`;
  $('game').appendChild(lay);
  const can = () => !!(ST.data && typeof inDungeon === 'function' && inDungeon() && S.mode === 'walk' && !S.monster
    && !(typeof RG !== 'undefined' && RG.special) && !(typeof ITEMUI !== 'undefined' && ITEMUI.open));
  const close = () => { GIVEUP.open = false; lay.hidden = true; if (typeof heldDirs !== 'undefined') heldDirs.length = 0; };
  const open = () => { if (!can() || GIVEUP.open) return; GIVEUP.open = true; lay.hidden = false; if (typeof heldDirs !== 'undefined') heldDirs.length = 0; lay.querySelector('.no').focus({ preventScroll: true }); };
  const yes = () => {
    close();
    SFX.star();
    leaveDungeon('giveup');
    stDialog(['ダンジョン を あとに した……', 'ルミナリアの まちへ もどった。また ちょうせん しよう！']);
  };
  b.addEventListener('click', () => { if (typeof audio === 'function') audio(); open(); b.blur(); });
  lay.querySelector('.yes').addEventListener('click', yes);
  lay.querySelector('.no').addEventListener('click', close);
  // ひらいて いる あいだ は ほか の キー を とめる（← → で えらぶ・Enter で きめる・Esc で とじる）
  addEventListener('keydown', (e) => {
    if (!GIVEUP.open) return;
    const btns = [...lay.querySelectorAll('button')], i = btns.indexOf(document.activeElement);
    if (e.key === 'Escape') close();
    else if (/Arrow(Left|Right|Up|Down)/.test(e.key)) btns[(i + 1) % 2].focus({ preventScroll: true });
    else if ((e.key === 'Enter' || e.code === 'Space') && !e.repeat) (document.activeElement === btns[0] ? yes : close)();
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  addEventListener('keyup', (e) => { if (GIVEUP.open) e.stopImmediatePropagation(); }, true);
  setInterval(() => { b.hidden = !can() && !GIVEUP.open; if (GIVEUP.open && !inDungeon()) close(); }, 200);
})();
// ひらいて いる あいだ は おしろ のぼり も とまる
if (typeof climbUpdate === 'function') { const baseClimbUpdateGiveup = climbUpdate; climbUpdate = function (dt) { if (GIVEUP.open) return; baseClimbUpdateGiveup(dt); }; }
window.giveupTest = { open: () => $('giveupBtn').click(), isOpen: () => GIVEUP.open };

// テスト よう
window.dashTest = { dash: rgDash, stamina: () => staminaOf(), set(n) { ST.data.stamina = n; } };
