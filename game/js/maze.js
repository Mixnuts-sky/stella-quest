'use strict';
// =====================================================================
//  ぼうけんパート：ランダムな めいろ（さんすう・かんじ・おんがく きょうつう）
//  ・↑↓←→ で 1マスずつ すすむ。ゴールに ボス。とちゅうで てきが でる
//  ・たからばこ → なぞなぞ（4たく）→ せいかい で アイテム
//  ・HP（まちがえると へる。0 で ステージの さいしょから）
//  game.js の あと、kanji.js / music.js の まえに よむ
// =====================================================================

const heartSVG = (on) => `<svg viewBox="0 0 24 24" class="${on ? 'on' : ''}"><path d="M12 21 C5 15 2 12 2 8 a5 5 0 0 1 10-1 a5 5 0 0 1 10 1 c0 4-3 7-10 13z" fill="${on ? '#ff6fa8' : '#eee4f2'}" stroke="#3a2a4d" stroke-width="1.6"/></svg>`;

// ---- アイテム ----
const ITEMS = {
  herb:   { name: 'やくそう', desc: 'HPを 1 かいふく', weight: 40 },
  churu:  { name: 'にゃんこの チュール', desc: 'つぎの てきを にゃんこが たおす（ボスは だめ）', weight: 25 },
  water:  { name: 'かいふくの みず', desc: 'HPを ぜんぶ かいふく', weight: 20 },
  revive: { name: 'ふっかつの みず', desc: 'HPが 0に なっても 1で ふっかつ（もっていれば じどう）', weight: 15 },
  wing:   { name: 'きかんの はね', desc: 'つかうと まちへ もどれる（ダンジョンの なかで）', weight: 0 }, // おみせで かう（ステラクエスト）
  scale:  { name: 'ドラゴンの うろこ', desc: 'ボスの まえまで ワープ（つぎの ステージで きえる）', weight: 0 }, // レアてきが おとす
};
const ITEM_SVG = {
  herb: '<svg viewBox="0 0 40 40"><path d="M20 36 C20 26 20 18 20 8" stroke="#2f7d3a" stroke-width="3" fill="none"/><path d="M20 22 C10 22 6 14 8 8 C16 8 20 14 20 22Z" fill="#5fd06a" stroke="#2f7d3a" stroke-width="2"/><path d="M20 18 C30 18 34 10 32 4 C24 4 20 10 20 18Z" fill="#7ee08a" stroke="#2f7d3a" stroke-width="2"/></svg>',
  churu: '<svg viewBox="0 0 40 40"><rect x="13" y="4" width="14" height="30" rx="5" fill="#ffb3d1" stroke="#3a2a4d" stroke-width="2.5"/><rect x="13" y="4" width="14" height="8" rx="3" fill="#ff6fa8" stroke="#3a2a4d" stroke-width="2.5"/><path d="M15 24 l3 -3 l3 3 l3 -3" stroke="#3a2a4d" stroke-width="2" fill="none"/><circle cx="20" cy="36" r="2.5" fill="#ffd27a"/></svg>',
  water: '<svg viewBox="0 0 40 40"><rect x="15" y="3" width="10" height="7" rx="2" fill="#c9a26a" stroke="#3a2a4d" stroke-width="2"/><path d="M14 10 h12 v4 c6 3 8 8 8 13 c0 6 -6 10 -14 10 s-14 -4 -14 -10 c0 -5 2 -10 8 -13z" fill="#7fc8ff" stroke="#3a2a4d" stroke-width="2.5"/><ellipse cx="15" cy="24" rx="3" ry="5" fill="#ffffff" opacity=".7"/></svg>',
  wing: '<svg viewBox="0 0 40 40"><path d="M8 34 C8 20 16 8 32 4 C30 12 28 16 22 20 C28 20 30 22 30 24 C24 26 20 26 16 26 C20 28 22 30 22 32 C16 34 12 34 8 34Z" fill="#ffffff" stroke="#3a2a4d" stroke-width="2.5" stroke-linejoin="round"/><path d="M8 34 C14 26 20 18 30 6" stroke="#7fb2ff" stroke-width="2" fill="none"/><circle cx="30" cy="7" r="3" fill="#ffd84a"/></svg>',
  scale: '<svg viewBox="0 0 40 40"><path d="M20 3 C31 8 35 17 33 27 C31 34 25 38 20 38 C15 38 9 34 7 27 C5 17 9 8 20 3Z" fill="#6fd6a0" stroke="#3a2a4d" stroke-width="2.5"/><path d="M20 8 C26 12 28 18 27 25 M20 8 C14 12 12 18 13 25 M13 25 C16 29 24 29 27 25" stroke="#2f9c6a" stroke-width="2" fill="none"/><ellipse cx="15" cy="15" rx="3" ry="5" fill="#ffffff" opacity=".7"/></svg>',
  revive: '<svg viewBox="0 0 40 40"><rect x="15" y="3" width="10" height="7" rx="2" fill="#c9a26a" stroke="#3a2a4d" stroke-width="2"/><path d="M14 10 h12 v4 c6 3 8 8 8 13 c0 6 -6 10 -14 10 s-14 -4 -14 -10 c0 -5 2 -10 8 -13z" fill="#ffd84a" stroke="#3a2a4d" stroke-width="2.5"/><path d="M20 19 l2 5 l5 0 l-4 3 l2 5 l-5 -3 l-5 3 l2 -5 l-4 -3 l5 0z" fill="#ffffff"/></svg>',
};

// ---- なぞなぞ（こたえは choices[0]。だすときに まぜる）----
const RIDDLES = [
  { q: 'パンは パンでも たべられない パンは なーんだ？', choices: ['フライパン', 'メロンパン', 'ジャムパン', 'クリームパン'] },
  { q: 'うえは おおみず、したは おおかじ。なーんだ？', choices: ['おふろ', 'たきび', 'うみ', 'かざん'] },
  { q: 'たべると ほっと する ケーキは なーんだ？', choices: ['ホットケーキ', 'ショートケーキ', 'チーズケーキ', 'ロールケーキ'] },
  { q: 'れいぞうこの なかに いる どうぶつは なーんだ？', choices: ['ゾウ', 'ネコ', 'クマ', 'ウサギ'] },
  { q: 'さかさまに すると かるく なる どうぶつは なーんだ？', choices: ['イルカ', 'ラッコ', 'キツネ', 'タヌキ'] },
  { q: '「とり」は「とり」でも そらを とばない とりは なーんだ？', choices: ['ちりとり', 'すずめ', 'つばめ', 'からす'] },
  { q: '「いす」は「いす」でも すわれない いすは なーんだ？', choices: ['アイス', 'ソファ', 'ベンチ', 'ざいす'] },
  { q: '「ねこ」は「ねこ」でも なかない ねこは なーんだ？', choices: ['まねきねこ', 'こねこ', 'くろねこ', 'のらねこ'] },
  { q: '「はし」は「はし」でも わたれない はしは なーんだ？', choices: ['おはし', 'つりばし', 'いしばし', 'てっきょう'] },
  { q: '「たい」は「たい」でも およがない たいは なーんだ？', choices: ['ほうたい', 'まだい', 'きんめだい', 'くろだい'] },
  { q: 'みみが あるのに なにも きこえない たべものは なーんだ？', choices: ['しょくパン', 'おにぎり', 'りんご', 'うどん'] },
  { q: 'まるくて とげとげ、あきに おちてくる なーんだ？', choices: ['くり', 'どんぐり', 'みかん', 'まつぼっくり'] },
  { q: 'いつも あたまに ゆきが つもっている やまは なーんだ？', choices: ['ふじさん', 'すなやま', 'うらやま', 'おかやま'] },
  { q: 'つかえば つかうほど ちいさく なる ものは なーんだ？', choices: ['けしゴム', 'ノート', 'はさみ', 'じょうぎ'] },
  { q: 'あさは 4ほん、ひるは 2ほん。ほんとうは なんの こと？ ── あしが 4ほんで「ワン」と なく どうぶつは？', choices: ['イヌ', 'ネコ', 'ウシ', 'ブタ'] },
  { q: 'くちが ひとつで めが ひとつ、はりで ちくちく。なーんだ？', choices: ['ぬいばり', 'ハリネズミ', 'サボテン', 'ウニ'] },
  { q: 'ひっくりかえすと「かい」に なる たべものは なーんだ？', choices: ['イカ', 'タコ', 'エビ', 'カニ'] },
  { q: 'なきむしで いつも あめを ふらせる そらの ものは なーんだ？', choices: ['くも', 'たいよう', 'にじ', 'ほし'] },
];

// =====================================================================
//  がめんの ぶひん（HUD・アイテム・じゅうじキー・なぞなぞ・なんもん）
// =====================================================================
(function buildMazeUi() {
  const game = $('game');
  // HUD：ミス／ボスまで の かわりに HP と たからばこ
  document.querySelector('#hud .streaks').innerHTML =
    '<div class="row"><span class="cap">HP</span><span id="hpMarks" class="marks"></span></div>' +
    '<div class="row"><span class="cap">たから</span><span id="chestInfo" class="chest-info"></span><span id="churuBadge" class="churu-badge" hidden>にゃんこ まってる！</span></div>';
  const add = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); const el = d.firstChild; game.appendChild(el); return el; };
  add('<div id="itemBar" class="item-bar" hidden></div>');
  add(`<div id="dpad" class="dpad" hidden>
    <button type="button" data-dir="up" class="up" aria-label="うえ">▲</button>
    <button type="button" data-dir="left" class="left" aria-label="ひだり">◀</button>
    <button type="button" data-dir="right" class="right" aria-label="みぎ">▶</button>
    <button type="button" data-dir="down" class="down" aria-label="した">▼</button></div>`);
  add(`<div id="riddle" class="overlay riddle" hidden><div class="riddle-card">
    <div class="riddle-title">たからばこ を みつけた！</div>
    <div class="riddle-lead">なぞなぞに こたえると アイテムが もらえるよ</div>
    <div id="riddleQ" class="riddle-q"></div>
    <div id="riddleChoices" class="riddle-choices"></div>
    <div id="riddleResult" class="riddle-result"></div>
    <button id="riddleClose" class="big-btn" type="button" hidden>とじる</button></div></div>`);
  add(`<div id="nanmonOffer" class="overlay nanmon-offer" hidden><div class="riddle-card">
    <div class="riddle-title">でんせつの たからばこ が あらわれた！</div>
    <div class="riddle-lead">さいごに「なんもん」に ちょうせん する？<br>とけたら でんせつの ゆうしゃ！</div>
    <div class="nm-btns"><button id="nmGo" class="big-btn" type="button">ちょうせん する！</button><button id="nmSkip" class="sub-btn" type="button">しない</button></div></div></div>`);
  add('<div id="toast" class="toast" hidden></div>');

  $('itemBar').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && b.dataset.i !== undefined) useItem(+b.dataset.i); });
  $('dpad').querySelectorAll('button').forEach((b) => {
    b.addEventListener('pointerdown', (e) => { audio(); pressDir(b.dataset.dir); b.setPointerCapture(e.pointerId); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, () => releaseDir(b.dataset.dir)));
  });
  $('riddleChoices').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) answerRiddle(+b.dataset.i); });
  $('riddleClose').addEventListener('click', closeRiddle);
  $('nmGo').addEventListener('click', () => { if (S.mode === 'nanmonOffer') startNanmon(); });
  $('nmSkip').addEventListener('click', () => { if (S.mode === 'nanmonOffer') { S.nanmon = 'skip'; gameClear(); } });
})();

const baseUpdateUIMaze = updateUI;
updateUI = function () {
  baseUpdateUIMaze();
  const m = S.mode;
  $('itemBar').hidden = m !== 'walk';
  $('dpad').hidden = m !== 'walk';
  $('riddle').hidden = m !== 'riddle';
  $('nanmonOffer').hidden = m !== 'nanmonOffer';
};

let toastTimer = null;
function showToast(text, sec = 2.2) {
  const t = $('toast');
  t.textContent = text; t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, sec * 1000);
}

function renderMazeHud() {
  $('hpMarks').innerHTML = Array.from({ length: CONFIG.maxHp }, (_, i) => heartSVG(i < S.hp)).join('');
  const M = S.maze;
  $('chestInfo').textContent = M ? `${M.chests.filter((c) => c.opened).length} / ${M.chests.length}` : '';
  $('churuBadge').hidden = !S.churu;
  renderItems();
}

function renderItems() {
  const bar = $('itemBar');
  let html = '';
  for (let i = 0; i < CONFIG.maxItems; i++) {
    const id = S.items[i];
    html += id
      ? `<button type="button" class="slot" data-i="${i}" title="${ITEMS[id].desc}"><span class="key">${i + 1}</span>${ITEM_SVG[id]}<span class="nm">${ITEMS[id].name}</span></button>`
      : `<span class="slot empty"><span class="key">${i + 1}</span></span>`;
  }
  bar.innerHTML = `<span class="bar-cap">もちもの</span>${html}`;
}

// =====================================================================
//  アイテム
// =====================================================================
function randomItem() {
  const ids = Object.keys(ITEMS);
  let r = Math.random() * ids.reduce((s, k) => s + ITEMS[k].weight, 0);
  for (const k of ids) { r -= ITEMS[k].weight; if (r <= 0) return k; }
  return 'herb';
}

function heroScreenPos() {
  if (inMaze() && S.maze) return S.maze.heroScreen || { x: W / 2, y: H / 2 };
  return { x: HERO_X(), y: GROUND() - 120 };
}
function healEffect() {
  const p = heroScreenPos();
  SFX.heal();
  for (let i = 0; i < 14; i++) spawn('heart', p.x + rnd(-30, 30), p.y + rnd(-40, 10), { vx: rnd(-80, 80), vy: rnd(-260, -80), color: '#ff6fa8' });
}

function useItem(i) {
  const id = S.items[i];
  if (!id || S.mode !== 'walk') return;
  if (id === 'herb' || id === 'water') {
    if (S.hp >= CONFIG.maxHp) { showToast('HPは まんたん だよ'); return; }
    S.hp = id === 'herb' ? Math.min(CONFIG.maxHp, S.hp + 1) : CONFIG.maxHp;
    S.items.splice(i, 1);
    healEffect();
    showToast(id === 'herb' ? 'やくそうで HPが 1 かいふく！' : 'かいふくの みずで HPが まんたん！');
  } else if (id === 'churu') {
    if (S.churu) { showToast('にゃんこは もう まってるよ'); return; }
    S.items.splice(i, 1);
    S.churu = true;
    SFX.meow();
    showToast('チュールを あげた！ つぎの てきは にゃんこに おまかせ！');
  } else if (id === 'scale') {
    S.items.splice(i, 1);
    renderHud();
    warpToBoss();
    return;
  } else if (id === 'revive') {
    showToast('ふっかつの みずは HPが 0に なったら じどうで つかうよ');
    return;
  }
  renderHud();
}

// まちがえた とき：HPが 1 へる。0 に なったら ふっかつの みず
function damageHero() {
  if (S.hp <= 0) return;
  S.hp--;
  if (S.hp <= 0) {
    const r = S.items.indexOf('revive');
    if (r >= 0) {
      S.items.splice(r, 1);
      S.hp = 1;
      later(0.5, () => { healEffect(); showToast('ふっかつの みずで ふっかつ！'); });
    }
  }
  renderHud();
}

// =====================================================================
//  めいろを つくる
// =====================================================================
function buildStage(level) {
  const n = CONFIG.mazeSize(level), TW = n * 2 + 1, TH = n * 2 + 1;
  const grid = new Uint8Array(TW * TH); // 0: かべ 1: みち
  const at = (x, y) => y * TW + x;
  // あなほり ほうしき（いきどまりの ある めいろ）
  const seen = new Uint8Array(n * n);
  const stack = [[0, 0]];
  seen[0] = 1; grid[at(1, 1)] = 1;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
      const nx = cx + dx, ny = cy + dy;
      return nx >= 0 && ny >= 0 && nx < n && ny < n && !seen[ny * n + nx];
    });
    if (!nb.length) { stack.pop(); continue; }
    const [dx, dy] = pick(nb), nx = cx + dx, ny = cy + dy;
    grid[at(cx * 2 + 1 + dx, cy * 2 + 1 + dy)] = 1;
    grid[at(nx * 2 + 1, ny * 2 + 1)] = 1;
    seen[ny * n + nx] = 1;
    stack.push([nx, ny]);
  }
  // すこし かべを こわして まわりみちを つくる（まよいすぎない ように）
  for (let k = 0; k < Math.floor(n * n * 0.06); k++) {
    const x = rnd(1, TW - 2), y = rnd(1, TH - 2);
    if (grid[at(x, y)]) continue;
    if ((x % 2 === 0 && y % 2 === 1 && grid[at(x - 1, y)] && grid[at(x + 1, y)]) || (x % 2 === 1 && y % 2 === 0 && grid[at(x, y - 1)] && grid[at(x, y + 1)])) grid[at(x, y)] = 1;
  }
  // ゴールは はんたいがわ（みぎした）の すみの なかで、みちのりが いちばん とおい ところ
  const dist = bfs(grid, TW, TH, { x: 1, y: 1 });
  let goal = { x: TW - 2, y: TH - 2 }, far = -1;
  for (let y = 1; y < TH; y += 2) {
    for (let x = 1; x < TW; x += 2) {
      if (x < TW * 0.6 || y < TH * 0.6) continue;
      if (dist[at(x, y)] > far) { far = dist[at(x, y)]; goal = { x, y }; }
    }
  }
  // たからばこは いきどまりに
  const deadEnds = [];
  for (let y = 1; y < TH; y += 2) {
    for (let x = 1; x < TW; x += 2) {
      if ((x === 1 && y === 1) || (x === goal.x && y === goal.y)) continue;
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => grid[at(x + dx, y + dy)]).length;
      if (open === 1) deadEnds.push({ x, y });
    }
  }
  deadEnds.sort(() => Math.random() - 0.5);
  const chests = deadEnds.slice(0, Math.min(3 + Math.floor(level / 2), 6)).map((c) => ({ ...c, opened: false, openT: 0 }));
  // おとしあなの へや（4×4 の ひろい へや。みえない あなが あるけど よけて とおれる）
  const rooms = [], pits = [];
  const roomCount = Math.min(1 + Math.floor(level / 2), 3);
  // CONFIG.pitOnPath（ステラクエスト）：スタート → ボス の みちの まんなか に へやを 1つ おく
  if (CONFIG.pitOnPath) {
    const path = [];
    for (let c = { ...goal }; c; ) {
      path.push(c);
      const d = dist[at(c.x, c.y)];
      if (d <= 0) break;
      c = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })).find((q) => dist[at(q.x, q.y)] === d - 1);
    }
    for (const k of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      const c = path[Math.floor(path.length * k)];
      const odd = (v, max) => Math.max(1, Math.min(max, (v % 2 ? v : v - 1) - 2 + rnd(0, 1) * 2));
      const r = { x: odd(c.x, TW - 6), y: odd(c.y, TH - 6), w: 4, h: 4, onPath: true };
      const inside = (p, pad = 0) => p.x >= r.x - pad && p.x < r.x + r.w + pad && p.y >= r.y - pad && p.y < r.y + r.h + pad;
      if (inside(c) && !inside({ x: 1, y: 1 }, 2) && !inside(goal, 2) && r.x + r.w < TW - 1 && r.y + r.h < TH - 1) { rooms.push(r); break; }
    }
  }
  for (let tries = 0; rooms.length < roomCount && tries < 200; tries++) {
    const rx = rnd(1, Math.floor((TW - 6) / 2)) * 2 + 1, ry = rnd(1, Math.floor((TH - 6) / 2)) * 2 + 1; // 4×4 の ひだりうえ（き すうの マス）
    const r = { x: rx, y: ry, w: 4, h: 4 };
    const inside = (p, pad = 0) => p.x >= r.x - pad && p.x < r.x + r.w + pad && p.y >= r.y - pad && p.y < r.y + r.h + pad;
    if (r.x + r.w >= TW - 1 || r.y + r.h >= TH - 1) continue;
    if (inside({ x: 1, y: 1 }, 2) || inside(goal, 2)) continue;
    if (rooms.some((o) => r.x < o.x + o.w + 2 && r.x + r.w + 2 > o.x && r.y < o.y + o.h + 2 && r.y + r.h + 2 > o.y)) continue;
    rooms.push(r);
  }
  if (CONFIG.pitOnPath && !rooms.some((r) => r.onPath) && (buildStage.retry = (buildStage.retry || 0) + 1) < 20) return buildStage(level);
  rooms.forEach((r) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[at(x, y)] = 1; });
  // みちの へや を とおらない まわりみち を ふさぐ（ぜんぶの みちは へや を とおれば いける まま）
  const pathRoom = rooms.find((r) => r.onPath);
  if (pathRoom) {
    const inRoom = (x, y) => x >= pathRoom.x && x < pathRoom.x + pathRoom.w && y >= pathRoom.y && y < pathRoom.y + pathRoom.h;
    const allReachable = (g) => { const d = bfs(g, TW, TH, { x: 1, y: 1 }); for (let i = 0; i < g.length; i++) if (g[i] && d[i] < 0) return false; return true; };
    for (let guard = 0; guard < 60; guard++) {
      const g2 = Uint8Array.from(grid);
      for (let y = pathRoom.y; y < pathRoom.y + pathRoom.h; y++) for (let x = pathRoom.x; x < pathRoom.x + pathRoom.w; x++) g2[at(x, y)] = 0;
      const d2 = bfs(g2, TW, TH, { x: 1, y: 1 });
      if (d2[at(goal.x, goal.y)] < 0) break; // もう へや を とおらないと いけない
      // へや を よけた みち の うえ の「つなぎめ」（かべ の あった ところ）を ふさいでみる
      const way = [];
      for (let c = { ...goal }; c; ) {
        way.push(c);
        const d = d2[at(c.x, c.y)];
        if (d <= 0) break;
        c = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })).find((q) => d2[at(q.x, q.y)] === d - 1);
      }
      const links = way.filter((c) => (c.x + c.y) % 2 === 1 && !inRoom(c.x, c.y)).sort(() => Math.random() - 0.5);
      let cut = false;
      for (const c of links) {
        grid[at(c.x, c.y)] = 0;
        if (allReachable(grid)) { cut = true; break; }
        grid[at(c.x, c.y)] = 1;
      }
      if (!cut) break;
    }
    // それでも まわりみち が のこったら めいろ を つくりなおす
    const g3 = Uint8Array.from(grid);
    for (let y = pathRoom.y; y < pathRoom.y + pathRoom.h; y++) for (let x = pathRoom.x; x < pathRoom.x + pathRoom.w; x++) g3[at(x, y)] = 0;
    if (bfs(g3, TW, TH, { x: 1, y: 1 })[at(goal.x, goal.y)] >= 0 && (buildStage.retry = (buildStage.retry || 0) + 1) < 20) return buildStage(level);
  }
  buildStage.retry = 0;
  const blocked = new Set();
  const reachAll = (extra) => { // あなを よけて スタートから ゴールと たからばこに いけるか
    const g2 = Uint8Array.from(grid);
    for (const k of blocked) g2[k] = 0;
    g2[extra] = 0;
    const d2 = bfs(g2, TW, TH, { x: 1, y: 1 });
    return d2[at(goal.x, goal.y)] >= 0 && deadEnds.every((c) => d2[at(c.x, c.y)] >= 0);
  };
  rooms.forEach((r) => {
    const want = Math.min(2 + Math.floor(level / 2), 5);
    const cand = [];
    // へや の いりぐち（そと の みち と つながる ところ）と その となり には あな を おかない
    const inR = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    const doors = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inR(x + dx, y + dy) && grid[at(x + dx, y + dy)])) doors.push({ x, y });
    }
    const nearDoor = (x, y) => doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (!nearDoor(x, y)) cand.push({ x, y });
    if (cand.length < 3) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (!doors.some((d) => d.x === x && d.y === y) && !cand.some((c) => c.x === x && c.y === y)) cand.push({ x, y }); // いりぐち が おおい へや
    cand.sort(() => Math.random() - 0.5);
    let n = 0;
    for (const c of cand) {
      if (n >= want) break;
      const k = at(c.x, c.y);
      if (!reachAll(k)) continue;
      blocked.add(k); pits.push({ ...c, found: false }); n++;
    }
  });
  const pitKeys = new Set(pits.map((p) => at(p.x, p.y)));
  const safeChests = chests.filter((c) => !pitKeys.has(at(c.x, c.y)));
  S.maze = { TW, TH, grid, start: { x: 1, y: 1 }, goal, chests: safeChests, rooms, pits, fog: new Uint8Array(TW * TH), visited: new Uint8Array(TW * TH), heroScreen: null };
  S.pos = { x: 1, y: 1 }; S.from = { x: 1, y: 1 }; S.moveT = 1; S.stepsSinceBattle = 0; S.facing = 1; S.mazeLock = 0; S.fall = null;
  S.maze.visited[TW + 1] = 1;
  reveal();
}

function bfs(grid, TW, TH, from) {
  const dist = new Int32Array(TW * TH).fill(-1);
  const q = [from]; dist[from.y * TW + from.x] = 0;
  for (let h = 0; h < q.length; h++) {
    const { x, y } = q[h];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = ny * TW + nx;
      if (nx < 0 || ny < 0 || nx >= TW || ny >= TH || !grid[k] || dist[k] >= 0) continue;
      dist[k] = dist[y * TW + x] + 1; q.push({ x: nx, y: ny });
    }
  }
  return dist;
}

// まわりを みえる ように する
function reveal() {
  const M = S.maze;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = S.pos.x + dx, y = S.pos.y + dy;
      if (x >= 0 && y >= 0 && x < M.TW && y < M.TH && dx * dx + dy * dy <= 5) M.fog[y * M.TW + x] = 1;
    }
  }
}

const inMaze = () => !!S.maze && ['walk', 'riddle', 'bosswarn', 'levelfx'].includes(S.mode) && !S.monster;

// =====================================================================
//  うごく
// =====================================================================
const KEY_DIR = {
  ArrowUp: 'up', KeyW: 'up', Numpad8: 'up', ArrowDown: 'down', KeyS: 'down', Numpad2: 'down',
  ArrowLeft: 'left', KeyA: 'left', Numpad4: 'left', ArrowRight: 'right', KeyD: 'right', Numpad6: 'right',
};
const DIR_VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const heldDirs = [];
const pressDir = (d) => { const i = heldDirs.indexOf(d); if (i >= 0) heldDirs.splice(i, 1); heldDirs.push(d); };
const releaseDir = (d) => { const i = heldDirs.indexOf(d); if (i >= 0) heldDirs.splice(i, 1); };

function mazeKeyDown(e) {
  const enter = (e.key === 'Enter' || e.code === 'NumpadEnter') && !e.repeat;
  if (S.mode === 'walk') {
    const d = KEY_DIR[e.code];
    if (d) { pressDir(d); e.preventDefault(); return; }
    const m = e.code.match(/^Digit([1-5])$/);
    if (m && !e.repeat) { useItem(+m[1] - 1); e.preventDefault(); }
  } else if (S.mode === 'riddle') {
    const m = e.code.match(/^(Digit|Numpad)([1-4])$/);
    if (m && !e.repeat && !S.riddle.done) { answerRiddle(+m[2] - 1); e.preventDefault(); }
    else if (enter && S.riddle.done) { closeRiddle(); e.preventDefault(); }
  } else if (S.mode === 'nanmonOffer') {
    if (enter) { startNanmon(); e.preventDefault(); }
    if (e.code === 'Escape') { S.nanmon = 'skip'; gameClear(); e.preventDefault(); }
  }
}
function mazeKeyUp(e) {
  if (!e) { heldDirs.length = 0; return; }
  const d = KEY_DIR[e.code];
  if (d) releaseDir(d);
}

function mazeUpdate(dt) {
  const M = S.maze;
  if (!M) return;
  M.chests.forEach((c) => { if (c.opened && c.openT < 1) c.openT = Math.min(1, c.openT + dt * 3); });
  if (S.mazeLock > 0) { S.mazeLock -= dt; return; }
  if (S.moveT < 1) {
    S.moveT = Math.min(1, S.moveT + dt / CONFIG.stepTime);
    if (S.moveT >= 1) arrive();
    return;
  }
  const d = heldDirs[heldDirs.length - 1];
  if (!d) return;
  const [dx, dy] = DIR_VEC[d], nx = S.pos.x + dx, ny = S.pos.y + dy;
  if (dx) S.facing = dx;
  if (!M.grid[ny * M.TW + nx]) return;
  S.from = { ...S.pos }; S.pos = { x: nx, y: ny }; S.moveT = 0;
  SFX.step();
}

function arrive() {
  const M = S.maze;
  reveal();
  if (S.pos.x === M.goal.x && S.pos.y === M.goal.y) { heldDirs.length = 0; encounter({ boss: true }); return; }
  const pit = M.pits.find((p) => !p.found && p.x === S.pos.x && p.y === S.pos.y);
  if (pit) { heldDirs.length = 0; fallIntoPit(pit); return; }
  const chest = M.chests.find((c) => !c.opened && c.x === S.pos.x && c.y === S.pos.y);
  if (chest) { heldDirs.length = 0; openChest(chest); return; }
  const k = S.pos.y * M.TW + S.pos.x;
  const been = M.visited[k];
  M.visited[k] = 1;
  S.stepsSinceBattle++;
  // いちど とおった みちは てきが でる かくりつ はんぶん
  const chance = CONFIG.encounterChance * (been ? 0.5 : 1);
  if (S.stepsSinceBattle >= CONFIG.encounterMinSteps && Math.random() < chance) {
    S.stepsSinceBattle = 0;
    heldDirs.length = 0;
    // ドラゴンの うろこを もっている あいだは レアてきは でない
    encounter({ rare: !S.items.includes('scale') && Math.random() < CONFIG.rareRate });
  }
}

// レアてきを たおしたら ドラゴンの うろこ（もちものが いっぱいなら すぐ ワープ）
function gotDragonScale() {
  if (S.items.length >= CONFIG.maxItems) { warpToBoss(); return; }
  S.items.push('scale');
  renderHud();
  SFX.star();
  showToast('ドラゴンの うろこを てに いれた！ つかうと ボスまで ワープ！', 3);
}

// おとしあなに おちた：アイテムを 1つ おとす。なければ HP が はんぶん
function fallIntoPit(pit) {
  pit.found = true;
  S.mazeLock = 1.3;
  S.fall = { t: 0, pit };
  S.shake = 0.5;
  SFX.bad(); note(600, 0, 0.6, { type: 'sine', vol: 0.12, slide: 0.25 }); // ひゅ〜
  later(0.9, () => {
    if (S.items.length) {
      const i = rnd(0, S.items.length - 1), id = S.items[i];
      S.items.splice(i, 1);
      showToast(`おとしあな！「${ITEMS[id].name}」を おとしちゃった…`, 2.8);
    } else {
      const before = S.hp;
      S.hp = Math.max(1, Math.floor(S.hp / 2));
      showToast(before > S.hp ? `おとしあな！ HPが はんぶんに なっちゃった…` : 'おとしあな！ あぶなかった…', 2.8);
    }
    renderHud();
    // あなから でて ひとつ まえの マスへ
    S.pos = { ...S.from }; S.moveT = 1; S.fall = null;
  });
}

// ボスの まえへ ワープ
function warpToBoss() {
  const M = S.maze;
  if (!M) return;
  heldDirs.length = 0;
  showToast('ドラゴンの うろこの ちからで ボスの まえへ ワープ！', 2.4);
  SFX.star();
  S.mazeLock = 1.6;
  later(0.8, () => {
    S.flash = 0.9; S.flashColor = '255,240,180';
    S.pos = { ...M.goal }; S.from = { ...M.goal }; S.moveT = 1;
    reveal();
  });
  later(1.7, () => { if (S.mode === 'walk') encounter({ boss: true }); });
}

// =====================================================================
//  たからばこ と なぞなぞ
// =====================================================================
let riddleBag = [];
function openChest(chest) {
  chest.opened = true;
  SFX.encounter();
  if (!riddleBag.length) riddleBag = RIDDLES.map((_, i) => i).sort(() => Math.random() - 0.5);
  const r = RIDDLES[riddleBag.pop()];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  S.riddle = { q: r.q, choices: order.map((i) => r.choices[i]), answer: order.indexOf(0), done: false };
  $('riddleQ').textContent = r.q;
  $('riddleChoices').innerHTML = S.riddle.choices.map((c, i) => `<button type="button" data-i="${i}"><span class="k">${i + 1}</span>${c}</button>`).join('');
  $('riddleResult').innerHTML = '';
  $('riddleClose').hidden = true;
  setMode('riddle');
  renderHud();
}

function answerRiddle(i) {
  const R = S.riddle;
  if (!R || R.done) return;
  R.done = true;
  const ok = i === R.answer;
  [...$('riddleChoices').children].forEach((b, k) => { b.disabled = true; b.classList.toggle('right', k === R.answer); b.classList.toggle('wrong', k === i && !ok); });
  if (ok) {
    const id = randomItem();
    SFX.good();
    if (S.items.length < CONFIG.maxItems) {
      S.items.push(id);
      $('riddleResult').innerHTML = `<span class="ok">せいかい！</span><span class="get">${ITEM_SVG[id]}<b>${ITEMS[id].name}</b> を てに いれた！</span><small>${ITEMS[id].desc}</small>`;
    } else {
      $('riddleResult').innerHTML = `<span class="ok">せいかい！</span><span class="get">${ITEM_SVG[id]}<b>${ITEMS[id].name}</b> … でも もちものが いっぱい！</span>`;
    }
  } else {
    SFX.bad();
    $('riddleResult').innerHTML = `<span class="ng">ざんねん！ こたえは「${R.choices[R.answer]}」</span><small>たからばこは からっぽに なっちゃった</small>`;
  }
  $('riddleClose').hidden = false;
  renderHud();
}

function closeRiddle() {
  if (S.mode !== 'riddle') return;
  S.riddle = null;
  setMode('walk');
}

// =====================================================================
//  えがく
// =====================================================================
function drawChest(x, y, size, open, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 40, size / 40);
  ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = INK;
  if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = 24; }
  const wood = opts.gold ? '#f2b630' : '#b0703c', band = opts.gold ? '#fff2a8' : '#ffd84a';
  // はこ
  ctx.fillStyle = wood; ctx.fillRect(-18, -14, 36, 22); ctx.strokeRect(-18, -14, 36, 22);
  ctx.shadowBlur = 0;
  // ふた
  ctx.save();
  if (open) { ctx.translate(0, -14); ctx.rotate(-0.9 * open); ctx.translate(0, 14); }
  ctx.fillStyle = wood;
  ctx.beginPath(); ctx.moveTo(-18, -14); ctx.quadraticCurveTo(0, -30, 18, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = band; ctx.fillRect(-3, -22, 6, 9); ctx.strokeRect(-3, -22, 6, 9);
  ctx.restore();
  ctx.fillStyle = band; ctx.fillRect(-3, -14, 6, 10); ctx.strokeRect(-3, -14, 6, 10);
  if (opts.sealed) {
    ctx.strokeStyle = '#7a7f8c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-18, -12); ctx.lineTo(18, 6); ctx.moveTo(18, -12); ctx.lineTo(-18, 6); ctx.stroke();
  }
  ctx.restore();
}

// でんせつの たからばこ（なんもん）
function drawBigChest(m) {
  const gy = GROUND();
  const y = m.landed ? gy : m.y;
  const pulse = 1 + Math.sin(S.t * 3) * 0.03;
  ctx.save();
  ctx.fillStyle = 'rgba(30,10,50,.22)';
  ctx.beginPath(); ctx.ellipse(m.x, gy + 8, 90, 14, 0, 0, 7); ctx.fill();
  if (m.state === 'open') {
    // ひかりの はしら
    const g = ctx.createLinearGradient(0, y - 400, 0, y);
    g.addColorStop(0, 'rgba(255,240,160,0)'); g.addColorStop(1, 'rgba(255,240,160,.7)');
    ctx.fillStyle = g; ctx.fillRect(m.x - 70, y - 400, 140, 360);
    if (Math.random() < 0.5) spawn('twinkle', m.x + rnd(-80, 80), y - rnd(60, 300), { color: pick(['#fff3a0', '#ffffff', '#ffb3e0']), size: rnd(8, 16) });
  }
  ctx.restore();
  drawChest(m.x, y - 10, 170 * pulse, m.state === 'open' ? Math.min(1, m.t * 2) : 0, { gold: true, glow: m.state === 'sealed' ? null : 'rgba(255,220,80,.95)', sealed: m.state === 'sealed' });
}

function drawMaze() {
  const M = S.maze, th = THEMES[S.level];
  const T = 52;
  const k = S.moveT < 1 ? (1 - Math.cos(S.moveT * Math.PI)) / 2 : 1;
  const hx = S.from.x + (S.pos.x - S.from.x) * k, hy = S.from.y + (S.pos.y - S.from.y) * k;
  const mapW = M.TW * T, mapH = M.TH * T;
  let camX = hx * T + T / 2 - W / 2, camY = hy * T + T / 2 - H / 2 - 20;
  camX = mapW < W ? (mapW - W) / 2 : Math.max(0, Math.min(mapW - W, camX));
  camY = mapH < H - 60 ? (mapH - H) / 2 - 20 : Math.max(-70, Math.min(mapH - H + 90, camY));

  ctx.fillStyle = shade(th.far, -50); ctx.fillRect(-30, -30, W + 60, H + 60);
  ctx.save();
  ctx.translate(-camX, -camY);
  const x0 = Math.max(0, Math.floor(camX / T) - 1), x1 = Math.min(M.TW - 1, Math.ceil((camX + W) / T) + 1);
  const y0 = Math.max(0, Math.floor(camY / T) - 1), y1 = Math.min(M.TH - 1, Math.ceil((camY + H) / T) + 1);
  const wallTop = th.near, wallSide = shade(th.near, -45), floor = th.path;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x * T, py = y * T, idx = y * M.TW + x;
      if (M.grid[idx]) {
        ctx.fillStyle = floor; ctx.fillRect(px, py, T + 1, T + 1);
        const hsh = hash(idx);
        if (hsh < 0.18) { // ちいさな はな
          ctx.fillStyle = th.accent[Math.floor(hash(idx + 7) * th.accent.length)];
          ctx.beginPath(); ctx.arc(px + 10 + hash(idx + 3) * (T - 20), py + 10 + hash(idx + 5) * (T - 20), 3.5, 0, 7); ctx.fill();
        }
      } else {
        // かべ（いけがき みたいに）
        ctx.fillStyle = wallSide; ctx.fillRect(px, py + T * 0.55, T + 1, T * 0.45 + 1);
        ctx.fillStyle = wallTop;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px + 1, py - 6, T - 2, T * 0.62 + 6, 10) : ctx.rect(px + 1, py - 6, T - 2, T * 0.62 + 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath(); ctx.arc(px + T * 0.3, py + 4, 6, 0, 7); ctx.arc(px + T * 0.65, py + 2, 5, 0, 7); ctx.fill();
      }
    }
  }
  // おとしあなの へや（ゆかが タイル）と みつけた あな
  M.rooms.forEach((r) => {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        ctx.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,.18)' : 'rgba(60,30,90,.10)';
        ctx.fillRect(x * T + 2, y * T + 2, T - 4, T - 4);
      }
    }
    ctx.strokeStyle = 'rgba(60,30,90,.35)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    ctx.strokeRect(r.x * T + 3, r.y * T + 3, r.w * T - 6, r.h * T - 6); ctx.setLineDash([]);
  });
  M.pits.forEach((p) => {
    if (!p.found) return;
    const cx = p.x * T + T / 2, cy = p.y * T + T / 2;
    ctx.fillStyle = '#1a0f2a'; ctx.beginPath(); ctx.ellipse(cx, cy + 3, T * 0.4, T * 0.3, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 3; ctx.stroke();
  });
  // スタート
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(M.start.x * T + 14, M.start.y * T + T - 8); ctx.lineTo(M.start.x * T + 14, M.start.y * T + 8); ctx.stroke();
  ctx.fillStyle = '#ff6fa8'; ctx.beginPath(); ctx.moveTo(M.start.x * T + 14, M.start.y * T + 8); ctx.lineTo(M.start.x * T + 38, M.start.y * T + 15); ctx.lineTo(M.start.x * T + 14, M.start.y * T + 22); ctx.closePath(); ctx.fill(); ctx.stroke();
  // たからばこ
  M.chests.forEach((c) => drawChest(c.x * T + T / 2, c.y * T + T * 0.72, T * 0.8, c.openT, { glow: c.opened ? null : 'rgba(255,215,60,.8)' }));
  // ゴール（ボスの おしろ）
  ctx.save();
  ctx.translate(M.goal.x * T + T / 2, M.goal.y * T + T * 0.95);
  ctx.scale(0.17, 0.17);
  drawCastle(0, 0, BOSS_STAGES[S.level], S.level >= CONFIG.maxLevel);
  ctx.restore();
  outlinedText('ボス', M.goal.x * T + T / 2, M.goal.y * T - T * 0.95, 18, '#ff4f6a');
  // きり（まだ いっていない ところ）
  ctx.fillStyle = 'rgba(16,10,34,.88)';
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!M.fog[y * M.TW + x]) ctx.fillRect(x * T - 0.5, y * T - 0.5, T + 1, T + 1);
  // しゅじんこう
  let bob = S.moveT < 1 ? Math.abs(Math.sin(S.moveT * Math.PI)) * 6 : Math.sin(S.t * 3) * 1.5;
  let fallScale = 1;
  if (S.fall) { S.fall.t += 1 / 60; const k2 = Math.min(1, S.fall.t / 0.6); fallScale = 1 - k2 * 0.8; bob = -k2 * 20; }
  const sx = hx * T + T / 2, sy = hy * T + T * 0.92 - bob;
  ctx.fillStyle = 'rgba(30,10,50,.25)'; ctx.beginPath(); ctx.ellipse(hx * T + T / 2, hy * T + T * 0.9, T * 0.32, 6, 0, 0, 7); ctx.fill();
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale((S.facing < 0 ? -1 : 1) * fallScale, fallScale);
  const hh = T * 1.55, spr = SPR.hero;
  if (spr) ctx.drawImage(spr.canvas, -hh * spr.w / spr.h / 2, -hh, hh * spr.w / spr.h, hh);
  else if (typeof window.drawHeroPlaceholder === 'function') window.drawHeroPlaceholder(hh);
  ctx.restore();
  ctx.restore();
  M.heroScreen = { x: sx - camX, y: sy - camY - T * 0.6 };
  drawMinimap();
}

function drawMinimap() {
  const M = S.maze;
  const cell = Math.min(5, 150 / M.TW), w = M.TW * cell, h = M.TH * cell;
  const x = W - w - 14, y = 66;
  ctx.save();
  ctx.fillStyle = 'rgba(20,12,40,.75)';
  ctx.strokeStyle = 'rgba(255,250,243,.9)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 6, y - 6, w + 12, h + 12, 8) : ctx.rect(x - 6, y - 6, w + 12, h + 12); ctx.fill(); ctx.stroke();
  for (let ty = 0; ty < M.TH; ty++) {
    for (let tx = 0; tx < M.TW; tx++) {
      const k = ty * M.TW + tx;
      if (!M.fog[k] || !M.grid[k]) continue;
      ctx.fillStyle = '#e9e2f2'; ctx.fillRect(x + tx * cell, y + ty * cell, cell + 0.3, cell + 0.3);
    }
  }
  M.chests.forEach((c) => { if (M.fog[c.y * M.TW + c.x] && !c.opened) { ctx.fillStyle = '#ffc93c'; ctx.fillRect(x + c.x * cell - 1, y + c.y * cell - 1, cell + 2, cell + 2); } });
  M.pits.forEach((p) => { if (p.found) { ctx.fillStyle = '#ff5c8a'; ctx.fillRect(x + p.x * cell, y + p.y * cell, cell, cell); } });
  ctx.fillStyle = '#ff4f6a';
  drawStar(x + M.goal.x * cell + cell / 2, y + M.goal.y * cell + cell / 2, cell * 1.8, '#ff4f6a');
  if (Math.sin(S.t * 8) > -0.3) { ctx.fillStyle = '#4ee0b0'; ctx.beginPath(); ctx.arc(x + S.pos.x * cell + cell / 2, y + S.pos.y * cell + cell / 2, cell * 0.9 + 1, 0, 7); ctx.fill(); }
  ctx.restore();
}

// =====================================================================
//  テスト よう：めいろの みちを しらべる
// =====================================================================
window.mazeTest = {
  // いまの ばしょ から ゴール／まだ あけていない たからばこ までの すすみかた（'up' など の れつ）
  pathTo(kind = 'goal', avoidPits = true) {
    const M = S.maze;
    const targets = kind === 'goal' ? [M.goal] : M.chests.filter((c) => !c.opened);
    const prev = new Map(), q = [S.pos], key = (p) => p.y * M.TW + p.x;
    prev.set(key(S.pos), null);
    for (let h = 0; h < q.length; h++) {
      const p = q[h];
      if (targets.some((t) => t.x === p.x && t.y === p.y)) {
        const dirs = [];
        let cur = p;
        while (prev.get(key(cur))) { const [from, d] = prev.get(key(cur)); dirs.unshift(d); cur = from; }
        return dirs;
      }
      for (const [d, [dx, dy]] of Object.entries(DIR_VEC)) {
        const np = { x: p.x + dx, y: p.y + dy };
        if (!M.grid[key(np)] || prev.has(key(np))) continue;
        if (avoidPits && M.pits.some((pt) => !pt.found && pt.x === np.x && pt.y === np.y)) continue;
        if (kind === 'chest' && np.x === M.goal.x && np.y === M.goal.y) continue; // ゴールを とおらない
        prev.set(key(np), [p, d]); q.push(np);
      }
    }
    return [];
  },
  riddleAnswer: () => S.riddle && S.riddle.answer,
};
