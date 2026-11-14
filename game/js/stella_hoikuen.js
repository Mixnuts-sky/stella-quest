'use strict';
// =====================================================================
//  ステラクエスト：ほいくえん モード（ST.data.mode === 'hoikuen'）
//  ・あそびかた は おなじ。もんだい だけ かわる（どの なんいど でも おなじ むずかしさ）
//      ふつうの てき：いろ 8わり・ひらがな 1わり・すうじ 1わり
//        いろ：「『あか』は どれでしょう」いろ を 5こ から
//        ひらがな：「『ア』の ひらがなは どれでしょう」50おん から 5こ
//        すうじ：「すうじの『いち』は どれでしょう」0〜9 から 5こ
//      ボス（ネクロディウス も）：すうじ → ひらがな → いろ の じゅん
//      レアてき・たからばこ：アルファベット「『えー』は どれでしょう」A〜Z
//  ・5つの ボタン から えらぶ（クリック / すうじキー / ← → と Enter）
//  ・こえ：きほん は よまない。🔊 で その もんだい を よむ。「こえ：オン」に すると いつも よむ（ST.data.hkVoice）
//  ・ふつうの てき は「うぇーおー」だけ（ボス・レア・ネクロディウス は おなじ）
//  しよう：docs/GAME_SPEC.md「13.5 ほいくえん モード」
// =====================================================================

const isHoikuen = () => !!(ST.data && ST.data.mode === 'hoikuen');
const NUM_READ = ['ぜろ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const HIRAGANA = [...'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'];
const toKata = (h) => String.fromCharCode(h.charCodeAt(0) + 0x60);
const COLORS = [
  ['あか', '#e8323c'], ['あお', '#2f6fe0'], ['きいろ', '#ffd400'], ['みどり', '#2fae4a'], ['ピンク', '#ff8ac0'],
  ['むらさき', '#8a4ad0'], ['オレンジ', '#ff8c1a'], ['ちゃいろ', '#8a5a2c'], ['くろ', '#222222'], ['しろ', '#ffffff'],
];
const ABC = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const ABC_READ = ['えー', 'びー', 'しー', 'でぃー', 'いー', 'えふ', 'じー', 'えいち', 'あい', 'じぇー', 'けー', 'える', 'えむ', 'えぬ', 'おー', 'ぴー', 'きゅー', 'あーる', 'えす', 'てぃー', 'ゆー', 'ぶい', 'だぶりゅー', 'えっくす', 'わい', 'ぜっと'];
const CHOICE_KIND = { math: 'num', kanji: 'hira', music: 'color', abc: 'abc' };
const HOIKUEN_WEIGHTS = [['music', 80], ['kanji', 10], ['math', 10]]; // ふつうの てき：いろ・ひらがな・すうじ
function pickHoikuenSubject() {
  let r = Math.random() * 100;
  for (const [s, w] of HOIKUEN_WEIGHTS) { r -= w; if (r < 0) return s; }
  return 'music';
}

// 5こ えらぶ（こたえ ＋ ちがう もの 4こ）
function pickChoices(all, ans) {
  const others = shuffle(all.filter((x) => x !== ans)).slice(0, 4);
  return shuffle([ans, ...others]);
}

function makeChoiceQuestion(subject) {
  const kind = CHOICE_KIND[subject] || 'num';
  if (kind === 'num') {
    const n = rnd(0, 9), opts = pickChoices([...Array(10).keys()], n);
    return { subject: 'num', spellSubject: 'math', choice: true, kind, prompt: `すうじの「${NUM_READ[n]}」は どれでしょう。`, say: `すうじの ${NUM_READ[n]} は どれでしょう`,
      options: opts.map((v) => ({ label: String(v), value: v })), ansIndex: opts.indexOf(n), ans: n, symbol: String(n) };
  }
  if (kind === 'abc') {
    const i = rnd(0, 25), opts = pickChoices(ABC, ABC[i]);
    return { subject: 'abc', spellSubject: 'kanji', symKey: 'abc', choice: true, kind, prompt: `「${ABC_READ[i]}」は どれでしょう。`, say: `${ABC_READ[i]} は どれでしょう`,
      options: opts.map((v) => ({ label: v, value: v })), ansIndex: opts.indexOf(ABC[i]), symbol: ABC[i], symbolColor: '#ff7a2a' };
  }
  if (kind === 'hira') {
    const h = pick(HIRAGANA), opts = pickChoices(HIRAGANA, h);
    return { subject: 'hira', spellSubject: 'kanji', choice: true, kind, prompt: `「${toKata(h)}」の ひらがなは どれでしょう。`, say: `${toKata(h)} の ひらがなは どれでしょう`,
      options: opts.map((v) => ({ label: v, value: v })), ansIndex: opts.indexOf(h), symbol: h };
  }
  const c = pick(COLORS), opts = pickChoices(COLORS, c);
  return { subject: 'color', spellSubject: 'music', choice: true, kind, prompt: `「${c[0]}」は どれでしょう。`, say: `${c[0]} は どれでしょう`,
    options: opts.map(([name, hex]) => ({ label: '', color: hex, value: name })), ansIndex: opts.indexOf(c), symbol: '●', symbolColor: c[1] };
}

// こえ で よむ（ブラウザが よめない ときは なにも しない）。force：🔊 を おした とき（こえ：オフ でも よむ）
function sayAloud(text, force) {
  try {
    if (!soundOn || !window.speechSynthesis || !(force || (ST.data && ST.data.hkVoice))) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; u.rate = 0.85; u.pitch = 1.2;
    speechSynthesis.speak(u);
  } catch { /* よめなくても あそべる */ }
}

// ---------------------------------------------------------------------
//  がめん：#quiz の なかに 5つの ボタン
// ---------------------------------------------------------------------
function choiceBox() {
  let box = $('choiceBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'choiceBox'; box.className = 'choice-box';
    box.innerHTML = '<div class="choice-q"><span id="choicePrompt"></span><button id="choiceSay" type="button" class="choice-say" aria-label="よんで もらう">🔊</button><button id="choiceVoice" type="button" class="choice-voice"></button></div><div id="choiceOpts" class="choice-opts"></div>';
    $('qmsg').before(box);
    $('choiceSay').addEventListener('click', (e) => { if (S.q && S.q.choice) { if (S.q.speak) S.q.speak(); else sayAloud(S.q.say, true); } e.currentTarget.blur(); });
    $('choiceVoice').addEventListener('click', (e) => { ST.data.hkVoice = !ST.data.hkVoice; renderVoiceBtn(); stSave(); if (ST.data.hkVoice && S.q && S.q.choice) sayAloud(S.q.say); e.currentTarget.blur(); });
    $('choiceOpts').addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) choiceAnswer(+b.dataset.i);
    });
  }
  return box;
}
function renderVoiceBtn() { const b = $('choiceVoice'); if (b) { b.hidden = !isHoikuen(); b.textContent = ST.data.hkVoice ? 'こえ：オン' : 'こえ：オフ'; b.classList.toggle('on', !!ST.data.hkVoice); } }
// 「おおもじ」「こもじ」を いろ で わける（おおもじ ＝ あか・こもじ ＝ あお）（2026-11-14）
const caseMark = (html) => String(html).replace(/おおもじ|こもじ/g, (w) => `<b class="case-${w === 'こもじ' ? 'lo' : 'up'}">${w}</b>`);
const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let choiceSel = 0;
function renderChoices() {
  const q = S.q, box = choiceBox();
  $('choicePrompt').innerHTML = caseMark(q.promptHtml || escHtml(q.prompt));
  renderVoiceBtn();
  $('choiceOpts').innerHTML = q.options.map((o, i) => {
    let cls = 'choice-opt ' + q.kind;
    if (S.mode === 'answered') cls += i === q.ansIndex ? ' good' : i === q.picked ? ' bad' : ' dim';
    else if (i === choiceSel) cls += ' sel';
    const style = o.color ? ` style="background:${o.color}"` : '';
    return `<button type="button" class="${cls}" data-i="${i}"${style} aria-label="${o.value}"><small>${i + 1}</small>${o.label}</button>`;
  }).join('');
  box.hidden = false;
}

function askChoice(m, subject) {
  const q = typeof subject === 'object' ? subject : makeChoiceQuestion(subject); // えいご（stella_english.js）は もんだい を わたす
  S.q = q; S.input = ''; choiceSel = 0;
  if (typeof stopPhrase === 'function') stopPhrase();
  $('quiz').dataset.subj = 'choice';
  const tag = q.tag || { num: 'すうじ', hira: 'ひらがな', color: 'いろ', abc: 'アルファベット' }[q.kind];
  const who = m.boss ? `ボス ${enemyTag(m)}！` : m.rare ? `レア ${enemyTag(m)} が あらわれた！` : `${enemyTag(m)} が あらわれた！`;
  $('monName').innerHTML = `${who} <span class="subj-tag ${q.spellSubject}">${tag}</span>`;
  $('quiz').classList.toggle('boss', !!m.boss);
  $('qmsg').textContent = ''; $('qmsg').className = 'qmsg';
  $('nextBtn').hidden = true; $('hint').hidden = true;
  S.hintNext = false;
  setMode('question');
  renderChoices();
  if (q.speak) q.speak(); else sayAloud(q.say);
}

function choiceAnswer(i) {
  const q = S.q;
  if (S.mode !== 'question' || !q || !q.choice || i < 0 || i >= q.options.length) return;
  q.picked = i;
  const ok = i === q.ansIndex;
  setMode('answered');
  renderChoices();
  const right = q.options[q.ansIndex];
  resolveAnswer(ok, q.wrongMsg ? q.wrongMsg(right) : `おしい！ こたえは ${q.kind === 'color' ? `「${right.value}」の いろ` : `「${right.label}」`} だよ`);
  if (q.afterAnswer) { q.afterAnswer(ok, right); return; }
  if (!ok) sayAloud(`こたえは ${q.kind === 'num' ? NUM_READ[right.value] : q.kind === 'abc' ? ABC_READ[ABC.indexOf(right.value)] : right.value} だよ`);
}

// ---------------------------------------------------------------------
//  もんだいを だす・こたえる（ステラの たたかい だけ）
// ---------------------------------------------------------------------
const baseAskHoikuen = askQuestion;
askQuestion = function () {
  const m = S.monster;
  if (!isHoikuen() || !ST.battle || !m || m.nanmon) { if (choiceBox()) $('choiceBox').hidden = true; baseAskHoikuen(); return; }
  askChoice(m, battleSubject(m));
};
// レアてき は アルファベット、ボス・ネクロディウス は すうじ→ひらがな→いろ、ふつうの てき は いろ 8わり・ひらがな・すうじ
const baseBattleSubjectHoikuen = battleSubject;
battleSubject = function (m) {
  if (!isHoikuen()) return baseBattleSubjectHoikuen(m);
  if (m.rare) return 'abc';
  if (m.boss || m.necro || m.seq) return SUBJ_ORDER[(m.hits || 0) % 3]; // ボス・アルトの れんしゅう は じゅんばんに
  if (!m.hkSubject) m.hkSubject = pickHoikuenSubject();
  return m.hkSubject;
};

// たからばこ：なぞなぞ の かわりに アルファベット（4こ から えらぶ）
const baseOpenChestHoikuen = openChest;
openChest = function (chest) {
  const lead = document.querySelector('#riddle .riddle-lead');
  if (lead) lead.textContent = isHoikuen() ? 'もんだいに こたえると アイテムが もらえるよ' : 'なぞなぞに こたえると アイテムが もらえるよ';
  if (!isHoikuen()) { baseOpenChestHoikuen(chest); return; }
  chest.opened = true;
  SFX.encounter();
  const i = rnd(0, 25), choices = shuffle([ABC[i], ...shuffle(ABC.filter((c) => c !== ABC[i])).slice(0, 3)]);
  S.riddle = { q: `「${ABC_READ[i]}」は どれでしょう。`, choices, answer: choices.indexOf(ABC[i]), done: false, abc: true };
  $('riddleQ').textContent = S.riddle.q;
  $('riddleChoices').innerHTML = choices.map((c, k) => `<button type="button" data-i="${k}" class="abc"><span class="k">${k + 1}</span>${c}</button>`).join('');
  $('riddleResult').innerHTML = '';
  $('riddleClose').hidden = true;
  setMode('riddle');
  renderHud();
  sayAloud(`${ABC_READ[i]} は どれでしょう`);
};

const isChoice = () => !!(S.q && S.q.choice);
const baseSubmitHoikuen = submit, baseTypeDigitHoikuen = typeDigit, baseEraseHoikuen = eraseDigit, baseRenderAnswerHoikuen = renderAnswer;
submit = function () { if (isChoice()) choiceAnswer(choiceSel); else baseSubmitHoikuen(); };
typeDigit = function (k) {
  if (!isChoice()) { baseTypeDigitHoikuen(k); return; }
  const q = S.q;
  if (q.kind === 'num') { const i = q.options.findIndex((o) => o.value === +k); if (i >= 0) choiceAnswer(i); return; } // すうじ は その すうじ の キー
  const n = +k; if (n >= 1 && n <= q.options.length) choiceAnswer(n - 1); // ひらがな・いろ は 1〜5
};
eraseDigit = function () { if (!isChoice()) baseEraseHoikuen(); };
renderAnswer = function () { if (isChoice()) renderChoices(); else baseRenderAnswerHoikuen(); };
addEventListener('keydown', (e) => {
  if (!isChoice() || S.mode !== 'question') return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    choiceSel = (choiceSel + (e.key === 'ArrowRight' ? 1 : -1) + S.q.options.length) % S.q.options.length;
    renderChoices(); e.preventDefault();
  }
});

// ---------------------------------------------------------------------
//  てき：ふつうの てき は うぇーおー だけ
// ---------------------------------------------------------------------
function toWeo(m) {
  if (!isHoikuen() || !m || m.boss || m.rare || m.necro || m.nanmon) return;
  const weo = SPR.enemies.find(isWeo);
  if (!weo) return;
  const tint = pick(TINTS), pw = ENEMY_POWER[S.level] || ENEMY_POWER[1];
  Object.assign(m, { spr: tintSprite(weo, tint.color), tintColor: tint.color, height: (weo.height || 150) * pw.scale, name: pw.prefix + tint.name + ' ' + weo.name });
}
const baseEncounterHoikuen = encounter;
encounter = function (opts = {}) {
  baseEncounterHoikuen(opts);
  if (!opts.boss) toWeo(S.monster);
};
const baseStartBattleHoikuen = startStellaBattle;
startStellaBattle = function (opts) {
  baseStartBattleHoikuen(opts);
  const m = S.monster;
  if (m && isHoikuen() && !m.boss) { const keep = opts.monster && opts.monster.name; toWeo(m); if (keep) m.name = keep; }
};

// ---------------------------------------------------------------------
//  がめん の きりかえ
// ---------------------------------------------------------------------
const baseUpdateUIHoikuen = updateUI;
updateUI = function () {
  baseUpdateUIHoikuen();
  const box = $('choiceBox');
  if (!box) return;
  const show = isChoice() && (S.mode === 'question' || S.mode === 'answered');
  box.hidden = !show;
  if (show) { $('pad').hidden = true; $('writePad').hidden = true; $('answerBar').hidden = true; }
};
