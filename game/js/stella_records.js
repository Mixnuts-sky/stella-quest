'use strict';
// =====================================================================
//  ステラクエスト：きろく（にがて・ずかん・まいにち の せいかい）
//  ・にがて：まちがえた もんだい を かもく ごと に のこす（さんすう は しき、えいご は もじ。かんじ は いまの しくみ）。
//            せいかい が つづくと きえる。アルト の れんしゅう に「にがて とっくん」
//  ・ずかん：たおした てき・かけた かんじ・かけた アルファベット。まち の「📖 ずかん」ボタン
//  ・まいにち の きろく（おうち の ひと の がめん で つかう）：ST.data.log['YYYY-MM-DD'][かもく] = [こたえた, せいかい]
//  stella_growth.js の あと に よむ。しよう：docs/GAME_SPEC.md 15.4・15.5・15.6
// =====================================================================

const REC = { weakMax: 5, trainMax: 5 };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const recOf = () => {
  const d = ST.data;
  d.weakQ = d.weakQ || { math: {}, english: {} };
  d.zukan = d.zukan || { enemies: {}, kanji: {}, abc: {} };
  d.log = d.log || {};
  return d;
};

// ---------------------------------------------------------------------
//  こたえた とき：にがて・まいにち・ずかん（かんじ は 1もじ ずつ、recordResult で）
// ---------------------------------------------------------------------
const baseResolveRec = resolveAnswer;
resolveAnswer = function (ok, wrongMsg, attackKinds) {
  const q = S.q, m = S.monster;
  if (ST.data && ST.battle && q && m && !m.nanmon) {
    const d = recOf(), subj = q.subject || 'math';
    // まいにち
    const day = (d.log[today()] = d.log[today()] || {}), cell = (day[subj] = day[subj] || [0, 0]);
    cell[0]++; if (ok) cell[1]++;
    // にがて
    let key = null, table = null;
    if (subj === 'math' && q.a !== undefined && q.op) { key = `${q.a}${q.op}${q.b}`; table = d.weakQ.math; }
    if (subj === 'english' && q.engw) { key = q.target; table = d.weakQ.english; }
    if (table && key) {
      if (!ok) table[key] = Math.min(REC.weakMax, (table[key] || 0) + 2);
      else if (table[key]) { table[key]--; if (table[key] <= 0) delete table[key]; }
    }
    // ずかん：アルファベット
    if (ok && subj === 'english' && q.engw) [...q.target].forEach((ch) => { d.zukan.abc[ch] = (d.zukan.abc[ch] || 0) + 1; });
  }
  baseResolveRec(ok, wrongMsg, attackKinds);
};
const baseRecordResultRec = recordResult;
recordResult = function (ch, ok) {
  if (ok && ST.data && ST.battle) { const d = recOf(); d.zukan.kanji[ch] = (d.zukan.kanji[ch] || 0) + 1; }
  return baseRecordResultRec(ch, ok);
};

// たおした てき
function zukanEnemy(m) {
  if (!m || !ST.data || (ST.battle && ST.battle.practice)) return;
  const d = recOf(), name = m.necro ? NECRO_KINDS[m.necro].name : m.boss ? m.name : m.spr ? m.spr.name : m.name; // ボス は 1まい の え を なんいど ごと の なまえ で
  if (name) d.zukan.enemies[name] = (d.zukan.enemies[name] || 0) + 1;
}
const baseEndBattleRec = endBattle;
endBattle = function () {
  const m = S.monster;
  if (m && m.state === 'hit' && ST.battle) zukanEnemy(m);
  baseEndBattleRec();
};
const baseOnSpellHitRec = onSpellHit;
onSpellHit = function () {
  const m = S.monster;
  baseOnSpellHitRec();
  if (m && m.boss && m.hp <= 0 && !m.zukanDone) { m.zukanDone = true; zukanEnemy(m); }
};
// ひっさつ で たおした てき も
const baseCastSpecialRec = castSpecial;
castSpecial = function (shape) {
  const M = S.maze, before = M ? M.enemies.slice() : [];
  baseCastSpecialRec(shape);
  later(0.8, () => { if (S.maze === M) before.filter((e) => !M.enemies.includes(e) && e.kind === 'normal').forEach((e) => zukanEnemy({ spr: e.spr, name: e.base })); stSave(); });
};

// ---------------------------------------------------------------------
//  にがて とっくん（アルト の れんしゅう）
// ---------------------------------------------------------------------
function weakList() {
  const d = recOf(), out = [];
  Object.entries(d.weakQ.math).forEach(([k, n]) => { const m = k.match(/^(\d+)([+-])(\d+)$/); if (m) out.push({ subj: 'math', key: k, n, a: +m[1], op: m[2], b: +m[3] }); });
  Object.entries(d.weakQ.english).forEach(([k, n]) => out.push({ subj: 'english', key: k, n }));
  const wk = d.weak || {};
  KLIST.forEach((e) => { const w = [...e.word].reduce((s, ch) => s + weakWeight(wk[ch]), 0); if (w > 0) out.push({ subj: 'kanji', key: e.word, n: w, entry: e }); });
  return out.sort((p, q) => q.n - p.n);
}
const weakLabel = (w) => (w.subj === 'math' ? `${w.a} ${w.op === '+' ? '＋' : '−'} ${w.b}` : w.subj === 'english' ? w.key : w.key);
function startWeakTraining() {
  const list = weakList().slice(0, REC.trainMax);
  if (!list.length) { stDialog([['アルト', 'にがて は ない よ！ すごい！'], ['アルト', 'この ちょうし で がんばるのじゃ。']], () => askPractice()); return; }
  startStellaBattle({
    difficulty: Math.max(1, Math.min(6, maxCleared(ST.data) + 1)), practice: true, returnTo: 'town', pos: { x: TW_HERO.x, y: TW_HERO.y },
    monster: { name: 'とっくん スライム', hp: list.length * heroAtk(), maxHp: list.length * heroAtk() },
    after: () => stDialog([['アルト', 'よく がんばった！'], ['アルト', 'にがて は すこし ずつ へって いくぞ。']], () => askPractice()),
  });
  ST.battle.weak = list;
  ST.battle.weakI = 0;
}
const baseAskQuestionRec = askQuestion;
askQuestion = function () {
  const b = ST.battle, m = S.monster;
  if (!b || !b.weak || !m) { baseAskQuestionRec(); return; }
  const w = b.weak[b.weakI++ % b.weak.length];
  if (w.subj === 'math') {
    const o = makeQuestion; makeQuestion = () => mk(w.a, w.op, w.b);
    m.subject = 'math';
    try { baseAskQuestionRec(); } finally { makeQuestion = o; }
  } else if (w.subj === 'english' && w.key.length > 1) { // ことば（3もじ）
    const cvc = CVC.find((c) => c[0] === w.key) || [w.key, '✏'];
    askEngWrite(m, { ...engWriteQuestion(6), target: w.key, symbol: w.key, word: w.key,
      promptHtml: `<span class="eng-pic">${cvc[1]}</span> この ことば を 3もじ で かこう`, speak: () => speakEn(`${w.key}. ${w.key}.`, 0.6) });
  } else if (w.subj === 'english') {
    const up = w.key === w.key.toUpperCase(), i = (up ? UPPER : LOWER).indexOf(w.key);
    askEngWrite(m, { ...engWriteQuestion(up ? 1 : 2), target: w.key, symbol: w.key,
      promptHtml: `「${ABC_READ[i]}」の <b>${up ? 'おおもじ' : 'こもじ'}</b> を かこう`, speak: () => speakEn(UPPER[i]) });
  } else {
    const o = pickEntry; pickEntry = () => w.entry;
    try { askKanjiStella(m, w.entry.level); } finally { pickEntry = o; }
  }
  $('monName').insertAdjacentHTML('afterbegin', '<span class="weak-tag">🔥 にがて とっくん</span> ');
};
// アルト の れんしゅう の がめん に ボタン
const baseAskPracticeRec = askPractice;
askPractice = function () {
  baseAskPracticeRec();
  if (ST.data.mode === 'hoikuen') return;
  const p = $('stPanel'), foot = p.querySelector('.shop-foot');
  if (!foot) return;
  const n = weakList().length;
  foot.insertAdjacentHTML('beforebegin', `<div class="pr-row"><button type="button" class="weak-go" id="weakGo">🔥 にがて とっくん（${n}こ）</button></div>`);
  $('weakGo').addEventListener('click', () => { closePanelSilently(); startWeakTraining(); });
};

// ---------------------------------------------------------------------
//  ずかん
// ---------------------------------------------------------------------
const ZK_IMG = {};
function sprUrl(spr) {
  if (!spr) return '';
  if (!ZK_IMG[spr.name]) { try { ZK_IMG[spr.name] = spr.canvas.toDataURL('image/png'); } catch { ZK_IMG[spr.name] = ''; } }
  return ZK_IMG[spr.name];
}
function zukanEnemies() {
  const seen = new Set(), out = [];
  const add = (spr, kind) => { if (spr && !seen.has(spr.name)) { seen.add(spr.name); out.push({ name: spr.name, spr, kind }); } };
  (SPR.enemies || []).forEach((s) => add(s, 'てき'));
  for (let lv = 1; lv <= 6; lv++) { const st = BOSS_STAGES[lv]; if (st && st.name && !seen.has(st.name)) { seen.add(st.name); out.push({ name: st.name, spr: SPR.boss, kind: 'ボス' }); } }
  (SPR.rares || []).forEach((s) => add(s, 'レア'));
  (typeof BONUS_SPR !== 'undefined' ? BONUS_SPR : []).forEach((s) => add(s, 'ボーナス'));
  Object.entries(NECRO_KINDS).forEach(([k, v]) => { if (!seen.has(v.name)) { seen.add(v.name); out.push({ name: v.name, spr: NECRO.spr[v.img], kind: 'かくし' }); } });
  return out;
}
function openZukan(tab = 'enemy') {
  const d = recOf(), z = d.zukan;
  let body = '', count = '';
  if (tab === 'enemy') {
    const list = zukanEnemies(), got = list.filter((e) => z.enemies[e.name]).length;
    count = `${got} / ${list.length}`;
    body = `<div class="zk-grid">${list.map((e) => { const n = z.enemies[e.name] || 0;
      return `<div class="zk-card${n ? '' : ' none'}">${n ? `<img src="${sprUrl(e.spr)}" alt="">` : '<div class="zk-q">？</div>'}<b>${n ? e.name : '？？？'}</b><small>${e.kind}${n ? `・${n}かい` : ''}</small></div>`; }).join('')}</div>`;
  } else if (tab === 'kanji') {
    const levels = {};
    KLIST.forEach((e) => [...e.word].filter(isKanji).forEach((ch) => { (levels[e.level] = levels[e.level] || new Set()).add(ch); }));
    const all = new Set(Object.values(levels).flatMap((x) => [...x])).size, got = Object.keys(z.kanji).length;
    count = `${got} / ${all}`;
    body = Object.keys(levels).sort().map((lv) => `<div class="zk-lv">${lv === 'main' ? 'メイン かんじ' : `なんいど ${lv}`}</div><div class="zk-chars">${[...levels[lv]].map((ch) => `<span class="${z.kanji[ch] ? 'on' : ''}">${ch}</span>`).join('')}</div>`).join('');
  } else {
    const all = [...UPPER, ...LOWER], got = all.filter((c) => z.abc[c]).length;
    count = `${got} / ${all.length}`;
    body = `<div class="zk-lv">おおもじ</div><div class="zk-chars abc">${UPPER.map((c) => `<span class="${z.abc[c] ? 'on' : ''}">${c}</span>`).join('')}</div>
      <div class="zk-lv">こもじ</div><div class="zk-chars abc">${LOWER.map((c) => `<span class="${z.abc[c] ? 'on' : ''}">${c}</span>`).join('')}</div>`;
  }
  const tabs = [['enemy', '👾 てき'], ['kanji', '✏ かんじ'], ['abc', '🔤 アルファベット']].map(([k, l]) => `<button type="button" class="pr-s${k === tab ? ' on' : ''}" data-tab="${k}">${l}</button>`).join('');
  const p = stPanel(`<div class="shop-head"><span class="shop-title">📖 ずかん</span><span class="shop-arca">${count}</span></div>
    <div class="pr-row">${tabs}</div><div class="zk-body">${body}</div>
    <div class="shop-foot"><button type="button" class="close">とじる（Esc）</button></div>`);
  p.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { closePanelSilently(); openZukan(b.dataset.tab); }));
  p.querySelector('.close').addEventListener('click', closePanel);
}
// まち・たてもの の HUD に「📖 ずかん」
(function zukanButton() {
  const b = document.createElement('button');
  b.id = 'zukanBtn'; b.type = 'button'; b.className = 'hud-btn st-zukan-btn'; b.textContent = '📖 ずかん';
  $('stMenuBtn').insertAdjacentElement('beforebegin', b);
  b.addEventListener('click', () => { if (S.mode === 'st') openZukan(); b.blur(); });
  setInterval(() => { b.hidden = !(ST.data && S.mode === 'st' && (ST.scene === 'town' || ST.scene === 'interior')); }, 200);
})();

// テスト よう
window.recTest = { weakList, startWeakTraining, openZukan, today };
