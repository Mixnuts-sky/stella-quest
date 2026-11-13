'use strict';
// =====================================================================
//  ステラクエスト：かくしボス ネクロディウス と エンディング
//    death：ダンジョンで 1% … しにがみ。くくの もんだい・HP100・にげられる・たおすと ゲームクリア
//    tower：ふるい とけいだい（ふるびた かぎ）… 3けたの たしざん・ひきざん・HP50・にげられない
//           たおすと ネクロ・ルミナス ＋ しんせいまほうつかい の すがた
//    true ：とけいだい（tower を たおした あと、もういちど はいる）… くく・HP100 → ゲームクリア
//  たたかいは game.js の ボスせん を そのまま つかい、もんだい・え・せりふ だけ かえる。
//  しよう：docs/GAME_SPEC.md「11. 隠しボス」
// =====================================================================

const NECRO = {
  chance: 0.01,   // ダンジョンで でる かくりつ
  force: false,   // テストよう：つぎの ざこの かわりに かならず でる
  spr: {},        // death / tower / true の え（まるく ぼかして きりぬく）
};
const NECRO_KINDS = {
  death: { name: '死神：ネクロディウス', hp: 100, quiz: 'kuku', img: 'necroTrue', flee: true },
  tower: { name: 'ネクロディウス', hp: 50, quiz: 'three', img: 'necro', flee: false },
  true:  { name: 'ネクロディウス（真）', hp: 100, quiz: 'kuku', img: 'necroTrue', flee: false },
};
const NECRO_STAGE = { height: 240, dark: true, aura: 'rgba(255,40,90,.95)' };
// もんだい の パネル（まんなか）に かさならない ように、みぎ に よせる
const SIDE_X = () => W * 0.76;
const necroBattle = () => !!(ST.battle && ST.battle.necro);
const curNecro = () => S.monster && S.monster.necro ? S.monster : null;

// え：はいけい つきの イラストなので、まわりを だえんに ぼかして きりとる
function buildNecroSprite(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = 600, h = Math.round(600 * img.height / img.width);
      const mk2 = (paint) => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d');
        paint(g);
        g.globalCompositeOperation = 'destination-in';
        g.save(); g.translate(w / 2, h / 2); g.scale(1, h / w);
        const rg = g.createRadialGradient(0, 0, w * 0.22, 0, 0, w / 2);
        rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.fillRect(-w / 2, -w / 2, w, w);
        g.restore();
        return c;
      };
      const canvas = mk2((g) => g.drawImage(img, 0, 0, w, h));
      const white = mk2((g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); });
      resolve({ canvas, white, w, h });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
['necro', 'necroTrue'].forEach((k) => { if (STIMG[k]) buildNecroSprite(STIMG[k]).then((s) => { NECRO.spr[k] = s; }); });

// ---------------------------------------------------------------------
//  もんだい
// ---------------------------------------------------------------------
// くく：1の だん から。へった HP に あわせて だんが あがる（さいごは 9の だん）
function kukuQuestion(m) {
  const dan = Math.min(9, 1 + Math.floor((1 - m.hp / m.maxHp) * 9));
  const b = rnd(1, 9);
  return { a: dan, op: '×', b, ans: dan * b, text: `${dan} × ${b}`, kuku: true };
}
// 3けたの たしざん・ひきざん（こたえも 3けたまで）
function threeDigitQuestion() {
  if (Math.random() < 0.5) { const a = rnd(100, 899); return mk(a, '+', rnd(100, 999 - a)); }
  const a = rnd(200, 999); return mk(a, '-', rnd(100, a - 1));
}

const baseBattleSubjectNecro = battleSubject;
battleSubject = function (m) { return m.necro ? 'math' : baseBattleSubjectNecro(m); };

const baseAskNecro = askQuestion;
askQuestion = function () {
  if (!S.monster) return; // にげた あとに おくれて よばれた とき
  const m = curNecro();
  if (!m) { baseAskNecro(); return; }
  const orig = makeBossQuestion;
  const q = NECRO_KINDS[m.necro].quiz === 'kuku' ? kukuQuestion(m) : threeDigitQuestion();
  makeBossQuestion = () => q;
  try { baseAskNecro(); } finally { makeBossQuestion = orig; }
  $('qtext').textContent = q.text || `${q.a} ${q.op === '+' ? '＋' : '−'} ${q.b}`;
  const kind = NECRO_KINDS[m.necro];
  $('monName').innerHTML = `${enemyTag(m)}（${kind.quiz === 'kuku' ? `くく ${q.a}の だん` : '3けたの けいさん'}）${subjTag('math')}`;
  renderAnswer();
  updateUI();
};

// ---------------------------------------------------------------------
//  たたかいを はじめる
// ---------------------------------------------------------------------
function startNecroBattle(kind, returnTo) {
  const k = NECRO_KINDS[kind];
  const diff = inDungeon() ? ST.data.dungeon.difficulty : 6;
  ST.battle = { difficulty: diff, returnTo, necro: kind };
  CONFIG.maxHp = stMaxHp();
  S.hp = inDungeon() ? S.hp : ST.data.hp;
  S.items = ST.data.items;
  if (!inDungeon()) { S.maze = null; S.level = 6; }
  S.catUsed = false; S.hintNext = false; S.castleX = null; S.necroSay = null; S.necroSaid = {};
  S.keyHeld = false; S.btnHeld = false; S.scroll = rnd(0, 5000);
  S.monster = {
    boss: true, necro: kind, spr: NECRO.spr[k.img] || null, level: S.level, stage: NECRO_STAGE,
    name: k.name, height: NECRO_STAGE.height,
    x: SIDE_X(), y: -400, vy: 0, landed: false,
    state: 'enter', t: 0, alpha: 1, hp: k.hp, maxHp: k.hp, hpShown: k.hp, hitFlash: 0,
  };
  setMode('encounter');
}

// ダンジョンで 1%：きゅうに くらく なって「……みつけた……」→ かねの おと → あらわれた！
const baseEncounterNecro = encounter;
encounter = function (opts = {}) {
  if (inDungeon() && !ST.battle && !opts.boss && !opts.rare && (NECRO.force || Math.random() < NECRO.chance)) {
    NECRO.force = false;
    necroAppear();
    return;
  }
  baseEncounterNecro(opts);
};
function necroAppear() {
  S.keyHeld = false; S.btnHeld = false;
  S.necroIntro = true;
  setMode('bosswarn');
  const box = necroWarnBox();
  box.innerHTML = '<p class="nw-voice"></p><p class="nw-title"></p>';
  box.hidden = false; box.className = 'necro-warn dark';
  note(70, 0, 3, { type: 'sawtooth', vol: 0.05, vib: 3 });
  later(0.9, () => { box.querySelector('.nw-voice').textContent = '？？？「……みつけた……」'; });
  later(2.0, () => [0, 0.9, 1.8].forEach((t) => { note(196, t, 1.6, { type: 'sine', vol: 0.14 }); note(392 * 1.01, t, 1.2, { type: 'sine', vol: 0.05 }); })); // ゴーン……
  later(3.4, () => { const t = box.querySelector('.nw-title'); t.textContent = '【死神：ネクロディウスが あらわれた！】'; S.shake = 1; SFX.roar(); });
  later(5.2, () => { box.hidden = true; S.necroIntro = false; startNecroBattle('death', 'dungeon'); });
}
function necroWarnBox() {
  let b = $('necroWarn');
  if (!b) { b = document.createElement('div'); b.id = 'necroWarn'; b.hidden = true; $('game').appendChild(b); }
  return b;
}

// ---------------------------------------------------------------------
//  にげる（しにがみ だけ）
// ---------------------------------------------------------------------
function necroFleeBtn() {
  let b = $('necroFlee');
  if (!b) {
    b = document.createElement('button');
    b.id = 'necroFlee'; b.type = 'button'; b.className = 'necro-flee'; b.textContent = '🏃 にげる（Esc）';
    b.addEventListener('click', necroFlee);
    $('game').appendChild(b);
  }
  return b;
}
function necroFlee() {
  const m = curNecro();
  if (!m || !NECRO_KINDS[m.necro].flee || S.mode !== 'question') return;
  setMode('answered');
  $('qmsg').textContent = 'にげろ〜！'; $('qmsg').className = 'qmsg bad';
  S.hero.hurt = 0.5; SFX.whoosh ? SFX.whoosh() : note(600, 0, 0.3, { type: 'sine', vol: 0.1, slide: 0.4 });
  later(0.9, () => {
    S.monster = null; S.q = null; ST.battle = null;
    setMode('walk');
    snapshotDungeon(); stSave('dungeon');
    showToast('なんとか にげきった……！', 2.6);
  });
}
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && curNecro() && S.mode === 'question') { necroFlee(); e.preventDefault(); }
});

// ---------------------------------------------------------------------
//  せりふ（とけいだいの ネクロディウス）
// ---------------------------------------------------------------------
const NECRO_LINES = {
  tower: [[0.5, 'ほう……なかなか やるではないか。'], [0.2, 'ばかな……この わたしが……！']],
  true: [[0.5, 'ククク……まだまだ……！'], [0.2, 'ほしの ひかり……これほど とは……']],
  death: [[0.5, '……ほう……'], [0.2, '……おもしろい……']],
};
const baseOnSpellHitNecro = onSpellHit;
onSpellHit = function () {
  const m = curNecro();
  baseOnSpellHitNecro();
  if (!m || m.hp <= 0) return;
  for (const [r, text] of NECRO_LINES[m.necro]) {
    if (m.hp <= m.maxHp * r && !S.necroSaid[r]) { S.necroSaid[r] = true; S.necroSay = { text, t: 0 }; }
  }
};
const baseDrawMonsterNecro = drawMonster;
drawMonster = function () {
  baseDrawMonsterNecro();
  const m = curNecro();
  if (!m || !S.necroSay) return;
  S.necroSay.t += 1 / 60;
  if (S.necroSay.t > 3.5) { S.necroSay = null; return; }
  outlinedText(S.necroSay.text, Math.min(Math.max(m.x, 260), W - 260), GROUND() - m.height - 50, 30, '#ff8ac0');
};
// ドラゴン よう の こえ を ネクロディウス よう に
const baseOutlinedTextNecro = outlinedText;
outlinedText = function (text, x, y, size, color) {
  if (curNecro()) { if (text === 'ガオーッ！') text = 'ククク……'; else if (text === 'ガハハハ！') text = 'フハハハ！'; }
  baseOutlinedTextNecro(text, x, y, size, color);
};
// たたかいの けしき：くらい あかい そら
const baseDrawWorldNecro = drawWorld;
drawWorld = function () {
  if (!necroBattle() && !S.necroIntro) { baseDrawWorldNecro(); return; }
  if (S.necroIntro && S.maze) { baseDrawWorldNecro(); return; }
  const gy = GROUND();
  const g = ctx.createLinearGradient(0, 0, 0, gy);
  g.addColorStop(0, '#12000c'); g.addColorStop(1, '#4a0a2c');
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  const mg = ctx.createRadialGradient(W * 0.78, H * 0.2, 0, W * 0.78, H * 0.2, 90);
  mg.addColorStop(0, 'rgba(255,60,70,.9)'); mg.addColorStop(0.6, 'rgba(160,0,40,.5)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.2, 90, 0, 7); ctx.fill();
  for (let i = 0; i < 40; i++) { // まいあがる ひのこ
    const x = (hash(i) * W + Math.sin(S.t * 0.7 + i) * 30), y = gy - ((S.t * (20 + hash(i + 4) * 40) + hash(i + 9) * gy) % gy);
    ctx.fillStyle = `rgba(255,${80 + hash(i) * 100 | 0},120,${0.3 + 0.4 * hash(i + 2)})`;
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.fillStyle = '#1e0614'; ctx.fillRect(-30, gy, W + 60, H - gy + 30);
  ctx.fillStyle = 'rgba(255,60,120,.25)'; ctx.fillRect(-30, gy, W + 60, 4);
};

// ---------------------------------------------------------------------
//  かち・まけ（game.js は さいごに offerNanmon / levelFx を よぶ）
// ---------------------------------------------------------------------
const baseLevelFxNecro = levelFx;
levelFx = function (kind) {
  if (!necroBattle()) { baseLevelFxNecro(kind); return; }
  const k = ST.battle.necro;
  if (kind === 'up') necroWin(k); else necroLose(k);
};
const baseOfferNanmonNecro = offerNanmon;
offerNanmon = function () { if (necroBattle()) necroWin(ST.battle.necro); else baseOfferNanmonNecro(); };

function necroCleanup() {
  S.monster = null; S.q = null; S.necroSay = null; ST.battle = null;
  CONFIG.maxHp = stMaxHp();
}
function necroWin(kind) {
  necroCleanup();
  if (kind === 'death') {
    ST.data.flags.deathNecro = true;
    leaveDungeon('clear');
    startEnding('death');
    return;
  }
  ST.data.hp = Math.max(1, S.hp);
  if (kind === 'tower') {
    const d = ST.data;
    d.flags.towerNecro = true;
    const w = 'ネクロ・ルミナス';
    if (!d.weapons.includes(w)) d.weapons.push(w);
    if (weaponOf(d.equip).atk < weaponOf(w).atk) d.equip = w;
    d.form = 'ura';
    stApplyForm();
    setScene('tower');
    stSave('tower'); // たおしたら セーブ
    stDialog([['ネクロディウス', 'みごとだ……ほしの まほうつかいよ……'], ['ネクロディウス', 'わが ちから……おまえに たくそう……'], ['ネクロディウス', 'そのちからで……しんのてきを……たおせ……'],
      ['', 'ネクロディウスは くろい ひかりに なって きえた……'], ['', 'ネクロ・ルミナス を てに いれた！'], ['', 'ちゅなちゃんは しんせいまほうつかい に なった！']], showUra);
    return;
  }
  startEnding('true');
}
function necroLose(kind) {
  necroCleanup();
  if (kind === 'death') { dungeonLose(); return; }
  ST.data.hp = 5; ST.data.innBuff = false;
  setScene('town', { pos: { x: 24, y: 1 } });
  stDialog(['ちゅなちゃんは ちからつきてしまった……', 'でも だいじょうぶ！ また ちょうせんしよう！', 'ルミナリアの まちへ もどります']);
}
function showUra() {
  const img = STIMG.forms && STIMG.forms.ura;
  const wimg = STIMG.weapons && STIMG.weapons['ネクロ・ルミナス'];
  const p = stPanel(`<div class="shop-head"><div class="shop-title">🌙 しんせいまほうつかい ちゅなちゃん</div></div>
    <div class="tp-reward">${img ? `<img src="${img}" alt="しんせいまほうつかい ちゅなちゃん">` : ''}${wimg ? `<img class="w" src="${wimg}" alt="">` : ''}</div>
    <div class="tp-q">ネクロ・ルミナス を てに いれた！<br><small>こうげきりょく ${weaponOf('ネクロ・ルミナス').atk}</small></div>
    <div class="shop-foot"><button type="button" class="buy close">すごい！</button></div>`, () => setScene('town', { pos: { x: 24, y: 1 } }));
  p.querySelector('.close').addEventListener('click', closePanel);
}

// ---------------------------------------------------------------------
//  ふるい とけいだい
// ---------------------------------------------------------------------
ST_PLACE.tower = 'ふるい とけいだい';
ST_PLACE.ending = 'ほしの もどった よぞら';
SCENES.tower = {
  enter() {},
  draw() { drawTowerInside(); },
};
function drawTowerInside() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a1022'); g.addColorStop(1, '#3a2030');
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  // いしの かべ
  ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 2;
  for (let y = 0; y < H; y += 40) for (let x = (y / 40) % 2 ? 0 : -40; x < W; x += 80) ctx.strokeRect(x, y, 80, 40);
  // はぐるま
  [[0.18, 0.3, 70, 1], [0.84, 0.62, 90, -0.7], [0.12, 0.75, 50, -1.3]].forEach(([fx, fy, r, sp]) => {
    ctx.save(); ctx.translate(W * fx, H * fy); ctx.rotate(S.t * sp * 0.3);
    ctx.fillStyle = 'rgba(150,120,90,.35)';
    for (let i = 0; i < 10; i++) { ctx.rotate(Math.PI / 5); ctx.fillRect(-8, -r - 12, 16, 20); }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1022'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, 7); ctx.fill();
    ctx.restore();
  });
  // おおきな とけい
  const cx = W / 2, cy = H * 0.36, R = Math.min(W, H) * 0.22;
  ctx.fillStyle = '#e8dcc0'; ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a2a4d';
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.arc(cx + Math.sin(a) * R * 0.82, cy - Math.cos(a) * R * 0.82, 5, 0, 7); ctx.fill(); }
  const tick = Math.floor(S.t);
  ctx.strokeStyle = '#3a2a4d'; ctx.lineCap = 'round';
  ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(tick * 0.05) * R * 0.5, cy - Math.cos(tick * 0.05) * R * 0.5); ctx.stroke();
  ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(tick * Math.PI / 30) * R * 0.75, cy - Math.cos(tick * Math.PI / 30) * R * 0.75); ctx.stroke();
  // あかい ひかり
  const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2);
  rg.addColorStop(0, 'rgba(255,40,80,0)'); rg.addColorStop(1, `rgba(140,0,40,${0.25 + 0.1 * Math.sin(S.t * 2)})`);
  ctx.fillStyle = rg; ctx.fillRect(-30, -30, W + 60, H + 60);
  const spr = SPR.hero;
  if (spr) { const hh = 200, w = hh * spr.w / spr.h; ctx.drawImage(spr.canvas, W / 2 - w / 2, H * 0.92 - hh, w, hh); }
}

// うらの とびら（ふるびた かぎ）
const baseTowerInteractNecro = towerInteract;
towerInteract = function (side) {
  const f = ST.data.flags;
  if (side !== 'back' || !f.oldKey) { baseTowerInteractNecro(side); return; }
  if (f.trueNecro) { stDialog(['とけいだいの なかは しずかだ。', 'カチ……コチ……とけいの おとだけが ひびいている。']); return; }
  setScene('tower');
  stSave('tower');
  const intro = !f.towerNecro
    ? ['ふるびた かぎで うらの とびらを ひらいた……', 'カチ……コチ……カチ……コチ……', ['？？？', 'ククク……わが ねむりを さまたげるとは……']]
    : ['とけいだいの なかが あかく ひかっている……', ['ネクロディウス', '……まだ おわりでは ない……'], ['ネクロディウス', 'これが わが しんの すがた……！']];
  stDialog(intro, () => {
    const kind = f.towerNecro ? 'true' : 'tower';
    const p = stPanel(`<div class="inn-ask">${NECRO_KINDS[kind].name}と たたかう？<small>${kind === 'tower' ? '3けたの けいさん' : 'くく'}・HP ${NECRO_KINDS[kind].hp}・にげられない！</small></div>
      <div class="shop-foot two"><button type="button" class="buy go">たたかう！</button><button type="button" class="close">いまは やめる</button></div>`,
    () => setScene('town', { pos: { x: 24, y: 1 } }));
    p.querySelector('.go').addEventListener('click', () => { closePanelSilently(); startNecroBattle(kind, 'tower'); });
    p.querySelector('.close').addEventListener('click', closePanel);
  });
};

// ---------------------------------------------------------------------
//  エンディング
// ---------------------------------------------------------------------
SCENES.ending = {
  enter() { this.t = 0; },
  update(dt) { this.t += dt; if (Math.random() < 0.3) spawn('twinkle', rnd(0, W), rnd(0, H * 0.7), { color: pick(['#fff7c2', '#ffb3e0', '#bfe9ff']), size: rnd(6, 14) }); },
  draw() {
    const k = Math.min(1, (this.t || 0) / 4);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${10 + 20 * k},${8 + 30 * k},${40 + 60 * k})`); g.addColorStop(1, `rgb(${60 + 80 * k},${30 + 60 * k},${90 + 60 * k})`);
    ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
    for (let i = 0; i < 160 * k; i++) { ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(S.t * 1.4 + i)); drawStar(hash(i * 3) * W, hash(i * 7 + 1) * H * 0.7, 1.5 + hash(i + 5) * 3, '#fff7c2'); }
    ctx.globalAlpha = 1;
    const spr = SPR.hero;
    if (spr) { const hh = 260, w = hh * spr.w / spr.h; ctx.drawImage(spr.canvas, W / 2 - w / 2, H * 0.9 - hh + Math.sin(S.t * 2) * 6, w, hh); }
    if (SPR.cat) { const hh = 110, w = hh * SPR.cat.w / SPR.cat.h; ctx.drawImage(SPR.cat.canvas, W / 2 + 120, H * 0.9 - hh - Math.abs(Math.sin(S.t * 4)) * 8, w, hh); }
  },
};
function startEnding(kind) {
  const d = ST.data;
  d.flags.gameClear = (d.flags.gameClear || 0) + 1;
  if (kind === 'true') d.flags.trueNecro = true;
  d.place = 'town'; d.pos = { x: 14, y: 11 };
  setScene('ending');
  stSave();
  SFX.levelUp();
  const lines = kind === 'death'
    ? [['', 'しにがみ ネクロディウスを たおした！'], ['', 'だれも たおせない はずの しにがみを……！']]
    : [['', 'しんの ネクロディウスを たおした！']];
  stDialog(lines.concat([['', 'よぞらに ほしの ひかりが もどってきた……'], ['にゃんこ', 'にゃー！ にゃー！'], ['ちゅなちゃん', 'おほしさま、おかえり！'], ['アルト', 'ちゅなちゃん、ありがとう。'], ['アルト', 'きみこそ ほんものの ほしの まほうつかいじゃ！']]), showGameClear);
}
function showGameClear() {
  const d = ST.data;
  const p = stPanel(`<div class="gc-title">⭐ ゲーム クリア！ ⭐</div>
    <div class="tp-q">おめでとう！ ちゅなちゃんは せかいの ほしを まもりました！</div>
    <div class="gc-stats"><span>プレイじかん <b>${fmtPlayTime(d.playSeconds || 0)}</b></span><span>アルカ <b>${d.arca}</b></span><span>クリアした ダンジョン <b>${maxCleared(d)}</b></span></div>
    <div class="shop-foot two"><button type="button" class="buy go">まちで あそぶ</button><button type="button" class="ttl">タイトルへ</button></div>`, () => setScene('town', { pos: { x: 14, y: 11 } }));
  p.querySelector('.go').addEventListener('click', closePanel);
  p.querySelector('.ttl').addEventListener('click', () => { stSave(); location.href = '../ステラクエスト.html'; });
  for (let i = 0; i < 80; i++) spawn(Math.random() < 0.5 ? 'heart' : 'confetti', W / 2 + rnd(-60, 60), H * 0.4, { vx: rnd(-420, 420), vy: rnd(-520, -120) });
}

// ---------------------------------------------------------------------
//  がめん
// ---------------------------------------------------------------------
const baseUpdateUINecro = updateUI;
updateUI = function () {
  baseUpdateUINecro();
  const m = curNecro();
  if (typeof $ === 'function' && $('game')) {
    necroFleeBtn().hidden = !(m && NECRO_KINDS[m.necro].flee && S.mode === 'question');
    if (S.necroIntro) $('bossWarn').hidden = true;
  }
};
