'use strict';
// =====================================================================
//  ステラクエスト：たたかい
//  ・1かいの たたかいで さんすう・かんじ・おんがく を きりかえて だす
//      ボス・れんしゅう：せいかい するたびに さんすう → かんじ → おんがく の じゅん
//      レアてき：おんがく なんいど7（おとだけ）
//      ふつうの てき：m.subject（ダンジョンで きめる。だんかい5）
//  ・てきの HP と ちゅなちゃんの こうげきりょく（ぶきの つよさ）
//  ・まちがえても てきは にげない（HP が のこっていれば つぎの もんだい）
//  たたかいの えんしゅつ は game.js、もんだいの ぶひん は kanji_core.js / music_core.js。
//  しよう：docs/GAME_SPEC.md「9. ダンジョン」
// =====================================================================

Object.assign(CONFIG, { heroX: 0.2, enemyX: 0.5 }); // かんじの かきとり パッドが みぎに でるので てきは まんなか
const SUBJ_ORDER = ['math', 'kanji', 'music'];
const SUBJ_LABEL = { math: 'さんすう', kanji: 'かんじ', music: 'おんがく' };
const KANJI_TAG = { 1: 'かんじ 1', 2: 'かんじ 2', 3: 'かんじ 3', 4: 'かんじ 4', 5: 'かんじ 5・なぞり', 6: 'かんじ 6・なぞり' }; // 2026-11-14：リスト の なんいど と おなじ

// にがて かんじは セーブデータに きろく
KANJI_HOOKS.loadWeak = () => (ST.data && ST.data.weak) || {};
KANJI_CONFIG.retryOnce = true; // かんじ は 1かい まちがえても こたえ を みせず もういちど（ダメージ は ある）
// 2026-11-15：はんてい を ゆるく（かたち すこし・ほぼ くっついている／すこし かさなる は けいこく だけ で せいかい）
Object.assign(KANJI_CONFIG, { tolerance: 0.30, maxDev: 0.38, touchWarnGap: 0.16, apartWarn: true });
KANJI_HOOKS.saveWeak = (w) => { if (ST.data) ST.data.weak = w; };

// いまの たたかい：{ difficulty, practice, returnTo, pos }
ST.battle = null;

// ---------------------------------------------------------------------
//  なにを だすか
// ---------------------------------------------------------------------
let battleSubject = function (m) {
  if (m.rare) return 'music';
  if (m.boss || m.seq) return SUBJ_ORDER[(m.hits || 0) % 3];
  return m.subject || 'math';
};
const subjTag = (s) => `<span class="subj-tag ${s}">${SUBJ_LABEL[s]}</span>`;

const baseAskQuestionStella = askQuestion;
askQuestion = function () {
  const m = S.monster;
  if (!ST.battle || !m || m.nanmon) { baseAskQuestionStella(); return; }
  const d = ST.battle.difficulty, subj = battleSubject(m);
  const up = m.boss ? 1 : 0; // ボスは ひとつ うえ
  $('quiz').dataset.subj = subj;
  if (typeof stopPhrase === 'function') stopPhrase();
  if (subj === 'math') {
    S.level = d;
    baseAskQuestionStella(); // game.js（ボスは makeBossQuestion）
    $('monName').innerHTML += subjTag('math');
  } else if (subj === 'kanji') {
    askKanjiStella(m, Math.min(6, d + up));
  } else {
    askMusicStella(m, m.rare ? 7 : Math.min(6, d + up));
  }
};

function enemyLabel(m, tag) {
  const who = m.boss ? `ボス ${enemyTag(m)}！` : m.rare ? `レア ${enemyTag(m)} が あらわれた！` : `${enemyTag(m)} が あらわれた！`;
  return `${who}（${tag}）`;
}

// かんじ：なんいど 1〜6 は 漢字リスト の おなじ なんいど（ことば か みじかい ぶん の あなうめ を はんぶん ずつ）
//   てだすけ：1〜4 は おてほん なし、5・6 は なぞり がき（GAME_SPEC.md 14.11）
const KANJI_SENTENCE_RATE = 0.5;
function askKanjiStella(m, lv) {
  const listLv = lv;
  let pool = KLIST.filter((e) => e.level === listLv);
  if (!pool.length) pool = KLIST;
  const entry = m.mainQ && m.mainQ.length ? m.mainQ[0] : pickEntry(pool), sentence = !!entry.sentence && Math.random() < KANJI_SENTENCE_RATE;
  const q = buildQuestion(entry, false, sentence);
  S.q = q; S.input = '';
  $('monName').innerHTML = enemyLabel(m, m.mainQ ? `メイン かんじ のこり ${m.mainQ.length}` : KANJI_TAG[lv]) + subjTag('kanji');
  $('quiz').classList.toggle('boss', !!m.boss);
  $('qmsg').textContent = ''; $('qmsg').className = 'qmsg';
  $('nextBtn').hidden = true;
  const guide = (listLv >= 5 && !m.mainQ) || S.hintNext ? 'trace' : 'none';
  S.hintNext = false;
  setMode('question');
  kanjiSetup(q, { guide, hint: false });
}

// おんがく：なんいど 1〜6、レアてきは 7（おとだけ）
function askMusicStella(m, lv) {
  const q = makeMusicQuestion(lv);
  S.q = q; S.input = '';
  $('monName').innerHTML = enemyLabel(m, MUSIC_LEVELS[lv].tag) + subjTag('music');
  $('quiz').classList.toggle('boss', !!m.boss);
  S.hintNext = false;
  musicAsk(q);
}

// こたえかたを もんだいの しゅるいで きりかえる（game.js の キー・ボタンから よばれる）
const baseSubmitStella = submit, baseTypeDigitStella = typeDigit, baseEraseDigitStella = eraseDigit, baseRenderAnswerStella = renderAnswer;
const qSubj = () => (S.q && S.q.subject) || 'math';
submit = function () { const s = qSubj(); if (s === 'kanji') kanjiSubmit(); else if (s === 'music') musicSubmit(); else baseSubmitStella(); };
typeDigit = function (k) { const s = qSubj(); if (s === 'music') musicTypeDigit(k); else if (s === 'math') baseTypeDigitStella(k); };
eraseDigit = function () { const s = qSubj(); if (s === 'kanji') kanjiErase(); else if (s === 'music') musicErase(); else baseEraseDigitStella(); };
renderAnswer = function () { const s = qSubj(); if (s === 'kanji') renderWord(); else if (s === 'music') renderStaff(); else baseRenderAnswerStella(); };

// ---------------------------------------------------------------------
//  HP と こうげき
// ---------------------------------------------------------------------
// せいかい：てきの HP を こうげきりょく ぶん へらす。のこっていれば つぎの もんだい
const baseOnSpellHitStella = onSpellHit;
onSpellHit = function () {
  const m = S.monster;
  if (!ST.battle || !m || m.nanmon) { baseOnSpellHitStella(); return; }
  m.hits = (m.hits || 0) + 1;
  if (m.mainQ) m.mainQ.shift(); // メイン かんじ：できた じ は もう でない
  if (m.boss) { // game.js は 1 ずつ へらすので、こうげきりょく ぶんに あわせる
    m.hp = Math.max(1, m.hp - heroAtk() + 1);
    baseOnSpellHitStella();
    return;
  }
  m.hp = Math.max(0, m.hp - heroAtk());
  if (m.hp > 0) {
    m.state = 'flinch'; m.t = 0;
    SFX.poof();
    later(CONFIG.afterCorrectWait * 0.7, () => { if (S.monster === m) { m.state = 'idle'; askQuestion(); } });
    return;
  }
  baseOnSpellHitStella(); // たおした
};

// まちがい：てきは にげない（HP が のこっていれば もう いちど）。レアてき は にげて たたかい おわり
const baseOnEnemyAttackDoneStella = onEnemyAttackDone;
onEnemyAttackDone = function () {
  const m = S.monster;
  if (!ST.battle || !m || m.boss || m.nanmon) { baseOnEnemyAttackDoneStella(); return; }
  if (m.rare) { // game.js の ふつうの てき と おなじ：にげる → HP 0 なら まけ、ちがえば たたかい おわり
    showToast(`${m.name}に にげられた……`, 2.4);
    baseOnEnemyAttackDoneStella();
    return;
  }
  if (m.mainQ && m.mainQ.length > 1) m.mainQ.push(m.mainQ.shift()); // メイン かんじ：まちがえた じ は あとで もういちど
  if (S.hp > 0) { m.state = 'idle'; askQuestion(); return; }
  baseOnEnemyAttackDoneStella();
};

// れんしゅうでは HP が へらない。レアてき に まちがえると 2 へる
const baseDamageHeroStella = damageHero;
damageHero = function () {
  if (ST.battle && ST.battle.practice) return;
  baseDamageHeroStella();
  if (ST.battle && S.monster && S.monster.rare && !S.monster.necro) baseDamageHeroStella();
};

// たたかいが おわったら
const baseEndBattleStella = endBattle;
endBattle = function () {
  const b = ST.battle;
  if (!b && !S.monster) return; // たたかい が もう おわっている（おくれて よばれた とき）
  if (!b) { baseEndBattleStella(); return; }
  if (typeof stopPhrase === 'function') stopPhrase();
  S.monster = null; S.q = null; ST.battle = null;
  if (!b.practice) ST.data.hp = S.hp;
  if (b.returnTo === 'town') {
    setScene('town', { pos: b.pos });
    if (b.after) b.after();
  }
};

// ---------------------------------------------------------------------
//  たたかいを はじめる
// ---------------------------------------------------------------------
function startStellaBattle(opts) {
  ST.battle = { difficulty: opts.difficulty || 1, practice: !!opts.practice, returnTo: opts.returnTo || 'town', pos: opts.pos, after: opts.after };
  S.level = ST.battle.difficulty;
  CONFIG.maxHp = stMaxHp();
  S.hp = ST.data.hp;
  S.items = ST.data.items;
  S.maze = null;
  encounter(opts.encounter || {});
  const m = S.monster;
  if (m && opts.monster) Object.assign(m, opts.monster);
}

// アルトの まほうの れんしゅう：えらんだ なんいど・かもく で 5もん せいかい で クリア（ぜんぶ なら さんすう → かんじ → おんがく の じゅん）
//   てきの HP は 5 × こうげきりょく（つよい つえ でも 5もん）。なんど でも できる
//   かんじ の「メイン」：漢字リスト の メイン漢字 を ぜんぶ 1かい ずつ（じゅんばん は ランダム。まちがえた じ は あとで もういちど）
//   クリア の ごほうび：ダンジョン より すこし すくない アルカ（GAME_SPEC.md 15.15）
const PRACTICE_Q = 5;
const mainKanjiList = () => KLIST.filter((e) => e.level === 'main');
// ダンジョン の ざこ（2もん で ARCA_REWARD[なんいど][0]）の 8わり ぐらい
const practiceReward = (diff, n) => Math.max(3, Math.round(ARCA_REWARD[Math.max(1, Math.min(6, diff))][0] * 0.4 * n));
function startPractice(opts = {}) {
  const main = !!opts.main && mainKanjiList().length > 0, subject = main ? 'kanji' : opts.subject || 'all';
  const mainQ = main ? shuffle(mainKanjiList().slice()) : null, n = main ? mainQ.length : PRACTICE_Q, diff = opts.difficulty || 1;
  startStellaBattle({
    difficulty: diff, practice: true, returnTo: 'town', pos: { x: TW_HERO.x, y: TW_HERO.y },
    monster: { name: main ? 'メイン かんじ スライム' : 'れんしゅう スライム', hp: n * heroAtk(), maxHp: n * heroAtk(), seq: subject === 'all',
      ...(subject === 'all' ? {} : { subject, hkSubject: subject }), ...(main ? { mainQ } : {}) },
    after: () => {
      const a = practiceReward(diff, n);
      ST.data.arca += a; coinSound(); stRenderHud(); stSave();
      stDialog([['アルト', main ? 'メイン かんじ を ぜんぶ かけたのう！ すばらしい！' : 'すばらしい！ クリアじゃ！'], ['アルト', `ごほうび に ${a} アルカ を あげよう。`], ['アルト', 'その ちょうしじゃ！']],
        () => { if (typeof practiceAgain === 'function') practiceAgain(); });
    },
  });
}

// ---------------------------------------------------------------------
//  がめん
// ---------------------------------------------------------------------
const baseUpdateUIBattle = updateUI;
updateUI = function () {
  baseUpdateUIBattle();
  const m = S.mode, asking = m === 'question' || m === 'answered', subj = qSubj();
  if (!stActive()) $('hud').hidden = true; // たたかいでは game.js の HUD（レベル・たから）は ださない
  $('pad').hidden = !(m === 'question' && subj === 'math');
  $('writePad').hidden = !(asking && subj === 'kanji');
  $('answerBar').hidden = !(asking && subj === 'music');
  if (!asking && typeof stopPhrase === 'function') stopPhrase();
  if (!$('writePad').hidden) { sizePad(); renderPadUi(); }
  if (subj === 'music') renderKeys();
};
