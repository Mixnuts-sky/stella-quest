'use strict';
// =====================================================================
//  ステラクエスト：えいご（フォニックス）と もんだいの モード
//  ・もんだいの モード（ST.data.subjMode）：まぜる（さんすう30・かんじ25・えいご25・おんがく10）／まぜる（えいご なし）／さんすう だけ／かんじ だけ／おんがく だけ／えいご だけ
//      ダンジョン の いりぐち（なんいど を えらぶ ところ）で えらぶ。ほいくえん は いままで どおり
//  ・えいご の もんだい（5つ から えらぶ。えいご の こえ で よむ）：なんいど で かわる
//      1 おおもじ：「びー」は どれ？ → B          2 こもじ：「びー」の こもじ は？ → b
//      3 おおもじ と こもじ：B の こもじ は？ → b
//      4 はじめの おと：🐝 bee は どの もじ で はじまる？ → b
//      5 まんなかの おと（みじかい ぼいん）：🐱 c_t → a
//      6 よんで みよう：「dog」は どれ？ → 🐶
//    ボス・レアてき は 1つ うえ（6 まで）
//  しよう：docs/GAME_SPEC.md「13.6 えいご と もんだいの モード」
// =====================================================================

const UPPER = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'], LOWER = UPPER.map((c) => c.toLowerCase());
// はじめの おと（x は ことば の はじめ に こない ので のぞく）
const FIRST_WORDS = [
  ['a', 'ant', '🐜'], ['b', 'bus', '🚌'], ['c', 'cat', '🐱'], ['d', 'dog', '🐶'], ['e', 'egg', '🥚'], ['f', 'fish', '🐟'],
  ['g', 'gift', '🎁'], ['h', 'hat', '🎩'], ['i', 'igloo', '🛖'], ['j', 'juice', '🧃'], ['k', 'kite', '🪁'], ['l', 'lion', '🦁'],
  ['m', 'moon', '🌙'], ['n', 'nut', '🥜'], ['o', 'octopus', '🐙'], ['p', 'pig', '🐷'], ['q', 'queen', '👑'], ['r', 'rabbit', '🐰'],
  ['s', 'sun', '☀️'], ['t', 'tiger', '🐯'], ['u', 'umbrella', '☂️'], ['v', 'van', '🚐'], ['w', 'web', '🕸️'], ['y', 'yo-yo', '🪀'], ['z', 'zebra', '🦓'],
];
// みじかい ぼいん の 3もじ の ことば（CVC）
const CVC = [
  ['cat', '🐱'], ['hat', '🎩'], ['bag', '👜'], ['van', '🚐'], ['bed', '🛏️'], ['hen', '🐔'], ['pen', '🖊️'], ['web', '🕸️'],
  ['pig', '🐷'], ['six', '6️⃣'], ['lip', '👄'], ['dog', '🐶'], ['box', '📦'], ['fox', '🦊'], ['sun', '☀️'], ['bus', '🚌'], ['cup', '🥤'], ['bug', '🐛'],
];
const VOWELS = ['a', 'e', 'i', 'o', 'u'];

// えいご の こえ（ブラウザ の よみあげ）
function speakEn(text, rate = 0.8) {
  try {
    if (!soundOn || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = rate; u.pitch = 1.1;
    speechSynthesis.speak(u);
  } catch { /* よめなくても あそべる */ }
}

const pick5 = (all, ans, key = (x) => x) => shuffle([ans, ...shuffle(all.filter((x) => key(x) !== key(ans))).slice(0, 4)]);
function englishQuestion(lv) {
  const base = { subject: 'english', spellSubject: 'english', choice: true, tag: 'えいご', kind: 'eng' };
  const make = (q, opts, ans, valueOf, labelOf) => ({ ...base, ...q, options: opts.map((o) => ({ label: labelOf(o), value: valueOf(o) })), ansIndex: opts.indexOf(ans) });
  if (lv <= 2) { // おおもじ・こもじ を よみかた から
    const i = rnd(0, 25), list = lv === 1 ? UPPER : LOWER, ans = list[i], opts = pick5(list, ans);
    return make({ prompt: `「${ABC_READ[i]}」の ${lv === 1 ? 'おおもじ' : 'こもじ'} は どれ？`, symbol: ans, speak: () => speakEn(UPPER[i]),
      wrongMsg: () => `おしい！ こたえは「${ans}」だよ`, afterAnswer: (ok) => { if (!ok) speakEn(UPPER[i]); } }, opts, ans, (o) => o, (o) => o);
  }
  if (lv === 3) { // おおもじ ↔ こもじ
    const i = rnd(0, 25), ans = LOWER[i], opts = pick5(LOWER, ans);
    return make({ promptHtml: `<b class="eng-big">${UPPER[i]}</b> の こもじ は どれ？`, prompt: `${UPPER[i]} の こもじ`, symbol: ans, speak: () => speakEn(UPPER[i]),
      wrongMsg: () => `おしい！ ${UPPER[i]} の こもじ は「${ans}」だよ` }, opts, ans, (o) => o, (o) => o);
  }
  if (lv === 4) { // はじめの おと（フォニックス）
    const w = pick(FIRST_WORDS), opts = pick5(LOWER.filter((c) => c !== 'x'), w[0]);
    const say = () => speakEn(`${w[1]}. ${w[1]}.`, 0.7);
    return make({ promptHtml: `<span class="eng-pic">${w[2]}</span> <b>${w[1]}</b> は どの もじ で はじまる？`, prompt: `${w[1]} は どの もじ で はじまる？`, symbol: w[0], speak: say,
      wrongMsg: () => `おしい！ ${w[1]} は「${w[0]}」で はじまるよ`, afterAnswer: () => say() }, opts, w[0], (o) => o, (o) => o);
  }
  if (lv === 5) { // まんなかの おと（みじかい ぼいん）
    const w = pick(CVC), v = w[0][1], blank = `${w[0][0]}<u>&nbsp;?&nbsp;</u>${w[0][2]}`;
    const say = () => speakEn(`${w[0]}. ${w[0]}.`, 0.6);
    return make({ promptHtml: `<span class="eng-pic">${w[1]}</span> <b class="eng-word">${blank}</b> まんなか の おと は？`, prompt: `${w[0]} の まんなか の おと`, symbol: v, speak: say,
      wrongMsg: () => `おしい！「${w[0]}」の まんなか は「${v}」だよ`, afterAnswer: () => say() }, shuffle(VOWELS.slice()), v, (o) => o, (o) => o);
  }
  // 6 よんで みよう（ブレンディング）：ことば → え
  const w = pick(CVC), opts = pick5(CVC, w, (x) => x[0]);
  return make({ kind: 'eng pic', promptHtml: `<b class="eng-word">${w[0]}</b> は どれ？`, prompt: `${w[0]} は どれ？`, symbol: w[0], speak: () => {},
    wrongMsg: () => `おしい！ ${w[0]} は ${w[1]} だよ`, afterAnswer: () => speakEn(w[0], 0.6) }, opts, w, (o) => o[0], (o) => o[1]);
}

// ---------------------------------------------------------------------
//  もんだいの モード
// ---------------------------------------------------------------------
const SUBJ_MODES = {
  mix: { label: 'まぜる', weights: [['math', 30], ['kanji', 25], ['english', 25], ['music', 10]], order: ['math', 'kanji', 'english', 'music'] },
  mix3: { label: 'まぜる（えいご なし）', weights: [['math', 50], ['kanji', 30], ['music', 20]], order: ['math', 'kanji', 'music'] },
  math: { label: 'さんすう だけ', weights: [['math', 100]], order: ['math'] },
  kanji: { label: 'かんじ だけ', weights: [['kanji', 100]], order: ['kanji'] },
  music: { label: 'おんがく だけ', weights: [['music', 100]], order: ['music'] },
  english: { label: 'えいご だけ', weights: [['english', 100]], order: ['english'] },
};
const subjMode = () => (ST.data && !isHoikuen() && SUBJ_MODES[ST.data.subjMode]) || SUBJ_MODES.mix;
SUBJ_LABEL.english = 'えいご';

// ふつうの てき の もんだい
pickSubject = function () {
  let r = Math.random() * subjMode().weights.reduce((t, [, w]) => t + w, 0);
  for (const [s, w] of subjMode().weights) { r -= w; if (r < 0) return s; }
  return subjMode().order[0];
};
// ボス・れんしゅう（ぜんぶ）は モード の じゅんばん、レアてき は モード が 1つ なら その かもく
const baseBattleSubjectEng = battleSubject;
battleSubject = function (m) {
  if (isHoikuen() || m.necro || !ST.battle) return baseBattleSubjectEng(m);
  const mode = subjMode();
  if (m.seq) return SUBJ_ORDER[(m.hits || 0) % 3]; // アルトの「ぜんぶ じゅんばんに」は いままで どおり
  if (m.rare) return mode.order.length === 1 && mode.order[0] !== 'music' ? mode.order[0] : baseBattleSubjectEng(m);
  if (m.boss) {
    if (ST.battle.difficulty >= 6 && isFinalBlow(m) && mode.order.includes('math')) return 'math'; // なんいど6 の とどめ は 100 を こえる たしざん
    return mode.order[(m.hits || 0) % mode.order.length];
  }
  return baseBattleSubjectEng(m);
};

// えいご の もんだい を だす
const baseAskEng = askQuestion;
askQuestion = function () {
  const m = S.monster;
  if (!ST.battle || !m || m.nanmon || isHoikuen() || battleSubject(m) !== 'english') { baseAskEng(); return; }
  const lv = Math.min(6, ST.battle.difficulty + (m.boss || m.rare ? 1 : 0));
  askChoice(m, englishQuestion(lv));
  const tag = $('monName').querySelector('.subj-tag');
  if (tag) tag.insertAdjacentHTML('beforebegin', `<span class="eng-lv">${['', 'おおもじ', 'こもじ', 'おおもじ・こもじ', 'はじめの おと', 'まんなかの おと', 'よんで みよう'][lv]}</span> `);
};

// ---------------------------------------------------------------------
//  ダンジョン の いりぐち で モード を えらぶ（なんいど を えらぶ ところ）
// ---------------------------------------------------------------------
const baseGateEng = enterDungeonGate;
enterDungeonGate = function () {
  baseGateEng();
  if (isHoikuen()) return;
  const list = $('stPanel').querySelector('.dlist');
  if (!list) return;
  const cur = ST.data.subjMode || 'mix';
  list.insertAdjacentHTML('afterend', `<div class="pr-label">もんだい</div><div class="pr-row" id="subjModes">${Object.entries(SUBJ_MODES).map(([k, v]) =>
    `<button type="button" class="pr-s${k === cur ? ' on' : ''}" data-mode="${k}">${v.label}</button>`).join('')}</div>`);
  $('stPanel').querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    ST.data.subjMode = b.dataset.mode; stSave();
    $('stPanel').querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
    note(880, 0, 0.06, { type: 'sine', vol: 0.06 });
  }));
};
// アルト の れんしゅう にも えいご
const basePracticeSubjectsEng = practiceSubjects;
practiceSubjects = function () {
  const list = basePracticeSubjectsEng();
  if (!isHoikuen()) list.splice(3, 0, ['english', 'えいご']);
  return list;
};
