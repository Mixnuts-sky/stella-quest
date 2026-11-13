'use strict';
// =====================================================================
//  しゅじんこうの え が まだ ない ときの かわりの え（タイトルと ゲーム きょうつう）
//  c: canvas の 2D コンテキスト。あしもと が (0, 0)、うえが マイナス。hh: たかさ
// =====================================================================
const P_INK = '#3a2a4d';

// けんし（かんじ）：はちまきと マントの けんし
function drawSwordsman(c, hh, t = 0, charge = false) {
  const k = hh / 250;
  c.save();
  c.scale(k, k);
  c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 4; c.strokeStyle = P_INK;
  const wave = Math.sin(t * 6);
  // マント
  c.fillStyle = '#e8333f';
  c.beginPath(); c.moveTo(-28, -150); c.quadraticCurveTo(-62 - wave * 6, -90, -54 - wave * 8, -36); c.lineTo(20, -44); c.lineTo(26, -150); c.closePath(); c.fill(); c.stroke();
  // あし
  c.fillStyle = '#2c3e7a';
  c.fillRect(-24, -64, 18, 52); c.strokeRect(-24, -64, 18, 52);
  c.fillRect(6, -64, 18, 52); c.strokeRect(6, -64, 18, 52);
  c.fillStyle = '#8a5a3c';
  c.beginPath(); c.ellipse(-16, -8, 16, 9, 0, 0, 7); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(16, -8, 16, 9, 0, 0, 7); c.fill(); c.stroke();
  // からだ
  c.fillStyle = '#4a7fd6';
  c.beginPath(); c.moveTo(-34, -142); c.lineTo(34, -142); c.lineTo(40, -58); c.lineTo(-40, -58); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#8a5a3c'; c.fillRect(-38, -82, 76, 12); c.strokeRect(-38, -82, 76, 12);
  c.fillStyle = '#ffd84a'; c.fillRect(-8, -84, 16, 16); c.strokeRect(-8, -84, 16, 16);
  // ひだりての こぶし
  c.fillStyle = '#ffe2c6';
  c.beginPath(); c.arc(-44, -96, 11, 0, 7); c.fill(); c.stroke();
  // けん（みぎて）
  c.save();
  c.translate(44, -104); c.rotate(-0.55);
  if (charge) { c.shadowColor = 'rgba(255,230,120,1)'; c.shadowBlur = 30; }
  c.fillStyle = '#e6eef8';
  c.beginPath(); c.moveTo(-6, -8); c.lineTo(-6, -110); c.lineTo(0, -124); c.lineTo(6, -110); c.lineTo(6, -8); c.closePath(); c.fill(); c.stroke();
  c.shadowBlur = 0;
  c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-1, -14); c.lineTo(-1, -108); c.stroke();
  c.strokeStyle = P_INK; c.lineWidth = 4;
  c.fillStyle = '#ffd84a'; c.fillRect(-20, -12, 40, 10); c.strokeRect(-20, -12, 40, 10);
  c.fillStyle = '#7a4a2c'; c.fillRect(-5, -2, 10, 22); c.strokeRect(-5, -2, 10, 22);
  c.restore();
  c.fillStyle = '#ffe2c6';
  c.beginPath(); c.arc(44, -100, 11, 0, 7); c.fill(); c.stroke();
  // あたま
  c.fillStyle = '#ffe2c6';
  c.beginPath(); c.arc(0, -190, 44, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#3b2a20';
  c.beginPath();
  c.moveTo(-46, -192); c.quadraticCurveTo(-48, -240, 0, -238); c.quadraticCurveTo(48, -240, 46, -192);
  c.lineTo(34, -206); c.lineTo(22, -194); c.lineTo(8, -208); c.lineTo(-6, -194); c.lineTo(-20, -208); c.lineTo(-32, -194); c.closePath();
  c.fill(); c.stroke();
  // はちまき
  c.fillStyle = '#e8333f';
  c.fillRect(-45, -212, 90, 12); c.strokeRect(-45, -212, 90, 12);
  c.beginPath(); c.moveTo(-44, -208); c.quadraticCurveTo(-70, -214 + wave * 6, -84, -200 + wave * 10); c.lineTo(-80, -192 + wave * 8); c.quadraticCurveTo(-66, -202, -44, -200); c.closePath(); c.fill(); c.stroke();
  // かお
  c.fillStyle = P_INK;
  c.beginPath(); c.ellipse(-15, -184, 5, 7, 0, 0, 7); c.ellipse(15, -184, 5, 7, 0, 0, 7); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(-13, -187, 2, 0, 7); c.arc(17, -187, 2, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,111,168,.45)'; c.beginPath(); c.ellipse(-26, -170, 8, 5, 0, 0, 7); c.ellipse(26, -170, 8, 5, 0, 0, 7); c.fill();
  c.strokeStyle = P_INK; c.lineWidth = 3; c.beginPath(); c.arc(0, -172, 8, 0.25, Math.PI - 0.25); c.stroke();
  c.restore();
}

// おどりこ（おんがく）：バレエの ポーズで リボンを ひらひら
function drawDancer(c, hh, t = 0, charge = false) {
  const k = hh / 250;
  c.save();
  c.scale(k, k);
  c.rotate(Math.sin(t * 3) * 0.04);
  c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 4; c.strokeStyle = P_INK;
  const sway = Math.sin(t * 4);
  // リボン（みぎての さきから）
  c.save();
  c.strokeStyle = '#ff6fa8'; c.lineWidth = 7;
  c.beginPath(); c.moveTo(58, -150);
  for (let i = 1; i <= 8; i++) c.lineTo(58 + i * 9, -150 + Math.sin(t * 7 - i * 0.9) * 14 - i * 6);
  c.stroke();
  c.restore();
  // あし（ひだりは まっすぐ、みぎは まげて ステップ）
  c.fillStyle = '#ffd1e3';
  c.beginPath(); c.moveTo(-12, -78); c.lineTo(-2, -78); c.lineTo(-4, -8); c.lineTo(-12, -8); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(4, -78); c.lineTo(14, -78); c.lineTo(36 + sway * 4, -42); c.lineTo(28 + sway * 4, -36); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ff6fa8';
  c.beginPath(); c.ellipse(-9, -6, 11, 6, 0, 0, 7); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(36 + sway * 4, -36, 10, 6, -0.6, 0, 7); c.fill(); c.stroke();
  // チュチュ（ふわふわ スカート）
  const frill = (y, rx, col) => {
    c.fillStyle = col;
    c.beginPath(); c.moveTo(-rx, y);
    for (let i = 0; i <= 8; i++) { const x = -rx + (rx * 2) * i / 8; c.quadraticCurveTo(x - rx / 8, y + 14, x, y + (i % 2 ? 6 : 0)); }
    c.lineTo(rx * 0.4, y - 26); c.lineTo(-rx * 0.4, y - 26); c.closePath(); c.fill(); c.stroke();
  };
  frill(-74, 62 + sway * 3, '#c9a2ff');
  frill(-82, 52 + sway * 2, '#ffb3e0');
  // からだ
  c.fillStyle = '#b07cf0';
  c.beginPath(); c.moveTo(-20, -150); c.lineTo(20, -150); c.lineTo(15, -100); c.lineTo(-15, -100); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(0, -138, 5, 0, 7); c.fill(); c.stroke();
  // うで（ひだりは うえへ、みぎは よこへ）
  c.strokeStyle = P_INK; c.lineWidth = 12;
  c.beginPath(); c.moveTo(-16, -146); c.quadraticCurveTo(-46, -170, -40 + sway * 3, -214); c.stroke();
  c.beginPath(); c.moveTo(16, -146); c.lineTo(56, -152); c.stroke();
  c.strokeStyle = '#ffe2c6'; c.lineWidth = 6;
  c.beginPath(); c.moveTo(-16, -146); c.quadraticCurveTo(-46, -170, -40 + sway * 3, -214); c.stroke();
  c.beginPath(); c.moveTo(16, -146); c.lineTo(56, -152); c.stroke();
  c.lineWidth = 4; c.strokeStyle = P_INK;
  c.fillStyle = '#ffe2c6';
  c.beginPath(); c.arc(-40 + sway * 3, -218, 8, 0, 7); c.fill(); c.stroke();
  c.beginPath(); c.arc(58, -152, 8, 0, 7); c.fill(); c.stroke();
  // あたま
  c.fillStyle = '#7a4a2c';
  c.beginPath(); c.arc(0, -238, 20, 0, 7); c.fill(); c.stroke(); // おだんご
  c.fillStyle = '#ffe2c6';
  c.beginPath(); c.arc(0, -190, 38, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#7a4a2c';
  c.beginPath(); c.moveTo(-40, -190); c.quadraticCurveTo(-40, -232, 0, -230); c.quadraticCurveTo(40, -232, 40, -190);
  c.quadraticCurveTo(26, -208, 4, -206); c.quadraticCurveTo(-20, -212, -40, -190); c.closePath(); c.fill(); c.stroke();
  // リボンの かみかざり
  c.fillStyle = '#ff6fa8';
  c.beginPath(); c.moveTo(20, -228); c.lineTo(42, -244); c.lineTo(42, -216); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(20, -228); c.lineTo(0, -246); c.lineTo(2, -216); c.closePath(); c.fill(); c.stroke();
  // かお（にっこり）
  c.lineWidth = 3.5;
  c.beginPath(); c.arc(-13, -186, 6, Math.PI + 0.3, -0.3); c.stroke();
  c.beginPath(); c.arc(13, -186, 6, Math.PI + 0.3, -0.3); c.stroke();
  c.fillStyle = 'rgba(255,111,168,.5)'; c.beginPath(); c.ellipse(-22, -172, 7, 4.5, 0, 0, 7); c.ellipse(22, -172, 7, 4.5, 0, 0, 7); c.fill();
  c.fillStyle = '#ff5c8a'; c.beginPath(); c.arc(0, -172, 7, 0, Math.PI); c.closePath(); c.fill(); c.stroke();
  // まわりの おんぷ
  c.font = '900 26px "Noto Music", "Segoe UI Symbol", sans-serif'; c.textAlign = 'center';
  ['♪', '♫', '♪'].forEach((n, i) => {
    const a = t * 1.6 + i * 2.1;
    c.globalAlpha = 0.85;
    c.fillStyle = ['#ff6fa8', '#7fb2ff', '#ffb13a'][i];
    c.fillText(n, Math.cos(a) * 70, -200 + Math.sin(a * 1.3) * 30 - i * 10);
  });
  c.globalAlpha = 1;
  if (charge) {
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(255,220,120,.35)';
    c.beginPath(); c.arc(0, -130, 120 + Math.sin(t * 12) * 8, 0, 7); c.fill();
  }
  c.restore();
}
