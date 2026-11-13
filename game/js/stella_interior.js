'use strict';
// =====================================================================
//  ステラクエスト：たてものの なか（やどや・ぶきや・アイテムや・おしろ・ちゅなちゃんの いえ・ダンジョンの いりぐち）と まちの たてものの え
//  ・なかの え（デザイン/建物/○○内装.png など）を はいけいに して、やじるしキーで じゆうに あるく
//      walk：あるける ところ（え の ピクセルで かいた たかっけい）   block：とおれない ところ（テーブル など）
//      spots：ちかくで Enter（または ぶつかる）と しらべる・はなす   exit：はいると まちへ
//  ・まちの たてもの は デザイン/建物/ の え に さしかえる（なければ いままでの canvas の え）
//  え は tools/make_building_images.py が game/data/building_images.js に まとめる。
//  しよう：docs/GAME_SPEC.md「4.5 たてものの なか」
// =====================================================================

const BIMG = { outside: {}, inside: {} };
(function loadBuildingImages() {
  const src = window.BUILDING_IMAGES || { outside: {}, inside: {} };
  for (const kind of ['outside', 'inside']) {
    Object.entries(src[kind] || {}).forEach(([k, url]) => { const im = new Image(); im.src = url; BIMG[kind][k] = im; });
  }
})();
const bimgReady = (im) => !!im && im.complete && im.naturalWidth > 0;

// ---------------------------------------------------------------------
//  なか の せってい（ざひょう は それぞれの え の ピクセル。大きさ は BUILDING_IMAGES.size）
//    デザイン/建物/内装全般.png を へやごとに きりだした え（ぶきや・やどや・しんでん・いえ・おしろ）と、
//    内装アイテム屋.png・ダンジョン入口.png
//    heroH：ちゅなちゃんの たかさ   npcs：え の ある ひと（NPC_SPR の なまえ）   door：はいると act
// ---------------------------------------------------------------------
const isLit = () => !!(ST.data.flags.trueNecro || ST.data.flags.deathNecro);
const starCount = () => Object.keys(ST.data.cleared || {}).filter((k) => ST.data.cleared[k] > 0).length;
const INTERIORS = {
  weapon: {
    img: 'weaponIn', name: 'ぶきや', heroH: 46, start: { x: 210, y: 326 }, back: { x: 24, y: 11 },
    walk: [[[65, 198], [352, 198], [352, 312], [242, 312], [242, 350], [178, 350], [178, 312], [65, 312]],
      [[65, 150], [130, 150], [130, 200], [65, 200]], [[288, 150], [352, 150], [352, 200], [288, 200]]],
    block: [[128, 150, 162, 48], [122, 222, 72, 80], [248, 212, 64, 94]],
    exit: { x: 178, y: 340, w: 64, h: 10 },
    spots: [
      { id: 'counter', x: 210, y: 208, r: 34, label: 'てんいん', act: () => openWeaponShop() },
      { id: 'display', x: 160, y: 308, r: 28, label: 'てんじ', act: () => stDialog(['かっこいい ぶきが ならんでいる……！', 'かうときは てんいんさんに はなしかけてね。']) },
      { id: 'armor', x: 95, y: 170, r: 30, label: 'よろい', act: () => stDialog(['ピカピカの よろいだ。', ['ちゅなちゃん', 'ちょっと おもそう……'], ['にゃんこ', 'にゃ（まほうつかい には つえ が いちばん）']]) },
    ],
  },
  inn: {
    img: 'innIn', name: 'やどや', heroH: 46, start: { x: 207, y: 326 }, back: { x: 4, y: 11 },
    walk: [[[40, 188], [395, 188], [395, 315], [242, 315], [242, 350], [172, 350], [172, 315], [40, 315]],
      [[198, 132], [256, 132], [256, 192], [198, 192]], [[256, 205], [395, 205], [395, 232], [256, 232]]],
    block: [[45, 148, 152, 40], [48, 205, 64, 42], [140, 203, 64, 44], [88, 256, 70, 50], [262, 140, 50, 70], [338, 140, 50, 70], [258, 234, 54, 72], [336, 234, 54, 72]],
    exit: { x: 172, y: 340, w: 70, h: 10 },
    spots: [
      { id: 'counter', x: 120, y: 196, r: 38, label: 'うけつけ', act: () => openInn() },
      { id: 'stairs', x: 226, y: 140, r: 24, label: 'かいだん', act: () => stDialog(['2かいは おきゃくさんの へや みたい。', ['うけつけの おねえさん', 'おとまりは うけつけで どうぞ♪']]) },
      { id: 'bed', x: 325, y: 220, r: 28, label: 'ベッド', act: () => stDialog(['ふかふかの ベッド が ならんでいる。', ['うけつけの おねえさん', 'とまるなら うけつけで おはなし してね♪']]) },
      { id: 'table', x: 110, y: 312, r: 30, label: 'しょくどう', act: () => stDialog(['テーブルに おいしそうな スープ が おいてある。', 'いい におい……！']) },
    ],
  },
  house: {
    img: 'houseIn', name: 'ちゅなちゃんの いえ', heroH: 46, start: { x: 280, y: 302 }, back: { x: 4, y: 16 },
    walk: [[[35, 112], [505, 112], [505, 280], [305, 280], [305, 334], [255, 334], [255, 280], [35, 280]]],
    block: [[48, 98, 64, 76], [26, 178, 42, 95], [76, 226, 66, 44], [148, 208, 48, 70], [193, 95, 16, 76], [193, 205, 16, 75],
      [206, 98, 48, 74], [303, 103, 78, 42], [276, 183, 62, 46], [303, 228, 44, 26], [391, 95, 16, 54], [376, 200, 22, 80],
      [462, 132, 46, 64], [408, 100, 58, 46], [468, 203, 40, 70], [422, 238, 56, 40]],
    exit: { x: 255, y: 324, w: 50, h: 10 },
    spots: [
      { id: 'bed', x: 85, y: 186, r: 26, label: 'ベッド', act: () => stDialog(['ふかふかの ベッド。うさぎの もようが かわいい。', ['ちゅなちゃん', 'まだ ねむくないよ！']]) },
      { id: 'desk', x: 112, y: 222, r: 24, label: 'べんきょう', act: () => stDialog(['べんきょうづくえ。', ['ちゅなちゃん', 'きょうも かんじと けいさん、がんばろう！']]) },
      { id: 'window', x: 150, y: 125, r: 26, label: 'まど', act: () => stDialog(['まどから そとが みえる。', isLit() ? 'よぞらに ほしが いっぱい かがやいている！' : 'よぞらの ほしが すくない……']) },
      { id: 'kitchen', x: 340, y: 152, r: 26, label: 'キッチン', act: () => stDialog(['キッチン。おなべから いい におい。', ['ちゅなちゃん', 'ぼうけんから かえったら たべよう♪']]) },
      { id: 'cat', x: 325, y: 262, r: 26, label: 'しろねこ', act: () => { SFX.meow(); stDialog([['しろねこ', 'ふにゃ〜……（おひるね ちゅう）'], ['にゃんこ', 'にゃっ（しずかに しよう）']]); } },
      { id: 'bear', x: 452, y: 230, r: 26, label: 'くまさん', act: () => stDialog(['くまの ぬいぐるみ。', ['ちゅなちゃん', 'いってきます、くまさん！']]) },
    ],
  },
  castle: {
    img: 'castleIn', name: 'おしろ', heroH: 50, start: { x: 332, y: 366 }, back: { x: 15, y: 5 },
    walk: [[[205, 175], [455, 175], [455, 282], [415, 282], [415, 388], [250, 388], [250, 282], [205, 282]],
      [[258, 135], [410, 135], [410, 178], [258, 178]], [[45, 198], [208, 198], [208, 282], [45, 282]], [[452, 198], [615, 198], [615, 282], [452, 282]]],
    block: [[82, 212, 92, 55], [486, 220, 82, 48], [560, 212, 42, 50], [252, 262, 42, 80], [372, 262, 42, 80], [258, 95, 40, 62], [365, 95, 40, 62],
      [290, 150, 32, 26], [350, 150, 32, 26], [210, 236, 30, 22]],
    npcs: [{ spr: 'おうさま', x: 306, y: 172, h: 62 }, { spr: 'おひめさま', x: 366, y: 172, h: 58 }, { spr: 'このえへい', x: 225, y: 254, h: 54 }],
    exit: { x: 300, y: 378, w: 65, h: 10 },
    spots: [
      { id: 'king', x: 306, y: 190, r: 30, label: 'おうさま', act: () => stDialog(kingLines()) },
      { id: 'princess', x: 366, y: 190, r: 30, label: 'おひめさま', act: () => stDialog(princessLines()) },
      { id: 'guard', x: 228, y: 276, r: 28, label: 'このえへい', act: () => stDialog(guardLines()) },
      { id: 'map', x: 120, y: 206, r: 28, label: 'ちず', act: () => stDialog(['せかいの ちず だ。', 'ルミナリアの みなみに ダンジョン、きたに しんでん と とけいだい が かいてある。']) },
      { id: 'books', x: 545, y: 206, r: 28, label: 'ほんだな', act: () => stDialog(['むずかしそうな ほんが いっぱい。', '『ほしと まほうの れきし』……『7つの ほしの でんせつ』……']) },
    ],
  },
  item: {
    img: 'itemIn', name: 'アイテムや', heroH: 125, start: { x: 600, y: 630 }, back: { x: 24, y: 16 },
    walk: [[[230, 285], [960, 285], [960, 540], [700, 540], [700, 668], [500, 668], [500, 540], [230, 540]],
      [[300, 200], [430, 200], [430, 290], [300, 290]], [[755, 200], [940, 200], [940, 290], [755, 290]]],
    block: [[425, 198, 336, 88], [385, 335, 190, 168], [635, 335, 192, 168]],
    exit: { x: 500, y: 652, w: 200, h: 16 },
    spots: [
      { id: 'counter', x: 592, y: 300, r: 80, label: 'てんいん', act: () => openItemShop() },
      { id: 'potion', x: 480, y: 525, r: 60, label: 'くすり', act: () => stDialog(['いろとりどりの くすり が ならんでいる。', 'かうときは てんいんさんに はなしかけてね。']) },
      { id: 'goods', x: 730, y: 525, r: 60, label: 'しなもの', act: () => stDialog(['はね・りんご・すいしょう……ふしぎな しなもの が いっぱい！']) },
      { id: 'door', x: 860, y: 260, r: 60, label: 'とびら', act: () => stDialog(['おくの くら に つづく とびら。', ['てんいんさん', 'そこは くら だから はいっちゃ だめよ〜']]) },
    ],
  },
  gate: {
    img: 'gateIn', name: 'ダンジョンの いりぐち', heroH: 120, start: { x: 595, y: 730 }, back: { x: 14, y: 18 },
    walk: [[[140, 370], [1060, 370], [1060, 545], [720, 545], [720, 772], [470, 772], [470, 545], [140, 545]],
      [[520, 325], [680, 325], [680, 375], [520, 375]]],
    block: [[115, 362, 142, 165], [108, 468, 104, 84], [305, 298, 112, 124], [788, 298, 108, 124], [425, 278, 92, 122], [683, 278, 92, 122],
      [836, 378, 118, 152], [994, 362, 72, 122], [984, 472, 82, 74], [404, 488, 72, 34]],
    npcs: [{ spr: 'もんばんの へいし', x: 440, y: 518, h: 120 }],
    exit: { x: 470, y: 758, w: 250, h: 16 },
    door: { x: 525, y: 325, w: 150, h: 18, act: () => gateDoor() }, // アーチ に はいると なんいど を えらぶ
    spots: [
      { id: 'soldier', x: 440, y: 545, r: 70, label: 'へいたいさん', act: () => stDialog(gateSoldierLines()) },
      { id: 'sign', x: 895, y: 545, r: 70, label: 'かんばん', act: () => stDialog(['かんばん：『ここから さき ダンジョン』', '『おくへ すすむ ほど つよい まもの が でます』', `『いま いける ところ：なんいど ${Math.min(6, maxCleared(ST.data) + 1)} まで』`]) },
      { id: 'tools', x: 210, y: 545, r: 70, label: 'どうぐ', act: () => stDialog(['ぼうけんしゃ の わすれもの かな？ つるはし と ちず が おいてある。']) },
    ],
  },
};
// ダンジョンの いりぐち：HP が へっていたら へいたいさん が 1かい だけ おしえてくれる（もういちど アーチ に すすめば はいれる）
function gateDoor() {
  const hp = ST.data.hp, max = stMaxHp();
  if (hp < max && !INT.hpWarned) {
    INT.hpWarned = true;
    stDialog([['へいたいさん', 'ちょっと まった！'], ['へいたいさん', `HPが へっているぞ（${'♥'.repeat(hp)}${'♡'.repeat(max - hp)}）。`],
      ['へいたいさん', 'やどやで やすむか、やくそう で かいふく してから いくと いいぞ。'], ['へいたいさん', 'それでも いくなら、もういちど アーチ に すすむんだ！']]);
    return;
  }
  enterDungeonGate();
}
function gateSoldierLines() {
  const S1 = (t) => ['へいたいさん', t];
  if (ST.data.hp < stMaxHp()) return [S1('HPが へっているな。むりは きんもつ だぞ！'), S1('やどやで やすめば げんき いっぱいに なれるぞ。')];
  return [S1('この さきは ダンジョンだ。'), S1('おくの アーチに すすむと、いく ダンジョンを えらべるぞ！'), S1('ボスまでの みちには おとしあなの へやが ある。あしもとに きを つけるんだ！')];
}

// おしろ の ひとたち（すすみぐあい で かわる）
function kingLines() {
  const f = ST.data.flags, n = starCount(), K = (t) => ['おうさま', t];
  if (f.gameClear) return [K('おお、ちゅなよ！ よぞらが ほしで いっぱいじゃ！'), K('そなたに「ほしの ゆうしゃ」の なを さずけよう！'), K('これからも ルミナリアを たのんだぞ。わっはっは！')];
  if (f.oldKey && !f.towerNecro) return [K('なに？ ダンジョンで「ふるびた かぎ」を みつけたとな？'), K('それは きたの はしの「ふるい とけいだい」の かぎ かもしれん。'), K('とけいだいの うらに ちいさな とびら が あるはずじゃ。きを つけるのじゃぞ！')];
  if (f.templeOpen && !f.templeCleared) return [K('きたの しんでんの とびらが ひかりだした そうじゃな。'), K('7つの なぞ を とけば、ほしの ちからが てに はいる という。'), K('そなたなら きっと とける！')];
  if (n > 0) return [K(`おお、ちゅなよ！ よぞらに ほしが ${n}つ もどってきたぞ！`), K('そなたは この くにの ほこりじゃ。'), K('ダンジョンの おくには、まだ ひほうが ねむっておる。たのんだぞ！')];
  return [K('よく きたな、ちいさな まほうつかい ちゅなよ。'), K('ほしが きえて、くにじゅうの みなが こまっておる……'), K('みなみの ダンジョンには むかしから「ひほう」が ねむっていると いわれておる。'), K('どうか ほしの ひかりを とりもどしてくれ！')];
}
function princessLines() {
  const f = ST.data.flags, n = starCount(), P = (t) => ['おひめさま', t];
  if (f.gameClear) return [P('ほしぞら、とっても きれい……！'), P('ちゅなちゃん、ほんとうに ありがとう！'), P('こんど いっしょに ほしぞら ピクニック しようね♪')];
  if (f.templeOpen && !f.templeCleared) return [P('しんでんの なぞ には「ほし」と「にじ」の ヒントが あるんですって。'), P('にじの いろの じゅんばん、おぼえてる？ あか・オレンジ・きいろ……'), P('ちゅなちゃん、がんばってね！')];
  if (n > 0) return [P('ゆうべ、まどから ほしが ふえているのが みえたわ！'), P('ちゅなちゃんの おかげね♪'), P('つかれたら やどやで とまってね。げんき いっぱいに なれるわよ。')];
  return [P('ちゅなちゃん、いらっしゃい！'), P('わたし、よぞらの ほしを みるのが だいすきなの。'), P('でも さいきん ほしが へって さみしい……'), P('ほしが もどったら、いっしょに ほしぞら を みようね！')];
}
function guardLines() {
  const n = starCount(), G = (t) => ['このえへい', t];
  if (ST.data.flags.gameClear) return [G('ちゅなどの！ ほしの ゆうしゃ ばんざい！')];
  if (n > 0) return [G('ちゅなどのの かつやく、しろじゅうの うわさ ですぞ！'), G('ぼうけんの まえには、ぶきや で つえを みておくと よいですぞ。')];
  return [G('ここは ルミナリアじょう です！'), G('おうさま と おひめさま が おまちかね ですぞ。')];
}
ST_PLACE.interior = '';

// ---------------------------------------------------------------------
//  ばめん
// ---------------------------------------------------------------------
const INT = { id: null, x: 0, y: 0, facing: 1, held: [], step: 0, near: null, sleeping: false, free: true, sparkle: 0, catHop: false, cat: null };
const curInt = () => INTERIORS[INT.id];

SCENES.interior = {
  enter(arg = {}) {
    INT.id = arg.id || 'inn';
    const c = curInt();
    const p = arg.pos || c.start;
    Object.assign(INT, { x: p.x, y: p.y, facing: 1, held: [], step: 0, near: null, sleeping: !!arg.sleeping, free: !arg.sleeping, sparkle: 0, catHop: false, cat: arg.cat || null, exiting: false, fresh: true, hpWarned: false }); // fresh：はいった とき おしっぱなし の キー は つかわない
    ST_PLACE.interior = c.name;
    if (!arg.silent) SFX.step();
  },
  update(dt) {
    if (S.mode !== 'st' || !INT.free || INT.exiting) return;
    const d = INT.held[INT.held.length - 1];
    if (d) {
      const [vx, vy] = TW_VEC[d], sp = intSize(curInt())[1] * 0.33 * dt;
      if (vx) INT.facing = vx;
      if (tryMoveInt(INT.x + vx * sp, INT.y + vy * sp)) {
        INT.step += dt;
        if (Math.floor(INT.step * 4) !== Math.floor((INT.step - dt) * 4)) SFX.step();
      }
    }
    INT.near = nearSpot();
    const c = curInt(), ex = c.exit, inZ = (z) => INT.x >= z.x && INT.x <= z.x + z.w && INT.y >= z.y && INT.y <= z.y + z.h;
    if (inZ(ex)) leaveInterior();
    else if (c.door && inZ(c.door)) { INT.held.length = 0; INT.y = c.door.y + c.door.h + c.heroH * 0.5; c.door.act(); }
  },
  keydown(e) {
    const d = TW_KEYS[e.code];
    if (d) {
      e.preventDefault();
      if (e.repeat && INT.fresh) return; // まえの ばめん から おしっぱなし → いちど はなして おしなおす まで うごかない
      INT.fresh = false;
      const i = INT.held.indexOf(d); if (i >= 0) INT.held.splice(i, 1); INT.held.push(d); return;
    }
    if ((e.key === 'Enter' || e.code === 'Space') && !e.repeat && INT.free) { const s = nearSpot(); if (s) { INT.held.length = 0; s.act(); } e.preventDefault(); }
  },
  keyup(e) { const d = TW_KEYS[e.code]; if (d) { const i = INT.held.indexOf(d); if (i >= 0) INT.held.splice(i, 1); } },
  draw() { drawInterior(); },
};

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function canStand(x, y) {
  const c = curInt();
  if (!c.walk.some((p) => inPoly(x, y, p))) return false;
  return !c.block.some(([bx, by, bw, bh]) => x > bx && x < bx + bw && y > by && y < by + bh);
}
const intSize = (c) => (window.BUILDING_IMAGES && BUILDING_IMAGES.size && BUILDING_IMAGES.size[c.img]) || [1200, 800];
function tryMoveInt(nx, ny) {
  if (canStand(nx, ny)) { INT.x = nx; INT.y = ny; return true; }
  if (canStand(nx, INT.y)) { INT.x = nx; return true; } // かべに そって すべる
  if (canStand(INT.x, ny)) { INT.y = ny; return true; }
  return false;
}
function nearSpot() {
  let best = null, bd = Infinity;
  for (const s of curInt().spots) { const d = Math.hypot(s.x - INT.x, s.y - INT.y); if (d < s.r && d < bd) { best = s; bd = d; } }
  return best;
}

function enterInterior(id, opts = {}) {
  INT.held.length = 0;
  setScene('interior', { id, ...opts });
}
function leaveInterior() {
  INT.exiting = true; INT.held.length = 0;
  const c = curInt();
  if (INT.id === 'house' && ST.data.flags.opStage === 'room') ST.data.flags.opStage = 'ch2'; // オープニング：へや から まちへ
  setScene('town', { pos: { ...c.back } });
}

// ---------------------------------------------------------------------
//  かく
// ---------------------------------------------------------------------
function interiorView(c = curInt()) {
  const [iw, ih] = intSize(c);
  const s = Math.min(W / iw, (H - 20) / ih);
  return { s, ox: (W - iw * s) / 2, oy: (H - ih * s) / 2 + 10, iw, ih };
}
function drawInterior() {
  const c = curInt(), v = interiorView(c), im = BIMG.inside[c.img], k = c.heroH / 92;
  if (!$('itemBar').hidden) $('itemBar').hidden = true; // なか では もちもの バー を ださない（いりぐち が かくれる）
  ctx.fillStyle = '#2a1d3a'; ctx.fillRect(-30, -30, W + 60, H + 60);
  ctx.save(); ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
  if (bimgReady(im)) ctx.drawImage(im, 0, 0, v.iw, v.ih);
  // ひと と ちゅなちゃん を うえから じゅんに
  const objs = (c.npcs || []).map((n) => ({ y: n.y, draw: () => { ctx.save(); ctx.translate(n.x, n.y); drawNpcSprite(n.spr, n.h, n.flip); ctx.restore(); } }));
  if (INT.id === 'house' && INT.cat) objs.push({ y: INT.cat.y, draw: () => drawIntCat(INT.cat.x, INT.cat.y, c.heroH * 0.55) });
  if (INT.sleeping) objs.push({ y: 0, draw: () => drawSleeping() });
  else objs.push({ y: INT.y, draw: () => drawIntHero(c, k, v) });
  objs.sort((p, q) => p.y - q.y).forEach((o) => o.draw());
  ctx.restore();
  // しらべられる ところ（ふだ は がめんの おおきさ で）
  if (INT.near && S.mode === 'st' && INT.free) {
    const s = INT.near;
    ctx.save(); ctx.globalAlpha = 0.85 + Math.sin(S.t * 5) * 0.15;
    townLabel(`${s.label}（Enter）`, v.ox + s.x * v.s, v.oy + (s.y - c.heroH) * v.s - 26, '#8a5cd1');
    ctx.restore();
  }
}
function drawIntHero(c, k, v) {
  const spr = SPR.hero; if (!spr) return;
  const hh = c.heroH, w = hh * spr.w / spr.h, bob = INT.held.length && INT.free ? Math.abs(Math.sin(INT.step * 14)) * 4 * k : 0;
  ctx.fillStyle = 'rgba(30,10,50,.25)'; ctx.beginPath(); ctx.ellipse(INT.x, INT.y, w * 0.34, 6 * k, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(INT.x, INT.y - bob); ctx.scale(INT.facing < 0 ? -1 : 1, 1);
  ctx.shadowColor = 'rgba(58,42,77,.9)';
  const o = 1.5 * v.s * dpr; // ふちどり（がめんの ピクセル）
  for (const [ox, oy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) { ctx.shadowOffsetX = ox; ctx.shadowOffsetY = oy; if (spr.white) ctx.drawImage(spr.white, -w / 2, -hh, w, hh); }
  ctx.shadowColor = 'transparent'; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.drawImage(spr.canvas, -w / 2, -hh, w, hh);
  ctx.restore();
  if (INT.sparkle > 0) { // つえが ひかる
    INT.sparkle -= 1 / 60;
    for (let i = 0; i < 2; i++) spawn('twinkle', v.ox + (INT.x + hh * 0.3 * INT.facing) * v.s + rnd(-12, 12), v.oy + (INT.y - hh * 0.75) * v.s + rnd(-12, 12), { color: '#fff3a0', size: rnd(8, 16) });
  }
}
function drawIntCat(x, y, h) {
  if (!SPR.cat) return;
  const w = h * SPR.cat.w / SPR.cat.h, bob = Math.abs(Math.sin(S.t * 5)) * h * (INT.catHop ? 0.2 : 0.03);
  ctx.drawImage(SPR.cat.canvas, x - w / 2, y - h - bob, w, h);
}
// ベッドで ねている ちゅなちゃん（あたま だけ ふとん から でている）
const HOUSE_BED = { x: 80, y: 106, h: 54, clipY: 134 };
function drawSleeping() {
  const spr = SPR.hero; if (!spr) return;
  const b = HOUSE_BED, w = b.h * spr.w / spr.h;
  ctx.save();
  ctx.beginPath(); ctx.rect(b.x - w, b.y - 10, w * 2, b.clipY - b.y + 10); ctx.clip();
  ctx.drawImage(spr.canvas, b.x - w / 2, b.y + Math.sin(S.t * 2) * 0.8, w, b.h);
  ctx.restore();
  ctx.font = '900 12px "Dela Gothic One", sans-serif'; ctx.fillStyle = '#8a5cd1'; ctx.textAlign = 'center';
  ctx.fillText('Z z z', b.x + 34, b.y + 2 - Math.sin(S.t * 2) * 3);
}

// ---------------------------------------------------------------------
//  まちの たてもの を え に する
// ---------------------------------------------------------------------
const OUTSIDE_IMG = { inn: 'inn', weapon: 'weapon', item: 'item', house: 'house', castle: 'castle', tower: 'tower', temple: 'temple' };
const OUTSIDE_FIT = { castle: 1.05, tower: 1.0, temple: 1.15 }; // よこはば（たてものの はば に たいして）
const baseDrawBuilding = drawBuilding;
drawBuilding = function (b, T) {
  const im = BIMG.outside[OUTSIDE_IMG[b.id]];
  if (!bimgReady(im)) { baseDrawBuilding(b, T); return; }
  const f = (ST.data && ST.data.flags) || {};
  const bottom = (b.y + b.h) * T + 8;
  let w = b.w * T * (OUTSIDE_FIT[b.id] || 1.12), h = w * im.naturalHeight / im.naturalWidth;
  if (h > bottom) { h = bottom; w = h * im.naturalWidth / im.naturalHeight; } // まちの うえに はみださない
  const x = (b.x + b.w / 2) * T - w / 2, y = bottom - h;
  ctx.save();
  const hp = lerpPos(TW_HERO);
  if (hp.x > b.x - 1 && hp.x < b.x + b.w && hp.y < b.y + b.h - 0.5 && hp.y > bottom / T - h / T - 1) ctx.globalAlpha = 0.5; // うしろに いる ときは すける
  if (b.id === 'temple' && !f.templeOpen) ctx.filter = 'saturate(.45) brightness(.92)'; // まだ ひらいていない しんでん
  ctx.drawImage(im, x, y, w, h);
  ctx.filter = 'none';
  if (b.id === 'temple' && f.templeOpen) { // ひかる とびら
    const dx = (b.door.x + 0.5) * T, dy = b.door.y * T + T * 0.4;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(dx, dy, 0, dx, dy, T * 1.3);
    g.addColorStop(0, `rgba(255,230,140,${0.55 + Math.sin(S.t * 4) * 0.2})`); g.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = g; ctx.fillRect(dx - T * 1.5, dy - T * 1.5, T * 3, T * 3);
  }
  ctx.restore();
  townLabel(b.name, (b.x + b.w / 2) * T, Math.max(72, y + 10)); // うえの HUD に かくれない
};
const baseDrawFountain = drawFountain;
drawFountain = function (px, py, T) {
  const im = BIMG.outside.fountain;
  if (!bimgReady(im)) { baseDrawFountain(px, py, T); return; }
  const w = T * 3.2, h = w * im.naturalHeight / im.naturalWidth;
  ctx.drawImage(im, px + T - w / 2, py + T * 2 + 6 - h, w, h);
};

// ---------------------------------------------------------------------
//  まち の とびら → なか
// ---------------------------------------------------------------------
const baseEnterBuildingInterior = enterBuilding;
enterBuilding = function (b) {
  if (['inn', 'weapon', 'house', 'item', 'castle'].includes(b.id)) { enterInterior(b.id); return; }
  baseEnterBuildingInterior(b);
};

// おみせ の とじる ボタン は なか では「とじる」
const baseUpdateUIInterior = updateUI;
updateUI = function () {
  baseUpdateUIInterior();
  if (ST.scene === 'interior' && stActive()) {
    $('itemBar').hidden = true;
    const c = $('stPanel').querySelector('.shop-foot .close');
    if (c && c.textContent.includes('おみせを でる')) c.textContent = 'とじる（Esc）';
  }
};

// テスト よう：スポット・でぐち の まえ へ
window.intTest = {
  toSpot(id) { const s = curInt().spots.find((x) => x.id === id); INT.x = s.x; INT.y = s.y; INT.near = nearSpot(); return !!s; },
  toExitFront() { // でぐちの となり の あるける ところ。もどりち は でぐちへの むき
    const ex = curInt().exit, x = ex.x + ex.w / 2;
    for (const [y, dir] of [[ex.y + ex.h + 24, 'up'], [ex.y - 24, 'down']]) if (canStand(x, y)) { INT.x = x; INT.y = y; return dir; }
    return null;
  },
  canStand: (x, y) => canStand(x, y),
};

// ダンジョン の もん → いりぐち の へや（アーチ に はいると なんいど を えらぶ）
//   （enterDungeonGate は stella_dungeon.js が あとで おきかえる ので、まちの「しらべる」の ほう で きりかえる）
const baseInteractAtInterior = interactAt;
interactAt = function (p, bump) {
  if (GATE.some((g) => g.x === p.x && g.y === p.y)) { enterInterior('gate'); return true; }
  return baseInteractAtInterior(p, bump);
};
const baseStepHeroBackInterior = stepHeroBack;
stepHeroBack = function () { if (ST.scene === 'interior') return; baseStepHeroBackInterior(); };
// まちの もん の え
const baseDrawGate = drawGate;
drawGate = function (px, py, T) {
  const im = BIMG.outside.gate;
  if (!bimgReady(im)) { baseDrawGate(px, py, T); return; }
  const w = T * 3.6, h = w * im.naturalHeight / im.naturalWidth;
  ctx.drawImage(im, px + T - w / 2, py + T - h, w, h);
  townLabel('ダンジョン', px + T, py + T - h - 4, '#c0306a');
};
