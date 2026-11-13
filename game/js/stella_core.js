'use strict';
// =====================================================================
//  ステラクエスト：きほんの しくみ
//  ・スロットの よみこみ／セーブ
//  ・ばめん（シーン）の きりかえ（まち・へや・ダンジョン など）
//  ・ステラ よう の HUD（HP・アルカ）
//  たたかい と めいろ は game.js / maze.js を そのまま つかう。
//  しよう：docs/GAME_SPEC.md　すすみぐあい：docs/PROGRESS.md
// =====================================================================

const ST = {
  slot: 1,
  data: null,           // セーブデータ（stella_save.js の newSaveData の かたち）
  sessionStart: Date.now(),
  scene: null,          // いまの ばめん の なまえ
  isNew: false,
};
const STIMG = window.STELLA_IMAGES || {};

// ステラが うごかしている あいだの S.mode（game.js の たたかい・めいろ とは べつ）
//   st: ばめんを あるく   dialog: かいわ   panel: おみせ・えらぶ がめん   cut: ムービー
const ST_MODES = ['st', 'dialog', 'panel', 'cut'];
const stActive = () => ST_MODES.includes(S.mode);

// ---------------------------------------------------------------------
//  セーブ
// ---------------------------------------------------------------------
function stSave(place) {
  if (!ST.data) return;
  if (place) ST.data.place = place;
  const now = Date.now();
  ST.data.playSeconds = (ST.data.playSeconds || 0) + Math.round((now - ST.sessionStart) / 1000);
  ST.sessionStart = now;
  writeSlot(ST.slot, ST.data);
}

// ---------------------------------------------------------------------
//  ばめん（シーン）
//    SCENES[name] = { enter(arg), update(dt), draw(), keydown(e) }
// ---------------------------------------------------------------------
const SCENES = {};
function setScene(name, arg) {
  const sc = SCENES[name];
  if (!sc) { console.error('しらない ばめん', name); return; }
  ST.scene = name;
  S.monster = null; S.q = null; S.maze = null;
  setMode('st');
  if (sc.enter) sc.enter(arg);
  stRenderHud();
}

// ---------------------------------------------------------------------
//  かいわ：stDialog([['アルト', 'こんにちは'], 'ナレーション'], おわったら)
//    Enter / スペース / クリック で すすむ。もじは すこしずつ でる
// ---------------------------------------------------------------------
const DLG = { lines: [], i: 0, shown: 0, done: null };
function stDialog(lines, done) {
  DLG.lines = lines.map((l) => (Array.isArray(l) ? { who: l[0], text: l[1] } : { who: '', text: l }));
  DLG.i = 0; DLG.shown = 0; DLG.done = done || null;
  setMode('dialog');
  renderDialog();
}
function renderDialog() {
  const l = DLG.lines[DLG.i];
  if (!l) return;
  $('stSpeaker').textContent = l.who;
  $('stText').textContent = l.text.slice(0, Math.floor(DLG.shown));
}
function advanceDialog() {
  const l = DLG.lines[DLG.i];
  if (!l) return;
  if (DLG.shown < l.text.length) { DLG.shown = l.text.length; renderDialog(); return; } // さいごまで だす
  DLG.i++; DLG.shown = 0;
  if (DLG.i >= DLG.lines.length) {
    const done = DLG.done; DLG.done = null;
    setMode('st');
    if (done) done();
    return;
  }
  note(880, 0, 0.04, { type: 'sine', vol: 0.05 });
  renderDialog();
}
$('stDialog').addEventListener('click', advanceDialog);

// ---------------------------------------------------------------------
//  HUD（HP・アルカ・ばしょ）
// ---------------------------------------------------------------------
const ST_PLACE = { town: 'ルミナリアの まち', house: 'ちゅなちゃんの いえ', castle: 'おしろ', temple: 'ほしの しんでん', tower: 'ふるい とけいだい' };
const stMaxHp = () => (ST.data && ST.data.innBuff ? 6 : 5);

function stRenderHud() {
  const d = ST.data;
  const show = !!d && stActive() && ST.scene && ST.scene !== 'boot';
  $('stHud').hidden = !show;
  if (!d) return;
  $('stPlace').textContent = ST_PLACE[ST.scene] || '';
  const hpKey = `${d.hp}/${stMaxHp()}`;
  if ($('stHp').dataset.k !== hpKey) { // かわった ときだけ（まいかい かくと ハートの アニメが なんども うごく）
    $('stHp').dataset.k = hpKey;
    $('stHp').innerHTML = Array.from({ length: stMaxHp() }, (_, i) => heartSVG(i < d.hp)).join('');
  }
  $('stArca').textContent = d.arca;
}
$('stArcaIcon').src = STIMG.arca || '';

const baseUpdateUIStella = updateUI;
updateUI = function () {
  baseUpdateUIStella();
  if (stActive()) $('hud').hidden = true; // まちでは game.js の HUD を かくす
  $('stDialog').hidden = S.mode !== 'dialog';
  stRenderHud();
};

// ---------------------------------------------------------------------
//  まいフレーム：ステラの ばめん の ときは じぶんで えがく
// ---------------------------------------------------------------------
const baseTickStella = tick;
tick = function (now) {
  if (!stActive()) { baseTickStella(now); return; }
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  S.t += dt; S.phaseT += dt;
  for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const fn = timers[i].fn; timers.splice(i, 1); fn(); } }
  if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 3);
  stepParticles(dt); // game.js の update は めいろ・たたかい よう なので よばない
  if (S.mode === 'dialog') {
    const l = DLG.lines[DLG.i];
    if (l && DLG.shown < l.text.length) { DLG.shown = Math.min(l.text.length, DLG.shown + dt * 32); renderDialog(); }
  }
  const sc = SCENES[ST.scene];
  if (sc && sc.update) sc.update(dt);
  ctx.setTransform(dpr * pxScale, 0, 0, dpr * pxScale, 0, 0);
  ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.shadowBlur = 0;
  ctx.clearRect(-30, -30, W + 60, H + 60);
  if (sc && sc.draw) sc.draw();
  drawParticles();
  if (S.flash > 0) { ctx.fillStyle = `rgba(${S.flashColor},${Math.min(0.85, S.flash)})`; ctx.fillRect(-30, -30, W + 60, H + 60); }
};

// ---------------------------------------------------------------------
//  そうさ
// ---------------------------------------------------------------------
const STELLA_KEY_HOOKS = []; // ほかの ファイルが さきに キーを うけとる（true を かえしたら おわり）
addEventListener('keydown', (e) => {
  if (!stActive()) return;
  if (STELLA_KEY_HOOKS.some((h) => h(e))) return;
  if (S.mode === 'dialog') {
    if ((e.key === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && !e.repeat) { advanceDialog(); e.preventDefault(); }
    return;
  }
  const sc = SCENES[ST.scene];
  if (sc && sc.keydown && S.mode === 'st') sc.keydown(e); // おみせ・ムービーの ときは あるかない
});
addEventListener('keyup', (e) => {
  if (!stActive()) return;
  const sc = SCENES[ST.scene];
  if (sc && sc.keyup) sc.keyup(e);
});
$('stMenuBtn').addEventListener('click', () => { stSave(); location.href = '../ステラクエスト.html'; });

// ---------------------------------------------------------------------
//  はじまり：スロットを よみこむ（あいていれば あたらしい ゲーム）
// ---------------------------------------------------------------------
// うらわざ：9999アルカ・なんいど 1〜5 を クリア（しんでん も ひらく）
function applyCheat() {
  const d = ST.data;
  d.arca = 9999;
  for (let i = 1; i <= 5; i++) d.cleared[i] = Math.max(1, d.cleared[i] || 0);
  d.flags.templeOpen = true;
  d.flags.tutorialPaid = true; // オープニングの 10アルカ で 9999 を こえない ように
  stSave();
  history.replaceState(null, '', location.href.replace(/&cheat=1/, ''));
  setTimeout(() => showToast('✨ うらわざ はつどう！ 9999アルカ・なんいど5 まで クリア！', 3.5), 600);
}
addEventListener('DOMContentLoaded', () => {
  const m = location.hash.match(/slot([1-3])/), mm = location.hash.match(/mode=(\w+)/);
  ST.slot = m ? +m[1] : 1;
  const d = loadSlot(ST.slot);
  ST.isNew = !d;
  ST.data = d || newSaveData(mm ? mm[1] : 'grade1'); // あたらしく はじめる ときは タイトルで えらんだ モード
  if (!ST.data.mode) ST.data.mode = 'grade1'; // まえからの セーブ
  if (ST.isNew) stSave('opening');
  if (/cheat=1/.test(location.hash)) applyCheat(); // タイトルの うらわざ
  if (ST.data.place === 'dungeon' && ST.data.dungeon && typeof resumeDungeon === 'function') resumeDungeon(); // ダンジョンの とちゅうから
  else if ((ST.data.place === 'opening' || ST.data.flags.opStage) && typeof resumeOpening === 'function') resumeOpening(); // オープニング
  else if (ST.data.place === 'temple') setScene('town', { pos: { x: 4, y: 5 } }); // しんでんは とびらの まえから
  else if (ST.data.place === 'tower') setScene('town', { pos: { x: 24, y: 1 } }); // とけいだいは うらの とびらの まえから
  else setScene('town');
});
