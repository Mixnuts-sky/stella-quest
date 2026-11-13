'use strict';
// =====================================================================
//  おんがく おどりこの ぼうけん
//  game.js（あるく・てき・ボス・おしろ・にゃんこ・ランキング）を そのまま つかって、
//  もんだい（ごせんふの おんぷ）と こうげき（おんぷの うた と ダンス）だけを さしかえる。
//  おんがくの ぶひん（ごせんふ・おと）は music_core.js。
// =====================================================================


// ---- 7つの レベル（6は あたらしい よるの ステージ、7が ドラゴンの おしろ）----
Object.assign(CONFIG, { maxLevel: 7, heroX: 0.2, enemyX: 0.74 });
{
  const T5 = THEMES[5], T6 = THEMES[6], E5 = ENEMY_POWER[5], E6 = ENEMY_POWER[6], B5 = BOSS_STAGES[5], B6 = BOSS_STAGES[6];
  THEMES[6] = { place: 'よぞらの ステージ', sky: ['#1d2b5a', '#5a6fb8'], far: '#2e3f7a', near: '#24346a', ground: '#3a4f8f', path: '#a9b8e6', accent: ['#ffe27a', '#9ff', '#ff9ad5'], props: 5 };
  THEMES[7] = { ...T6, props: 6 };
  ENEMY_POWER[6] = { ...E5, prefix: 'ナイト ', scale: 1.22 };
  ENEMY_POWER[7] = E6;
  BOSS_STAGES[6] = { ...B5, name: 'ダーク どらぎょ', height: 244 };
  BOSS_STAGES[7] = B6;
  void T5;
}

makeQuestion = makeMusicQuestion;
// なんもん：きじゅんの ド なしで おとを あてる（ト音の した〜うえ）
makeNanmonQuestion = function () {
  const q = makeMusicQuestion(7);
  q.target.oct = pick([4, 5]);
  return { ...q, noRef: true, nanmon: true };
};
// ボスは ひとつ うえの レベル。さいごの ボスは いろいろ まぜる
makeBossQuestion = function (level) {
  return makeMusicQuestion(level < CONFIG.maxLevel ? level + 1 : pick([3, 6, 7]));
};

askQuestion = function () {
  const m = S.monster;
  stopPhrase();
  S.q = m.nanmon ? makeNanmonQuestion() : (m.boss || m.rare) ? makeBossQuestion(S.level, m.boss && m.hp === 1) : makeQuestion(S.level);
  S.input = '';
  const q = S.q;
  const tag = MUSIC_LEVELS[q.level].tag;
  $('monName').innerHTML = m.nanmon ? 'でんせつの なんもん！ ドの おと なしで わかるかな？'
    : m.boss ? `ボス ${enemyTag(m)}！（${tag}）${m.hp === 1 ? ' とどめの もんだい！' : ''}`
      : m.rare ? `レア ${enemyTag(m)} が あらわれた！（${tag}）` : `${enemyTag(m)} が あらわれた！（${tag}）`;
  $('quiz').classList.toggle('boss', m.boss);
  musicAsk(q);
};

// こたえかた（music_core.js の ぶひんを つかう）
typeDigit = musicTypeDigit;
eraseDigit = musicErase;
renderAnswer = function () { renderStaff(); };
submit = musicSubmit;
MUSIC_HOOKS.attackKinds = ['step', 'turn', 'song'];

// =====================================================================
//  うたと ダンスの こうげき（おんぷを とばす）
// =====================================================================
const DANCE = {
  step: { lines: ['ハッピー', 'ステップ！'], color: '#ff4f9a', path: 'hop' },
  turn: { lines: ['くるくる', 'ターン！'], color: '#7f6bff', path: 'spiral' },
  song: { lines: ['ラララ', 'ソング！'], color: '#22a8c5', path: 'wave' },
  star: { lines: ['フィナーレ！', 'スーパー', 'コンサート'], color: '#e0a800' },
  double: { lines: ['ダブル', 'コンサート！'], color: '#e0408a' },
};
const GLYPHS = ['♪', '♫', '♬', '♩'];
const flyNotes = [];

cast = function (kind, onHit) {
  const dn = DANCE[kind] || DANCE.step;
  const m = S.monster;
  const from = { x: HERO_X() + 50, y: GROUND() - 170 }, to = { x: m.x, y: GROUND() - m.height * 0.5 };
  S.heroSay = { lines: dn.lines, color: dn.color, t: 0, dur: 1.6 };
  S.hero.jump = 1;
  const finisher = kind === 'star' || kind === 'double';
  const n = finisher ? 16 : 5;
  const melody = finisher ? [0, 2, 4, 0, 2, 4, 5, 4, 0, 2, 4, 6, 4, 2, 1, 0] : [0, 2, 4, 2, 0];
  for (let i = 0; i < n; i++) {
    const oct = finisher && i >= 8 ? 5 : 4;
    const fromCat = kind === 'double' && S.cat && i % 2;
    flyNotes.push({
      sx: fromCat ? S.cat.x : from.x, sy: fromCat ? GROUND() - 80 : from.y, tx: to.x + rnd(-30, 30), ty: to.y + rnd(-40, 40),
      t: -i * (finisher ? 0.07 : 0.11), dur: finisher ? 0.5 : 0.6, path: finisher ? pick(['hop', 'spiral', 'wave']) : dn.path,
      glyph: pick(GLYPHS), color: finisher ? `hsl(${i * 37},90%,60%)` : dn.color, size: finisher ? rnd(30, 44) : rnd(28, 36),
      deg: melody[i % melody.length], oct, last: i === n - 1, onHit,
      big: finisher && i === n - 1,
    });
  }
  if (finisher) { S.flash = 0.6; S.flashColor = '255,240,200'; }
};

staffTip = function () { return { x: HERO_X() + 55, y: GROUND() - 160 }; };
const baseStartCharge = startCharge;
startCharge = function (withCat) {
  baseStartCharge(withCat);
  if (S.heroSay) S.heroSay.lines = ['リズムを', 'ためて…'];
};

const baseUpdate = update;
update = function (dt) {
  baseUpdate(dt);
  for (let i = flyNotes.length - 1; i >= 0; i--) {
    const f = flyNotes[i];
    f.t += dt;
    if (f.t < 0) continue;
    const k = Math.min(1, f.t / f.dur);
    let x = f.sx + (f.tx - f.sx) * k, y = f.sy + (f.ty - f.sy) * k;
    if (f.path === 'hop') y -= Math.abs(Math.sin(k * Math.PI * 2)) * 70;
    if (f.path === 'spiral') { x += Math.cos(k * 12) * 40 * (1 - k); y += Math.sin(k * 12) * 40 * (1 - k); }
    if (f.path === 'wave') y += Math.sin(k * 10) * 30;
    f.x = x; f.y = y;
    if (Math.random() < 0.4) spawn('twinkle', x, y, { color: f.color, size: rnd(5, 10) });
    if (k >= 1) {
      flyNotes.splice(i, 1);
      playPitch(f.deg, f.oct, 0, 0.35); // あたると メロディ
      for (let j = 0; j < (f.big ? 30 : 6); j++) spawn(j % 2 ? 'star' : 'twinkle', x, y, { vx: rnd(-260, 260), vy: rnd(-300, 60), color: f.color, size: rnd(8, f.big ? 20 : 13) });
      if (S.monster) S.monster.hitFlash = 1;
      S.shake = Math.max(S.shake, f.big ? 0.9 : 0.15);
      if (f.big) { S.flash = 0.9; S.flashColor = '255,248,210'; [0, 2, 4].forEach((d) => playPitch(d, 5, 0.05, 1.2)); }
      if (f.last && f.onHit) f.onHit();
    }
  }
};

const baseDrawSpells = drawSpells;
drawSpells = function () {
  baseDrawSpells();
  for (const f of flyNotes) {
    if (f.t < 0 || f.x === undefined) continue;
    const size = f.big ? 110 : f.size;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(Math.sin(f.t * 10) * 0.3);
    ctx.font = `900 ${size}px "Noto Music", "Segoe UI Symbol", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.strokeText(f.glyph, 0, 0);
    ctx.fillStyle = f.color; ctx.fillText(f.glyph, 0, 0);
    ctx.restore();
  }
};

// =====================================================================
//  がめん
// =====================================================================
const baseUpdateUI = updateUI;
updateUI = function () {
  baseUpdateUI();
  $('answerBar').hidden = !(S.mode === 'question' || S.mode === 'answered');
  if (S.mode !== 'question' && S.mode !== 'answered') stopPhrase();
  renderKeys();
};

// おどりこの え が まだ ない ときの かわり（踊り子/ に え を いれると そちらを つかう）
window.drawHeroPlaceholder = (hh, c = ctx) => drawDancer(c, hh, S.t, !!S.charge);
{
  const cnv = document.createElement('canvas');
  cnv.width = 260; cnv.height = 300;
  const c = cnv.getContext('2d');
  c.translate(120, 290);
  drawDancer(c, 260, 0.6);
  const url = cnv.toDataURL();
  ['titleChara', 'upChara', 'downChara', 'clearHero'].forEach((id) => { if (!$(id).getAttribute('src')) $(id).src = url; });
}
