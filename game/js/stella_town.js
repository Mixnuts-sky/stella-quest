'use strict';
// =====================================================================
//  ステラクエスト：まち「ルミナリア」
//  ・↑↓←→ で 1マスずつ あるく（WASD・テンキー 8246 も OK）
//  ・たてものの とびら／ひとに ぶつかる か、まえを むいて Enter で しらべる・はなす
//  ・まちに はいったら セーブ
//  しよう：docs/GAME_SPEC.md「4. 街」
// =====================================================================

const TOWN = { W: 30, H: 20, T: 48 };

// たてもの：x, y, w, h（マス）、door（はいる ところ）、kind、なまえ
const BUILDINGS = [
  { id: 'temple', kind: 'temple', name: 'ほしの しんでん', x: 2, y: 2, w: 5, h: 3, door: { x: 4, y: 4 } },
  { id: 'castle', kind: 'castle', name: 'おしろ', x: 11, y: 1, w: 8, h: 4, door: { x: 15, y: 4 } },
  { id: 'tower', kind: 'tower', name: 'ふるい とけいだい', x: 23, y: 2, w: 3, h: 3, door: { x: 24, y: 4 }, back: { x: 24, y: 1 } },
  { id: 'inn', kind: 'shop', name: 'やどや', sign: 'INN', roof: '#e2588f', x: 2, y: 8, w: 5, h: 3, door: { x: 4, y: 10 } },
  { id: 'house', kind: 'house', name: 'ちゅなちゃんの いえ', roof: '#8a5cd1', x: 2, y: 13, w: 5, h: 3, door: { x: 4, y: 15 } },
  { id: 'weapon', kind: 'shop', name: 'ぶきや', sign: '⚔', roof: '#4a7fd6', x: 22, y: 8, w: 5, h: 3, door: { x: 24, y: 10 } },
  { id: 'item', kind: 'shop', name: 'アイテムや', sign: '🧪', roof: '#3cc46e', x: 22, y: 13, w: 5, h: 3, door: { x: 24, y: 15 } },
];
const FOUNTAIN = { x: 14, y: 9, w: 2, h: 2 };
const GATE = [{ x: 14, y: 19 }, { x: 15, y: 19 }]; // ダンジョンの いりぐち（みなみの もん）

// まちの ひと
const NPCS = [
  { id: 'alto', name: 'アルト', kind: 'alto', spr: 'アルト', x: 13, y: 12, home: { x: 13, y: 12 }, wander: false, lines: () => altoLines(), after: () => askPractice() },
  { id: 'v1', name: 'むらびと', kind: 'villager', spr: 'おとなの おとこ', color: '#ff9a3a', hair: '#7a4a2c', x: 9, y: 12, home: { x: 9, y: 12 }, wander: true,
    lines: () => [['むらびと', 'こんにちは、ちゅなちゃん！'], ['むらびと', 'さいきん よぞらの ほしが へって さみしいねえ。']] },
  { id: 'v2', name: 'おばあさん', kind: 'villager', spr: 'おばあちゃん', color: '#9a7ad6', hair: '#d9d9d9', x: 19, y: 16, home: { x: 19, y: 16 }, wander: true,
    lines: () => [['おばあさん', 'やどやに とまると げんきに なるよ。'], ['おばあさん', 'おかねを はらって とまると、もっと げんきに なれるんだって！']] },
  { id: 'v3', name: 'こども', kind: 'villager', spr: 'むらの おとこのこ', color: '#5ac8e0', hair: '#3a2a20', x: 19, y: 6, home: { x: 19, y: 6 }, wander: true,
    lines: () => [['こども', 'ねえ しってる？'], ['こども', 'きたの はしの ふるい とけいだい、よなかに かねが なるんだよ……'], ['こども', 'でも とびらは ずーっと しまったまま なんだって。']] },
  { id: 'v4', name: 'へいたいさん', kind: 'villager', spr: 'もんばんの へいし', color: '#4a7fd6', hair: '#4a3020', helmet: true, x: 12, y: 18, home: { x: 12, y: 18 }, wander: false,
    lines: () => [['へいたいさん', 'この さきは ダンジョンだ。'], ['へいたいさん', 'じゅんびは ばっちりかい？ やどや・ぶきや・アイテムやで じゅんび しておこう！']] },
  { id: 'v5', name: 'おんなのこ', kind: 'villager', spr: 'むらの おんなのこ', color: '#ff7aa8', hair: '#7a4a2c', x: 17, y: 13, home: { x: 17, y: 13 }, wander: true,
    lines: () => [['おんなのこ', 'ちゅなちゃん、まほう みせて！'], ['おんなのこ', 'わたしも おおきく なったら まほうつかいに なりたいな！']] },
  { id: 'v6', name: 'はなうりの おねえさん', kind: 'villager', spr: 'おとなの おんな', color: '#3fa06a', hair: '#7a4a2c', x: 19, y: 9, home: { x: 19, y: 9 }, wander: true,
    lines: () => [['はなうりの おねえさん', 'おはなは いかが？'], ['はなうりの おねえさん', 'おしろの おひめさまも おはなが だいすきなのよ。']] },
  { id: 'v7', name: 'おじいさん', kind: 'villager', spr: 'おじいちゃん', color: '#6a8a4a', hair: '#d9d9d9', beard: true, x: 8, y: 6, home: { x: 8, y: 6 }, wander: true,
    lines: () => [['おじいさん', 'むかしは よぞら いっぱいに ほしが あってのう……'], ['おじいさん', 'きたの しんでんには ふしぎな なぞが ねむって いるそうじゃ。']] },
];

// むらびと・アルト の え（デザイン/村人・デザイン/賢者アルト。なければ canvas で かいた ひと）
const NPC_SPR = {};
addEventListener('DOMContentLoaded', () => {
  const IM = window.IMAGES || {};
  [...(IM['村人'] || []), ...(IM['賢者アルト'] || [])].forEach((item) => loadImage(item).then((spr) => { if (spr) NPC_SPR[item.name] = spr; }));
});
// え の ある ひと を かく（あしもと が (0,0)）。なければ false
function drawNpcSprite(name, hh, flip) {
  const spr = NPC_SPR[name] || (SPR.rares || []).find((r) => r.name === name); // しまじろう（レアてき の え）
  if (!spr) return false;
  const w = hh * spr.w / spr.h;
  ctx.save();
  if (flip) ctx.scale(-1, 1);
  ctx.shadowColor = 'rgba(58,42,77,.85)'; ctx.shadowBlur = 0;
  for (const [ox, oy] of [[-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5]]) { ctx.shadowOffsetX = ox; ctx.shadowOffsetY = oy; ctx.drawImage(spr.white, -w / 2, -hh, w, hh); }
  ctx.shadowColor = 'transparent'; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.drawImage(spr.canvas, -w / 2, -hh, w, hh);
  ctx.restore();
  return true;
}

// アルトと はなした あと：まほうの れんしゅう（stella_battle.js）
// アルトの まほうの れんしゅう：いま いける なんいど と かもく を えらぶ（HP は へらない・つづけて できる）
const PRACTICE = { d: null, s: 'all' };
function practiceSubjects() {
  const hk = ST.data.mode === 'hoikuen';
  return [['math', hk ? 'すうじ' : 'さんすう'], ['kanji', hk ? 'ひらがな' : 'かんじ'], ['music', hk ? 'いろ' : 'おんがく'], ['all', 'ぜんぶ じゅんばんに']];
}
function askPractice() {
  const top = Math.min(6, maxCleared(ST.data) + 1), hk = ST.data.mode === 'hoikuen';
  if (!PRACTICE.d || PRACTICE.d > top) PRACTICE.d = top; // はじめは つぎに いく ダンジョン の なんいど
  const hasMain = !hk && typeof mainKanjiList === 'function' && mainKanjiList().length > 0;
  if (PRACTICE.d === 'main' && (!hasMain || PRACTICE.s !== 'kanji')) PRACTICE.d = top;
  const dBtns = Array.from({ length: top }, (_, i) => i + 1).map((n) =>
    `<button type="button" class="pr-d${n === PRACTICE.d ? ' on' : ''}" data-d="${n}"><b>${n}</b><small>${(typeof DUNGEONS !== 'undefined' && DUNGEONS[n]) || ''}</small></button>`).join('')
    + (hasMain ? `<button type="button" class="pr-d pr-main${PRACTICE.d === 'main' ? ' on' : ''}" data-d="main"${PRACTICE.s === 'kanji' ? '' : ' hidden'}><b>メイン</b><small>${mainKanjiList().length}こ ぜんぶ</small></button>` : '');
  const sBtns = practiceSubjects().map(([k, label]) => `<button type="button" class="pr-s${k === PRACTICE.s ? ' on' : ''}" data-s="${k}">${label}</button>`).join('');
  const p = stPanel(`<div class="shop-head"><span class="shop-title">🪄 まほうの れんしゅう</span></div>
    <div class="shop-talk">「どの なんいど の、どの まほう を れんしゅう する？ ${PRACTICE_Q}もん せいかい で クリア、ごほうび も あるぞ。HPは へらないぞ。」</div>
    ${hk ? '' : `<div class="pr-label">なんいど</div><div class="pr-row">${dBtns}</div>`}
    <div class="pr-label">まほう</div><div class="pr-row">${sBtns}</div>
    <div class="shop-foot two"><button type="button" class="buy go">はじめる！</button><button type="button" class="close">いまは いい</button></div>`);
  const pick = (sel, attr, key) => p.querySelectorAll(sel).forEach((b) => b.addEventListener('click', () => {
    PRACTICE[key] = key === 'd' && b.dataset[attr] !== 'main' ? +b.dataset[attr] : b.dataset[attr];
    p.querySelectorAll(sel).forEach((x) => x.classList.toggle('on', x === b));
    // かんじ の とき だけ「メイン」を だす
    const mb = p.querySelector('.pr-main');
    if (key === 's' && mb) {
      mb.hidden = PRACTICE.s !== 'kanji';
      if (mb.hidden && PRACTICE.d === 'main') { PRACTICE.d = top; p.querySelectorAll('.pr-d').forEach((x) => x.classList.toggle('on', x.dataset.d === String(top))); }
    }
    note(880, 0, 0.06, { type: 'sine', vol: 0.06 });
  }));
  pick('.pr-d', 'd', 'd'); pick('.pr-s', 's', 's');
  p.querySelector('.go').addEventListener('click', () => { closePanelSilently(); startPractice(practiceOpts()); });
  p.querySelector('.close').addEventListener('click', closePanel);
  p.querySelector('.close').focus(); // はじめは「いまは いい」（Enter を おしっぱなし でも はじまらない）
}
// えらんだ れんしゅう（メイン は かんじ・いま いける いちばん うえ の なんいど の ごほうび）
function practiceOpts() {
  const hk = ST.data.mode === 'hoikuen', top = Math.min(6, maxCleared(ST.data) + 1);
  if (PRACTICE.d === 'main') return { difficulty: top, subject: 'kanji', main: true };
  return { difficulty: hk ? 1 : PRACTICE.d, subject: PRACTICE.s };
}
// れんしゅう が おわったら：もういちど（おなじ）／ ほかの れんしゅう ／ おわる
function practiceAgain() {
  const label = (practiceSubjects().find(([k]) => k === PRACTICE.s) || [])[1] || '';
  const hk = ST.data.mode === 'hoikuen';
  const p = stPanel(`<div class="inn-ask">もういちど れんしゅう する？<small>${hk ? '' : PRACTICE.d === 'main' ? 'メイン・' : `なんいど ${PRACTICE.d}・`}${label}</small></div>
    <div class="shop-foot two"><button type="button" class="buy again">もういちど！</button><button type="button" class="other">ほかの れんしゅう</button><button type="button" class="close">おわる</button></div>`,
  () => stDialog([['アルト', 'よく がんばったのう。'], ['アルト', 'ダンジョンでも その ちょうしじゃ！']]));
  p.querySelector('.again').addEventListener('click', () => { closePanelSilently(); startPractice(practiceOpts()); });
  p.querySelector('.other').addEventListener('click', () => { closePanelSilently(); askPractice(); });
  p.querySelector('.close').addEventListener('click', closePanel);
  p.querySelector('.again').focus();
}

function altoLines() {
  const f = ST.data.flags || {};
  if (f.templeCleared) return [['アルト', 'ほっほっほ。7つの ほしに みとめられたのじゃな。'], ['アルト', 'さすが ちゅなちゃんじゃ！']];
  return [['アルト', 'おお、ちゅなちゃん。'], ['アルト', 'ダンジョンで ほしの ひかりを とりもどすのじゃ。'], ['アルト', 'むずかしい もんだいも あきらめずに かんがえるのじゃぞ。']];
}

// ---------------------------------------------------------------------
//  ちず
// ---------------------------------------------------------------------
// 0: くさ 1: き（とおれない） 2: みち 3: はな（くさ と おなじ） 5: もん
const TG = new Uint8Array(TOWN.W * TOWN.H);
(function buildTown() {
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < TOWN.W && y < TOWN.H) TG[y * TOWN.W + x] = v; };
  for (let y = 0; y < TOWN.H; y++) for (let x = 0; x < TOWN.W; x++) {
    const edge = x === 0 || y === 0 || x === TOWN.W - 1 || y === TOWN.H - 1;
    set(x, y, edge ? 1 : hash(x * 31 + y * 7) < 0.08 ? 3 : 0);
  }
  for (let x = 2; x <= 27; x++) { set(x, 11, 2); set(x, 12, 2); }   // よこの おおどおり
  for (let y = 5; y <= 18; y++) { set(14, y, 2); set(15, y, 2); }   // たての おおどおり
  BUILDINGS.forEach((b) => { for (let y = b.door.y + 1; y <= 11; y++) set(b.door.x, y, 2); for (let y = 12; y < b.door.y; y++) set(b.door.x, y, 2); });
  set(24, 1, 0); set(22, 1, 0); set(26, 1, 0); // とけいだいの うら
  GATE.forEach((g) => set(g.x, g.y, 5));
})();

const inRect = (p, r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
function buildingAt(p) { return BUILDINGS.find((b) => inRect(p, b)); }
function npcAt(p) { return NPCS.find((n) => n.x === p.x && n.y === p.y); }
function townBlocked(p, ignoreNpc) {
  if (p.x < 0 || p.y < 0 || p.x >= TOWN.W || p.y >= TOWN.H) return true;
  const t = TG[p.y * TOWN.W + p.x];
  if (t === 1) return true;
  if (buildingAt(p) || inRect(p, FOUNTAIN)) return true;
  if (!ignoreNpc && npcAt(p)) return true;
  return false;
}

// ---------------------------------------------------------------------
//  しらべる・はなす
// ---------------------------------------------------------------------
function talkTo(n) { faceHero(n); stDialog(n.lines(), n.after ? n.after : null); return true; }
// となりに いる ひと（まえ を むいている ひと を さきに）
function adjacentNpc() {
  const [dx, dy] = TW_VEC[TW_HERO.dir];
  const front = npcAt({ x: TW_HERO.x + dx, y: TW_HERO.y + dy });
  if (front) return front;
  return NPCS.find((n) => Math.abs(n.x - TW_HERO.x) + Math.abs(n.y - TW_HERO.y) === 1) || null;
}
function interactAt(p, bump) {
  const n = npcAt(p);
  if (n) return bump ? false : talkTo(n); // ぶつかった だけ では はなさない（Enter か「はなす」ボタン）
  if (GATE.some((g) => g.x === p.x && g.y === p.y)) { enterDungeonGate(); return true; }
  const b = buildingAt(p);
  if (!b) return false;
  const atDoor = b.door.x === p.x && b.door.y === p.y;
  if (b.id === 'tower') { towerInteract(atDoor ? 'front' : TW_HERO.dir === 'down' && p.y === b.y ? 'back' : 'side'); return true; }
  if (!atDoor) return false;
  enterBuilding(b);
  return true;
}

function faceHero(n) {
  const dx = TW_HERO.x - n.x, dy = TW_HERO.y - n.y;
  n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

// それぞれの たてもの（おみせ・ダンジョン は つぎの だんかいで つくる）
function enterBuilding(b) {
  const f = ST.data.flags || {};
  switch (b.id) {
    case 'castle':
      stDialog([
        'おしろに はいった。',
        ['おうさま', 'よく きたな、ちいさな まほうつかい。'],
        ['おうさま', 'まちの みなみの ダンジョンには、むかしから「ひほう」が ねむっていると いわれておる。'],
        ['おひめさま', 'ほしの ひかりと かんけいが あるのかしら……'],
        ['おひめさま', 'ちゅなちゃん、きを つけて いってらっしゃい！'],
      ]);
      break;
    case 'temple':
      if (f.templeOpen) stDialog(['しんでんの とびらが ひかっている……', '（しんでんの なかは まだ つくりちゅう）']);
      else stDialog(['ふるい しんでんだ。', 'とびらは かたく とざされている……']);
      break;
    case 'house':
      stDialog(['ちゅなちゃんの いえ。', ['にゃんこ', 'にゃー！'], '（いえの なかは オープニングで つかうよ）']);
      break;
    case 'inn': openInn(); break;
    case 'weapon': openWeaponShop(); break;
    case 'item': openItemShop(); break;
    default: break;
  }
}

function towerInteract(side) {
  const f = ST.data.flags || {};
  if (side === 'back') {
    if (f.oldKey) stDialog(['うらに ちいさな とびらが ある。', 'ふるびた かぎで ひらきそうだ……', '（とけいだいの なかは まだ つくりちゅう）']);
    else stDialog(['とけいだいの うらに ちいさな とびらが ある。', 'かぎが かかっていて ひらかない……']);
  } else stDialog(['ふるい とけいだいだ。', 'とびらは さびついて びくとも しない。', 'カチ……コチ……とけいの おとが きこえる。']);
}

let enterDungeonGate = function () {
  stDialog([['へいたいさん', 'ダンジョンへの みちは まだ じゅんびちゅうだ！']], () => { stepHeroBack(); });
};
function stepHeroBack() { TW_HERO.y = Math.max(1, TW_HERO.y - 1); TW_HERO.fy = TW_HERO.y; }

// ---------------------------------------------------------------------
//  あるく
// ---------------------------------------------------------------------
const TW_HERO = { x: 4, y: 16, fx: 4, fy: 16, t: 1, dir: 'down', facing: 1 };
const TW_KEYS = {
  ArrowUp: 'up', KeyW: 'up', Numpad8: 'up', ArrowDown: 'down', KeyS: 'down', Numpad2: 'down',
  ArrowLeft: 'left', KeyA: 'left', Numpad4: 'left', ArrowRight: 'right', KeyD: 'right', Numpad6: 'right',
};
const TW_VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const twHeld = [];
let twBumpLock = false, twFresh = false; // おなじ ところに ぶつかり つづけて なんども しらべない ように

function twTryMove(d) {
  const [dx, dy] = TW_VEC[d];
  TW_HERO.dir = d;
  if (dx) TW_HERO.facing = dx;
  const np = { x: TW_HERO.x + dx, y: TW_HERO.y + dy };
  if (!townBlocked(np) || (TG[np.y * TOWN.W + np.x] === 5)) {
    if (TG[np.y * TOWN.W + np.x] === 5) { twHeld.length = 0; interactAt(np); return; }
    TW_HERO.fx = TW_HERO.x; TW_HERO.fy = TW_HERO.y; TW_HERO.x = np.x; TW_HERO.y = np.y; TW_HERO.t = 0;
    SFX.step();
    return;
  }
  if (twBumpLock) return;
  twBumpLock = true;
  if (interactAt(np, true)) twHeld.length = 0;
}

SCENES.town = {
  enter(arg) {
    const p = (arg && arg.pos) || (ST.data.pos && ST.data.place === 'town' ? ST.data.pos : null) || { x: 4, y: 16 };
    Object.assign(TW_HERO, { x: p.x, y: p.y, fx: p.x, fy: p.y, t: 1 });
    twHeld.length = 0; twFresh = true; // はいった とき おしっぱなし の キー は つかわない
    NPCS.forEach((n) => { n.x = n.home.x; n.y = n.home.y; n.fx = n.x; n.fy = n.y; n.t = 1; n.wait = 1 + Math.random() * 2; });
    ST.data.pos = { x: TW_HERO.x, y: TW_HERO.y };
    stSave('town'); // まちに はいったら セーブ
  },
  update(dt) {
    if (TW_HERO.t < 1) {
      TW_HERO.t = Math.min(1, TW_HERO.t + dt / 0.15);
      if (TW_HERO.t >= 1) ST.data.pos = { x: TW_HERO.x, y: TW_HERO.y };
    } else if (S.mode === 'st' && twHeld.length) twTryMove(twHeld[twHeld.length - 1]);
    // むらびとは ときどき あるく
    NPCS.forEach((n) => {
      if (n.t < 1) { n.t = Math.min(1, n.t + dt / 0.3); return; }
      if (!n.wander || S.mode !== 'st') return;
      n.wait -= dt;
      if (n.wait > 0) return;
      n.wait = 1.5 + Math.random() * 2.5;
      const [dx, dy] = pick(Object.values(TW_VEC));
      const np = { x: n.x + dx, y: n.y + dy };
      if (Math.abs(np.x - n.home.x) > 3 || Math.abs(np.y - n.home.y) > 2) return;
      if (townBlocked(np) || (np.x === TW_HERO.x && np.y === TW_HERO.y) || TG[np.y * TOWN.W + np.x] === 5) return;
      n.fx = n.x; n.fy = n.y; n.x = np.x; n.y = np.y; n.t = 0;
      n.dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
    });
  },
  keydown(e) {
    const d = TW_KEYS[e.code];
    if (d) {
      if (e.repeat && twFresh) { e.preventDefault(); return; } // まえの ばめん から おしっぱなし
      twFresh = false;
      const i = twHeld.indexOf(d); if (i >= 0) twHeld.splice(i, 1);
      twHeld.push(d); twBumpLock = false; e.preventDefault();
      if (!e.repeat && TW_HERO.t >= 1 && S.mode === 'st') twTryMove(d); // ちょんと おしても うごく
      return;
    }
    if ((e.key === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && !e.repeat && S.mode === 'st') {
      const [dx, dy] = TW_VEC[TW_HERO.dir], n = adjacentNpc();
      if (n) talkTo(n);
      else interactAt({ x: TW_HERO.x + dx, y: TW_HERO.y + dy }) || interactAt({ x: TW_HERO.x, y: TW_HERO.y });
      e.preventDefault();
    }
  },
  keyup(e) {
    const d = TW_KEYS[e.code];
    if (d) { const i = twHeld.indexOf(d); if (i >= 0) twHeld.splice(i, 1); }
  },
  draw() { drawTown(); },
};
addEventListener('blur', () => { twHeld.length = 0; });

// ---------------------------------------------------------------------
//  えがく
// ---------------------------------------------------------------------
const lerpPos = (o) => { const k = o.t < 1 ? (1 - Math.cos(o.t * Math.PI)) / 2 : 1; return { x: o.fx + (o.x - o.fx) * k, y: o.fy + (o.y - o.fy) * k }; };

function drawTown() {
  const T = TOWN.T, hp = lerpPos(TW_HERO);
  const mapW = TOWN.W * T, mapH = TOWN.H * T;
  const camX = Math.max(0, Math.min(mapW - W, hp.x * T + T / 2 - W / 2));
  const camY = Math.max(0, Math.min(mapH - H, hp.y * T + T / 2 - H / 2));
  ctx.fillStyle = '#7fcf7a'; ctx.fillRect(-30, -30, W + 60, H + 60);
  ctx.save();
  ctx.translate(-camX, -camY);
  // じめん
  for (let y = 0; y < TOWN.H; y++) {
    for (let x = 0; x < TOWN.W; x++) {
      const t = TG[y * TOWN.W + x], px = x * T, py = y * T;
      ctx.fillStyle = (x + y) % 2 ? '#86d07f' : '#80ca79'; ctx.fillRect(px, py, T + 1, T + 1);
      if (t === 2 || t === 5) {
        ctx.fillStyle = '#f1dcae'; ctx.fillRect(px, py, T + 1, T + 1);
        ctx.fillStyle = 'rgba(160,120,70,.18)';
        ctx.beginPath(); ctx.ellipse(px + T * (0.3 + hash(x * 3 + y) * 0.4), py + T * 0.5, 8, 4, 0, 0, 7); ctx.fill();
      }
      if (t === 3) { // はな
        ctx.fillStyle = ['#ff8fbf', '#ffd84a', '#ffffff', '#b98aff'][Math.floor(hash(x + y * 13) * 4)];
        for (let k = 0; k < 5; k++) { const a = k * 1.2566; ctx.beginPath(); ctx.arc(px + T / 2 + Math.cos(a) * 5, py + T / 2 + Math.sin(a) * 5, 4, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.arc(px + T / 2, py + T / 2, 3, 0, 7); ctx.fill();
      }
    }
  }
  // もん（ダンジョン）
  drawGate(GATE[0].x * T, GATE[0].y * T, T);
  // ふんすい
  drawFountain(FOUNTAIN.x * T, FOUNTAIN.y * T, T);
  // たてもの・ひと・き を うえから じゅんに
  const objs = [];
  for (let y = 0; y < TOWN.H; y++) for (let x = 0; x < TOWN.W; x++) if (TG[y * TOWN.W + x] === 1) objs.push({ y: y + 0.9, draw: () => drawTree(x * T, y * T, T, x, y) });
  BUILDINGS.forEach((b) => objs.push({ y: b.y + b.h, draw: () => drawBuilding(b, T) }));
  NPCS.forEach((n) => { const p = lerpPos(n); objs.push({ y: p.y + 0.95, draw: () => drawNpc(n, p, T) }); });
  objs.push({ y: hp.y + 0.95, draw: () => drawTownHero(hp, T) });
  objs.sort((a, b) => a.y - b.y).forEach((o) => o.draw());
  ctx.restore();
}

// たてもの・ひとの なまえ（しろい ふだに まるい もじ）
function townLabel(text, x, y, color = INK) {
  ctx.save();
  ctx.font = '900 15px "Zen Maru Gothic", sans-serif';
  const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = 'rgba(255,250,243,.95)'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  roundRectPath(x - w / 2, y - 13, w, 26, 13); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

function drawTree(px, py, T, x, y) {
  const r = T * (0.46 + hash(x * 7 + y * 3) * 0.12);
  ctx.fillStyle = '#7a5230'; ctx.fillRect(px + T * 0.42, py + T * 0.55, T * 0.16, T * 0.45);
  ctx.fillStyle = hash(x + y) < 0.5 ? '#4fa85a' : '#5bb866';
  ctx.beginPath(); ctx.arc(px + T / 2, py + T * 0.42, r, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(px + T * 0.38, py + T * 0.3, r * 0.35, 0, 7); ctx.fill();
}

function drawFountain(px, py, T) {
  const cx = px + T, cy = py + T, r = T * 0.95;
  ctx.fillStyle = '#c9c3d6'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#7fc8ff'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) { const rr = ((S.t * 18 + k * 12) % 36) + 4; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.stroke(); }
  ctx.fillStyle = '#e9e4f2'; ctx.fillRect(cx - 7, cy - 26, 14, 26); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(cx - 7, cy - 26, 14, 26);
  for (let k = 0; k < 6; k++) { // みずしぶき
    const a = S.t * 3 + k, h = 18 + Math.sin(S.t * 6 + k) * 4;
    ctx.fillStyle = 'rgba(160,215,255,.9)'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 10, cy - 26 - h * Math.abs(Math.sin(a)), 3, 0, 7); ctx.fill();
  }
  drawStar(cx, cy - 34, 8, '#ffd84a');
}

function drawGate(px, py, T) {
  ctx.fillStyle = '#5a4a6a'; ctx.fillRect(px - 6, py - T * 0.7, T * 2 + 12, T * 1.7);
  ctx.fillStyle = '#20142e'; ctx.beginPath(); ctx.moveTo(px + 8, py + T); ctx.lineTo(px + 8, py); ctx.arc(px + T, py, T - 8, Math.PI, 0); ctx.lineTo(px + 2 * T - 8, py + T); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(px - 6, py - T * 0.7, T * 2 + 12, T * 1.7);
  townLabel('ダンジョン', px + T, py - T * 0.9, '#c0306a');
}

function drawBuilding(b, T) {
  const px = b.x * T, py = b.y * T, w = b.w * T, h = b.h * T;
  const f = (ST.data && ST.data.flags) || {};
  ctx.save();
  // ちゅなちゃんが たてものの うしろに いる ときは すけて みえる ように
  const hp = lerpPos(TW_HERO);
  if (hp.x > b.x - 1 && hp.x < b.x + b.w && hp.y < b.y && hp.y > b.y - 3.5) ctx.globalAlpha = 0.45;
  ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = INK;
  if (b.kind === 'castle') {
    ctx.fillStyle = '#efe6ff'; ctx.fillRect(px, py + T * 0.6, w, h - T * 0.6); ctx.strokeRect(px, py + T * 0.6, w, h - T * 0.6);
    for (let i = 0; i < b.w; i++) { ctx.fillStyle = '#efe6ff'; ctx.fillRect(px + i * T + 6, py + T * 0.3, T * 0.55, T * 0.35); ctx.strokeRect(px + i * T + 6, py + T * 0.3, T * 0.55, T * 0.35); }
    [[px - 8, T * 1.1], [px + w - T + 8, T * 1.1]].forEach(([tx]) => {
      ctx.fillStyle = '#e4d8ff'; ctx.fillRect(tx, py - T * 0.6, T, h + T * 0.6); ctx.strokeRect(tx, py - T * 0.6, T, h + T * 0.6);
      ctx.fillStyle = '#8a5cd1'; ctx.beginPath(); ctx.moveTo(tx - 6, py - T * 0.6); ctx.lineTo(tx + T / 2, py - T * 1.7); ctx.lineTo(tx + T + 6, py - T * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.ellipse(tx + T / 2, py + T * 0.3, 7, 11, 0, 0, 7); ctx.fill();
    });
    ctx.fillStyle = '#ffd84a'; drawStar(px + w / 2, py + T * 0.95, 14, '#ffd84a');
  } else if (b.kind === 'tower') {
    ctx.fillStyle = '#8f8494'; ctx.fillRect(px, py - T * 1.4, w, h + T * 1.4); ctx.strokeRect(px, py - T * 1.4, w, h + T * 1.4);
    ctx.fillStyle = '#5a3a4a'; ctx.beginPath(); ctx.moveTo(px - 8, py - T * 1.4); ctx.lineTo(px + w / 2, py - T * 2.6); ctx.lineTo(px + w + 8, py - T * 1.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    const cx = px + w / 2, cy = py - T * 0.55;
    ctx.fillStyle = '#f4ecd6'; ctx.beginPath(); ctx.arc(cx, cy, T * 0.55, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(S.t * 0.2) * T * 0.35, cy + Math.sin(S.t * 0.2) * T * 0.35); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - T * 0.25); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,60,40,.5)'; ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(px + 6 + k * 30, py + T * 0.4); ctx.lineTo(px + 18 + k * 28, py + h * 0.8); ctx.stroke(); } // ひび
  } else if (b.kind === 'temple') {
    ctx.fillStyle = '#f2ecdc'; ctx.fillRect(px, py + T * 0.5, w, h - T * 0.5); ctx.strokeRect(px, py + T * 0.5, w, h - T * 0.5);
    ctx.fillStyle = '#e2d6b8'; ctx.beginPath(); ctx.moveTo(px - 10, py + T * 0.5); ctx.lineTo(px + w / 2, py - T * 0.5); ctx.lineTo(px + w + 10, py + T * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#fffaf0'; ctx.fillRect(px + 10 + i * (w - 30) / 3, py + T * 0.7, 10, h - T * 0.9); ctx.strokeRect(px + 10 + i * (w - 30) / 3, py + T * 0.7, 10, h - T * 0.9); }
    drawStar(px + w / 2, py + T * 0.05, 10, f.templeOpen ? '#ffd84a' : '#bdb2a0');
  } else {
    // いえ・おみせ
    ctx.fillStyle = '#fff4e2'; ctx.fillRect(px + 4, py + T * 0.7, w - 8, h - T * 0.7); ctx.strokeRect(px + 4, py + T * 0.7, w - 8, h - T * 0.7);
    ctx.fillStyle = b.roof || '#c0405a';
    ctx.beginPath(); ctx.moveTo(px - 8, py + T * 0.8); ctx.lineTo(px + T * 0.6, py - T * 0.2); ctx.lineTo(px + w - T * 0.6, py - T * 0.2); ctx.lineTo(px + w + 8, py + T * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9fd8ff';
    [[px + T * 0.6, py + T * 1.1], [px + w - T * 1.3, py + T * 1.1]].forEach(([wx, wy]) => { ctx.fillRect(wx, wy, T * 0.7, T * 0.6); ctx.strokeRect(wx, wy, T * 0.7, T * 0.6); });
    if (b.sign) {
      ctx.fillStyle = '#fffaf0'; roundRectPath(px + w / 2 - 26, py + T * 0.05, 52, 26, 8); ctx.fill(); ctx.stroke();
      ctx.font = '900 16px "Dela Gothic One", "Segoe UI Emoji", sans-serif'; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.sign, px + w / 2, py + T * 0.05 + 14);
    }
  }
  // とびら
  if (b.door) {
    const dx = b.door.x * T, dy = b.door.y * T;
    const glow = b.id === 'temple' && f.templeOpen;
    if (glow) { ctx.shadowColor = 'rgba(255,220,100,1)'; ctx.shadowBlur = 20 + Math.sin(S.t * 4) * 8; }
    ctx.fillStyle = b.kind === 'tower' ? '#4a3a3a' : glow ? '#ffe9a0' : '#8a5a3c';
    ctx.beginPath(); ctx.moveTo(dx + 10, dy + T); ctx.lineTo(dx + 10, dy + 16); ctx.arc(dx + T / 2, dy + 16, T / 2 - 10, Math.PI, 0); ctx.lineTo(dx + T - 10, dy + T); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  // なまえ
  townLabel(b.name, px + w / 2, (b.kind === 'castle' ? py - T * 0.9 : b.kind === 'tower' ? py - T * 2.75 : py - T * 0.35));
}

function drawPerson(c, opts) {
  // ちいさな ひと（むらびと・アルト）。あしもと が (0,0)
  const { color = '#ff9a3a', hair = '#7a4a2c', beard = false, hat = null, helmet = false } = opts;
  c.save();
  c.lineJoin = 'round'; c.lineWidth = 2.5; c.strokeStyle = INK;
  c.fillStyle = color;
  c.beginPath(); c.moveTo(-12, 0); c.lineTo(-9, -26); c.lineTo(9, -26); c.lineTo(12, 0); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ffe2c6'; c.beginPath(); c.arc(0, -36, 11, 0, 7); c.fill(); c.stroke();
  if (beard) { c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(-9, -34); c.quadraticCurveTo(0, -10, 9, -34); c.closePath(); c.fill(); c.stroke(); }
  c.fillStyle = hair;
  if (hat) { c.fillStyle = hat; c.beginPath(); c.moveTo(-15, -42); c.lineTo(3, -70); c.lineTo(15, -42); c.closePath(); c.fill(); c.stroke(); drawStar(2, -54, 5, '#ffd84a'); }
  else if (helmet) { c.fillStyle = '#c9cfe0'; c.beginPath(); c.arc(0, -40, 12, Math.PI, 0); c.fill(); c.stroke(); }
  else { c.beginPath(); c.arc(0, -40, 11, Math.PI, 0); c.fill(); }
  c.fillStyle = INK; c.beginPath(); c.arc(-4, -36, 1.8, 0, 7); c.arc(4, -36, 1.8, 0, 7); c.fill();
  c.restore();
}

function drawNpc(n, p, T) {
  const x = p.x * T + T / 2, y = p.y * T + T * 0.95;
  ctx.fillStyle = 'rgba(30,10,50,.2)'; ctx.beginPath(); ctx.ellipse(x, y, 14, 5, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(x, y - (n.t < 1 ? Math.abs(Math.sin(n.t * Math.PI)) * 3 : 0));
  if (drawNpcSprite(n.spr, T * (n.kind === 'alto' ? 1.9 : 1.6), n.dir === 'left')) { /* え */ }
  else if (n.kind === 'alto') { ctx.scale(1.1, 1.1); drawPerson(ctx, { color: '#5a6fd6', beard: true, hat: '#3a4fb6' }); }
  else drawPerson(ctx, n);
  ctx.restore();
  // ちかくに いたら なまえ
  if (Math.abs(TW_HERO.x - n.x) + Math.abs(TW_HERO.y - n.y) <= 2) townLabel(n.name, x, y - T * 1.6, n.kind === 'alto' ? '#8a5cd1' : INK);
}

function drawTownHero(p, T) {
  const x = p.x * T + T / 2, y = p.y * T + T * 0.95;
  const bob = TW_HERO.t < 1 ? Math.abs(Math.sin(TW_HERO.t * Math.PI)) * 5 : Math.sin(S.t * 3) * 1.2;
  ctx.fillStyle = 'rgba(30,10,50,.25)'; ctx.beginPath(); ctx.ellipse(x, y, T * 0.32, 6, 0, 0, 7); ctx.fill();
  ctx.save();
  ctx.translate(x, y - bob);
  ctx.scale(TW_HERO.facing < 0 ? -1 : 1, 1);
  const hh = T * 1.9, spr = SPR.hero;
  if (spr) {
    const w = hh * spr.w / spr.h;
    ctx.shadowColor = 'rgba(58,42,77,.9)'; ctx.shadowBlur = 0;
    for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) { ctx.shadowOffsetX = ox; ctx.shadowOffsetY = oy; ctx.drawImage(spr.white, -w / 2, -hh, w, hh); }
    ctx.shadowColor = 'transparent'; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.drawImage(spr.canvas, -w / 2, -hh, w, hh);
  } else { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, -30, 16, 0, 7); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------------
//  テスト よう
// ---------------------------------------------------------------------
window.townTest = {
  // (tx, ty) の となりまで の すすみかた
  pathNextTo(tx, ty) {
    const key = (p) => p.y * TOWN.W + p.x;
    const goals = Object.values(TW_VEC).map(([dx, dy]) => ({ x: tx + dx, y: ty + dy })).filter((g) => !townBlocked(g, true));
    const start = { x: TW_HERO.x, y: TW_HERO.y };
    const prev = new Map([[key(start), null]]), q = [start];
    for (let h = 0; h < q.length; h++) {
      const p = q[h];
      if (goals.some((g) => g.x === p.x && g.y === p.y)) {
        const dirs = []; let cur = p;
        while (prev.get(key(cur))) { const [from, d] = prev.get(key(cur)); dirs.unshift(d); cur = from; }
        const [ddx, ddy] = [tx - p.x, ty - p.y];
        dirs.push(ddx > 0 ? 'right' : ddx < 0 ? 'left' : ddy > 0 ? 'down' : 'up'); // さいごに あいての ほうへ
        return dirs;
      }
      for (const [d, [dx, dy]] of Object.entries(TW_VEC)) {
        const np = { x: p.x + dx, y: p.y + dy };
        if (townBlocked(np) || prev.has(key(np))) continue; // ひとは よける
        prev.set(key(np), [p, d]); q.push(np);
      }
    }
    return [];
  },
  stopNpcs() { NPCS.forEach((n) => { n.wander = false; }); },
};

// 「はなす」ボタン：となりに ひと が いる とき だけ でる
(function talkButton() {
  const b = document.createElement('button');
  b.id = 'stTalk'; b.type = 'button'; b.className = 'st-talk'; b.hidden = true;
  b.innerHTML = '💬 はなす <small>Enter</small>';
  b.addEventListener('click', () => { const n = adjacentNpc(); if (n && S.mode === 'st' && ST.scene === 'town') talkTo(n); b.blur(); });
  $('game').appendChild(b);
  setInterval(() => { // うごいた あと に たしかめる
    const n = ST.scene === 'town' && S.mode === 'st' && TW_HERO.t >= 1 ? adjacentNpc() : null;
    b.hidden = !n;
    if (n) b.innerHTML = `💬 ${n.name}と はなす <small>Enter</small>`;
  }, 150);
})();
