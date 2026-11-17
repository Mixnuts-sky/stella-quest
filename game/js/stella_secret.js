'use strict';
// =====================================================================
//  ステラクエスト：ひみつの ふんすい（うらわざ）
//  まちの ふんすい を つづけて 5かい しらべる（ふんすい の となり で Enter）と「ひみつの ふんすい」が ひらく
//    ・いますぐ たたかう：死神ネクロディウス／しまじろう（レア）／ボーナスてき
//        → いま いける いちばん むずかしい ダンジョン に はいって、すぐ その てき が でる
//    ・でやすさ：死神（1%・10%・30%）、しまじろう（10%・30%）、ボーナスてき（12%・40%）
//        → セーブ データ（ST.data.secretRates）に のこる。ふつう に もどす ことも できる
//  しよう：docs/GAME_SPEC.md「2.6 ひみつの ふんすい」
// =====================================================================

const SECRET = { count: 0, lastAt: 0 };
const SECRET_DEFAULT = { death: NECRO.chance, rare: CONFIG.rareRate, bonus: BONUS.rate };
const SECRET_CHOICES = {
  death: [['ふつう（1%）', 0.01], ['10%', 0.1], ['30%', 0.3]],
  rare: [['ふつう（18%）', 0.1], ['3ばい（54%）', 0.3]], // しまじろう：かい ごと の かくりつ ＝ RG_CONF.shimaRate × あたい ÷ 0.1
  bonus: [['ふつう（12%）', 0.12], ['40%', 0.4]],
};

// セーブ に ある でやすさ を つかう（テスト の ボーナス 0 より あと に よむ）
function applySecretRates() {
  const r = (ST.data && ST.data.secretRates) || {};
  NECRO.chance = r.death ?? SECRET_DEFAULT.death;
  CONFIG.rareRate = r.rare ?? SECRET_DEFAULT.rare;
  BONUS.rate = r.bonus ?? SECRET_DEFAULT.bonus;
}
addEventListener('DOMContentLoaded', () => setTimeout(applySecretRates, 0));

// ふんすい を しらべる
const inFountain = (p) => p.x >= FOUNTAIN.x && p.x < FOUNTAIN.x + FOUNTAIN.w && p.y >= FOUNTAIN.y && p.y < FOUNTAIN.y + FOUNTAIN.h;
const baseInteractAtSecret = interactAt;
interactAt = function (p, bump) {
  if (!bump && ST.scene === 'town' && inFountain(p)) { checkFountain(); return true; }
  return baseInteractAtSecret(p, bump);
};
function checkFountain() {
  const now = performance.now();
  SECRET.count = now - SECRET.lastAt < 20000 ? SECRET.count + 1 : 1; // 20びょう いじょう あくと やりなおし
  SECRET.lastAt = now;
  if (SECRET.count >= 5) { SECRET.count = 0; openSecret(); return; }
  const lines = [['', 'きれいな ふんすい だ。みず が キラキラ ひかっている。'], ['', 'ふんすい の そこ に ほし の もよう が みえる……'],
    ['', '……ふんすい が すこし ひかった きが する。'], ['', 'ふんすい の ひかり が つよく なってきた……！']];
  stDialog([lines[SECRET.count - 1]]);
}

function openSecret() {
  [523, 784, 1046, 1568].forEach((f, i) => note(f, i * 0.09, 0.4, { type: 'sine', vol: 0.08 }));
  S.flash = 0.5; S.flashColor = '200,230,255';
  const r = ST.data.secretRates || {};
  const top = Math.min(6, maxCleared(ST.data) + 1);
  const rateRow = (key, label) => `<div class="pr-label">${label}</div><div class="pr-row">${SECRET_CHOICES[key].map(([t, v]) =>
    `<button type="button" class="pr-s${(r[key] ?? SECRET_DEFAULT[key]) === v ? ' on' : ''}" data-k="${key}" data-v="${v}">${t}</button>`).join('')}</div>`;
  const p = stPanel(`<div class="shop-head"><span class="shop-title">⛲ ひみつの ふんすい</span></div>
    <div class="shop-talk">「…… つよい てき に あいたい ものよ、ねがい を いいなさい。」</div>
    <div class="pr-label">いますぐ たたかう（なんいど ${top} の ダンジョン で）</div>
    <div class="pr-row"><button type="button" class="pr-d" data-fight="death"><b>💀</b><small>死神 ネクロディウス</small></button><button type="button" class="pr-d" data-fight="rare"><b>✨</b><small>しまじろう（レア）</small></button><button type="button" class="pr-d" data-fight="bonus"><b>🌟</b><small>ボーナスてき</small></button></div>
    ${rateRow('death', 'ダンジョン で 死神 が でる かくりつ')}${rateRow('rare', 'しまじろう（レア）が でる かくりつ')}${rateRow('bonus', 'ボーナスてき が でる かくりつ')}
    <div class="shop-msg"></div>
    <div class="shop-foot"><button type="button" class="close">とじる（Esc）</button></div>`);
  p.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.k, v = +b.dataset.v;
    ST.data.secretRates = { ...(ST.data.secretRates || {}), [k]: v };
    applySecretRates(); stSave();
    p.querySelectorAll(`[data-k="${k}"]`).forEach((x) => x.classList.toggle('on', x === b));
    shopMsg('ねがい が とどいた……！');
    note(1046, 0, 0.15, { type: 'sine', vol: 0.08 });
  }));
  p.querySelectorAll('[data-fight]').forEach((b) => b.addEventListener('click', () => { closePanelSilently(); secretFight(b.dataset.fight, top); }));
  p.querySelector('.close').addEventListener('click', closePanel);
  p.querySelector('.close').focus();
}

// いますぐ たたかう：ダンジョン に はいって すぐ でる
function secretFight(kind, diff) {
  enterDungeon(diff);
  later(1.2, () => {
    if (!inDungeon() || S.mode !== 'walk') return;
    if (kind === 'death') { NECRO.force = true; encounter({}); }
    else if (kind === 'rare') encounter({ rare: true });
    else encounter({ bonus: true });
  });
}
