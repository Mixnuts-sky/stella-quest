'use strict';
// =====================================================================
//  かんじ けんしの ぼうけん
//  game.js（あるく・てき・ボス・おしろ・にゃんこ・ランキング）を そのまま つかって、
//  もんだい（かんじの かきとり）と こうげき（けん）だけを さしかえる。
//  かんじの ぶひん（パッド・はんてい）は kanji_core.js。
// =====================================================================

const LEVEL_TAG = { 1: 'ふくしゅう', 2: 'いま おぼえている かんじ', 3: 'よしゅう：なぞって かこう' };

// ---- レベルは 3つ（ふくしゅう → いま → よしゅう）。けしきと てきは けいさんの 1・4・6 を つかう ----
Object.assign(CONFIG, { maxLevel: 3, heroX: 0.2, enemyX: 0.5 });
{
  const T4 = THEMES[4], T6 = THEMES[6], E4 = ENEMY_POWER[4], E6 = ENEMY_POWER[6], B4 = BOSS_STAGES[4], B6 = BOSS_STAGES[6];
  THEMES[2] = { ...T4, props: 4 };
  THEMES[3] = { ...T6, props: 6 };
  ENEMY_POWER[2] = E4; ENEMY_POWER[3] = E6;
  BOSS_STAGES[2] = B4; BOSS_STAGES[3] = B6;
}


makeQuestion = function (level) {
  let pool = KLIST.filter((e) => e.level === level);
  if (!pool.length) pool = KLIST;
  return buildQuestion(pickEntry(pool));
};

// ボスは にがて かんじを メインに（7わり）。とどめは いちばん にがてな かんじ
let lastBossWord = null;
makeBossQuestion = function (level, finalBlow) {
  const weak = loadWeak();
  let scored = KLIST.map((e) => ({ e, w: [...e.word].reduce((s, ch) => s + weakWeight(weak[ch]), 0) })).filter((x) => x.w > 0);
  if (scored.length > 1) scored = scored.filter((x) => x.e.word !== lastBossWord); // おなじ ことばが つづかない ように
  let q = null;
  if (scored.length && (finalBlow || Math.random() < 0.7)) {
    if (finalBlow) q = buildQuestion(scored.sort((a, b) => b.w - a.w)[0].e, true);
    else {
      let r = Math.random() * scored.reduce((s, x) => s + x.w, 0);
      for (const x of scored) { r -= x.w; if (r <= 0) { q = buildQuestion(x.e, true); break; } }
    }
  }
  q = q || makeQuestion(Math.min(level + 1, CONFIG.maxLevel));
  lastBossWord = q.entry.word;
  return q;
};

// なんもん：かんじが 2つ いじょうの ことばを、おてほん なしで（よしゅうの かんじも でる）
makeNanmonQuestion = function () {
  const multi = KLIST.filter((e) => [...e.word].filter(isKanji).length >= 2);
  const pool = multi.length ? multi : KLIST.filter((e) => e.level === CONFIG.maxLevel);
  return { ...buildQuestion(pick(pool.length ? pool : KLIST)), nanmon: true };
};


askQuestion = function () {
  const m = S.monster;
  const finalBlow = m.boss && m.hp === 1;
  S.q = m.nanmon ? makeNanmonQuestion() : (m.boss || m.rare) ? makeBossQuestion(S.level, finalBlow) : makeQuestion(S.level);
  S.input = '';
  const q = S.q, lv = q.entry.level;
  let label = `${enemyTag(m)} が あらわれた！（${LEVEL_TAG[lv] || ''}）`;
  if (m.boss) label = `ボス ${enemyTag(m)}！ ${finalBlow ? 'とどめの もんだい！' : q.fromWeak ? 'にがて かんじで しょうぶ！' : ''}`;
  else if (m.rare) label = `レア ${enemyTag(m)} が あらわれた！ ${q.fromWeak ? '（にがて かんじ）' : '（ボスと おなじ もんだい）'}`;
  if (m.nanmon) label = 'でんせつの なんもん！ おてほん なしで かけるかな？';
  $('monName').innerHTML = label;
  $('quiz').classList.toggle('boss', m.boss);
  $('qmsg').textContent = ''; $('qmsg').className = 'qmsg';
  $('nextBtn').hidden = true;
  // おてほん：よしゅうは なぞりがき、にゃんこの ヒントの ときも
  const guide = !m.nanmon && (lv >= 3 || S.hintNext) ? 'trace' : 'none';
  S.hintNext = false;
  setMode('question');
  kanjiSetup(q, { guide, hint: !m.nanmon && lv === 2 });
};

// こたえかた（kanji_core.js の ぶひんを つかう）
typeDigit = function () {};
eraseDigit = kanjiErase;
renderAnswer = function () { renderWord(); };
submit = kanjiSubmit;
KANJI_HOOKS.attackKinds = ['ichimonji', 'tsubame', 'kabuto'];


// =====================================================================
//  けんの こうげき
// =====================================================================
const SWORD = {
  ichimonji: { lines: ['いちもんじ', 'ぎり！'], color: '#3a8dff' },
  tsubame:   { lines: ['つばめ', 'がえし！'], color: '#22c56a' },
  kabuto:    { lines: ['かぶと', 'わり！'], color: '#ff4b3a' },
  star:      { lines: ['ひっさつ！', 'りゅうせいざん！'], color: '#e0a800' },
  double:    { lines: ['ダブル', 'りゅうせいざん！'], color: '#e0408a' },
};
SFX.slash = () => { noise(0, .18, .22, 3200); note(1800, 0, .12, { type: 'sine', vol: .06, slide: .4 }); };
SFX.dash = () => noise(0, .2, .1, 900);

const slashes = [];
let swordSeq = null;

function addSlash(x, y, angle, len, color, width = 16) {
  slashes.push({ x, y, angle, len, color, width, t: 0, life: 0.42 });
}

function slashImpact(x, y, big) {
  for (let i = 0; i < (big ? 26 : 12); i++) spawn('star', x, y, { vx: rnd(-320, 320), vy: rnd(-380, 60), size: rnd(8, big ? 20 : 14), color: pick(['#ffffff', '#fff3a0', '#bfe9ff']) });
  for (let i = 0; i < 6; i++) spawn('twinkle', x + rnd(-60, 60), y + rnd(-60, 60), { color: '#ffffff', size: rnd(8, 16) });
  S.shake = Math.max(S.shake, big ? 0.9 : 0.35);
  if (S.monster) S.monster.hitFlash = 1;
  SFX.slash();
}

const easeOut = (k) => 1 - (1 - k) * (1 - k);

cast = function (kind, onHit) {
  const sw = SWORD[kind] || SWORD.ichimonji;
  const m = S.monster;
  const D = Math.max(0, m.x - HERO_X() - 140);
  const cx = m.x, cy = GROUND() - m.height * 0.5, len = m.height * 0.95;
  S.heroSay = { lines: sw.lines, color: sw.color, t: 0, dur: 1.5 };
  SFX.dash();
  const finisher = kind === 'star' || kind === 'double';
  const events = [];
  if (!finisher) {
    const hitAt = 0.17;
    if (kind === 'ichimonji') events.push({ at: hitAt, fn: () => { addSlash(cx, cy, rnd(-12, 4) / 100, len, sw.color, 18); slashImpact(cx, cy); } });
    if (kind === 'kabuto') events.push({ at: hitAt, fn: () => { addSlash(cx, cy, Math.PI / 2 - 0.12, len, sw.color, 18); slashImpact(cx, cy); } });
    if (kind === 'tsubame') {
      events.push({ at: hitAt, fn: () => { addSlash(cx, cy, 0.75, len, sw.color, 15); slashImpact(cx, cy); } });
      events.push({ at: hitAt + 0.11, fn: () => { addSlash(cx, cy, -0.75, len, sw.color, 15); slashImpact(cx, cy); } });
    }
    events.push({ at: hitAt + 0.12, fn: onHit });
    swordSeq = { t: 0, events, end: 0.85, dash: (t) => (t < 0.16 ? easeOut(t / 0.16) * D : t < 0.5 ? D : t < 0.8 ? D * (1 - easeOut((t - 0.5) / 0.3)) : 0) };
    return;
  }
  // ひっさつ：れんぞく ぎり → さいごに おおきな じゅうじ ぎり
  for (let i = 0; i < 6; i++) {
    events.push({ at: 0.24 + i * 0.09, fn: () => { addSlash(cx + rnd(-30, 30), cy + rnd(-40, 40), Math.random() * Math.PI, len * 0.9, pick(['#ffe27a', '#bfe9ff', '#ff9ad5']), 13); slashImpact(cx, cy); } });
  }
  if (kind === 'double' && S.cat) { // にゃんこも ほしを なげる
    events.push({ at: 0.3, fn: () => {
      for (let i = 0; i < 5; i++) spells.push({ kind: 'star', sx: S.cat.x, sy: GROUND() - 80, tx: cx + rnd(-40, 40), ty: cy + rnd(-50, 50), t: -i * 0.08, dur: 0.5, arc: rnd(60, 160), size: 24, hue: i * 60, onHit: null });
    } });
  }
  events.push({ at: 0.9, fn: () => {
    addSlash(cx, cy, 0.78, len * 1.5, '#ffd84a', 30); addSlash(cx, cy, -0.78, len * 1.5, '#ffd84a', 30);
    slashImpact(cx, cy, true);
    S.flash = 0.9; S.flashColor = '255,248,210';
    SFX.star();
  } });
  events.push({ at: 1.0, fn: onHit });
  swordSeq = { t: 0, events, end: 1.5, dash: (t) => (t < 0.2 ? easeOut(t / 0.2) * D : t < 1.15 ? D : t < 1.45 ? D * (1 - easeOut((t - 1.15) / 0.3)) : 0) };
};

// つるぎの さき（ためる ときの ひかり）
staffTip = function () { return { x: HERO_X() + 62, y: GROUND() - 200 }; };

const baseStartCharge = startCharge;
startCharge = function (withCat) {
  baseStartCharge(withCat);
  if (S.heroSay) S.heroSay.lines = ['きあいを', 'ためて…'];
};

const baseUpdate = update;
update = function (dt) {
  baseUpdate(dt);
  if (swordSeq) {
    const sq = swordSeq;
    sq.t += dt;
    sq.events = sq.events.filter((ev) => { if (sq.t >= ev.at) { ev.fn(); return false; } return true; });
    S.hero.dashX = sq.dash(sq.t);
    if (sq.t >= sq.end && !sq.events.length) { swordSeq = null; S.hero.dashX = 0; }
  }
  for (let i = slashes.length - 1; i >= 0; i--) { slashes[i].t += dt; if (slashes[i].t >= slashes[i].life) slashes.splice(i, 1); }
};

const baseDrawSpells = drawSpells;
drawSpells = function () {
  baseDrawSpells();
  for (const s of slashes) {
    const grow = Math.min(1, s.t / 0.1), fade = 1 - Math.max(0, (s.t - 0.1) / (s.life - 0.1));
    const half = s.len / 2;
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.angle);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(-half, 0);
      ctx.quadraticCurveTo(0, -s.len * 0.16, -half + s.len * grow, 0);
    };
    ctx.globalAlpha = 0.35 * fade; ctx.strokeStyle = s.color; ctx.lineWidth = s.width * 2.4; path(); ctx.stroke();
    ctx.globalAlpha = 0.9 * fade; ctx.lineWidth = s.width; path(); ctx.stroke();
    ctx.globalAlpha = fade; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s.width * 0.35; path(); ctx.stroke();
    ctx.restore();
  }
};

// =====================================================================
//  がめん
// =====================================================================
const baseUpdateUI = updateUI;
updateUI = function () {
  baseUpdateUI();
  const m = S.mode;
  $('writePad').hidden = !(m === 'question' || m === 'answered');
  if (m !== 'title') $('weakList').hidden = true;
  if (!$('writePad').hidden) { sizePad(); renderPadUi(); }
};

function renderWeakList() {
  const weak = loadWeak();
  const items = Object.entries(weak).sort((a, b) => weakWeight(b[1]) - weakWeight(a[1]) || b[1].miss - a[1].miss);
  $('weakItems').innerHTML = items.length ? items.map(([ch, w]) => `
    <div class="weak-item ${w.overcome ? 'ok' : ''}">
      <span class="ch">${ch}</span>
      <span class="n">${w.overcome ? 'こくふく！' : `まちがい ${w.miss}かい`}</span>
      <span class="s">${w.overcome ? `まちがい ${w.miss}かい` : `れんぞく せいかい ${w.streak}/${KANJI_CONFIG.overcomeStreak}`}</span>
    </div>`).join('') : '<div class="weak-empty">まだ ありません。この ちょうしで がんばろう！</div>';
}
$('weakBtn').addEventListener('click', () => { renderWeakList(); $('weakReset').textContent = 'きろくを けす'; $('weakList').hidden = false; });
$('weakClose').addEventListener('click', () => { $('weakList').hidden = true; });
$('weakReset').addEventListener('click', (e) => {
  const b = e.currentTarget;
  if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'ほんとうに けす？'; return; }
  b.dataset.sure = ''; saveWeak({}); renderWeakList(); b.textContent = 'けしました';
});

// =====================================================================
//  けんしの え が まだ ない ときの かわり（剣士/ に え を いれると そちらを つかう）
// =====================================================================
window.drawHeroPlaceholder = (hh, c = ctx) => drawSwordsman(c, hh, S.t, !!S.charge);

// タイトルなどの え（剣士/ の え が はいったら loadAll が うわがきする）
{
  const cnv = document.createElement('canvas');
  cnv.width = 260; cnv.height = 300;
  const c = cnv.getContext('2d');
  c.translate(130, 290);
  window.drawHeroPlaceholder(270, c);
  const url = cnv.toDataURL();
  ['titleChara', 'upChara', 'downChara', 'clearHero'].forEach((id) => { if (!$(id).getAttribute('src')) $(id).src = url; });
}
