'use strict';
// =====================================================================
//  ステラクエスト：おうち の ひと の がめん（タイトル画面）
//  ・タイトル の「👪 おうち の ひと」（だれ でも ひらける）→ セーブ スロット を えらんで みる
//  ・かもく ごと の せいかい りつ（ぜんぶ・さいきん 7日）、ひ ごと の かず、にがて、すすみ ぐあい、ずかん
//  ・きろく は ゲーム の なか（stella_records.js）で ST.data.log / weakQ / weak / zukan に のこす
//  しよう：docs/GAME_SPEC.md 15.6
// =====================================================================
(function parentScreen() {
  const SUBJ = [['math', 'さんすう'], ['kanji', 'かんじ'], ['english', 'えいご'], ['music', 'おんがく']];
  const css = `
  .pa-btn { position: fixed; left: 12px; bottom: 12px; z-index: 20; font-family: var(--body); font-weight: 900; font-size: 14px; color: var(--ink); background: rgba(255,250,243,.92); border: 3px solid var(--ink); border-radius: 999px; padding: 6px 14px; cursor: pointer; box-shadow: 0 3px 0 rgba(30,10,60,.4); }
  .pa-over { position: fixed; inset: 0; z-index: 30; background: rgba(20,10,40,.6); display: flex; align-items: center; justify-content: center; }
  .pa-over[hidden] { display: none; }
  .pa-card { width: min(96vw, 900px); max-height: 94vh; overflow-y: auto; box-sizing: border-box; background: #fffaf3; border: 4px solid var(--ink); border-radius: 22px; padding: 14px 20px 18px; font-family: var(--body); color: var(--ink); }
  .pa-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .pa-head h2 { margin: 0; font-family: var(--display); font-size: 24px; color: #8a5cd1; }
  .pa-tabs { display: flex; gap: 8px; }
  .pa-tabs button, .pa-close { font-family: var(--body); font-weight: 900; font-size: 14px; border: 3px solid var(--ink); border-radius: 999px; padding: 4px 12px; background: #fff; cursor: pointer; }
  .pa-tabs button.on { background: #ffd84a; }
  .pa-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-top: 12px; }
  .pa-box { border: 2px solid #d9cfe3; border-radius: 14px; padding: 10px 12px; background: #fff; }
  .pa-box h3 { margin: 0 0 6px; font-size: 15px; color: #8a5cd1; }
  .pa-row { display: grid; grid-template-columns: 70px 1fr 92px; gap: 8px; align-items: center; font-size: 13px; font-weight: 700; margin: 4px 0; }
  .pa-bar { height: 12px; border-radius: 999px; background: #efe6f5; overflow: hidden; }
  .pa-bar i { display: block; height: 100%; background: linear-gradient(90deg, #7fe0c0, #4ecbff); }
  .pa-bar.low i { background: linear-gradient(90deg, #ffb3d1, #ff6fa8); }
  .pa-days { width: 100%; border-collapse: collapse; font-size: 12px; }
  .pa-days td, .pa-days th { border-bottom: 1px solid #eee4f2; padding: 3px 4px; text-align: center; }
  .pa-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .pa-chips span { background: #ffe8f1; border: 2px solid #ffb3d1; border-radius: 10px; padding: 2px 8px; font-weight: 900; font-size: 14px; }
  .pa-kv { font-size: 13px; font-weight: 700; line-height: 1.8; }
  .pa-empty { color: #9a8aac; font-size: 13px; }`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const btn = document.createElement('button');
  btn.className = 'pa-btn'; btn.type = 'button'; btn.textContent = '👪 おうち の ひと';
  const over = document.createElement('div');
  over.className = 'pa-over'; over.id = 'parentScreen'; over.hidden = true;
  document.body.appendChild(btn); document.body.appendChild(over);

  const pct = (c) => (c[0] ? Math.round((c[1] / c[0]) * 100) : null);
  const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const sum = (log, days) => {
    const out = {}; SUBJ.forEach(([k]) => { out[k] = [0, 0]; });
    Object.entries(log || {}).forEach(([day, row]) => { if (days && !days.includes(day)) return; Object.entries(row).forEach(([k, c]) => { if (out[k]) { out[k][0] += c[0]; out[k][1] += c[1]; } }); });
    return out;
  };
  const bars = (tot) => SUBJ.map(([k, l]) => { const p = pct(tot[k]);
    return `<div class="pa-row"><span>${l}</span><div class="pa-bar${p !== null && p < 70 ? ' low' : ''}"><i style="width:${p || 0}%"></i></div><span>${p === null ? 'まだ なし' : `${p}%（${tot[k][1]}/${tot[k][0]}）`}</span></div>`; }).join('');

  function render(slot) {
    const datas = [1, 2, 3].map((n) => loadSlot(n));
    if (!slot) slot = (datas.findIndex(Boolean) + 1) || 1;
    const d = datas[slot - 1];
    const tabs = [1, 2, 3].map((n) => `<button type="button" data-slot="${n}" class="${n === slot ? 'on' : ''}" ${datas[n - 1] ? '' : 'disabled'}>スロット ${n}</button>`).join('');
    let body = '<p class="pa-empty">この スロット には セーブ が ありません。</p>';
    if (d) {
      const last7 = Array.from({ length: 7 }, (_, i) => dayKey(Date.now() - i * 86400000));
      const all = sum(d.log), week = sum(d.log, last7);
      const dayRows = last7.map((day) => { const r = (d.log || {})[day] || {}; const tot = Object.values(r).reduce((a, c) => [a[0] + c[0], a[1] + c[1]], [0, 0]);
        return `<tr><td>${day.slice(5).replace('-', '/')}</td>${SUBJ.map(([k]) => `<td>${r[k] ? `${r[k][1]}/${r[k][0]}` : '−'}</td>`).join('')}<td><b>${tot[0] ? `${pct(tot)}%` : '−'}</b></td></tr>`; }).join('');
      const wq = d.weakQ || { math: {}, english: {} };
      const mathW = Object.entries(wq.math || {}).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k.replace('+', ' ＋ ').replace('-', ' − '));
      const engW = Object.entries(wq.english || {}).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k]) => k);
      const kanjiW = Object.entries(d.weak || {}).filter(([, w]) => w && !w.overcome && w.miss > 0).sort((a, b) => b[1].miss - a[1].miss).slice(0, 16).map(([ch]) => ch);
      const chips = (arr) => (arr.length ? `<div class="pa-chips">${arr.map((x) => `<span>${x}</span>`).join('')}</div>` : '<p class="pa-empty">いまは ありません</p>');
      const cleared = Object.keys(d.cleared || {}).filter((k) => d.cleared[k] > 0).sort().join('・') || 'まだ';
      const z = d.zukan || { enemies: {}, kanji: {}, abc: {} };
      body = `<div class="pa-grid">
        <div class="pa-box"><h3>せいかい りつ（さいきん 7日）</h3>${bars(week)}</div>
        <div class="pa-box"><h3>せいかい りつ（ぜんぶ）</h3>${bars(all)}</div>
        <div class="pa-box" style="grid-column: 1 / -1"><h3>ひ ごと（せいかい / こたえた）</h3><table class="pa-days"><tr><th>ひ</th>${SUBJ.map(([, l]) => `<th>${l}</th>`).join('')}<th>ぜんぶ</th></tr>${dayRows}</table></div>
        <div class="pa-box"><h3>にがて：さんすう</h3>${chips(mathW)}</div>
        <div class="pa-box"><h3>にがて：かんじ</h3>${chips(kanjiW)}</div>
        <div class="pa-box"><h3>にがて：えいご</h3>${chips(engW)}</div>
        <div class="pa-box"><h3>すすみ ぐあい</h3><div class="pa-kv">
          モード：${GAME_MODES[d.mode] || ''}　プレイ じかん：${fmtPlayTime(d.playSeconds || 0)}<br>
          クリア した ダンジョン：${cleared}${d.flags && d.flags.gameClear ? '　⭐ ゲーム クリア' : ''}<br>
          むげん の とう：${d.flags && d.flags.endlessBest ? `ちか ${d.flags.endlessBest} かい` : 'まだ'}<br>
          ほし の かけら：${d.shards || 0}こ　にゃんこ：レベル ${(d.cat && d.cat.lv) || 1}<br>
          ずかん：てき ${Object.keys(z.enemies).length}・かんじ ${Object.keys(z.kanji).length}・アルファベット ${Object.keys(z.abc).length}<br>
          さいご に あそんだ ひ：${fmtDate(d.savedAt || Date.now())}</div></div>
      </div>`;
    }
    over.innerHTML = `<div class="pa-card"><div class="pa-head"><h2>👪 おうち の ひと</h2><div class="pa-tabs">${tabs}</div><button type="button" class="pa-close">とじる（Esc）</button></div>${body}</div>`;
    over.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => render(+b.dataset.slot)));
    over.querySelector('.pa-close').addEventListener('click', close);
  }
  function open() { render(); over.hidden = false; }
  function close() { over.hidden = true; }
  btn.addEventListener('click', open);
  over.addEventListener('click', (e) => { if (e.target === over) close(); });
  // ひらいている あいだ は タイトル の キー（スロット えらび）を とめる
  addEventListener('keydown', (e) => { if (over.hidden) return; if (e.key === 'Escape') close(); e.stopImmediatePropagation(); }, true);
  window.parentTest = { open, close, render };
})();
