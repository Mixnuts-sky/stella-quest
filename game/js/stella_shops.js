'use strict';
// =====================================================================
//  ステラクエスト：アルカ と おみせ（やどや・ぶきや・アイテムや）、まちの もちもの
//  しよう：docs/GAME_SPEC.md「4. 街（宿屋）」「5. アルカ」「7. 武器」「8. アイテム」
// =====================================================================

const WEAPONS = [
  { name: 'ウッド・ウィスパー', atk: 1, price: 0, sold: false, note: 'はじめの つえ' },
  { name: 'クリスタル・ファング', atk: 2, price: 300, sold: true },
  { name: 'クリスタル・フルーフ', atk: 3, price: 500, sold: true },
  { name: 'アストラ・ノクス', atk: 4, price: 800, sold: true },
  { name: 'エターナル・レグナス', atk: 5, price: 1300, sold: true },
  { name: 'セブンスター・レインボーエターナル', atk: 6, price: 0, sold: false, note: 'ほしの しんでんで てに はいる' },
  { name: 'ネクロ・ルミナス', atk: 10, price: 0, sold: false, note: 'ふるい とけいだいで てに はいる' },
];
const weaponOf = (name) => WEAPONS.find((w) => w.name === name) || WEAPONS[0];
const heroAtk = () => weaponOf(ST.data.equip).atk;

const SHOP_ITEMS = [
  { id: 'herb', price: 15 },
  { id: 'churu', price: 30 },
  { id: 'water', price: 40 },
  { id: 'revive', price: 60 },
  { id: 'wing', price: 20 },
];
const INN_PRICE = 10;

const arcaTag = (n) => `<span class="arca-tag"><img src="${STIMG.arca}" alt="アルカ">${n}</span>`;

// ---------------------------------------------------------------------
//  パネル（おみせの がめん）：Esc で とじる、←→↑↓ で ボタンを えらぶ
// ---------------------------------------------------------------------
let panelClose = null;
function stPanel(html, onClose) {
  const p = $('stPanel');
  p.innerHTML = `<div class="st-card">${html}</div>`;
  panelClose = onClose || null;
  setMode('panel');
  const first = p.querySelector('button:not([disabled])');
  if (first) first.focus({ preventScroll: true });
  return p;
}
function closePanel() {
  if (S.mode !== 'panel') return;
  $('stPanel').innerHTML = '';
  const cb = panelClose; panelClose = null;
  setMode('st');
  if (cb) cb();
}
function panelKeydown(e) {
  if (e.key === 'Escape') { closePanel(); e.preventDefault(); return; }
  const btns = [...$('stPanel').querySelectorAll('button:not([disabled])')];
  if (!btns.length) return;
  const i = btns.indexOf(document.activeElement);
  if (['ArrowDown', 'ArrowRight'].includes(e.key)) { btns[(i + 1) % btns.length].focus(); e.preventDefault(); }
  if (['ArrowUp', 'ArrowLeft'].includes(e.key)) { btns[(i - 1 + btns.length) % btns.length].focus(); e.preventDefault(); }
  if ((e.key === 'Enter' || e.code === 'Space') && !e.repeat) { (btns[i] || btns[0]).click(); e.preventDefault(); }
}

function coinSound() { [1568, 2093].forEach((f, i) => note(f, i * 0.07, 0.12, { type: 'square', vol: 0.05 })); }
function shopMsg(text, bad) { const m = $('stPanel').querySelector('.shop-msg'); if (m) { m.textContent = text; m.className = 'shop-msg' + (bad ? ' bad' : ' good'); } }

// ---------------------------------------------------------------------
//  ぶきや
// ---------------------------------------------------------------------
function openWeaponShop(msg = '') {
  const d = ST.data;
  const list = WEAPONS.filter((w) => w.sold || d.weapons.includes(w.name));
  const cards = list.map((w) => {
    const owned = d.weapons.includes(w.name), eq = d.equip === w.name;
    const img = STIMG.weapons && STIMG.weapons[w.name];
    let btn;
    if (eq) btn = '<button type="button" disabled>そうびちゅう</button>';
    else if (owned) btn = `<button type="button" data-equip="${w.name}">そうびする</button>`;
    else btn = `<button type="button" class="buy" data-buy="${w.name}">${arcaTag(w.price)} かう</button>`;
    return `<div class="wcard ${eq ? 'eq' : ''}">
      ${img ? `<img src="${img}" alt="${w.name}">` : `<div class="noimg">✦</div>`}
      <div class="wname">${w.name}</div>
      <div class="watk">こうげき <b>${'★'.repeat(Math.min(w.atk, 10))}</b> ${w.atk}</div>
      ${btn}</div>`;
  }).join('');
  const p = stPanel(`
    <div class="shop-head"><span class="shop-title">⚔ ぶきや</span><span class="shop-arca">もっている ${arcaTag(d.arca)}</span></div>
    <div class="shop-talk">「いらっしゃい！ つよい つえが あると、まほうの ちからも つよく なるぞ！」</div>
    <div class="wgrid">${cards}</div>
    <div class="shop-msg">${msg}</div>
    <div class="shop-foot"><button type="button" class="close">おみせを でる（Esc）</button></div>`);
  p.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => buyWeapon(b.dataset.buy)));
  p.querySelectorAll('[data-equip]').forEach((b) => b.addEventListener('click', () => { d.equip = b.dataset.equip; stSave(); openWeaponShop(`「${d.equip}」を そうび した！`); }));
  p.querySelector('.close').addEventListener('click', closePanel);
}

function buyWeapon(name) {
  const d = ST.data, w = weaponOf(name);
  if (d.arca < w.price) { SFX.bad(); shopMsg(`アルカが たりないよ。あと ${w.price - d.arca} アルカ！`, true); return; }
  d.arca -= w.price;
  d.weapons.push(w.name);
  d.equip = w.name; // かったら すぐ そうび
  coinSound(); SFX.levelUp();
  stSave();
  openWeaponShop(`「${w.name}」を かった！ そうび したよ！`);
  stRenderHud();
}

// ---------------------------------------------------------------------
//  アイテムや
// ---------------------------------------------------------------------
function openItemShop(msg = '') {
  const d = ST.data;
  const rows = SHOP_ITEMS.map(({ id, price }) => {
    const have = d.items.filter((x) => x === id).length;
    return `<div class="irow">
      <span class="iicon">${ITEM_SVG[id]}</span>
      <span class="iinfo"><b>${ITEMS[id].name}</b><small>${ITEMS[id].desc}</small></span>
      <span class="ihave">${have ? `${have}こ もってる` : ''}</span>
      <button type="button" class="buy" data-buy="${id}">${arcaTag(price)} かう</button></div>`;
  }).join('');
  const p = stPanel(`
    <div class="shop-head"><span class="shop-title">🍛 アイテムや</span><span class="shop-arca">もっている ${arcaTag(d.arca)}</span></div>
    <div class="shop-talk">しまじろう「いらっしゃい！ かいじるカレー あるよ！ もちものは ${CONFIG.maxItems}こ まで（いま ${d.items.length}こ）」</div>
    <div class="ilist">${rows}</div>
    <div class="shop-msg">${msg}</div>
    <div class="shop-foot"><button type="button" class="close">おみせを でる（Esc）</button></div>`);
  p.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => buyItem(b.dataset.buy)));
  p.querySelector('.close').addEventListener('click', closePanel);
}

function buyItem(id) {
  const d = ST.data, price = SHOP_ITEMS.find((s) => s.id === id).price;
  if (d.items.length >= CONFIG.maxItems) { SFX.bad(); shopMsg(`もちものが いっぱいだよ（${CONFIG.maxItems}こ まで）`, true); return; }
  if (d.arca < price) { SFX.bad(); shopMsg(`アルカが たりないよ。あと ${price - d.arca} アルカ！`, true); return; }
  d.arca -= price;
  d.items.push(id);
  coinSound();
  stSave();
  renderHud();
  openItemShop(`「${ITEMS[id].name}」を かった！`);
  const btn = $('stPanel').querySelector(`[data-buy="${id}"]`); if (btn) btn.focus();
  stRenderHud();
}

// ---------------------------------------------------------------------
//  やどや
// ---------------------------------------------------------------------
function openInn() {
  const d = ST.data;
  stDialog([['うけつけの おねえさん', `いらっしゃいませ！\n${INN_PRICE}アルカで おとまりしますか？`]], () => {
    const p = stPanel(`
      <div class="shop-head"><span class="shop-title">🛏 やどや</span><span class="shop-arca">もっている ${arcaTag(d.arca)}</span></div>
      <div class="inn-ask">${INN_PRICE}アルカで とまる？<small>とまると HPが 6に なるよ（つぎの ダンジョンを でるまで）</small></div>
      <div class="shop-foot two"><button type="button" class="buy stay">とまる</button><button type="button" class="close">やめる</button></div>`);
    p.querySelector('.stay').addEventListener('click', () => { closePanelSilently(); stayInn(); });
    p.querySelector('.close').addEventListener('click', () => { closePanelSilently(); stDialog([['うけつけの おねえさん', 'またの おこしを おまちしてます♪']]); });
  });
}
function closePanelSilently() { $('stPanel').innerHTML = ''; panelClose = null; setMode('st'); }

function stayInn() {
  const d = ST.data;
  const paid = d.arca >= INN_PRICE;
  const lines = paid ? [['うけつけの おねえさん', 'おやすみなさい、ちゅなちゃん♪']]
    : [['うけつけの おねえさん', 'あら、アルカが たりないのね……'], ['うけつけの おねえさん', 'きょうは とくべつに タダでいいわよ♪'], ['うけつけの おねえさん', 'おやすみなさい、ちゅなちゃん♪']];
  stDialog(lines, () => {
    if (paid) { d.arca -= INN_PRICE; coinSound(); d.innBuff = true; }
    d.hp = stMaxHp(); // はらったら 6、タダなら 5
    sleepEffect(paid, () => {
      stSave();
      stDialog([['うけつけの おねえさん', 'つぎの ぼうけんも がんばって！']]);
    });
  });
}

// ねむる えんしゅつ：くらく なって ほしが キラキラ → HP の おしらせ
function sleepEffect(paid, done) {
  setMode('cut');
  const el = document.createElement('div');
  el.className = 'sleep-fx';
  el.innerHTML = '<div class="zzz">Z z z …</div>' + Array.from({ length: 40 }, () =>
    `<i style="left:${Math.random() * 100}%;top:${Math.random() * 80}%;animation-delay:${(Math.random() * 1.5).toFixed(2)}s"></i>`).join('');
  $('game').appendChild(el);
  [523, 659, 784, 659, 523].forEach((f, i) => note(f, i * 0.35, 0.5, { type: 'sine', vol: 0.08 })); // こもりうた
  setTimeout(() => {
    el.classList.add('wake');
    stRenderHud();
    const b = $('stBanner');
    b.textContent = paid ? '♥ HPが 6に なった！' : '♥ HPが ぜんかいふく！';
    b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    SFX.heal();
    for (let i = 0; i < 24; i++) spawn('heart', W / 2 + rnd(-200, 200), H * 0.6, { vx: rnd(-120, 120), vy: rnd(-300, -100), color: '#ff6fa8' });
  }, 2600);
  setTimeout(() => {
    el.remove(); $('stBanner').hidden = true;
    setMode('st');
    done();
  }, 4300);
}

// ---------------------------------------------------------------------
//  まちの もちもの（maze.js の アイテムバーを まちでも つかう）
//    S.items は ST.data.items と おなじ はいれつを さす
// ---------------------------------------------------------------------
const baseUseItemStella = useItem;
useItem = function (i) {
  if (!stActive()) { baseUseItemStella(i); return; }
  if (S.mode !== 'st') return;
  const d = ST.data, id = d.items[i];
  if (!id) return;
  if (id === 'herb' || id === 'water') {
    if (d.hp >= stMaxHp()) { showToast('HPは まんたん だよ'); return; }
    d.hp = id === 'herb' ? Math.min(stMaxHp(), d.hp + 1) : stMaxHp();
    d.items.splice(i, 1);
    SFX.heal();
    showToast(id === 'herb' ? 'やくそうで HPが 1 かいふく！' : 'かいふくの みずで HPが まんたん！');
    stSave(); renderHud(); stRenderHud();
    return;
  }
  showToast(id === 'revive' ? 'ふっかつの みずは HPが 0に なったら じどうで つかうよ' : `「${ITEMS[id].name}」は ダンジョンで つかうよ`);
};

const baseUpdateUIShops = updateUI;
updateUI = function () {
  baseUpdateUIShops();
  if (ST.data && S.items !== ST.data.items) S.items = ST.data.items;
  if (stActive()) $('itemBar').hidden = S.mode !== 'st' || !ST.scene;
  $('stPanel').hidden = S.mode !== 'panel';
  const atk = $('stAtk'); if (atk && ST.data) atk.textContent = heroAtk();
};

// まちで すうじキー 1〜5 で アイテム
const baseShopKeydown = (e) => {
  if (S.mode === 'panel') { panelKeydown(e); return true; }
  if (S.mode === 'st') {
    const m = e.code.match(/^Digit([1-5])$/);
    if (m && !e.repeat) { useItem(+m[1] - 1); e.preventDefault(); return true; }
  }
  return false;
};
STELLA_KEY_HOOKS.push(baseShopKeydown);
