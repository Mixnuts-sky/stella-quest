'use strict';
// =====================================================================
//  ステラクエスト：なかま（けんし かずぅ・おどりこ みなり）
//  ・まち に さいしょ から いる。はなす と なかま に なる じょうけん を ヒント で おしえて くれる
//      かずぅ：かんじ を ずかん に PARTY.kazu.need こ あつめる
//      みなり：おんがく の もんだい に PARTY.minari.need かい せいかい
//  ・じょうけん を みたして はなす と なかま に なる（ST.data.party）
//  ・ダンジョン：ちゅなちゃん の うしろ を ついて くる
//      かずぅ：しげみ を きる（stella_jump.js）・たたかい で せいかい の あと ときどき おいうち（−1）
//      みなり：たからばこ の なぞなぞ で ちがう こたえ を 1つ おしえる・まちがえた とき ときどき おどって こうげき を とめる（ときどき HP も 1）
//  stella_jump.js・stella_action.js・stella_records.js の あと に よむ。しよう：docs/GAME_SPEC.md 15.11
// =====================================================================

const PARTY = {
  kazu: { name: 'かずぅ', job: 'けんし', folder: '剣士', need: 20, home: { x: 22, y: 11 }, color: '#4a7fd6', hair: '#3a2a20' },
  minari: { name: 'みなり', job: 'おどりこ', folder: '踊り子', need: 30, home: { x: 6, y: 11 }, color: '#ff7aa8', hair: '#f2c94c' },
  slashRate: 0.35,  // かずぅ の おいうち
  danceRate: 0.35,  // みなり の おどり（まちがえた とき）
  danceHeal: 0.4,   // おどり で HP も 1 かいふく
};
try { const t = localStorage.getItem('stella:test:partyRate'); if (t !== null) { PARTY.slashRate = +t; PARTY.danceRate = +t; } } catch { /* テスト よう */ }
const PARTY_IDS = ['kazu', 'minari'];
const PARTY_SPR = {};
addEventListener('DOMContentLoaded', () => {
  const IM = window.IMAGES || {};
  PARTY_IDS.forEach((id) => {
    const item = (IM[PARTY[id].folder] || [])[0];
    if (item) loadImage(item).then((spr) => { if (spr) { PARTY_SPR[id] = spr; NPC_SPR[PARTY[id].name] = spr; } });
  });
});
const partyList = () => (ST.data && ST.data.party) || [];

// じょうけん の すすみぐあい
function partyProgress(id) {
  const d = recOf();
  if (id === 'kazu') return Object.keys(d.zukan.kanji || {}).length;
  return Object.values(d.log || {}).reduce((a, day) => a + ((day.music || [0, 0])[1] || 0), 0);
}
const partyReady = (id) => partyProgress(id) >= PARTY[id].need;
function joinParty(id) {
  const d = ST.data;
  if (partyList().includes(id)) return;
  d.party = [...partyList(), id];
  stSave();
  SFX.levelUp();
  for (let i = 0; i < 50; i++) spawn(Math.random() < 0.5 ? 'heart' : 'confetti', W / 2 + rnd(-60, 60), H * 0.45, { vx: rnd(-380, 380), vy: rnd(-480, -120) });
  showBanner(`${PARTY[id].name} が なかま に なった！`, 2.4);
}

// ---------------------------------------------------------------------
//  まち：さいしょ から いる
// ---------------------------------------------------------------------
function partyLines(id) {
  const P = PARTY[id], n = partyProgress(id), joined = partyList().includes(id);
  if (id === 'kazu') {
    if (joined) return [['かずぅ', 'ダンジョン の しげみ は ぼく に まかせて！'], ['かずぅ', 'たたかい でも ときどき きりこむ よ！']];
    if (partyReady(id)) return [['かずぅ', 'かんじ を こんなに しってる なんて すごい！'], ['かずぅ', 'ぼく も いっしょに いって いい？'], ['かずぅ', 'しげみ を きったり、たたかい で おいうち したり する よ！']];
    return [['かずぅ', 'ぼく は けんし の かずぅ。'], ['かずぅ', 'かんじ に つよい まほうつかい と たび を したい んだ。'], ['かずぅ', `かんじ を ずかん に ${P.need}こ あつめたら、なかま に なる よ！（いま ${n}こ）`]];
  }
  if (joined) return [['みなり', 'なぞなぞ の ヒント は まかせて♪'], ['みなり', 'こまった とき は おどって たすける ね！']];
  if (partyReady(id)) return [['みなり', 'おんがく が こんなに できる なんて すてき♪'], ['みなり', 'わたし も いっしょに いく！'], ['みなり', 'なぞなぞ の ヒント を だしたり、おどって てき を みとれさせたり する よ♪']];
  return [['みなり', 'わたし は おどりこ の みなり♪'], ['みなり', 'おんがく が とくい な こ と いっしょに おどりたい な。'], ['みなり', `おんがく の もんだい に ${P.need}かい せいかい したら、なかま に なる よ♪（いま ${n}かい）`]];
}
PARTY_IDS.forEach((id) => {
  const P = PARTY[id];
  NPCS.push({ id, name: P.name, kind: 'party', spr: P.name, color: P.color, hair: P.hair, x: P.home.x, y: P.home.y, home: { ...P.home }, wander: false,
    lines: () => partyLines(id), after: () => { if (!partyList().includes(id) && partyReady(id)) joinParty(id); } });
});
// じょうけん を みたしたら まち に もどった とき に おしえる
const baseLeaveDungeonParty = leaveDungeon;
leaveDungeon = function (kind) {
  baseLeaveDungeonParty(kind);
  const d = ST.data;
  if (!d) return;
  d.partyTold = d.partyTold || {};
  PARTY_IDS.forEach((id, i) => {
    if (partyList().includes(id) || d.partyTold[id] || !partyReady(id)) return;
    d.partyTold[id] = true; stSave();
    later(2.5 + i * 3, () => showToast(`${PARTY[id].name}（${PARTY[id].job}）が まち で まって いる みたい！`, 3));
  });
};

// ---------------------------------------------------------------------
//  ダンジョン：うしろ を ついて くる
// ---------------------------------------------------------------------
const PTRAIL = { trail: [], prev: [], key: '', say: null };
function partySay(id, text) { PTRAIL.say = { id, text, t: 0 }; }
function rgPartyObjs(objs, T, ease) {
  const ids = partyList();
  if (!ids.length) return;
  const k = `${S.from.x},${S.from.y}>${S.pos.x},${S.pos.y}`;
  const far = !PTRAIL.trail.length || Math.abs(PTRAIL.trail[0].x - S.pos.x) + Math.abs(PTRAIL.trail[0].y - S.pos.y) > 3;
  if (far) { PTRAIL.trail = ids.map(() => ({ ...S.pos })); PTRAIL.prev = PTRAIL.trail.map((p) => ({ ...p })); PTRAIL.key = k; }
  else if (k !== PTRAIL.key && S.moveT < 1) {
    PTRAIL.key = k;
    PTRAIL.prev = PTRAIL.trail.map((p) => ({ ...p }));
    PTRAIL.trail = [{ ...S.from }, ...PTRAIL.trail].slice(0, ids.length);
  }
  const e = ease(S.moveT);
  ids.forEach((id, i) => {
    const a = PTRAIL.prev[i] || S.pos, b = PTRAIL.trail[i] || S.pos;
    if (a.x === S.pos.x && a.y === S.pos.y && b.x === S.pos.x && b.y === S.pos.y) return; // まだ ちゅなちゃん と おなじ ところ
    const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e, flip = b.x < a.x || (b.x === a.x && S.facing < 0);
    objs.push({ y: y - 0.01, draw: () => partyDrawMap(id, x, y, T, flip, S.moveT < 1 ? Math.abs(Math.sin(S.moveT * Math.PI)) * 4 : 0) });
  });
}
function partyDrawMap(id, x, y, T, flip, bob) {
  const spr = PARTY_SPR[id], sx = x * T + T / 2, sy = y * T + T * 0.92 - bob;
  ctx.fillStyle = 'rgba(30,10,50,.22)'; ctx.beginPath(); ctx.ellipse(sx, y * T + T * 0.9, T * 0.28, 5, 0, 0, 7); ctx.fill();
  const hh = T * 1.4;
  if (spr) { ctx.save(); ctx.translate(sx, sy); drawNpcSprite(PARTY[id].name, hh, flip); ctx.restore(); } // ふちどり つき（stella_town.js）
  else { ctx.fillStyle = PARTY[id].color; ctx.beginPath(); ctx.arc(sx, sy - hh * 0.4, T * 0.3, 0, 7); ctx.fill(); }
  const sp = PTRAIL.say;
  if (sp && sp.id === id) {
    sp.t += 1 / 60;
    if (sp.t > 1.8) PTRAIL.say = null;
    else outlinedText(sp.text, sx, sy - hh - 8, 15, PARTY[id].color);
  }
}

// ---------------------------------------------------------------------
//  たたかい：うしろ に ならぶ・おいうち・おどり
// ---------------------------------------------------------------------
const PB = { anim: null };
const partyInBattle = () => !!(ST.data && ST.battle && !ST.battle.practice && S.monster && !S.monster.nanmon);
const baseDrawCatParty = drawCat;
drawCat = function () {
  if (ST.data && ST.battle && S.monster) partyDrawBattle();
  baseDrawCatParty();
};
function partyDrawBattle() {
  // てつだう とき だけ ひだり から でてくる（ふだん は がめん に いない）
  const gy = GROUND(), A = PB.anim;
  if (!A) return;
  A.t += 1 / 60;
  if (A.t > A.dur) { PB.anim = null; return; }
  const id = A.id, k = A.t / A.dur, hh = 135, out = -90;
  let x, y = gy, rot = 0;
  if (id === 'kazu') { // ひだり から てき の まえ まで とんで きって、もどる
    const m = S.monster, tx = m ? m.x - 100 : W / 2;
    x = k < 0.35 ? out + (tx - out) * (k / 0.35) : k < 0.6 ? tx : tx + (out - tx) * ((k - 0.6) / 0.4);
    y = gy - Math.sin(Math.min(1, k / 0.35) * Math.PI) * 70 * (k < 0.35 ? 1 : 0);
  } else { // ちゅなちゃん の まえ で くるくる おどる
    const tx = Math.max(70, HERO_X() + 110);
    x = k < 0.15 ? out + (tx - out) * (k / 0.15) : k < 0.85 ? tx : tx + (out - tx) * ((k - 0.85) / 0.15);
    if (k >= 0.15 && k < 0.85) {
      y = gy - Math.abs(Math.sin(A.t * 9)) * 26; rot = Math.sin(A.t * 6) * 0.25;
      if (Math.random() < 0.35) spawn('heart', x + rnd(-40, 40), gy - rnd(60, 170), { vx: rnd(-90, 90), vy: rnd(-220, -60), color: pick(['#ff6fa8', '#ffb3e0', '#ffd84a']) });
    }
  }
  ctx.fillStyle = 'rgba(40,20,60,.16)'; ctx.beginPath(); ctx.ellipse(x, gy + 8, 34, 7, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(x, y + 8); ctx.rotate(rot);
  if (PARTY_SPR[id]) drawNpcSprite(PARTY[id].name, hh, false);
  ctx.restore();
  if (A.say && k > 0.15 && k < 0.9) drawSpeech([PARTY[id].name, A.say], { cx: x, bottom: y - hh - 10, noTail: true, color: PARTY[id].color, size: 20 });
}
// かずぅ：せいかい の あと ときどき おいうち（−1。ボス は HP 1 のこす）
const baseOnSpellHitParty = onSpellHit;
onSpellHit = function () {
  const m = S.monster;
  if (partyInBattle() && partyList().includes('kazu') && m.hp > 1 && Math.random() < PARTY.slashRate) {
    m.hp = Math.max(1, m.hp - 1);
    PB.anim = { id: 'kazu', t: 0, dur: 1.3, say: 'おいうち！ −1' };
    note(1500, 0.25, 0.06, { type: 'sawtooth', vol: 0.05, slide: 0.4 });
    later(0.5, () => { if (S.monster === m) for (let i = 0; i < 12; i++) spawn('twinkle', m.x + rnd(-30, 30), GROUND() - m.height * 0.5 + rnd(-30, 30), { color: pick(['#bfe4ff', '#ffffff']), size: rnd(6, 12) }); });
    renderHud();
  }
  baseOnSpellHitParty();
};
// みなり：まちがえた とき ときどき おどって こうげき を とめる
const baseResolveParty = resolveAnswer;
resolveAnswer = function (ok, wrongMsg, attackKinds) {
  S.charmQ = null;
  if (!ok && partyInBattle() && partyList().includes('minari') && Math.random() < PARTY.danceRate) S.charmQ = S.q;
  baseResolveParty(ok, wrongMsg, attackKinds);
};
const baseOpenDodgeParty = openDodge;
openDodge = function (m, opts = {}) {
  if (!opts.final && S.charmQ && S.charmQ === S.q) return; // おどり で こうげき しない ので よけなくて いい
  baseOpenDodgeParty(m, opts);
};
const baseDamageHeroParty = damageHero;
damageHero = function () {
  if (S.charmQ && S.charmQ === S.q && S.monster) {
    S.charmQ = null;
    const heal = Math.random() < PARTY.danceHeal && S.hp < stMaxHp();
    PB.anim = { id: 'minari', t: 0, dur: 2.2, say: heal ? 'おどって HP 1 かいふく♪' : 'みとれて こうげき しない♪' };
    [784, 988, 1175, 988].forEach((f, i) => note(f, i * 0.12, 0.14, { type: 'triangle', vol: 0.06 }));
    if (heal) { S.hp = Math.min(stMaxHp(), S.hp + 1); ST.data.hp = S.hp; renderHud(); SFX.heal(); }
    S.monster.state = 'idle';
    return;
  }
  baseDamageHeroParty();
};

// みなり：たからばこ の なぞなぞ で ちがう こたえ を 1つ おしえる
const baseOpenChestParty = openChest;
openChest = function (chest) {
  baseOpenChestParty(chest);
  const R = S.riddle, old = document.getElementById('minariHint');
  if (old) old.remove();
  if (!R || R.done || !partyList().includes('minari') || !inDungeon()) return;
  const wrong = R.choices.map((_, i) => i).filter((i) => i !== R.answer);
  const k = pick(wrong), b = $('riddleChoices').children[k];
  if (!b) return;
  b.disabled = true; b.classList.add('hinted');
  $('riddleChoices').insertAdjacentHTML('afterend', `<div class="minari-hint" id="minariHint">💃 みなり：「${R.choices[k]}」は ちがう みたい♪</div>`);
};

// テスト よう
window.partyTest = { join: joinParty, progress: partyProgress, ready: partyReady, lines: partyLines, trail: PTRAIL };
