'use strict';
// =====================================================================
//  ステラクエスト：タイムアタック と ランキング（stella_english.js の あと に よむ）
//  ・ダンジョン の いりぐち（なんいど を えらぶ ところ）で「⏱ タイムアタック」を オン → クリアした ダンジョン に はいる
//  ・はいった とき から ボス を たおす まで の じかん を はかる（がめん の みぎうえ に タイマー）
//  ・ランキング：なんいど × もんだい の モード ごと に はやい じゅん 5つ（どの セーブ の きろく も いっしょ）
//      localStorage['stella:timeattack'] = { '<なんいど>:<モード>': [{ t: びょう, slot, date }] }
//  ・まける・きかんのはね・とちゅう で やめる と きろく なし
//  しよう：docs/GAME_SPEC.md「9.8 タイムアタック」
// =====================================================================

const TA = { armed: false, run: null, timer: null };
const TA_KEY = 'stella:timeattack';
const fmtTA = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, '0')}`;
const taModeKey = () => (isHoikuen() ? 'hoikuen' : (ST.data.subjMode || 'mix'));
const taModeLabel = (k) => (k === 'hoikuen' ? 'ほいくえん' : (SUBJ_MODES[k] || SUBJ_MODES.mix).label);
function loadRanking() { try { return JSON.parse(localStorage.getItem(TA_KEY)) || {}; } catch { return {}; } }
function saveRanking(r) { try { localStorage.setItem(TA_KEY, JSON.stringify(r)); } catch { /* ほぞん できなくても あそべる */ } }

// ---------------------------------------------------------------------
//  いりぐち：タイムアタック の スイッチ と ランキング
// ---------------------------------------------------------------------
const baseGateTA = enterDungeonGate;
enterDungeonGate = function () {
  baseGateTA();
  const p = $('stPanel'), list = p.querySelector('.dlist');
  if (!list) return;
  const anyCleared = maxCleared(ST.data) > 0;
  list.insertAdjacentHTML('beforebegin', `<div class="ta-row"><button type="button" class="ta-toggle${TA.armed ? ' on' : ''}" id="taToggle" ${anyCleared ? '' : 'disabled'}>⏱ タイムアタック：${TA.armed ? 'オン' : 'オフ'}</button>
    <button type="button" class="ta-rank-btn" id="taRankBtn">🏆 ランキング</button><small>${anyCleared ? 'クリア した ダンジョン で タイム を はかる' : 'ダンジョン を クリア すると できるよ'}</small></div>`);
  const mark = () => p.querySelectorAll('[data-d]').forEach((b) => b.classList.toggle('ta-off', TA.armed && !(ST.data.cleared[b.dataset.d] > 0)));
  $('taToggle').addEventListener('click', (e) => {
    TA.armed = !TA.armed;
    e.currentTarget.classList.toggle('on', TA.armed);
    e.currentTarget.textContent = `⏱ タイムアタック：${TA.armed ? 'オン' : 'オフ'}`;
    mark();
  });
  $('taRankBtn').addEventListener('click', () => { closePanelSilently(); showRanking(null, () => enterDungeonGate()); });
  mark();
};

// はいる とき：タイムアタック なら はかりはじめる（クリア して いない なんいど は ふつう に はいる）
const baseEnterDungeonTA = enterDungeon;
enterDungeon = function (diff) {
  TA.run = null;
  baseEnterDungeonTA(diff);
  if (!TA.armed) return;
  if (!(ST.data.cleared[diff] > 0)) { showToast('タイムアタック は クリア した ダンジョン だけ だよ', 2.6); return; }
  TA.run = { diff, mode: taModeKey(), start: performance.now() };
  showBanner(`⏱ タイムアタック スタート！`, 1.8);
  startTimerHud();
};
const taElapsed = () => (TA.run ? (performance.now() - TA.run.start) / 1000 : 0);
function startTimerHud() {
  let el = $('taTimer');
  if (!el) { el = document.createElement('div'); el.id = 'taTimer'; el.className = 'ta-timer'; $('game').appendChild(el); }
  el.hidden = false;
  clearInterval(TA.timer);
  TA.timer = setInterval(() => {
    if (!TA.run || !inDungeon()) { el.hidden = true; clearInterval(TA.timer); return; }
    el.textContent = `⏱ ${fmtTA(taElapsed())}`;
  }, 100);
}

// でる とき：クリア いがい は きろく なし
const baseLeaveDungeonTA = leaveDungeon;
leaveDungeon = function (kind) {
  if (kind !== 'clear') TA.run = null;
  baseLeaveDungeonTA(kind);
};

// クリア：きろく と ランキング
const baseDungeonClearTA = dungeonClear;
dungeonClear = function () {
  const run = TA.run;
  TA.run = null;
  const sec = run ? (performance.now() - run.start) / 1000 : 0;
  baseDungeonClearTA();
  if (!run) return;
  const r = loadRanking(), key = `${run.diff}:${run.mode}`;
  const entry = { t: Math.round(sec * 10) / 10, slot: ST.slot, date: new Date().toISOString().slice(0, 10) };
  const list = [...(r[key] || []), entry].sort((a, b) => a.t - b.t);
  const rank = list.indexOf(entry) + 1;
  r[key] = list.slice(0, 5);
  saveRanking(r);
  TA.last = { key, rank, t: entry.t }; // テストよう
  // クリア の かいわ の あと に きろく と ランキング
  DLG.lines.push({ who: '', text: `⏱ タイム ${fmtTA(entry.t)}！${rank <= 5 ? `　ランキング ${rank}い！` : ''}` });
  const done = DLG.done;
  DLG.done = () => { if (done) done(); showRanking(key, null, rank <= 5 ? rank : 0); };
};

// ---------------------------------------------------------------------
//  ランキング の がめん（key が ない ときは えらべる）
// ---------------------------------------------------------------------
function showRanking(key, back, highlight = 0) {
  const r = loadRanking();
  const keys = Object.keys(r).sort();
  if (!key) key = keys[0] || `1:${taModeKey()}`;
  const [diff, mode] = key.split(':');
  const list = r[key] || [];
  const medal = ['🥇', '🥈', '🥉', '4', '5'];
  const tabs = keys.map((k) => { const [d, m] = k.split(':'); return `<button type="button" class="pr-s${k === key ? ' on' : ''}" data-key="${k}">${d}・${taModeLabel(m)}</button>`; }).join('');
  const rows = list.length ? list.map((e, i) => `<tr class="${i + 1 === highlight ? 'me' : ''}"><td>${medal.at(i)}</td><td class="tt">${fmtTA(e.t)}</td><td>スロット ${e.slot}</td><td>${e.date}</td></tr>`).join('')
    : '<tr><td colspan="4">まだ きろく が ないよ</td></tr>';
  const p = stPanel(`<div class="shop-head"><span class="shop-title">🏆 タイムアタック ランキング</span></div>
    ${keys.length ? `<div class="pr-row">${tabs}</div>` : ''}
    <div class="shop-talk">なんいど ${diff}「${(typeof DUNGEONS !== 'undefined' && DUNGEONS[diff]) || ''}」・もんだい：${taModeLabel(mode)}</div>
    <table class="ta-table">${rows}</table>
    <div class="shop-foot"><button type="button" class="close">とじる（Esc）</button></div>`, back || null);
  p.querySelectorAll('[data-key]').forEach((b) => b.addEventListener('click', () => { closePanelSilently(); showRanking(b.dataset.key, back); }));
  p.querySelector('.close').addEventListener('click', closePanel);
  p.querySelector('.close').focus();
}
