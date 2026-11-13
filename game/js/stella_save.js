'use strict';
// =====================================================================
//  ステラクエスト：セーブデータ（タイトル画面と ゲーム きょうつう）
//  スロット 1〜3 を localStorage の 'stella:save:N' に ほぞん する。
// =====================================================================
const SAVE_VERSION = 1;
const SAVE_SLOTS = 3;
const saveKey = (n) => `stella:save:${n}`;

// あたらしい ゲームの データ
// mode：'grade1'（しょうがく 1ねんせい）/ 'hoikuen'（ほいくえん）。あたらしく はじめる とき に えらぶ
const GAME_MODES = { grade1: 'しょうがく 1ねんせい', hoikuen: 'ほいくえん' };
function newSaveData(mode = 'grade1') {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    mode: GAME_MODES[mode] ? mode : 'grade1',
    createdAt: now,
    savedAt: now,
    playSeconds: 0,
    hero: 'chuna',
    form: 'normal',            // normal / ultimate（しんでん クリア）/ ura（とけいだいの ネクロディウス げきは）
    hp: 5,
    innBuff: false,            // やどやに おかねを はらって とまった（つぎの ダンジョンを でるまで さいだいHP 6）
    arca: 0,
    items: [],
    weapons: ['ウッド・ウィスパー'],
    equip: 'ウッド・ウィスパー',
    cleared: {},               // { なんいど: ボスを たおした かいすう }
    flags: {},                 // opening / templeOpen / templeCleared / oldKey / towerNecro / trueNecro など
    weak: {},                  // にがて かんじ
    place: 'opening',          // opening / house / town / castle / dungeon / temple / tower
    pos: null,                 // まちや へやの いち
    dungeon: null,             // ダンジョンの とちゅう（めいろ ごと）
    stats: { answered: 0, correct: 0, battles: 0 },
  };
}

function loadSlot(n) {
  try {
    const raw = localStorage.getItem(saveKey(n));
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.version ? { ...newSaveData(), ...d } : null;
  } catch { return null; }
}

function writeSlot(n, data) {
  try {
    data.savedAt = Date.now();
    localStorage.setItem(saveKey(n), JSON.stringify(data));
    return true;
  } catch { return false; }
}

function deleteSlot(n) {
  try { localStorage.removeItem(saveKey(n)); } catch { /* なにも しない */ }
}

// いちばん たかい クリアした なんいど
const maxCleared = (d) => Object.keys(d.cleared || {}).map(Number).filter((k) => d.cleared[k] > 0).reduce((a, b) => Math.max(a, b), 0);

const fmtPlayTime = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60;
  return h ? `${h}じかん ${m}ふん` : `${m}ふん`;
};
const fmtDate = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };

const PLACE_LABEL = { opening: 'オープニング', house: 'ちゅなちゃんの いえ', town: 'ルミナリアの まち', castle: 'おしろ', dungeon: 'ダンジョン', temple: 'ほしの しんでん', tower: 'ふるい とけいだい' };

// スロットに だす ひとこと
function slotSummary(d) {
  const mc = maxCleared(d);
  return {
    place: PLACE_LABEL[d.place] || '',
    mode: GAME_MODES[d.mode] || GAME_MODES.grade1,
    progress: d.flags && d.flags.gameClear ? '⭐ ゲーム クリア！' : mc ? `なんいど ${mc} まで クリア` : 'ぼうけん スタート',
    arca: d.arca || 0,
    time: fmtPlayTime(d.playSeconds || 0),
    date: fmtDate(d.savedAt || Date.now()),
  };
}
