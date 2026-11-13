'use strict';
// =====================================================================
//  ステラクエスト：さくらんぼ けいさん（10の まとまり を つくって とく）
//  たしざん：くりあがり の ある「1けた＋1けた」「2けた＋1けた」… たす かず を わける
//       5 ＋ 7：7 を ○5 と ○2 → 5＋5＝10、10＋2＝12
//  ひきざん（げんかほう、しょうがっこう と おなじ）：ひかれる かず を わける
//      13 − 5：13 を ○10 と ○3 → 10−5＝5、5＋3＝8      23 − 5：23 を ○20 と ○3 → 20−5＝15、15＋3＝18
//      10 − 7：10 を ○7 と ○3（10 は 7 と いくつ？）→ こたえ 3
//  じゅんばん：ひだりの ○ → みぎの ○ → こたえ。○ は うつと すぐ たしかめる（ちがえば やりなおし、HP は へらない）
//  ほかの もんだい（くりあがり なし・2けた どうし など）は いままで どおり。
//  しよう：docs/GAME_SPEC.md「9.7 さくらんぼ けいさん」
// =====================================================================

// さくらんぼ で とける もんだい か
//   { under：さくらんぼ の うえ の かず, balls：[ひだり, みぎ], prompts：○ ごと の ききかた, miss：まちがえた とき, hint：こたえ の まえ, reveal：まちがえた とき の とき, fill：さいしょ から うめる ○ }
function sakuranboOf(q) {
  if (!q || q.subject || q.op === undefined || q.b >= 10 || q.a >= 100) return null;
  const a = q.a, b = q.b, u = a % 10;
  if (q.op === '+') {
    if (u === 0 || u + b < 10) return null;
    const x = 10 - u, rest = b - x, ten = a + x;
    return { under: b, balls: [x, rest],
      prompts: [`${a} は あと いくつ で <b>${ten}</b>？`, `${b} を <b>${x}</b> と いくつ に わける？`],
      miss: [`${a} と あわせて ${ten} に なる かず だよ`, `${b} から ${x} を とった のこり だよ`],
      hint: `${a}＋${x}＝<b>${ten}</b>。${ten}＋${rest} は？`, reveal: `${a}＋${x}＝${ten}、${ten}＋${rest}＝<b>${q.ans}</b>` };
  }
  if (a === 10) { // 10 は b と いくつ
    return { under: 10, balls: [b, 10 - b], fill: 1,
      prompts: ['', `10 は <b>${b}</b> と いくつ？`], miss: ['', `${b} と あわせて 10 に なる かず だよ`],
      hint: `10 は ${b} と <b>${10 - b}</b>。10−${b} は？`, reveal: `10 は ${b} と ${10 - b}、10−${b}＝<b>${q.ans}</b>` };
  }
  if (a > 10 && u > 0 && u < b) { // げんかほう
    const tens = a - u, d = tens - b;
    return { under: a, balls: [tens, u],
      prompts: [`${a} の ${tens >= 20 ? 'なんじゅう' : '10'} の まとまり は？`, `${a} は <b>${tens}</b> と いくつ？`],
      miss: [`${a} の じゅう の くらい の まとまり（${String(tens).length}けた）だよ`, `${a} から ${tens} を とった のこり だよ`],
      hint: `${tens}−${b}＝<b>${d}</b>。${d}＋${u} は？`, reveal: `${tens}−${b}＝${d}、${d}＋${u}＝<b>${q.ans}</b>` };
  }
  return null;
}

function sakBox() {
  let box = $('sakBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'sakBox'; box.className = 'sak-box'; box.hidden = true;
    $('formulaH').after(box);
  }
  return box;
}

const sakHint = () => { const k = S.sak; return k.step < 2 ? k.prompts[k.step] : k.hint; };
function renderSak(how) {
  const k = S.sak; if (!k) return;
  const box = sakBox(), done = how === 'reveal' || how === 'good';
  const ball = (i) => {
    const now = !done && S.mode === 'question' && k.step === i;
    const text = done ? String(k.balls[i]) : k.vals[i];
    return `<span class="sak-ball${now ? ' now' : ''}${text !== '' ? ' on' : ''}${k.bad === i ? ' bad' : ''}">${text}</span>`;
  };
  box.innerHTML = `<div class="sak-tree"><span class="sak-num">${k.under}</span><span class="sak-branch"><i></i><i></i></span><span class="sak-balls">${ball(0)}${ball(1)}</span></div>
    <div class="sak-step">${how === 'reveal' ? k.reveal : sakHint()}</div>`;
  box.hidden = false;
}

// もんだい を だす：さんすう で さくらんぼ に できる とき
const baseAskSak = askQuestion;
askQuestion = function () {
  baseAskSak();
  S.sak = null;
  const box = $('sakBox'); if (box) box.hidden = true;
  if (!ST.battle || !S.q || S.mode !== 'question') return;
  const sk = sakuranboOf(S.q);
  if (!sk) {
    // くりあがり・くりさがり の ない「2けた ± 1けた」は ひっさん に しない（1けた ± 1けた と おなじ よこがき）
    const q = S.q;
    if (S.vertical && !q.subject && (q.op === '+' || q.op === '-') && q.b < 10 && q.a < 100) {
      S.vertical = false; S.digits = []; $('vbox').hidden = true; $('formulaH').classList.remove('small');
      renderAnswer();
    }
    return;
  }
  S.sak = { ...sk, step: sk.fill || 0, vals: sk.fill ? [String(sk.balls[0]), ''] : ['', ''], bad: -1 };
  S.vertical = false; $('vbox').hidden = true; $('formulaH').classList.remove('small'); // ひっさん の かわり
  renderAnswer();
};

const isSak = () => !!(S.sak && S.q && !S.q.subject);
const baseTypeSak = typeDigit, baseEraseSak = eraseDigit, baseSubmitSak = submit, baseRenderSak = renderAnswer;
typeDigit = function (key) {
  if (!isSak() || S.mode !== 'question') { baseTypeSak(key); return; }
  const k = S.sak;
  if (k.step === 2) { baseTypeSak(key); return; }
  const want = k.balls[k.step];
  k.vals[k.step] += key; SFX.key();
  if (k.vals[k.step].length < String(want).length && String(want).startsWith(k.vals[k.step])) { renderAnswer(); return; } // 10・20 は 2けた うつ
  if (+k.vals[k.step] === want) {
    k.bad = -1; k.step++;
    note(1320, 0, 0.12, { type: 'sine', vol: 0.1, slide: 1.5 }); // ポン
  } else {
    k.bad = k.step;
    $('qmsg').textContent = k.miss[k.step];
    $('qmsg').className = 'qmsg';
    later(0.5, () => { if (S.sak === k && k.bad >= 0) { k.vals[k.bad] = ''; k.bad = -1; renderAnswer(); } });
  }
  renderAnswer();
};
eraseDigit = function () {
  if (!isSak() || S.mode !== 'question') { baseEraseSak(); return; }
  const k = S.sak;
  if (k.step === 2 && S.input) baseEraseSak();
  else if (k.step < 2 && k.vals[k.step]) { k.vals[k.step] = ''; renderAnswer(); }
};
submit = function () {
  if (!isSak()) { baseSubmitSak(); return; }
  if (S.sak.step < 2 || S.mode !== 'question') return; // ○ を ぜんぶ うめてから
  baseSubmitSak();
  renderSak($('ans').classList.contains('good') ? 'good' : 'reveal');
};
renderAnswer = function () {
  baseRenderSak();
  if (isSak()) {
    renderSak();
    if (S.sak.step < 2) $('ans').classList.remove('blink'); // こたえ は ○ の あと
  }
};
const baseUpdateUISak = updateUI;
updateUI = function () {
  baseUpdateUISak();
  const box = $('sakBox');
  if (box && !(isSak() && (S.mode === 'question' || S.mode === 'answered'))) box.hidden = true;
};
