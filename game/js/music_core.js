'use strict';
// =====================================================================
//  おんがくの ぶひん（どうよう・ごせんふ・おと・こたえる ボタン）
//  おどりこ みなり（music.js）と ステラクエスト（stella_subjects.js）で つかう。
// =====================================================================

const MUSIC_CONFIG = {
  tempo: 0.34,        // フレーズを ならす はやさ（1おん の びょう）
  placeRate: 0.4,     // 「ごせんふに おく」もんだいの わりあい（のこりは「なまえを こたえる」）
};
const NOTE_NAMES = ['ド', 'レ', 'ミ', 'ファ', 'ソ', 'ラ', 'シ'];
const NOTE_COLORS = ['#ff5a5a', '#ff9a3a', '#f2c200', '#3cc46e', '#3cb8f0', '#5a7bff', '#b06aff'];
const SEMITONE = [0, 2, 4, 5, 7, 9, 11];

// レベルごとの おとの はんい（oct: オクターブ。ト音の した＝4、うえ＝5、ヘ音の した＝2、うえ＝3）
const MUSIC_LEVELS = {
  1: { clef: 'treble', octs: [4], tag: 'トおんきごう・した' },
  2: { clef: 'treble', octs: [5], tag: 'トおんきごう・うえ' },
  3: { clef: 'treble', octs: [4, 5], tag: 'トおんきごう・まぜまぜ' },
  4: { clef: 'bass', octs: [2], tag: 'ヘおんきごう・した' },
  5: { clef: 'bass', octs: [3], tag: 'ヘおんきごう・うえ' },
  6: { clef: 'bass', octs: [2, 3], tag: 'ヘおんきごう・まぜまぜ' },
  7: { ear: true, octs: [4], tag: 'おとだけ' },
};

// どうようの 1せつ（ちょさくけんの きれた きょく）。かず は 0=ド 1=レ … 6=シ
const SONGS = [
  { title: 'かえるの うた', notes: [0, 1, 2, 3, 2, 1, 0] },
  { title: 'かえるの うた', notes: [2, 3, 4, 5, 4, 3, 2] },
  { title: 'きらきらぼし', notes: [0, 0, 4, 4, 5, 5, 4] },
  { title: 'きらきらぼし', notes: [3, 3, 2, 2, 1, 1, 0] },
  { title: 'メリーさんの ひつじ', notes: [2, 1, 0, 1, 2, 2, 2] },
  { title: 'メリーさんの ひつじ', notes: [1, 1, 1, 2, 4, 4] },
  { title: 'ちょうちょう', notes: [4, 2, 2, 3, 1, 1] },
  { title: 'ちょうちょう', notes: [0, 1, 2, 3, 4, 4, 4] },
  { title: 'ぶんぶんぶん', notes: [4, 3, 2, 1, 2, 3, 1, 0] },
  { title: 'かっこう', notes: [4, 2, 4, 2, 1, 0, 1, 0] },
  { title: 'ロンドンばし', notes: [4, 5, 4, 3, 2, 3, 4] },
  { title: 'よろこびの うた', notes: [2, 2, 3, 4, 4, 3, 2, 1] },
  { title: 'よろこびの うた', notes: [0, 0, 1, 2, 2, 1, 1] },
  { title: 'ゆかいな まきば', notes: [0, 0, 0, 4, 5, 5, 4] },
  { title: 'ジングルベル', notes: [2, 2, 2, 2, 2, 2, 2, 4, 0, 1, 2] },
  { title: 'おんかいの かいだん（のぼり）', notes: [0, 1, 2, 3, 4, 5, 6] },
  { title: 'おんかいの かいだん（くだり）', notes: [6, 5, 4, 3, 2, 1, 0] },
];

const MUSIC_HOOKS = { attackKinds: undefined }; // resolveAnswer に わたす こうげき（undefined なら game.js の まほう）

// =====================================================================
//  おと
// =====================================================================
const midiOf = (deg, oct) => 12 * (oct + 1) + SEMITONE[deg];
function playPitch(deg, oct, start = 0, dur = 0.5) {
  const f = 440 * Math.pow(2, (midiOf(deg, oct) - 69) / 12);
  note(f, start, dur, { type: 'triangle', vol: oct <= 3 ? 0.22 : 0.15 });
  note(f * 2, start, dur * 0.6, { type: 'sine', vol: 0.04 }); // オルゴールの きらきら
  if (oct <= 3) note(f, start, dur, { type: 'square', vol: 0.025 }); // ひくい おとも きこえる ように
}

let phraseTimers = [];
function stopPhrase() { phraseTimers.forEach(clearTimeout); phraseTimers = []; if (S.q) S.q.playing = -1; }
function playPhrase(q, extraEnd) {
  stopPhrase();
  const tp = MUSIC_CONFIG.tempo;
  q.notes.forEach((n, i) => {
    playPitch(n.deg, n.oct, i * tp, tp * 1.4);
    phraseTimers.push(setTimeout(() => { if (S.q === q) { q.playing = i; renderStaff(); } }, i * tp * 1000));
  });
  phraseTimers.push(setTimeout(() => { if (S.q === q) { q.playing = -1; renderStaff(); if (extraEnd) extraEnd(); } }, q.notes.length * tp * 1000 + 100));
}
// おとだけの もんだい：きじゅんの ド → もんだいの おと
function playEar(q) {
  stopPhrase();
  if (q.noRef) { // なんもん：きじゅんの ド なし
    playPitch(q.target.deg, q.target.oct, 0, 0.9);
    q.playing = 1; renderStaff();
    phraseTimers.push(setTimeout(() => { if (S.q === q) { q.playing = -1; renderStaff(); } }, 1000));
    return;
  }
  playPitch(0, 4, 0, 0.7);
  playPitch(q.target.deg, q.target.oct, 1.1, 0.9);
  q.playing = 0; renderStaff();
  phraseTimers.push(setTimeout(() => { if (S.q === q) { q.playing = 1; renderStaff(); } }, 1100));
  phraseTimers.push(setTimeout(() => { if (S.q === q) { q.playing = -1; renderStaff(); } }, 2100));
}
const replay = () => { const q = S.q; if (!q) return; audio(); if (q.type === 'ear') playEar(q); else playPhrase(q); };

// =====================================================================
//  もんだい
// =====================================================================
let recentDegs = [];
function makeMusicQuestion(level) {
  const L = MUSIC_LEVELS[level];
  const degs = [0, 1, 2, 3, 4, 5, 6].filter((d) => !recentDegs.includes(d));
  const deg = pick(degs);
  recentDegs = [deg, ...recentDegs].slice(0, 2);
  const oct = pick(L.octs);
  if (L.ear) return { subject: 'music', type: 'ear', level, target: { deg, oct }, notes: [], playing: -1 };
  const song = pick(SONGS.filter((s) => s.notes.includes(deg)));
  const idxs = song.notes.map((d, i) => (d === deg ? i : -1)).filter((i) => i >= 0);
  const notes = song.notes.map((d) => ({ deg: d, oct }));
  const ti = pick(idxs);
  return {
    subject: 'music', type: Math.random() < MUSIC_CONFIG.placeRate ? 'place' : 'name',
    level, clef: L.clef, song, notes, ti, target: notes[ti], placed: null, hover: null, chosen: null, playing: -1,
  };
}

// もんだいを だす（ひょうじ・おと）。もんだいの うえの なまえ（monName）は よぶ ほうで きめる
function musicAsk(q) {
  $('songTitle').textContent = q.type === 'ear' ? '' : `♪ ${q.song.title}`;
  $('mInstr').innerHTML = q.type === 'name' ? 'ピンクの おんぷは なに？'
    : q.type === 'place' ? `<b>${NOTE_NAMES[q.target.deg]}</b> を ？の ところに おいてね（クリック）`
      : q.noRef ? 'きこえた <b>おと</b>は なに？（ヒントの ド は ないよ）' : 'さいしょの おとは ド。<b>つぎの おと</b>は なに？';
  $('qmsg').textContent = ''; $('qmsg').className = 'qmsg';
  $('nextBtn').hidden = true;
  S.hintNext = false;
  setMode('question');
  renderKeys();
  renderStaff();
  later(0.35, () => { if (S.q === q) (q.type === 'ear' ? playEar : playPhrase)(q); });
}

// =====================================================================
//  ごせんふ（SVG）
// =====================================================================
const STEP = 9;                  // せんと かんの あいだ（はんぶん）
const Y0 = 150;                  // いちばん したの せん
const BASE = { treble: 4 * 7 + 2, bass: 2 * 7 + 4 }; // いちばん したの せん（ト音＝ミ4、ヘ音＝ソ2）
const LEFT = 70, GAP = 46;
const posOf = (q, n) => n.oct * 7 + n.deg - BASE[q.clef];
const yOf = (p) => Y0 - p * STEP;

function placeRange(q) {
  const L = MUSIC_LEVELS[q.level];
  const lo = Math.min(...L.octs) * 7 - BASE[q.clef], hi = Math.max(...L.octs) * 7 + 6 - BASE[q.clef];
  return [lo - 1, hi + 1];
}

function noteSvg(x, p, color, opts = {}) {
  const y = yOf(p);
  let s = '';
  for (let lp = -2; lp >= p; lp -= 2) s += `<line x1="${x - 16}" x2="${x + 16}" y1="${yOf(lp)}" y2="${yOf(lp)}" stroke="#3a2a4d" stroke-width="2.4"/>`;
  for (let lp = 10; lp <= p; lp += 2) s += `<line x1="${x - 16}" x2="${x + 16}" y1="${yOf(lp)}" y2="${yOf(lp)}" stroke="#3a2a4d" stroke-width="2.4"/>`;
  const up = p < 4;
  s += up ? `<line x1="${x + 8.6}" x2="${x + 8.6}" y1="${y - 2}" y2="${y - 52}" stroke="${color}" stroke-width="2.6"/>`
    : `<line x1="${x - 8.6}" x2="${x - 8.6}" y1="${y + 2}" y2="${y + 52}" stroke="${color}" stroke-width="2.6"/>`;
  s += `<ellipse cx="${x}" cy="${y}" rx="10" ry="7.2" transform="rotate(-20 ${x} ${y})" fill="${color}" ${opts.glow ? 'stroke="#ffd84a" stroke-width="4"' : ''} opacity="${opts.opacity ?? 1}"/>`;
  return s;
}

function renderStaff() {
  const q = S.q, box = $('staffBox');
  if (!q || q.subject !== 'music') { box.innerHTML = ''; return; }
  if (q.type === 'ear') {
    box.innerHTML = `<div class="ear-icon">${q.playing === 1 ? '♪？' : q.playing === 0 ? 'ド♪' : '♫'}</div>`;
    return;
  }
  const answered = S.mode === 'answered';
  const width = LEFT + q.notes.length * GAP + 20, height = 230;
  let s = `<svg viewBox="0 0 ${width} ${height}" class="${q.type === 'place' && !answered ? 'place-mode' : ''}" id="staffSvg" xmlns="http://www.w3.org/2000/svg">`;
  for (let i = 0; i < 5; i++) s += `<line x1="8" x2="${width - 8}" y1="${yOf(i * 2)}" y2="${yOf(i * 2)}" stroke="#3a2a4d" stroke-width="2"/>`;
  // おんぷきごう（ト音は ソの せん、ヘ音は ファの せんに あわせる）
  s += q.clef === 'treble'
    ? `<text x="12" y="${yOf(2) + 15}" font-family="'Noto Music', 'Segoe UI Symbol', serif" font-size="86" fill="#3a2a4d">𝄞</text>`
    : `<text x="14" y="${yOf(6) + 21}" font-family="'Noto Music', 'Segoe UI Symbol', serif" font-size="66" fill="#3a2a4d">𝄢</text>`;
  q.notes.forEach((n, i) => {
    const x = LEFT + i * GAP + GAP / 2, p = posOf(q, n);
    const isT = i === q.ti, playing = q.playing === i;
    if (isT && q.type === 'place') {
      // おく ところ（？の わく）と おいた おんぷ
      s += `<rect x="${x - 20}" y="${yOf(12) - 4}" width="40" height="${yOf(-6) - yOf(12) + 8}" rx="10" fill="${playing ? '#fff3b0' : '#fff0f7'}" stroke="#ff8fbf" stroke-width="2" stroke-dasharray="6 5"/>`;
      if (!answered) s += `<text x="${x}" y="${yOf(12) + 12}" text-anchor="middle" font-size="20" font-weight="900" fill="#e2588f">？</text>`;
      if (answered) {
        if (q.placed !== null && q.placed !== p && !q.correctPlaced) s += noteSvg(x, q.placed, '#e8203c', { opacity: 0.55 });
        s += noteSvg(x, q.correctPlaced ? q.placed : p, '#1f9c74', { glow: true });
      } else if (q.placed !== null) s += noteSvg(x, q.placed, '#3a6cff');
      else if (q.hover !== null) s += noteSvg(x, q.hover, '#3a6cff', { opacity: 0.35 });
    } else {
      const color = isT ? (answered ? (q.correct ? '#1f9c74' : '#e8203c') : '#ff4f9a') : '#3a2a4d';
      s += noteSvg(x, p, color, { glow: playing });
      if (isT && q.type === 'name' && !answered) s += `<text x="${x}" y="${Math.min(yOf(p) - 60, yOf(9))}" text-anchor="middle" font-size="22" font-weight="900" fill="#ff4f9a">？</text>`;
    }
    // こたえた あとは ぜんぶの おんぷに なまえ
    if (answered) s += `<text x="${x}" y="${height - 6}" text-anchor="middle" font-size="15" font-weight="900" fill="${NOTE_COLORS[n.deg]}">${NOTE_NAMES[n.deg]}</text>`;
  });
  s += '</svg>';
  box.innerHTML = s;
  if (q.type === 'place' && !answered) bindPlace(q);
}

function bindPlace(q) {
  const svg = $('staffSvg');
  const toP = (e) => {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    const [lo, hi] = placeRange(q);
    return Math.max(lo, Math.min(hi, Math.round((Y0 - loc.y) / STEP)));
  };
  svg.addEventListener('pointermove', (e) => { const p = toP(e); if (p !== q.hover) { q.hover = p; renderStaff(); } });
  svg.addEventListener('pointerleave', () => { if (q.hover !== null) { q.hover = null; renderStaff(); } });
  svg.addEventListener('pointerdown', (e) => {
    if (S.mode !== 'question') return;
    audio();
    q.placed = toP(e);
    const d = q.placed + BASE[q.clef];
    playPitch(((d % 7) + 7) % 7, Math.floor(d / 7), 0, 0.5); // おいた おとを ならす
    renderStaff(); renderKeys();
  });
}

// =====================================================================
//  こたえる ボタン
// =====================================================================
$('noteKeys').innerHTML = NOTE_NAMES.map((nm, i) => `<button type="button" data-deg="${i}" style="--c:${NOTE_COLORS[i]}">${nm}<small>${i + 1}</small></button>`).join('');
$('noteKeys').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) chooseName(+b.dataset.deg); });
$('replayBtn').addEventListener('click', replay);
$('placeOk').addEventListener('click', () => submit());

function renderKeys() {
  const q = S.q;
  if (!q || q.subject !== 'music') return;
  $('noteKeys').hidden = q.type === 'place';
  $('placeOk').hidden = q.type !== 'place';
  $('placeOk').disabled = q.placed === null || S.mode !== 'question';
  [...$('noteKeys').children].forEach((b) => {
    const d = +b.dataset.deg;
    b.classList.toggle('right', S.mode === 'answered' && d === q.target.deg);
    b.classList.toggle('wrong', S.mode === 'answered' && d === q.chosen && d !== q.target.deg);
  });
}

// キーボードの 1〜7 で ド〜シ
function musicTypeDigit(k) { const d = +k - 1; if (d >= 0 && d < 7) chooseName(d); }
function musicErase() { const q = S.q; if (S.mode === 'question' && q && q.type === 'place') { q.placed = null; renderStaff(); renderKeys(); } }
addEventListener('keydown', (e) => {
  const q = S.q;
  if (S.mode !== 'question' || !q || q.subject !== 'music') return;
  if (e.code === 'Space') { replay(); e.preventDefault(); }
  if (q.type === 'place' && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
    const [lo, hi] = placeRange(q);
    q.placed = Math.max(lo, Math.min(hi, (q.placed ?? posOf(q, { deg: 0, oct: MUSIC_LEVELS[q.level].octs[0] })) + (e.code === 'ArrowUp' ? 1 : -1)));
    const d = q.placed + BASE[q.clef];
    playPitch(((d % 7) + 7) % 7, Math.floor(d / 7), 0, 0.4);
    renderStaff(); renderKeys(); e.preventDefault();
  }
});

function chooseName(deg) {
  const q = S.q;
  if (S.mode !== 'question' || !q || q.type === 'place') return;
  audio();
  q.chosen = deg;
  finish(deg === q.target.deg);
}

function musicSubmit() {
  const q = S.q;
  if (S.mode !== 'question' || !q || q.type !== 'place') return;
  if (q.placed === null) { $('qmsg').textContent = 'ごせんふを クリックして おんぷを おいてね'; return; }
  const d = q.placed + BASE[q.clef];
  const ok = ((d % 7) + 7) % 7 === q.target.deg;
  q.correctPlaced = ok;
  finish(ok);
}

function finish(ok) {
  const q = S.q, name = NOTE_NAMES[q.target.deg];
  q.correct = ok;
  stopPhrase();
  setMode('answered');
  renderStaff(); renderKeys();
  if (ok) {
    // せいかいの ときは もういちど フレーズを ならす
    if (q.type === 'ear') { playPitch(0, 4, 0, 0.4); playPitch(q.target.deg, q.target.oct, 0.35, 0.8); } else playPhrase(q);
    resolveAnswer(true, '', MUSIC_HOOKS.attackKinds);
  } else {
    playPitch(q.target.deg, q.target.oct, 0.1, 0.7); playPitch(q.target.deg, q.target.oct, 0.8, 0.7);
    const msg = q.type === 'name' ? `おしい！ ピンクの おんぷは「${name}」だよ`
      : q.type === 'place' ? `おしい！「${name}」は みどりの ところ だよ` : `おしい！ いまの おとは「${name}」だよ`;
    resolveAnswer(false, msg);
  }
}
