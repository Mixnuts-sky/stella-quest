'use strict';
// =====================================================================
//  ステラクエスト：アイテム がめん と もちもの
//  ・もちもの は 8こ まで。がめん した の もちもの バー は ださない
//  ・「アイテム」ボタン（I キー）で アイテム がめん：えらぶ → つかう／とじる
//    （すうじ キー 1〜8 は その ばんごう の アイテムを すぐ つかう）
//  ・かいふく アイテム は かいじるカレー（HP1）・おおもり かいじるカレー（ぜんかいふく）
//  stella_shops.js・stella_dungeon.js の あと、stella_touch.js の まえ に よむ
//  しよう：docs/GAME_SPEC.md 14.1・14.6
// =====================================================================

CONFIG.maxItems = 8;
Object.assign(ITEMS.herb, { name: 'かいじるカレー', desc: 'HPを 1 かいふく' });
Object.assign(ITEMS.water, { name: 'おおもり かいじるカレー', desc: 'HPを ぜんぶ かいふく' });
Object.assign(ITEMS.scale, { desc: 'その かい の ちず と かいだん（ボス）の ばしょが ぜんぶ みえる' });
Object.assign(ITEMS.churu, { desc: 'たたかい で つかう：にゃんこ が てき を たおす（ボス には せいかい 1かい ぶん の ダメージ）' });
// カレーの え（おさら・ごはん・ルー・かい）
const currySVG = (big) => `<svg viewBox="0 0 40 40">
  <ellipse cx="20" cy="27" rx="${big ? 18 : 16}" ry="${big ? 9 : 8}" fill="#ffffff" stroke="#3a2a4d" stroke-width="2.2"/>
  <path d="M${big ? 6 : 8} 25 C${big ? 8 : 10} 15 20 13 23 17 C26 13 ${big ? 34 : 32} 16 ${big ? 33 : 31} 24 C25 29 13 29 ${big ? 6 : 8} 25Z" fill="#fffaf0" stroke="#3a2a4d" stroke-width="1.6"/>
  <path d="M19 24 C20 18 27 16 ${big ? 33 : 31} 23 C28 28 22 29 19 24Z" fill="#c9771f" stroke="#3a2a4d" stroke-width="1.6"/>
  <path d="M24 21 l3 -3 l3 3 z" fill="#f4c7a1" stroke="#3a2a4d" stroke-width="1.3"/>
  ${big ? '<path d="M12 12 l2 -5 l2 5 M18 9 l2 -5 l2 5" stroke="#ff6fa8" stroke-width="2" fill="none"/>' : ''}
</svg>`;
ITEM_SVG.herb = currySVG(false);
ITEM_SVG.water = currySVG(true);
$('itemBar').hidden = true;

// ---------------------------------------------------------------------
//  つかう（まち・たてもの・ダンジョン）
// ---------------------------------------------------------------------
const baseUseItemItems = useItem;
useItem = function (i) {
  const items = ST.data ? ST.data.items : S.items, id = items[i];
  const town = S.mode === 'st', dungeon = S.mode === 'walk' && inDungeon();
  if (!id || (!town && !dungeon)) return;
  if (id === 'churu') { showToast('チュール は たたかい の とき に「🎒 アイテム」から つかうよ', 2.6); return; }
  if (id === 'herb' || id === 'water') {
    const hp = town ? ST.data.hp : S.hp, max = stMaxHp();
    if (hp >= max) { showToast('HPは まんたん だよ'); return; }
    const nhp = id === 'herb' ? Math.min(max, hp + 1) : max;
    items.splice(i, 1);
    if (town) ST.data.hp = nhp; else { S.hp = nhp; ST.data.hp = nhp; }
    if (dungeon) healEffect(); else SFX.heal();
    showToast(id === 'herb' ? 'かいじるカレー を たべた！ HPが 1 かいふく！' : 'おおもり かいじるカレー を たべた！ HPが まんたん！');
    stSave(); renderHud(); stRenderHud();
    return;
  }
  baseUseItemItems(i);
};

// ---------------------------------------------------------------------
//  アイテム がめん
// ---------------------------------------------------------------------
const ITEMUI = { open: false, sel: 0 };
(function buildItemPanel() {
  const el = document.createElement('div');
  el.id = 'stItemPanel'; el.className = 'overlay st-panel item-panel'; el.hidden = true;
  $('game').appendChild(el);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) { if (e.target === el) closeItemPanel(); return; }
    if (b.dataset.i !== undefined) { ITEMUI.sel = +b.dataset.i; renderItemPanel(); }
    else if (b.classList.contains('use')) useFromPanel();
    else if (b.classList.contains('close')) closeItemPanel();
  });
})();

function openItemPanel() {
  if (ITEMUI.open || !(S.mode === 'st' || (S.mode === 'walk' && inDungeon()) || canBattleItem())) return;
  ITEMUI.open = true;
  ITEMUI.sel = Math.min(ITEMUI.sel, Math.max(0, ST.data.items.length - 1));
  if (typeof heldDirs !== 'undefined') heldDirs.length = 0; // ダンジョン：あるくのを とめる
  if (typeof twHeld !== 'undefined') twHeld.length = 0;
  if (typeof INT !== 'undefined') INT.held.length = 0;
  SFX.tap ? SFX.tap() : note(880, 0, 0.08, { type: 'sine', vol: 0.06 });
  renderItemPanel();
  $('stItemPanel').hidden = false;
}
function closeItemPanel() {
  if (!ITEMUI.open) return;
  ITEMUI.open = false;
  $('stItemPanel').hidden = true;
}
function renderItemPanel() {
  const items = ST.data.items, sel = items[ITEMUI.sel];
  let slots = '';
  for (let i = 0; i < CONFIG.maxItems; i++) {
    const id = items[i];
    slots += id
      ? `<button type="button" class="islot${i === ITEMUI.sel ? ' sel' : ''}" data-i="${i}"><span class="key">${i + 1}</span>${ITEM_SVG[id]}<span class="nm">${ITEMS[id].name}</span></button>`
      : `<span class="islot empty"><span class="key">${i + 1}</span></span>`;
  }
  $('stItemPanel').innerHTML = `<div class="st-card item-card">
    <div class="shop-head"><span class="shop-title">🎒 もちもの</span><span class="shop-arca">${items.length} / ${CONFIG.maxItems}</span></div>
    <div class="islots">${slots}</div>
    <div class="idetail">${sel ? `<b>${ITEMS[sel].name}</b>：${ITEMS[sel].desc}` : 'なにも もっていないよ'}</div>
    <div class="shop-foot two"><button type="button" class="buy use" ${sel ? '' : 'disabled'}>つかう（Enter）</button><button type="button" class="close">とじる（Esc）</button></div>
  </div>`;
}
function useFromPanel() {
  const n = ST.data.items.length;
  if (!ST.data.items[ITEMUI.sel]) return;
  const id = ST.data.items[ITEMUI.sel];
  if (canBattleItem()) { battleUseItem(ITEMUI.sel); return; }
  // ダンジョンを でる・ワープ する アイテムは がめんを とじてから
  if (id === 'wing' || id === 'scale') { closeItemPanel(); useItem(ITEMUI.sel); return; }
  useItem(ITEMUI.sel);
  if (!ITEMUI.open) return;
  if (ST.data.items.length !== n) ITEMUI.sel = Math.max(0, Math.min(ITEMUI.sel, ST.data.items.length - 1));
  renderItemPanel();
}

// ---------------------------------------------------------------------
//  たたかい の なか：1かい だけ アイテム（かいふく・チュール）
// ---------------------------------------------------------------------
const canBattleItem = () => !!(ST.data && ST.battle && !ST.battle.practice && S.mode === 'question' && S.monster && !S.monster.nanmon && !S.monster.itemUsed);
function battleUseItem(i) {
  const m = S.monster, items = ST.data.items, id = items[i];
  if (!m || !id) return;
  if (id === 'herb' || id === 'water') {
    if (S.hp >= stMaxHp()) { showToast('HPは まんたん だよ'); return; }
    items.splice(i, 1); m.itemUsed = true;
    S.hp = id === 'herb' ? Math.min(stMaxHp(), S.hp + 1) : stMaxHp(); ST.data.hp = S.hp;
    closeItemPanel(); healEffect(); renderHud();
    showToast(id === 'herb' ? 'かいじるカレー を たべた！ HPが 1 かいふく！' : 'おおもり かいじるカレー を たべた！ HPが まんたん！', 2.4);
    return;
  }
  if (id === 'churu') {
    items.splice(i, 1); m.itemUsed = true;
    closeItemPanel();
    if (m.boss) { // ボス には せいかい 1かい ぶん の ダメージ
      const dmg = heroAtk() + (typeof staffPlus === 'function' ? staffPlus() : 0);
      catEnter(['まかせる', 'にゃ！']);
      later(1.0, () => {
        if (S.monster !== m) return;
        m.hp = Math.max(1, m.hp - dmg); m.hitFlash = 1; S.shake = 0.6; SFX.meow(); if (SFX.boom) SFX.boom();
        for (let k = 0; k < 20; k++) spawn('star', m.x, GROUND() - m.height * 0.5, { vx: rnd(-300, 300), vy: rnd(-380, 40), color: '#ffb3e0' });
        catSay(['にゃんこ', `パンチ！ −${dmg}`]); renderHud();
      });
      later(2.4, () => catLeave());
      return;
    }
    setMode('answered'); // ふつう の てき は にゃんこ が たおす
    $('quiz').hidden = true;
    churuAttack();
    return;
  }
  showToast(`「${ITEMS[id].name}」は たたかい では つかえないよ`, 2.2);
}
(function battleItemButton() {
  const b = document.createElement('button');
  b.id = 'battleItemBtn'; b.type = 'button'; b.className = 'st-item-btn battle-item'; b.hidden = true; b.textContent = '🎒 アイテム（1かい）';
  $('game').appendChild(b);
  b.addEventListener('click', () => { openItemPanel(); b.blur(); });
  setInterval(() => { b.hidden = !canBattleItem() || ITEMUI.open; }, 150);
})();

// キー：I で ひらく、ひらいている あいだ は ←→↑↓ で えらぶ・Enter で つかう・Esc で とじる
addEventListener('keydown', (e) => {
  if (!ST.data) return;
  if (ITEMUI.open) {
    const n = ST.data.items.length, cols = 4;
    const mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.code];
    if (mv && n) ITEMUI.sel = Math.max(0, Math.min(n - 1, ITEMUI.sel + mv));
    if (mv) renderItemPanel();
    else if ((e.key === 'Enter' || e.code === 'Space') && !e.repeat) useFromPanel();
    else if (e.key === 'Escape' || e.code === 'KeyI') closeItemPanel();
    else { const m = e.code.match(/^(?:Digit|Numpad)([1-8])$/); if (m && !e.repeat) { ITEMUI.sel = Math.min(+m[1] - 1, Math.max(0, n - 1)); renderItemPanel(); } }
    e.preventDefault(); e.stopImmediatePropagation();
    return;
  }
  if (e.code === 'KeyI' && !e.repeat && canBattleItem()) { openItemPanel(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  const walkable = S.mode === 'st' && (ST.scene === 'town' || ST.scene === 'interior') || (S.mode === 'walk' && inDungeon());
  if (!walkable || e.repeat) return;
  if (e.code === 'KeyI') { openItemPanel(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  const m = e.code.match(/^Digit([1-8])$/);
  if (m) { useItem(+m[1] - 1); e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

// テスト よう
window.itemTest = { open: openItemPanel, close: closeItemPanel };
