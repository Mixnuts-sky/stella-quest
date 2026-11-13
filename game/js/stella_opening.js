'use strict';
// =====================================================================
//  ステラクエスト：オープニング（あたらしく はじめた とき だけ）
//    1. ほしが きえた よる（ムービー）
//    2. だい1しょう ちゅなちゃんの あさ（へやを あるける → とびらで まちへ）
//    3. だい2しょう ルミナリアの おねがい（ひろばで アルト）
//    4. だい3しょう はじめての まほう（チュートリアル：2 ＋ 3）
//    5. だい4しょう ぼうけんの はじまり
//    6. ものがたりの うらがわ（3びょう）
//  どこでも「スキップ」できる。ぶんしょうは ユーザーの だいほん どおり。
//  しよう：docs/GAME_SPEC.md「3. オープニング」
// =====================================================================

const OP = { phase: 'black', t: 0, stars: [] };
const opFlags = () => ST.data.flags;

// じゅんばんに すすめる：[ ['だれ','せりふ'] の れつ | function(next) ]
function opSeq(steps, done) {
  const run = (i) => {
    if (i >= steps.length) { if (done) done(); return; }
    const s = steps[i];
    if (typeof s === 'function') s(() => run(i + 1));
    else stDialog(s, () => run(i + 1));
  };
  run(0);
}
const wait = (sec) => (next) => { setMode('cut'); later(sec, () => { setMode('st'); next(); }); }; // まっている あいだは あるけない
const phase = (p) => (next) => { OP.phase = p; OP.t = 0; next(); };

// しずかな おんがく（ゆっくりの アルペジオ）
let opMusicTimer = null;
function opMusic(on) {
  clearInterval(opMusicTimer);
  if (!on) return;
  const notes = [[523, 659, 784, 988], [440, 554, 659, 880], [392, 494, 587, 784], [349, 440, 523, 698]];
  let k = 0;
  const play = () => { notes[k % 4].forEach((f, i) => note(f, i * 0.32, 1.4, { type: 'sine', vol: 0.045 })); k++; };
  play();
  opMusicTimer = setInterval(play, 1600);
}

// ---------------------------------------------------------------------
//  1. ほしが きえた よる
// ---------------------------------------------------------------------
SCENES.op = {
  enter() { OP.phase = 'black'; OP.t = 0; OP.stars = Array.from({ length: 140 }, (_, i) => ({ x: hash(i * 3), y: hash(i * 7 + 1) * 0.75, r: 1 + hash(i + 5) * 2.4, p: hash(i * 11) * 6, at: hash(i * 13) * 6, gone: 0 })); },
  update(dt) { OP.t += dt; },
  draw() { drawOpening(); },
};

function drawOpening() {
  const p = OP.phase, t = OP.t;
  ctx.fillStyle = '#05030c'; ctx.fillRect(-30, -30, W + 60, H + 60);
  const drawSky = (alpha, keepRatio = 1) => {
    OP.stars.forEach((s, i) => {
      if (i / OP.stars.length > keepRatio) return;
      const a = Math.min(1, Math.max(0, (t - s.at * 0.5))) * alpha * (0.5 + 0.5 * Math.abs(Math.sin(S.t * 1.3 + s.p)));
      if (a <= 0.01) return;
      ctx.globalAlpha = a;
      drawStar(s.x * W, s.y * H, s.r * 1.6, '#fff7c2');
    });
    ctx.globalAlpha = 1;
  };
  if (p === 'stars') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(20,20,70,${Math.min(1, t / 3)})`); g.addColorStop(1, `rgba(60,30,100,${Math.min(1, t / 3)})`);
    ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
    drawSky(1);
  } else if (p === 'town' || p === 'cloud') {
    const dark = p === 'cloud' ? Math.min(1, t / 4) : 0;
    drawLuminaria(dark);
    if (p === 'cloud') {
      // くろい くもが ひろがる・ほしが きえていく
      for (let i = 0; i < 9; i++) {
        const x = (i / 8) * W * 1.2 - W * 0.1 + Math.sin(S.t + i) * 10 - (1 - Math.min(1, t / 3)) * W * 0.6;
        ctx.fillStyle = `rgba(20,10,30,${0.85 * Math.min(1, t / 2)})`;
        ctx.beginPath(); ctx.arc(x, 40 + hash(i) * 60, 70 + hash(i + 2) * 50, 0, 7); ctx.fill();
      }
      if (t < 2.5) S.shake = Math.max(S.shake, 0.25);
    }
  } else if (p === 'redstar') {
    drawSky(0.25, 0.1);
    const k = Math.min(1, t / 0.6) * (t > 2.2 ? Math.max(0, 1 - (t - 2.2) / 0.8) : 1);
    ctx.save(); ctx.translate(W / 2, H * 0.4);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 220);
    g.addColorStop(0, `rgba(255,60,60,${0.8 * k})`); g.addColorStop(1, 'rgba(120,0,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 220, 0, 7); ctx.fill();
    ctx.globalAlpha = k; drawStar(0, 0, 60 + Math.sin(S.t * 6) * 4, '#ff3b4a'); drawStar(0, 0, 26, '#ffd0d0');
    ctx.restore(); ctx.globalAlpha = 1;
  } else if (p === 'voice') {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
    g.addColorStop(0, 'rgba(80,0,30,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  }
}

// うつくしい ルミナリアの まち：おしろ・はなばたけ・にじ・ひとびと（dark: 0〜1 で くらく なる）
function drawLuminaria(dark) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#8fd0ff'); g.addColorStop(0.7, '#fff2fb');
  ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
  // にじ
  ['#ff5a5a', '#ff9a3a', '#ffd84a', '#5fd06a', '#5ab4ff', '#8a6aff', '#ff8fd0'].forEach((c, i) => {
    ctx.strokeStyle = c; ctx.lineWidth = 12; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(W * 0.72, H * 0.72, 300 - i * 12, Math.PI, 0); ctx.stroke();
  });
  ctx.globalAlpha = 1;
  // おしろ
  const cx = W * 0.32, gy = H * 0.66;
  const castleImg = typeof BIMG !== 'undefined' && BIMG.outside.castle;
  drawMeadow(gy);
  if (castleImg && bimgReady(castleImg)) { // デザイン/建物/城.png
    const w = Math.min(W * 0.5, 520), h = w * castleImg.naturalHeight / castleImg.naturalWidth;
    ctx.drawImage(castleImg, cx - w / 2, gy + 30 - h, w, h);
  } else drawCanvasCastle(cx, gy);
  drawPeople(gy, dark);
}
function drawCanvasCastle(cx, gy) {
  ctx.fillStyle = '#efe6ff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.fillRect(cx - 110, gy - 130, 220, 130); ctx.strokeRect(cx - 110, gy - 130, 220, 130);
  [[-130, 200], [90, 200], [-30, 240]].forEach(([dx, h]) => {
    ctx.fillStyle = '#e4d8ff'; ctx.fillRect(cx + dx, gy - h, 40, h); ctx.strokeRect(cx + dx, gy - h, 40, h);
    ctx.fillStyle = '#8a5cd1'; ctx.beginPath(); ctx.moveTo(cx + dx - 8, gy - h); ctx.lineTo(cx + dx + 20, gy - h - 60); ctx.lineTo(cx + dx + 48, gy - h); ctx.closePath(); ctx.fill(); ctx.stroke();
  });
  drawStar(cx, gy - 70, 16, '#ffd84a');
}
function drawMeadow(gy) { // はなばたけ
  ctx.fillStyle = '#86d07f'; ctx.fillRect(-30, gy, W + 60, H - gy + 30);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = ['#ff8fbf', '#ffd84a', '#ffffff', '#b98aff'][i % 4];
    ctx.beginPath(); ctx.arc(hash(i) * W, gy + 14 + hash(i + 3) * (H - gy - 20), 5, 0, 7); ctx.fill();
  }
}
function drawPeople(gy, dark) { // たのしそうな ひとびと
  [[0.52, '#ff9a3a', 'むらの おんなのこ'], [0.6, '#5ac8e0', 'むらの おとこのこ'], [0.69, '#9a7ad6', 'おとなの おんな'], [0.78, '#ff7aa8', 'おとなの おとこ'], [0.87, '#6a8a4a', 'おばあちゃん']].forEach(([x, c, name], i) => {
    ctx.save(); ctx.translate(W * x, gy + 70 - Math.abs(Math.sin(S.t * 4 + i)) * 10);
    if (!drawNpcSprite(name, 110, false)) { ctx.scale(1.3, 1.3); drawPerson(ctx, { color: c, hair: i % 2 ? '#3a2a20' : '#7a4a2c' }); }
    ctx.restore();
  });
  if (dark > 0) { ctx.fillStyle = `rgba(15,5,30,${0.75 * dark})`; ctx.fillRect(-30, -30, W + 60, H + 60); }
}

// ---------------------------------------------------------------------
//  2. ちゅなちゃんの へや は「たてものの なか」（stella_interior.js の house）を つかう
//     ねている あいだ は え の なかの ちゅなちゃん（ベッドで ねている え）、おきたら ふとんで かくす
// ---------------------------------------------------------------------
const HOUSE_WAKE = { x: 122, y: 192 }; // ベッドの よこ（デザイン/建物/内装全般.png の いえ の ざひょう）

// ---------------------------------------------------------------------
//  オープニングの ながれ
// ---------------------------------------------------------------------
function startOpening() {
  opFlags().opStage = 'movie';
  showSkip(true);
  setScene('op');
  opMusic(true);
  opSeq([
    wait(1.2), phase('stars'), wait(2.5),
    [['', 'むかし むかし。'], ['', 'この せかいには\nたくさんの ほしが かがやいていました。'], ['', 'ほしたちは まほうの ちからを\nせかいじゅうに とどけていました。'], ['', 'その おかげで\nみんなは えがおで\nくらしていたのです。']],
    phase('town'), wait(2.2),
    [['', 'しかし……']],
    (next) => { opMusic(false); OP.phase = 'cloud'; OP.t = 0; noise(0, 2.5, 0.3, 90); note(55, 0, 2.5, { type: 'sawtooth', vol: 0.08, vib: 3 }); next(); },
    [['', 'ゴゴゴゴゴ……！']],
    [['', 'ところが あるひ。'], ['', 'よぞらの ほしが\nすこしずつ きえはじめました。'], ['', 'ほしが きえるたびに\nせかいの まほうも\nよわくなっていったのです。']],
    phase('redstar'), (next) => { note(110, 0, 2, { type: 'sine', vol: 0.15, vib: 5 }); next(); }, wait(2.6),
    phase('voice'),
    [['？？？', 'ククク……'], ['？？？', 'ほしの ひかりが\nきえる とき……'], ['？？？', 'すべては やみに つつまれる……']],
    phase('black'), wait(1.5),
  ], startChapter1);
}

// だい1しょう ちゅなちゃんの あさ
function startChapter1() {
  opFlags().opStage = 'room';
  stSave('house');
  enterInterior('house', { sleeping: true, pos: HOUSE_WAKE, cat: { x: 102, y: 172 }, silent: true }); // ねこ は ベッドの うえ
  [1568, 1760, 1568, 2093].forEach((f, i) => note(f, i * 0.14, 0.12, { type: 'sine', vol: 0.06 })); // ことりの なきごえ
  opSeq([
    wait(1.2),
    (next) => { SFX.meow(); next(); },
    [['にゃんこ', 'にゃー！'], ['にゃんこ', 'にゃー！ にゃー！']],
    (next) => { INT.sleeping = false; INT.cat = { x: 96, y: 196 }; next(); },
    [['ちゅなちゃん', 'ふぁ〜……'], ['ちゅなちゃん', 'おはよう！'], ['ちゅなちゃん', 'きょうも いい てんきだね！']],
    (next) => { INT.cat = { x: 150, y: 140 }; INT.facing = 1; next(); }, // まどの ほうへ
    [['にゃんこ', 'にゃっ！？']],
    [['ちゅなちゃん', 'あれ……？'], ['ちゅなちゃん', 'おそらの おほしさまが\nすくなくなってる……？']],
    (next) => { INT.sparkle = 1.6; SFX.star(); next(); },
    [['', '✨ キラッ！'], ['ちゅなちゃん', 'えっ！？'], ['ちゅなちゃん', 'いま、つえが ひかった？']],
    (next) => { INT.catHop = true; SFX.meow(); next(); },
    [['にゃんこ', 'にゃん！']],
    (next) => { INT.catHop = false; INT.free = true; showBanner('ちゅなちゃんを うごかしてみよう！', 3); showToast('やじるしキーで あるけるよ。したの とびらから そとへ でよう！', 5); next(); },
  ]);
}

// だい2〜4しょう（まちに でたら）
function startChapter2() {
  opFlags().opStage = 'ch3';
  TW_HERO.x = 13; TW_HERO.y = 14; TW_HERO.fx = 13; TW_HERO.fy = 14; TW_HERO.dir = 'up';
  opSeq([
    wait(0.6),
    [['', 'ひろばに ひとびとが あつまっている。'], ['', 'まんなかには、しろい ひげの やさしそうな まほうつかいの おじいさん。'], ['', '⭐ ほしの けんじゃ「アルト」']],
    [['アルト', 'おお、ちゅなちゃん！'], ['アルト', 'ちょうど よいところに\nきてくれたのう。'], ['ちゅなちゃん', 'アルトおじいちゃん！'], ['ちゅなちゃん', 'なにか あったの？'],
      ['アルト', 'じつはのう……'], ['アルト', 'この せかいの ほしが\nすこしずつ きえておるのじゃ。'], ['ちゅなちゃん', 'ええっ！？'], ['ちゅなちゃん', 'おほしさまが\nなくなっちゃうの！？'],
      ['アルト', 'そうじゃ。'], ['アルト', 'じゃが、まだ きぼうは ある。'], ['', 'アルトが、ちゅなちゃんの つえを みつめる。'], ['アルト', 'その つえ……'], ['アルト', 'どうやら ほしの まほうに\nはんのうしておるようじゃ。'],
      ['ちゅなちゃん', 'ほしの まほう……？'], ['アルト', 'この せかいには\n6つの まほうの しれんが ある。'], ['アルト', 'しれんを のりこえると\nきえた ほしの ひかりを\nとりもどせるのじゃ。'],
      ['ちゅなちゃん', 'じゃあ、わたしが\nほしを とりもどす！'], ['にゃんこ', 'にゃー！！'], ['ちゅなちゃん', 'いっしょに\nがんばろうね！']],
    // だい3しょう はじめての まほう
    [['アルト', 'ちゅなちゃん。'], ['アルト', 'まほうを つかうには\nたいせつな ものが ある。'], ['アルト', 'なんだと おもう？'], ['ちゅなちゃん', 'うーん……'], ['ちゅなちゃん', 'つよい つえ？'],
      ['アルト', 'ほっほっほ！'], ['アルト', 'それも たいせつじゃ。'], ['アルト', 'じゃが、もっと たいせつなのは……'], ['アルト', 'かんがえる ちから じゃ！'],
      ['アルト', 'さんすうの まほう。'], ['アルト', 'かんじの まほう。'], ['アルト', 'おんがくの まほう。'], ['アルト', 'この 3つを つかって\nモンスターを たおすのじゃ！']],
    [['', 'ひろばに、ちいさな モンスターが あらわれた！'], ['モンスター', 'ぷるぷる！'], ['ちゅなちゃん', 'わっ！ モンスター！？'], ['アルト', 'あわてるでない！'], ['アルト', 'もんだいに こたえれば\nまほうが つかえるぞ！']],
    (next) => startTutorialBattle(next),
    (next) => { ST.data.arca += 10; opFlags().tutorialPaid = true; coinSound(); stRenderHud(); next(); },
    [['', 'モンスターを たおした！'], ['', '10アルカを てにいれた！'], ['ちゅなちゃん', 'やったー！！'], ['ちゅなちゃん', 'わたしにも まほうが\nつかえたよ！'], ['アルト', 'すばらしい！'], ['アルト', 'その ちょうしじゃ！']],
    // だい4しょう ぼうけんの はじまり
    [['', 'アルトが、まちの そとに ある ダンジョンを ゆびさす。'], ['アルト', 'あの どうくつに\nさいしょの ほしの ひかりが\nねむっておる。'], ['ちゅなちゃん', 'よーし！'], ['ちゅなちゃん', 'さっそく いってみよう！'],
      ['アルト', 'まつのじゃ！'], ['アルト', 'ぼうけんの まえには\nじゅんびが たいせつじゃぞ。'],
      ['アルト', '🏨 やどや では、10アルカで とまると HPが 6に なる。'], ['アルト', '🪄 ぶきや では、あたらしい つえが かえる。'], ['アルト', '🧪 アイテムや では、かいふくの アイテムなどが かえるぞ。'],
      ['アルト', 'ちゅなちゃん。'], ['アルト', 'むずかしい もんだいも\nあきらめずに かんがえるのじゃ。'], ['アルト', 'きっと ほしが\nちからを かしてくれる。'],
      ['ちゅなちゃん', 'うん！'], ['ちゅなちゃん', 'おほしさまを\nぜんぶ とりもどしてみせる！'], ['にゃんこ', 'にゃんにゃん！']],
    (next) => { showBanner('⭐ ぼうけんの はじまり！ ⭐', 2.6); SFX.levelUp(); later(2.8, next); },
    (next) => darkScene(next),
  ], finishOpening);
}

function startTutorialBattle(next) {
  const slime = SPR.enemies.find((s) => !s.tint) || null;
  startStellaBattle({
    difficulty: 1, practice: true, returnTo: 'town', pos: { x: TW_HERO.x, y: TW_HERO.y },
    monster: { name: 'ぷるぷる', hp: 1, maxHp: 1, subject: 'math', tutorial: true, rare: false, ...(slime ? { spr: slime, height: slime.height || 180, tintColor: null } : {}) },
    after: next,
  });
}

// ものがたりの うらがわ（3びょう）
function darkScene(next) {
  setScene('dark');
  opSeq([
    (n) => { for (let i = 0; i < 4; i++) later(i * 0.35, () => note(1800 + rnd(-200, 200), 0, 0.15, { type: 'square', vol: 0.04 })); n(); }, // ジャラ……
    wait(0.8),
    [['', 'ジャラ……ジャラ……']],
    (n) => { DK.red = 1; note(80, 0, 1.5, { type: 'sawtooth', vol: 0.06, vib: 4 }); n(); },
    [['？？？', 'ほう……'], ['？？？', 'ほしの ちからが\nめざめたか……']],
    (n) => { DK.scythe = 1; n(); },
    [['？？？', 'ククク……'], ['？？？', 'おもしろい……']],
    (n) => { DK.red = 0; DK.scythe = 0; DK.fade = 1; later(1.0, n); },
  ], next);
}
const DK = { red: 0, scythe: 0, fade: 0 };
SCENES.dark = {
  enter() { DK.red = 0; DK.scythe = 0; DK.fade = 0; },
  draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(-30, -30, W + 60, H + 60);
    // くさり
    ctx.strokeStyle = 'rgba(160,150,170,.5)'; ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const x = W * (0.2 + i * 0.2) + Math.sin(S.t * 1.5 + i) * 12;
      for (let k = 0; k < 12; k++) { ctx.beginPath(); ctx.ellipse(x + Math.sin(S.t * 1.5 + i) * k * 1.5, k * 26, 7, 12, 0, 0, 7); ctx.stroke(); }
    }
    if (DK.scythe) { // おおきな かまの かげ
      ctx.save(); ctx.translate(W * 0.62, H * 0.95); ctx.rotate(-0.25);
      ctx.fillStyle = 'rgba(40,0,20,.95)'; ctx.fillRect(-8, -420, 16, 420);
      ctx.beginPath(); ctx.moveTo(8, -420); ctx.quadraticCurveTo(-260, -470, -330, -300); ctx.quadraticCurveTo(-240, -400, 8, -380); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (DK.red) { // あかい ひかり
      const g = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, 120);
      g.addColorStop(0, 'rgba(255,40,40,.95)'); g.addColorStop(0.25, 'rgba(200,0,30,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
    }
  },
};

// おわり（スキップでも ここへ）
function finishOpening() {
  const f = opFlags();
  if (!f.tutorialPaid) { ST.data.arca += 10; f.tutorialPaid = true; }
  f.opening = true; f.opStage = null;
  opMusic(false); showSkip(false);
  ST.data.place = 'town';
  setScene('town', { pos: { x: 13, y: 14 } }); // ここで セーブ
}

// ---------------------------------------------------------------------
//  スキップ
// ---------------------------------------------------------------------
function showSkip(on) {
  let b = $('stSkip');
  if (!b) {
    b = document.createElement('button');
    b.id = 'stSkip'; b.type = 'button'; b.className = 'st-skip'; b.textContent = 'スキップ ▶▶';
    b.addEventListener('click', skipOpening);
    $('game').appendChild(b);
  }
  b.hidden = !on;
}
function skipOpening() {
  if (ST.battle) return; // チュートリアルの たたかい ちゅうは できない
  timers.length = 0;
  DLG.lines = []; DLG.done = null;
  $('stBanner').hidden = true;
  finishOpening();
}
const baseUpdateUIOpening = updateUI;
updateUI = function () {
  baseUpdateUIOpening();
  const b = $('stSkip');
  if (b && ST.data && ST.data.flags.opStage) b.hidden = !!ST.battle;
  if (['op', 'dark'].includes(ST.scene) && stActive()) $('stHud').hidden = true;
  if (['op', 'dark', 'room'].includes(ST.scene) && stActive()) $('itemBar').hidden = true; // へやでは とびらが かくれるので ださない
};

// ---------------------------------------------------------------------
//  まち・いえ・チュートリアルとの つなぎ
// ---------------------------------------------------------------------
ST_PLACE.room = 'ちゅなちゃんの いえ';
// まちに はいった とき：オープニングの とちゅう なら つづきを はじめる
const baseTownEnter = SCENES.town.enter;
SCENES.town.enter = function (arg) {
  baseTownEnter(arg);
  if (opFlags().opStage === 'ch2') later(0.1, startChapter2);
};
// チュートリアルの もんだいは 2 ＋ 3
const baseAskOp = askQuestion;
askQuestion = function () {
  const m = S.monster;
  if (!m || !m.tutorial) { baseAskOp(); return; }
  const orig = makeQuestion;
  makeQuestion = () => mk(2, '+', 3);
  try { baseAskOp(); } finally { makeQuestion = orig; }
};

// つづきから：オープニングの とちゅうで やめていたら そこから
function resumeOpening() {
  const st = opFlags().opStage;
  showSkip(true);
  if (st === 'room') { enterInterior('house', { pos: HOUSE_WAKE, cat: { x: 96, y: 196 }, silent: true }); return; }
  if (st === 'ch2' || st === 'ch3') { opFlags().opStage = 'ch2'; setScene('town', { pos: { x: 13, y: 14 } }); return; }
  startOpening();
}
