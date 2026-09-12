/* ============================================================
   FOC 学习站 — 全部交互可视化
   ============================================================ */
'use strict';

/* ---------- 通用小工具 ---------- */
const TAU = Math.PI * 2;
// 画布配色（随主题切换）
const COL_DARK = {
  a: '#e74c3c', b: '#2ecc71', c: '#3498db',
  alpha: '#e74c3c', beta: '#3498db',
  white: '#f5f5f5', dim: '#8b98ad', grid: '#2a3446',
  accent: '#4dd0a6', dq: '#2ecc71', warn: '#f39c12', good: '#2ecc71',
  boxFill: '#1a2232', faint: 'rgba(255,255,255,0.15)', fb: '#7a879a'
};
const COL_LIGHT = {
  a: '#c0392b', b: '#1a9e4b', c: '#1a6fc4',
  alpha: '#c0392b', beta: '#1a6fc4',
  white: '#1c2430', dim: '#5a6675', grid: '#d4dbe4',
  accent: '#0f9d6c', dq: '#1a9e4b', warn: '#d97a08', good: '#1a9e4b',
  boxFill: '#eef1f5', faint: '#1c24302e', fb: '#5a6675'
};
/* 樱花粉：画布底色是浅粉，所以线条/文字要压深才看得清 */
const COL_SAKURA = {
  a: '#d9385c', b: '#2f9468', c: '#7a5ad0',
  alpha: '#d9385c', beta: '#3a7fc4',
  white: '#6b2f47', dim: '#b08e99', grid: '#f0d3dc',
  accent: '#d6457e', dq: '#2f9468', warn: '#c96e1e', good: '#2f9468',
  boxFill: '#fff2f6', faint: 'rgba(214,69,126,.16)', fb: '#a8818d'
};
const COL = Object.assign({}, COL_DARK);
const COL_THEMES = { light: COL_LIGHT, sakura: COL_SAKURA, dark: COL_DARK };
function applyCanvasTheme(theme) {
  Object.assign(COL, COL_THEMES[theme] || COL_DARK);
  document.dispatchEvent(new CustomEvent('canvas-theme-change'));
}

function setupCanvas(id) {
  const cv = document.getElementById(id);
  if (!cv) return null;
  const ctx = cv.getContext('2d');
  return { cv, ctx, w: cv.width, h: cv.height, cx: cv.width / 2, cy: cv.height / 2 };
}

function drawCircleGrid(ctx, cx, cy, R) {
  ctx.strokeStyle = COL.grid;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - R - 12, cy); ctx.lineTo(cx + R + 12, cy);
  ctx.moveTo(cx, cy - R - 12); ctx.lineTo(cx, cy + R + 12);
  ctx.stroke();
}

function arrow(ctx, x0, y0, x1, y1, color, width = 2.5, head = 8) {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(ang - 0.45), y1 - head * Math.sin(ang - 0.45));
  ctx.lineTo(x1 - head * Math.cos(ang + 0.45), y1 - head * Math.sin(ang + 0.45));
  ctx.closePath(); ctx.fill();
}

function label(ctx, txt, x, y, color = '#aab', size = 13, align = 'center') {
  ctx.fillStyle = color;
  ctx.font = `${size}px "Segoe UI", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(txt, x, y);
}

/* ---------- 第 7 章硬件拓扑图元 ---------- */
// 折线路径总长
function pathLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
// 取折线上距离 s 处的点与方向
function pathPoint(pts, s) {
  let rem = s;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
    const L = Math.hypot(dx, dy);
    if (rem <= L) {
      const k = L ? rem / L : 0;
      return { x: pts[i - 1][0] + dx * k, y: pts[i - 1][1] + dy * k, ang: Math.atan2(dy, dx) };
    }
    rem -= L;
  }
  const p = pts[pts.length - 1];
  return { x: p[0], y: p[1], ang: 0 };
}
// 电流回路：画线 + 流动粒子（t 单位秒）
function currentPath(ctx, pts, t, color, opts = {}) {
  const { dim = false, n = 7, speed = 110, width = 2.5 } = opts;
  ctx.save();
  if (dim) ctx.globalAlpha = 0.32;
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  // 首尾箭头标明方向
  if (!dim) {
    const a0 = pathPoint(pts, 4), total = pathLen(pts), a1 = pathPoint(pts, total - 6);
    const ah = (p, d) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(p.x + 7 * Math.cos(d), p.y + 7 * Math.sin(d));
      ctx.lineTo(p.x + 5 * Math.cos(d + 2.6), p.y + 5 * Math.sin(d + 2.6));
      ctx.lineTo(p.x + 5 * Math.cos(d - 2.6), p.y + 5 * Math.sin(d - 2.6));
      ctx.closePath(); ctx.fill();
    };
    ah(a0, a0.ang); ah(a1, a1.ang);
  }
  // 流动粒子
  const total = pathLen(pts);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const s = ((t * speed + total * i / n) % total + total) % total;
    const p = pathPoint(pts, s);
    if (!dim) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// 竖直 N 沟道 MOSFET 标准符号（D 上 S 下，栅极在左；g=体二极管导通高亮，on=沟道导通，stateTxt 是否显示 ON/OFF）
function mosfetV(ctx, x, yT, yB, g, on, name, stateTxt = true) {
  const yc = (yT + yB) / 2;
  const ch = 18; // 沟道区半高
  ctx.save();
  // D/S 引线
  ctx.strokeStyle = on ? COL.good : COL.dim; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, yT); ctx.lineTo(x, yc - ch); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, yc + ch); ctx.lineTo(x, yB); ctx.stroke();
  // 沟道：三段断续线（增强型 NMOS）
  ctx.lineWidth = 3;
  [[-18, -9], [-4, 4], [9, 18]].forEach(([a, b]) => {
    ctx.beginPath(); ctx.moveTo(x, yc + a); ctx.lineTo(x, yc + b); ctx.stroke();
  });
  // 源极侧箭头（指向沟道）
  ctx.fillStyle = on ? COL.good : COL.dim;
  ctx.beginPath();
  ctx.moveTo(x - 9, yc + 9); ctx.lineTo(x - 9, yc + 17); ctx.lineTo(x - 2, yc + 13);
  ctx.closePath(); ctx.fill();
  // 栅极板 + 引出线
  ctx.strokeStyle = COL.dim; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 12, yc - 13); ctx.lineTo(x - 12, yc + 13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 12, yc); ctx.lineTo(x - 36, yc); ctx.stroke();
  label(ctx, 'G', x - 26, yc - 16, COL.dim, 11);
  label(ctx, 'D', x + 11, yT + 6, COL.dim, 10);
  label(ctx, 'S', x + 11, yB - 6, COL.dim, 10);
  // 栅极驱动电平指示（绿块 = 有驱动）
  if (on) { ctx.fillStyle = COL.good; ctx.fillRect(x - 38, yc - 4, 8, 8); }
  // ON / OFF
  if (stateTxt) label(ctx, on ? 'ON' : 'OFF', x + 44, yc - 16, on ? COL.good : COL.dim, 11);
  if (name) label(ctx, name, x + 44, stateTxt ? yc + 16 : yc, COL.white, 12);
  // 体二极管（外侧加大：阳极接 S、阴极接 D，向上导通）
  const dx = x + 22;
  ctx.strokeStyle = g ? COL.warn : COL.dim; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(x, yc - 14); ctx.lineTo(dx, yc - 14); ctx.lineTo(dx, yc - 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(dx, yc + 7); ctx.lineTo(dx, yc + 14); ctx.lineTo(x, yc + 14); ctx.stroke();
  ctx.fillStyle = g ? COL.warn : 'transparent';
  ctx.beginPath();
  ctx.moveTo(dx - 7, yc + 7); ctx.lineTo(dx + 7, yc + 7); ctx.lineTo(dx, yc - 7);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(dx - 7, yc - 7); ctx.lineTo(dx + 7, yc - 7); ctx.stroke();
  ctx.restore();
}
// 折线上等距方向箭头（标明电流流向，n 个）
function flowArrows(ctx, pts, color, n = 3) {
  const total = pathLen(pts);
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const p = pathPoint(pts, total * (i + 0.5) / n);
    ctx.beginPath();
    ctx.moveTo(p.x + 8 * Math.cos(p.ang), p.y + 8 * Math.sin(p.ang));
    ctx.lineTo(p.x + 6 * Math.cos(p.ang + 2.6), p.y + 6 * Math.sin(p.ang + 2.6));
    ctx.lineTo(p.x + 6 * Math.cos(p.ang - 2.6), p.y + 6 * Math.sin(p.ang - 2.6));
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// 折线描边（hops: [[x,y]] 为「跨越不相连」的跳线点，在水平段上画半圆弧）
function strokePath(ctx, pts, hops = [], r = 5) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (y0 === y1 && hops.length) {
      const hs = hops
        .filter(h => Math.abs(h[1] - y0) < 0.5 && h[0] > Math.min(x0, x1) + r && h[0] < Math.max(x0, x1) - r)
        .map(h => h[0])
        .sort((a, b) => (x1 > x0 ? a - b : b - a));
      for (const hx of hs) {
        ctx.lineTo(hx - Math.sign(x1 - x0) * r, y0);
        if (x1 > x0) ctx.arc(hx, y0, r, Math.PI, 0, false);
        else ctx.arc(hx, y0, r, 0, Math.PI, true);
      }
    }
    ctx.lineTo(x1, y1);
  }
}
// 带跳线的水平导线（基础线用）
function hLine(ctx, x0, x1, y, hops, w, c) {
  ctx.strokeStyle = c || COL.dim; ctx.lineWidth = w || 2;
  strokePath(ctx, [[x0, y], [x1, y]], hops);
  ctx.stroke();
}
// 电流回路：细线 + 等距箭头 + 少量缓慢流动点（简洁版，替代密集粒子）
function flowPath(ctx, pts, t, color, opts = {}) {
  const { nDots = 4, speed = 40, nArrows = 3, hops = [] } = opts;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
  strokePath(ctx, pts, hops);
  ctx.stroke();
  ctx.globalAlpha = 1;
  flowArrows(ctx, pts, color, nArrows);
  // 稀疏慢速小点
  const total = pathLen(pts);
  ctx.fillStyle = color;
  for (let i = 0; i < nDots; i++) {
    const s = ((t * speed + total * i / nDots) % total + total) % total;
    const p = pathPoint(pts, s);
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// 回路步骤圆标（①②③…，与底部说明文字编号对应）
function badges(ctx, arr, color) {
  ctx.save();
  for (const [x, y, s] of arr) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    label(ctx, s, x, y, '#fff', 10.5);
  }
  ctx.restore();
}
// 竖直栅极驱动电阻（水平走线上的小矩形框，用于 HO/LO 引线）
function gateRes(ctx, x0, y, w, name) {
  ctx.save();
  ctx.fillStyle = COL.boxFill; ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.4;
  ctx.fillRect(x0, y - 5, w, 10); ctx.strokeRect(x0, y - 5, w, 10);
  if (name) label(ctx, name, x0 + w / 2, y - 13, COL.dim, 10);
  ctx.restore();
}
// 竖直电阻（矩形框，用于下桥臂/母线采样电阻）
function resistorV(ctx, x, y0, h, name, hot) {
  ctx.save();
  ctx.fillStyle = hot ? 'rgba(243,156,18,0.22)' : COL.boxFill;
  ctx.strokeStyle = hot ? COL.warn : COL.dim; ctx.lineWidth = 1.5;
  ctx.fillRect(x - 6, y0, 12, h); ctx.strokeRect(x - 6, y0, 12, h);
  if (name) label(ctx, name, x + 14, y0 + h / 2, hot ? COL.warn : COL.dim, 11, 'left');
  ctx.restore();
}
// 竖直二极管（阳极在上，阴极在下）
function diodeV(ctx, x, yT, yB, name, active) {
  const yc = (yT + yB) / 2;
  ctx.save();
  ctx.strokeStyle = active ? COL.warn : COL.dim; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, yT); ctx.lineTo(x, yB); ctx.stroke();
  ctx.fillStyle = active ? COL.warn : 'transparent';
  ctx.strokeStyle = active ? COL.warn : COL.dim;
  ctx.beginPath();
  ctx.moveTo(x - 8, yc - 7); ctx.lineTo(x + 8, yc - 7); ctx.lineTo(x, yc + 7);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 8, yc + 7); ctx.lineTo(x + 8, yc + 7); ctx.stroke();
  if (name) label(ctx, name, x - 18, yc, COL.dim, 11);
  ctx.restore();
}
// 水平矩形电阻（电流从左往右）
function resistorH(ctx, x0, y, w, name, hot) {
  ctx.save();
  ctx.fillStyle = hot ? 'rgba(243,156,18,0.22)' : COL.boxFill;
  ctx.strokeStyle = hot ? COL.warn : COL.dim; ctx.lineWidth = 1.5;
  ctx.fillRect(x0, y - 6, w, 12); ctx.strokeRect(x0, y - 6, w, 12);
  if (name) label(ctx, name, x0 + w / 2, y + 16, hot ? COL.warn : COL.dim, 11);
  ctx.restore();
}
// 竖直电容
function capV(ctx, x, yT, yB, name, labelPos = 'bottom') {
  const yc = (yT + yB) / 2;
  ctx.save();
  ctx.strokeStyle = COL.dim; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, yT); ctx.lineTo(x, yc - 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, yc + 4); ctx.lineTo(x, yB); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 12, yc - 4); ctx.lineTo(x + 12, yc - 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 12, yc + 4); ctx.lineTo(x + 12, yc + 4); ctx.stroke();
  if (name) {
    if (labelPos === 'left') label(ctx, name, x - 16, yc, COL.dim, 11, 'right');
    else label(ctx, name, x, yc + 18, COL.dim, 11);
  }
  ctx.restore();
}

/* ---------- 播放/暂停 控制封装 ---------- */
function makePlayer(btnId) {
  const btn = document.getElementById(btnId);
  const state = { playing: true };
  if (btn) btn.addEventListener('click', () => {
    state.playing = !state.playing;
    btn.textContent = state.playing ? '⏸ 暂停' : '▶ 播放';
  });
  return state;
}

/* ============================================================
   图 1-1：旋转磁场（三相波形 + 空间矢量合成）
   ============================================================ */
(function rotatingField() {
  const wave = setupCanvas('cv-wave');
  const vec = setupCanvas('cv-vector');
  if (!wave || !vec) return;

  const player = makePlayer('btn-rf-play');
  const timeSlider = document.getElementById('rf-time');
  const speedSlider = document.getElementById('rf-speed');
  const readout = document.getElementById('rf-angle-readout');
  let tDeg = 0; // 电角度 0..360

  function threePhase(deg) {
    const r = deg * Math.PI / 180;
    return {
      a: Math.cos(r),
      b: Math.cos(r - TAU / 3),
      c: Math.cos(r + TAU / 3)
    };
  }

  function draw() {
    // --- 左：三相波形 ---
    const { ctx, w, h } = wave;
    ctx.clearRect(0, 0, w, h);
    const midY = h / 2, amp = h * 0.32;
    // 网格
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();
    // 画三条曲线
    const phases = [
      { k: 'a', color: COL.a, off: 0 },
      { k: 'b', color: COL.b, off: -120 },
      { k: 'c', color: COL.c, off: 120 }
    ];
    for (const p of phases) {
      ctx.strokeStyle = p.color; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= w; x++) {
        const deg = x / w * 360;
        const y = midY - Math.cos((deg + p.off) * Math.PI / 180) * amp;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 当前时刻竖线
    const curX = (tDeg % 360) / 360 * w;
    ctx.strokeStyle = '#ffffff55'; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(curX, 10); ctx.lineTo(curX, h - 10); ctx.stroke();
    ctx.setLineDash([]);
    // 当前点
    const cur = threePhase(tDeg % 360);
    label(ctx, 'ia', w - 16, midY - cur.a * amp, COL.a);
    for (const p of phases) {
      const val = Math.cos((tDeg % 360 + p.off) * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(curX, midY - val * amp, 4, 0, TAU); ctx.fill();
    }
    label(ctx, 'ia', 14, 16, COL.a);
    label(ctx, 'ib', 14, 34, COL.b);
    label(ctx, 'ic', 14, 52, COL.c);

    // --- 右：空间矢量 ---
    const v2 = vec.ctx, cx = vec.cx, cy = vec.cy, R = 110;
    v2.clearRect(0, 0, vec.w, vec.h);
    drawCircleGrid(v2, cx, cy, R);
    // 画 a/b/c 轴
    const axes = [
      { ang: 0, color: COL.a, name: 'a' },
      { ang: -TAU / 3, color: COL.b, name: 'b' },
      { ang: TAU / 3, color: COL.c, name: 'c' }
    ];
    for (const ax of axes) {
      const x = cx + Math.cos(ax.ang) * (R + 4), y = cy + Math.sin(ax.ang) * (R + 4);
      v2.strokeStyle = ax.color + '55'; v2.lineWidth = 1;
      v2.beginPath(); v2.moveTo(cx, cy); v2.lineTo(x, y); v2.stroke();
      label(v2, ax.name, cx + Math.cos(ax.ang) * (R + 16), cy + Math.sin(ax.ang) * (R + 16), ax.color);
    }
    // 三相分量矢量（沿各自轴）
    for (let i = 0; i < 3; i++) {
      const ax = axes[i];
      const val = [cur.a, cur.b, cur.c][i];
      const x = cx + Math.cos(ax.ang) * val * R;
      const y = cy + Math.sin(ax.ang) * val * R;
      arrow(v2, cx, cy, x, y, ax.color, 2, 6);
    }
    // 合成矢量 = clarke
    const alpha = cur.a;
    const beta = (cur.b - cur.c) / Math.sqrt(3);
    const sx = cx + alpha * R, sy = cy - beta * R; // 屏幕 y 向下
    arrow(v2, cx, cy, sx, sy, COL.white, 3, 10);
    label(v2, '合成矢量', (cx + sx) / 2 + 34, (cy + sy) / 2 - 10, COL.white, 12);
    // 轨迹圆
    v2.strokeStyle = '#ffffff22'; v2.setLineDash([2, 4]);
    v2.beginPath(); v2.arc(cx, cy, R, 0, TAU); v2.stroke(); v2.setLineDash([]);

    const angDeg = (Math.atan2(beta, alpha) * 180 / Math.PI + 360) % 360;
    readout.textContent = `ωt=${(tDeg % 360).toFixed(0)}°  |合成矢量|=${Math.hypot(alpha, beta).toFixed(2)}  ∠${angDeg.toFixed(0)}°`;
  }

  function tick() {
    if (player.playing) {
      tDeg += speedSlider.value / 20;
      timeSlider.value = (tDeg % 360).toFixed(0);
      draw();
    }
    requestAnimationFrame(tick);
  }
  timeSlider.addEventListener('input', () => { tDeg = +timeSlider.value; draw(); });
  draw(); tick();
})();

/* ============================================================
   图 1-2：转矩角与转矩脉动（六步换相 vs FOC）
   ============================================================ */
(function torqueRipple() {
  const cv = setupCanvas('cv-torque');
  if (!cv) return;
  const { ctx, w, h } = cv;
  const player = makePlayer('btn-tq-play');
  const readout = document.getElementById('tq-readout');
  const modeChk = document.getElementById('tq-mode');
  let tDeg = 0; // 电角度，慢速

  // 单步按钮
  const stepBtn = document.getElementById('btn-tq-step');
  if (stepBtn) stepBtn.addEventListener('click', () => {
    if (player.playing) { player.playing = false; document.getElementById('btn-tq-play').textContent = '▶ 播放'; }
    tDeg = (tDeg + 6) % 360;
    draw();
  });

  // 六步换相：定子电流矢量被离散到 6 个方向（间隔 60°），转子匀速转
  // δ = 定子电流方向 - 转子磁场(d轴)方向，在 60°~120° 间锯齿
  function sixStepDelta(rotorDeg) {
    // 定子矢量锁定在最近的 60° 倍数（超前转子）
    const sector = Math.floor((((rotorDeg % 360) + 360) % 360) / 60);
    const statorDeg = sector * 60 + 90; // 理想换相点：领先 sector 中心 90°
    let delta = statorDeg - rotorDeg;
    // 归一化到 0..180
    delta = ((delta % 360) + 360) % 360;
    if (delta > 180) delta = 360 - delta;
    return delta; // 实际在 60~120 间变化
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const compare = modeChk ? modeChk.checked : true;
    const rotorDeg = tDeg % 360;

    // 当前 δ（六步换相 / FOC）
    const delta6 = sixStepDelta(rotorDeg);
    const deltaFoc = 90;

    /* ---------- 左：dq 矢量示意 ---------- */
    const L = 300, cx = L / 2, cy = h / 2, R = 100;
    // 标题
    label(ctx, '转子 dq 坐标系（俯视）', cx, 16, COL.dim, 13);
    drawCircleGrid(ctx, cx, cy, R);
    // d 轴（转子磁场方向，蓝色，随转子转）
    const dAng = -rotorDeg * Math.PI / 180; // 屏幕 y 向下，取负使逆时针为正
    const dx = cx + Math.cos(dAng) * R, dy = cy + Math.sin(dAng) * R;
    arrow(ctx, cx, cy, dx, dy, '#3498db', 3.5, 11);
    // 标签半径从 R+30 收到 R+16：转到正上方时会撞到顶部标题
    label(ctx, 'd (转子磁场)', dx + 16 * Math.cos(dAng), dy + 16 * Math.sin(dAng), '#3498db', 12);
    // q 轴（领先 d 90°）
    const qAng = dAng - Math.PI / 2;
    const qx = cx + Math.cos(qAng) * R * 0.7, qy = cy + Math.sin(qAng) * R * 0.7;
    arrow(ctx, cx, cy, qx, qy, 'rgba(52,152,219,.4)', 1.5, 7);
    label(ctx, 'q', qx + 18 * Math.cos(qAng), qy + 18 * Math.sin(qAng), 'rgba(52,152,219,.6)', 11);

    // 定子电流矢量（白色）：FOC 模式恒在 q 轴；六步模式离散
    let statorAng;
    if (compare) {
      // 六步换相：离散到 60° 倍数
      const sector = Math.floor((((rotorDeg % 360) + 360) % 360) / 60);
      statorAng = -(sector * 60 + 90) * Math.PI / 180;
    } else {
      statorAng = dAng - Math.PI / 2; // FOC：恒在 q 轴
    }
    const sx = cx + Math.cos(statorAng) * R, sy = cy + Math.sin(statorAng) * R;
    arrow(ctx, cx, cy, sx, sy, COL.white, 3.5, 11);
    label(ctx, '定子电流', sx + 16 * Math.cos(statorAng), sy + 16 * Math.sin(statorAng), COL.white, 12);

    // δ 弧线标注
    ctx.strokeStyle = COL.warn; ctx.lineWidth = 2;
    ctx.beginPath();
    const a0 = dAng, a1 = statorAng;
    ctx.arc(cx, cy, 42, Math.min(a0, a1), Math.max(a0, a1));
    ctx.stroke();
    const midA = (a0 + a1) / 2;
    const curDelta = compare ? delta6 : deltaFoc;
    label(ctx, 'δ=' + curDelta.toFixed(0) + '°', cx + Math.cos(midA) * 62, cy + Math.sin(midA) * 62, COL.warn, 13);

    /* ---------- 右上：δ 随时间 ---------- */
    const gx0 = L + 30, gw = w - gx0 - 20;
    const topY0 = 30, topH = h * 0.32;
    label(ctx, '转矩角 δ 随转子转角', gx0 + gw / 2, 14, COL.dim, 13);
    ctx.strokeStyle = COL.grid; ctx.strokeRect(gx0, topY0, gw, topH);
    for (const deg of [60, 90, 120]) {
      const y = topY0 + topH - (deg / 180) * topH;
      ctx.strokeStyle = COL.grid;
      ctx.beginPath(); ctx.moveTo(gx0, y); ctx.lineTo(gx0 + gw, y); ctx.stroke();
      label(ctx, deg + '°', gx0 - 18, y, COL.dim, 10);
    }
    // 曲线
    ctx.lineWidth = 2;
    // 六步换相 δ
    if (compare) {
      ctx.strokeStyle = COL.warn; ctx.beginPath();
      for (let x = 0; x <= gw; x++) {
        const rd = (x / gw) * 360;
        const dv = sixStepDelta(rd);
        const y = topY0 + topH - (dv / 180) * topH;
        x === 0 ? ctx.moveTo(gx0 + x, y) : ctx.lineTo(gx0 + x, y);
      }
      ctx.stroke();
    }
    // FOC δ=90
    ctx.strokeStyle = COL.good; ctx.beginPath();
    const y90 = topY0 + topH - (90 / 180) * topH;
    ctx.moveTo(gx0, y90); ctx.lineTo(gx0 + gw, y90); ctx.stroke();

    // 当前点
    const curX = gx0 + (rotorDeg / 360) * gw;
    if (compare) {
      const yd = topY0 + topH - (delta6 / 180) * topH;
      ctx.fillStyle = COL.warn; ctx.beginPath(); ctx.arc(curX, yd, 5, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = COL.good; ctx.beginPath(); ctx.arc(curX, y90, 5, 0, TAU); ctx.fill();
    // 扫描线
    ctx.strokeStyle = COL.faint; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(curX, topY0); ctx.lineTo(curX, topY0 + topH); ctx.stroke();
    ctx.setLineDash([]);

    /* ---------- 右下：转矩随时间 ---------- */
    const botY0 = topY0 + topH + 40, botH = h - botY0 - 24;
    label(ctx, '归一化转矩  sinδ', gx0 + gw / 2, botY0 - 14, COL.dim, 13);
    ctx.strokeStyle = COL.grid; ctx.strokeRect(gx0, botY0, gw, botH);
    // 六步换相转矩
    if (compare) {
      ctx.strokeStyle = COL.warn; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 0; x <= gw; x++) {
        const rd = (x / gw) * 360;
        const tq = Math.sin(sixStepDelta(rd) * Math.PI / 180);
        const y = botY0 + botH - tq * botH;
        x === 0 ? ctx.moveTo(gx0 + x, y) : ctx.lineTo(gx0 + x, y);
      }
      ctx.stroke();
    }
    // FOC 转矩 = 1
    ctx.strokeStyle = COL.good; ctx.beginPath();
    ctx.moveTo(gx0, botY0); ctx.lineTo(gx0 + gw, botY0); ctx.stroke();
    // 当前点
    if (compare) {
      const tq6 = Math.sin(delta6 * Math.PI / 180);
      const y6 = botY0 + botH - tq6 * botH;
      ctx.fillStyle = COL.warn; ctx.beginPath(); ctx.arc(curX, y6, 5, 0, TAU); ctx.fill();
      label(ctx, tq6.toFixed(2), curX, y6 + 16, COL.warn, 11);   // 值标在点下方
    }
    ctx.fillStyle = COL.good; ctx.beginPath(); ctx.arc(curX, botY0, 5, 0, TAU); ctx.fill();
    // FOC 转矩恒为 1：写成静态标注（原来跟着点跑，δ=90° 时会和六步转矩值叠在一起）
    label(ctx, 'FOC = 1.00', gx0 + gw - 36, botY0 - 13, COL.good, 11);
    // 扫描线
    ctx.strokeStyle = COL.faint; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(curX, botY0); ctx.lineTo(curX, botY0 + botH); ctx.stroke();
    ctx.setLineDash([]);

    // 图例
    ctx.fillStyle = COL.warn; ctx.fillRect(gx0 + 6, botY0 + botH + 4, 14, 4);
    label(ctx, '六步换相（脉动 ±13%）', gx0 + 26, botY0 + botH + 6, COL.warn, 11, 'left');
    ctx.fillStyle = COL.good; ctx.fillRect(gx0 + 200, botY0 + botH + 4, 14, 4);
    label(ctx, 'FOC（恒定最优）', gx0 + 220, botY0 + botH + 6, COL.good, 11, 'left');

    const tqNow = Math.sin(curDelta * Math.PI / 180);
    readout.textContent = `转子角=${rotorDeg.toFixed(0)}°  δ=${curDelta.toFixed(0)}°  转矩=${tqNow.toFixed(2)}`;
  }

  function tick() {
    if (player.playing) { tDeg = (tDeg + 0.5) % 360; } // 降速
    draw(); requestAnimationFrame(tick);
  }
  if (modeChk) modeChk.addEventListener('change', draw);
  tick();
})();

/* ============================================================
   图 2-1：Clarke 变换可视化
   ============================================================ */
(function clarkeViz() {
  const three = setupCanvas('cv-clarke-3ph');
  const ab = setupCanvas('cv-clarke-ab');
  if (!three || !ab) return;
  const player = makePlayer('btn-cl-play');
  const timeSlider = document.getElementById('cl-time');
  const readout = document.getElementById('cl-readout');
  let tDeg = 0;

  function draw() {
    const r = tDeg * Math.PI / 180;
    const ia = Math.cos(r), ib = Math.cos(r - TAU / 3), ic = Math.cos(r + TAU / 3);
    const alpha = ia, beta = (ib - ic) / Math.sqrt(3);

    // --- 左：三相 ---
    {
      const { ctx, cx, cy } = three; const R = 110;
      ctx.clearRect(0, 0, three.w, three.h);
      drawCircleGrid(ctx, cx, cy, R);
      const axes = [
        { ang: -Math.PI / 2, color: COL.a, name: 'a', val: ia },
        { ang: -Math.PI / 2 + TAU / 3, color: COL.b, name: 'b', val: ib },
        { ang: -Math.PI / 2 - TAU / 3, color: COL.c, name: 'c', val: ic }
      ];
      for (const ax of axes) {
        const x = cx + Math.cos(ax.ang) * (R + 6), y = cy + Math.sin(ax.ang) * (R + 6);
        ctx.strokeStyle = ax.color + '44';
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
        label(ctx, ax.name, cx + Math.cos(ax.ang) * (R + 18), cy + Math.sin(ax.ang) * (R + 18), ax.color);
        const vx = cx + Math.cos(ax.ang) * ax.val * R, vy = cy + Math.sin(ax.ang) * ax.val * R;
        arrow(ctx, cx, cy, vx, vy, ax.color, 2, 6);
      }
      label(ctx, '三相静止绕组', cx, 18, COL.dim, 13);
    }
    // --- 右：αβ ---
    {
      const { ctx, cx, cy } = ab; const R = 110;
      ctx.clearRect(0, 0, ab.w, ab.h);
      drawCircleGrid(ctx, cx, cy, R);
      label(ctx, 'α', cx + R + 16, cy, COL.alpha);
      label(ctx, 'β', cx, cy - R - 14, COL.beta);
      // 轨迹
      ctx.strokeStyle = '#ffffff18';
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      const x = cx + alpha * R, y = cy - beta * R;
      arrow(ctx, cx, cy, x, y, COL.white, 3, 10);
      label(ctx, 'iα=' + alpha.toFixed(2), cx, cy + R + 18, COL.alpha, 12);
      label(ctx, 'iβ=' + beta.toFixed(2), cx, cy + R + 34, COL.beta, 12);
      label(ctx, 'αβ 合成矢量', cx, 18, COL.dim, 13);
    }
    readout.textContent = `ia=${ia.toFixed(2)} ib=${ib.toFixed(2)} ic=${ic.toFixed(2)}`;
  }
  function tick() {
    if (player.playing) { tDeg = (tDeg + 0.8) % 360; timeSlider.value = tDeg.toFixed(0); }
    draw(); requestAnimationFrame(tick);
  }
  timeSlider.addEventListener('input', () => { tDeg = +timeSlider.value; });
  tick();
})();

/* ============================================================
   图 3-1：Park 变换可视化
   ============================================================ */
(function parkViz() {
  const plane = setupCanvas('cv-park-plane');
  const wave = setupCanvas('cv-park-wave');
  if (!plane || !wave) return;
  const player = makePlayer('btn-pk-play');
  const speedSlider = document.getElementById('pk-speed');
  const speedVal = document.getElementById('pk-speed-val');
  const readout = document.getElementById('pk-readout');
  let tDeg = 0;
  const hist = []; // 记录波形历史

  function draw() {
    const wr = tDeg * Math.PI / 180;          // 电流矢量角度
    const dqRatio = +speedSlider.value / 100; // dq 系转速比
    const th = wr * dqRatio;                  // dq 系角度
    // 电流矢量（在 αβ 系中匀速旋转，幅值 1）
    const alpha = Math.cos(wr), beta = Math.sin(wr);
    const c = Math.cos(th), s = Math.sin(th);
    const d = alpha * c + beta * s;
    const q = -alpha * s + beta * c;

    hist.push({ alpha, beta, d, q });
    if (hist.length > 300) hist.shift();

    // --- 左：平面 ---
    {
      const { ctx, cx, cy } = plane; const R = 110;
      ctx.clearRect(0, 0, plane.w, plane.h);
      drawCircleGrid(ctx, cx, cy, R);
      // 静止 αβ 轴：标签往里收，避开旋转的 d/q 标签（它们在半径 R+18 的圆环上扫过）
      label(ctx, 'α', cx + R - 18, cy + 15, COL.dim);
      label(ctx, 'β', cx + 15, cy - R + 18, COL.dim);
      // 旋转 dq 轴（绿色）
      const dx = cx + Math.cos(th) * (R + 6), dy = cy - Math.sin(th) * (R + 6);
      const qx = cx + Math.cos(th + Math.PI / 2) * (R + 6), qy = cy - Math.sin(th + Math.PI / 2) * (R + 6);
      arrow(ctx, cx, cy, dx, dy, COL.dq, 1.5, 6);
      arrow(ctx, cx, cy, qx, qy, COL.dq, 1.5, 6);
      label(ctx, 'd', dx + 12 * Math.cos(th), dy - 12 * Math.sin(th), COL.dq);
      label(ctx, 'q', qx + 12 * Math.cos(th + Math.PI / 2), qy - 12 * Math.sin(th + Math.PI / 2), COL.dq);
      // 电流矢量
      const vx = cx + alpha * R, vy = cy - beta * R;
      arrow(ctx, cx, cy, vx, vy, COL.white, 3, 10);
      // 两行固定文字挪到 d/q 标签旋转圆环（半径 R+18）之外，避免转过去时叠字
      label(ctx, `同步=${(dqRatio * 100).toFixed(0)}%`, cx, 13, COL.dim, 13);
      label(ctx, `id=${d.toFixed(2)}  iq=${q.toFixed(2)}`, cx, cy + R + 38, COL.accent, 13);
    }
    // --- 右：波形 ---
    {
      const { ctx, w, h } = wave;
      ctx.clearRect(0, 0, w, h);
      const midY = h / 2, amp = h * 0.36;
      ctx.strokeStyle = COL.grid;
      ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();
      const series = [
        { k: 'alpha', color: COL.alpha, name: 'iα' },
        { k: 'beta', color: COL.beta, name: 'iβ' },
        { k: 'd', color: '#9b59b6', name: 'id' },
        { k: 'q', color: COL.warn, name: 'iq' }
      ];
      for (const sr of series) {
        ctx.strokeStyle = sr.color; ctx.lineWidth = sr.k === 'd' || sr.k === 'q' ? 2.5 : 1.5;
        ctx.beginPath();
        for (let i = 0; i < hist.length; i++) {
          const x = (i / 300) * w;
          const y = midY - hist[i][sr.k] * amp;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // 图例
      let lx = 14;
      for (const sr of series) { label(ctx, sr.name, lx, 16, sr.color, 13, 'left'); lx += 38; }
      label(ctx, dqRatio === 1 ? 'dq 同步 → id,iq 为直流' : 'dq 失步 → id,iq 变交流', w / 2, h - 14,
            dqRatio === 1 ? COL.good : COL.warn, 13);
    }
    readout.textContent = `id=${d.toFixed(3)}  iq=${q.toFixed(3)}`;
  }
  function tick() {
    if (player.playing) tDeg = (tDeg + 1.2) % 360;
    draw(); requestAnimationFrame(tick);
  }
  speedSlider.addEventListener('input', () => { speedVal.textContent = speedSlider.value + '%'; });
  tick();
})();

/* ============================================================
   第 4 章公用：开关码 <-> 空间矢量 / 相电压
   ============================================================ */
const SV_SQRT3 = Math.sqrt(3);
/* U1..U6 的开关码 (A,B,C)：U1=0°, U2=60°, ... U6=300° */
const SV_SW = [[1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1], [1, 0, 1]];
const SV_U0 = [0, 0, 0], SV_U7 = [1, 1, 1];
/** 开关码 -> 空间矢量 [α, β]（标幺到 Udc；有效矢量幅值 = 2/3） */
function svVec(sw) {
  const [a, b, c] = sw;
  return [(2 * a - b - c) / 3, (b - c) / SV_SQRT3];
}
/** 开关码 -> 三相相电压 [va, vb, vc]（标幺，对电机中性点） */
function svPhase(sw) {
  const [a, b, c] = sw;
  return [(2 * a - b - c) / 3, (2 * b - a - c) / 3, (2 * c - a - b) / 3];
}
/** 画正六边形（6 个顶点就是 6 个基本矢量的端点） */
function drawHex(ctx, cx, cy, R) {
  ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = i * Math.PI / 3;
    const x = cx + Math.cos(a) * R, y = cy - Math.sin(a) * R;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}
/** 由 uα,uβ 算七段式所需的一切（已用数值方式验证过正确性） */
function svCalc(m, deg) {
  const th = deg * Math.PI / 180;
  const mag = m / 2;                                  // 相电压幅值（标幺）；m=1.1547 → 1/√3
  const ua = mag * Math.cos(th), ub = mag * Math.sin(th);
  const X = SV_SQRT3 * ub;
  const Y = 1.5 * ua + SV_SQRT3 / 2 * ub;
  const Z = -1.5 * ua + SV_SQRT3 / 2 * ub;
  const code = (ub > 0 ? 1 : 0) + (SV_SQRT3 * ua - ub > 0 ? 2 : 0) + (-SV_SQRT3 * ua - ub > 0 ? 4 : 0);
  const LUT = [0, 2, 6, 1, 4, 3, 5, 0];               // code -> 几何扇区 1..6
  const s = LUT[code & 7];
  let t1, t2;                                          // t1 = 小角度那个矢量，t2 = 大角度那个
  switch (s) {
    case 1: t1 = -Z; t2 = X; break;
    case 2: t1 = Y; t2 = Z; break;
    case 3: t1 = X; t2 = -Y; break;
    case 4: t1 = Z; t2 = -X; break;
    case 5: t1 = -Y; t2 = -Z; break;
    default: t1 = -X; t2 = Y; break;                   // s = 6
  }
  const over = t1 + t2 > 1;                            // 过调制（超出六边形）
  if (over) { const k = 1 / (t1 + t2); t1 *= k; t2 *= k; }
  const t0 = (1 - t1 - t2) / 2;                        // 半个零矢量时间
  let d;
  switch (s) {
    case 1: d = [t1 + t2 + t0, t2 + t0, t0]; break;
    case 2: d = [t1 + t0, t1 + t2 + t0, t0]; break;
    case 3: d = [t0, t1 + t2 + t0, t2 + t0]; break;
    case 4: d = [t0, t1 + t0, t1 + t2 + t0]; break;
    case 5: d = [t2 + t0, t0, t1 + t2 + t0]; break;
    default: d = [t1 + t2 + t0, t0, t1 + t0]; break;   // s = 6
  }
  /* 七段：U0 → Us → U(s+1) → U7 → U(s+1) → Us → U0 */
  const segDur = [t0 / 2, t1 / 2, t2 / 2, t0, t2 / 2, t1 / 2, t0 / 2];
  const segSw = [SV_U0, SV_SW[s - 1], SV_SW[s % 6], SV_U7, SV_SW[s % 6], SV_SW[s - 1], SV_U0];
  return { s, code, t1, t2, t0, d, ua, ub, over, segDur, segSw };
}

/* ============================================================
   图 4-1：PWM 平均电压 —— 整个 SVPWM 的地基
   ============================================================ */
(function pwmBasic() {
  const c = setupCanvas('cv-pwm-basic');
  if (!c) return;
  const player = makePlayer('btn-pwm-play');
  const sDuty = document.getElementById('pwm-duty');
  const sVal = document.getElementById('pwm-duty-val');
  const readout = document.getElementById('pwm-readout');
  let phase = 0;

  function draw() {
    const D = +sDuty.value / 100;
    sVal.textContent = sDuty.value + '%';
    const { ctx, w } = c;
    ctx.clearRect(0, 0, w, c.h);

    const xa = 74, xb = w - 14, span = xb - xa;
    const yHi = 44, yLo = 104;
    const NP = 4, T = span / NP;
    const shift = (phase % 1) * T;

    /* ---------- 上：开关波形 ---------- */
    label(ctx, '开关波形：要么 Udc，要么 0，没有中间值', xa, 20, COL.dim, 12, 'left');
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xa, yHi); ctx.lineTo(xb, yHi);
    ctx.moveTo(xa, yLo); ctx.lineTo(xb, yLo);
    ctx.stroke();
    label(ctx, 'Udc', xa - 8, yHi, COL.dim, 11, 'right');
    label(ctx, '0', xa - 8, yLo, COL.dim, 11, 'right');

    ctx.strokeStyle = COL.accent; ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let p = 0; p <= NP; p++) {
      const s = xa + p * T - shift;
      const x1 = Math.max(xa, s), x2 = Math.min(xb, s + D * T);
      if (x2 <= xa || x1 >= xb) continue;
      p === 0 ? ctx.moveTo(x1, yLo) : ctx.lineTo(x1, yLo);
      ctx.lineTo(x1, yHi);
      ctx.lineTo(x2, yHi);
      ctx.lineTo(x2, yLo);
      if (p < NP) ctx.lineTo(Math.min(xb, xa + (p + 1) * T - shift), yLo);
    }
    ctx.stroke();

    /* 平均值虚线 */
    const yAvg = yLo - D * (yLo - yHi);
    ctx.strokeStyle = COL.warn; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(xa, yAvg); ctx.lineTo(xb, yAvg); ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, '平均 ' + D.toFixed(2) + '·Udc', xb - 2, yAvg - 12, COL.warn, 11.5, 'right');

    /* ---------- 下：电感电流 ---------- */
    const ycHi = 162, ycLo = 214;
    label(ctx, '电感电流：锯齿被「磨平」，只剩平均值', xa, 140, COL.dim, 12, 'left');
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xa, ycLo); ctx.lineTo(xb, ycLo); ctx.stroke();
    const ycAvg = ycLo - D * (ycLo - ycHi);
    ctx.strokeStyle = COL.warn; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(xa, ycAvg); ctx.lineTo(xb, ycAvg); ctx.stroke();
    ctx.setLineDash([]);
    const rip = 20 * 4 * D * (1 - D);
    ctx.strokeStyle = COL.beta; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = xa; x <= xb; x++) {
      const u = ((((x - xa + shift) / T) % 1) + 1) % 1;
      let f;
      if (D < 1e-4) f = 0;
      else if (u < D) f = -0.5 + u / D;
      else f = 0.5 - (u - D) / Math.max(1e-6, 1 - D);
      const y = ycAvg - rip * f;
      x === xa ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    readout.textContent = `占空比 ${(D * 100).toFixed(0)}% → 平均电压 ${D.toFixed(2)}·Udc`;
  }
  function tick() {
    if (player.playing) phase += 0.012;
    draw(); requestAnimationFrame(tick);
  }
  sDuty.addEventListener('input', draw);
  document.addEventListener('canvas-theme-change', draw);
  tick();
})();

/* ============================================================
   图 4-2：逆变器只有 8 种状态（可拨开关）
   ============================================================ */
(function svSwitchPanel() {
  const c = setupCanvas('cv-sv-switch');
  if (!c) return;
  const btns = ['sw-a', 'sw-b', 'sw-c'].map(id => document.getElementById(id));
  const autoBtn = document.getElementById('btn-sw-auto');
  const readout = document.getElementById('sw-readout');
  const SEQ = [SV_U0].concat(SV_SW, [SV_U7]);     // 000,100,110,010,011,001,101,111
  let sw = [1, 0, 0];
  let auto = false, idx = 1, acc = 0, last = performance.now();

  btns.forEach((b, i) => b.addEventListener('click', () => {
    sw[i] = sw[i] ? 0 : 1;
    auto = false; autoBtn.classList.remove('active'); autoBtn.textContent = '▶ 轮流切换';
    draw();
  }));
  autoBtn.addEventListener('click', () => {
    auto = !auto;
    autoBtn.classList.toggle('active', auto);
    autoBtn.textContent = auto ? '⏸ 停止' : '▶ 轮流切换';
    acc = 0;
  });

  function draw() {
    const { ctx } = c;
    ctx.clearRect(0, 0, c.w, c.h);
    btns.forEach((b, i) => {
      b.textContent = 'ABC'[i] + ' = ' + sw[i];
      b.classList.toggle('active', !!sw[i]);
    });

    /* ---------- 左：六边形 ---------- */
    const cx = 112, cy = 130, R = 84, S = R / (2 / 3);
    drawHex(ctx, cx, cy, R);
    let curName = null;
    const svNow = svVec(sw);
    const nowMag = Math.hypot(svNow[0], svNow[1]);
    const nowAng = (Math.atan2(svNow[1], svNow[0]) * 180 / Math.PI + 360) % 360;
    for (let i = 0; i < 6; i++) {
      const v = svVec(SV_SW[i]);
      const on = SV_SW[i][0] === sw[0] && SV_SW[i][1] === sw[1] && SV_SW[i][2] === sw[2];
      arrow(ctx, cx, cy, cx + v[0] * S, cy - v[1] * S, on ? COL.accent : COL.grid, on ? 3.4 : 1.3, on ? 10 : 5);
      label(ctx, 'U' + (i + 1), cx + v[0] * S * 1.2, cy - v[1] * S * 1.2 - 1, on ? COL.accent : COL.dim, 12);
      if (on) curName = 'U' + (i + 1);
    }
    /* 当前合成矢量的极坐标读数（实时验证表 4-1 的「大小/角度」两列） */
    label(ctx, `当前矢量 ${nowMag.toFixed(3)} Udc @ ${nowAng.toFixed(0)}°`,
      cx, cy + 52, COL.warn, 11);
    const isZero = sw[0] === sw[1] && sw[1] === sw[2];
    ctx.fillStyle = isZero ? COL.warn : COL.grid;
    ctx.beginPath(); ctx.arc(cx, cy, isZero ? 7 : 4, 0, TAU); ctx.fill();
    label(ctx, isZero ? (sw[0] ? 'U₇' : 'U₀') : 'U₀ / U₇', cx, cy + 20, isZero ? COL.warn : COL.dim, 11);
    if (isZero) curName = sw[0] ? 'U₇' : 'U₀';

    /* ---------- 中：三个桥臂 ---------- */
    const bx = [240, 292, 344], bw = 38;
    const yTop = 58, yMid = 104, bus1 = 44, bus2 = 166;
    ctx.strokeStyle = COL.a; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx[0] - 14, bus1); ctx.lineTo(bx[2] + bw + 4, bus1); ctx.stroke();
    ctx.strokeStyle = COL.dim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx[0] - 14, bus2); ctx.lineTo(bx[2] + bw + 4, bus2); ctx.stroke();
    label(ctx, '+Udc', bx[0] - 18, bus1, COL.a, 10.5, 'right');
    label(ctx, 'GND', bx[0] - 18, bus2, COL.dim, 10.5, 'right');

    for (let i = 0; i < 3; i++) {
      const x = bx[i], on = sw[i];
      ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + bw / 2, bus1); ctx.lineTo(x + bw / 2, yTop);
      ctx.moveTo(x + bw / 2, yTop + 40); ctx.lineTo(x + bw / 2, yMid);
      ctx.moveTo(x + bw / 2, yMid + 6); ctx.lineTo(x + bw / 2, bus2);
      ctx.stroke();
      const drawSw = (y, active) => {
        ctx.beginPath(); ctx.rect(x, y, bw, 40);
        if (active) { ctx.fillStyle = COL.accent; ctx.fill(); }
        ctx.strokeStyle = active ? COL.accent : COL.dim; ctx.lineWidth = 1.6; ctx.stroke();
        label(ctx, active ? 'ON' : 'off', x + bw / 2, y + 20, active ? '#10241c' : COL.dim, 11);
      };
      drawSw(yTop, on);
      drawSw(yMid + 6, !on);
      ctx.strokeStyle = COL.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + bw, yMid + 3); ctx.lineTo(x + bw + 12, yMid + 3); ctx.stroke();
      label(ctx, 'ABC'[i], x + bw + 22, yMid + 3, COL.accent, 13);
    }

    /* ---------- 右：三相电压柱 ---------- */
    const vx = [438, 484, 530], vw = 26, vy = 124, VS = 78;
    label(ctx, '三相相电压 / Udc', 484, 28, COL.dim, 12);
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    [2 / 3, 1 / 3, -1 / 3, -2 / 3].forEach(v => {
      const y = vy - v * VS;
      ctx.beginPath(); ctx.moveTo(424, y); ctx.lineTo(552, y); ctx.stroke();
      label(ctx, (v > 0 ? '+' : '') + v.toFixed(2), 418, y - 7, COL.dim, 9.5, 'right');  // 放在网格线上方，避开 A/B/C 相标签
    });
    ctx.setLineDash([]);
    ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(424, vy); ctx.lineTo(552, vy); ctx.stroke();
    const ph = svPhase(sw);
    const pc = [COL.a, COL.b, COL.c];
    for (let i = 0; i < 3; i++) {
      const hh = -ph[i] * VS;
      const y0 = vy, y1 = vy + hh;
      ctx.fillStyle = pc[i]; ctx.globalAlpha = 0.85;
      ctx.fillRect(vx[i], Math.min(y0, y1), vw, Math.abs(hh));
      ctx.globalAlpha = 1;
      label(ctx, (ph[i] >= 0 ? '+' : '') + ph[i].toFixed(2), vx[i] + vw / 2,
        hh >= 0 ? y1 - 9 : y1 + 9, pc[i], 10.5);
      label(ctx, 'v' + 'abc'[i], vx[i] + vw / 2, vy + 96, COL.dim, 12);
    }
    const vnGnd = (sw[0] + sw[1] + sw[2]) / 3;
    label(ctx, '三相之和恒为 0', 424, vy + 108, COL.dim, 10.5, 'left');
    label(ctx, `中性点电位 = ${vnGnd.toFixed(2)} Udc`, 424, vy + 124, COL.warn, 10.5, 'left');

    readout.textContent = `(A,B,C)=(${sw.join(',')}) → ${curName}　相电压 (${ph.map(v => (v >= 0 ? '+' : '') + v.toFixed(2)).join(', ')})　中性点 ${vnGnd.toFixed(2)} Udc　合成矢量 ${nowMag.toFixed(3)} Udc @ ${nowAng.toFixed(0)}°`;
  }
  function tick(now) {
    const dt = (now - last) / 1000; last = now;
    if (auto) {
      acc += dt;
      if (acc > 0.85) {
        acc = 0; idx = (idx + 1) % SEQ.length;
        sw = SEQ[idx].slice();
      }
    }
    draw(); requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ============================================================
   图 4-3：伏秒平衡 —— 时间加权平均
   ============================================================ */
(function svVsec() {
  const c = setupCanvas('cv-sv-vsec');
  if (!c) return;
  const s1 = document.getElementById('vs-t1');
  const s2 = document.getElementById('vs-t2');
  const v1 = document.getElementById('vs-t1-val');
  const v2 = document.getElementById('vs-t2-val');
  const sweepBtn = document.getElementById('btn-vs-sweep');
  const readout = document.getElementById('vs-readout');
  let sweeping = false, k = 0.5, dir = 1;

  sweepBtn.addEventListener('click', () => {
    sweeping = !sweeping;
    sweepBtn.textContent = sweeping ? '⏸ 停止演示' : '▶ 演示：扫过扇区';
    sweepBtn.classList.toggle('active', sweeping);
  });

  const V1 = svVec(SV_SW[0]);   // [2/3, 0]
  const V2 = svVec(SV_SW[1]);   // [1/3, 1/√3]

  function draw() {
    let t1 = +s1.value / 100, t2 = +s2.value / 100;
    if (sweeping) {
      const total = Math.min(1, (+s1.value + +s2.value) / 100) || 0.75;
      k += 0.007 * dir;
      if (k >= 1) { k = 1; dir = -1; }
      if (k <= 0) { k = 0; dir = 1; }
      t2 = total * k; t1 = total * (1 - k);
      s1.value = Math.round(t1 * 100); s2.value = Math.round(t2 * 100);
    }
    let total = t1 + t2;
    if (total > 1) { t1 /= total; t2 /= total; total = 1; }
    const t0 = 1 - total;
    v1.textContent = t1.toFixed(2);
    v2.textContent = t2.toFixed(2);

    const { ctx } = c;
    ctx.clearRect(0, 0, c.w, c.h);

    /* ---------- 左：矢量图 ---------- */
    // cx 右移 + 标签系数 1.19→1.12：U4 标签原来被画布左边缘裁掉
    const cx = 114, cy = 148, R = 86, S = R / (2 / 3);
    drawHex(ctx, cx, cy, R);
    for (let i = 0; i < 6; i++) {
      const v = svVec(SV_SW[i]);
      const hot = (i === 0 || i === 1);
      arrow(ctx, cx, cy, cx + v[0] * S, cy - v[1] * S, hot ? COL.grid : COL.grid, 1.3, 5);
      label(ctx, 'U' + (i + 1), cx + v[0] * S * 1.12, cy - v[1] * S * 1.12 - 1, hot ? COL.dim : COL.dim, 11);
    }
    // 两个有效矢量画亮一点
    arrow(ctx, cx, cy, cx + V1[0] * S, cy - V1[1] * S, COL.good, 2.4, 9);
    arrow(ctx, cx, cy, cx + V2[0] * S, cy - V2[1] * S, COL.beta, 2.4, 9);

    // 分步走：先沿 U1 走 t1，再沿 U2 走 t2
    const p1x = cx + V1[0] * S * t1, p1y = cy - V1[1] * S * t1;
    const ax = V1[0] * S * t1 + V2[0] * S * t2;
    const ay = -(V1[1] * S * t1 + V2[1] * S * t2);
    const p2x = cx + ax, p2y = cy + ay;
    ctx.setLineDash([5, 4]); ctx.lineWidth = 2;
    ctx.strokeStyle = COL.good;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p1x, p1y); ctx.stroke();
    ctx.strokeStyle = COL.beta;
    ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke();
    ctx.setLineDash([]);
    // "不掺零矢量"会到哪
    if (total > 1e-4) {
      const fx = cx + ax / total, fy = cy + ay / total;
      ctx.strokeStyle = COL.warn; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(p2x, p2y); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COL.warn;
      ctx.beginPath(); ctx.arc(fx, fy, 3.5, 0, TAU); ctx.fill();
    }
    // 平均矢量
    arrow(ctx, cx, cy, p2x, p2y, COL.white, 3.4, 12);
    label(ctx, '白色粗箭头 = 平均矢量', 114, 262, COL.white, 11);

    /* ---------- 右：时间条 ---------- */
    const x0 = 218, x1 = 545, by = 62, bh = 34;
    label(ctx, '一个 PWM 周期 Ts 里的时间分配', (x0 + x1) / 2, 34, COL.dim, 12);
    const segs = [[t1, COL.good, 'T₁'], [t2, COL.beta, 'T₂'], [t0, COL.grid, 'T₀']];
    let cxr = x0;
    segs.forEach(([v, col, nm]) => {
      const wd = v * (x1 - x0);
      ctx.fillStyle = col; ctx.globalAlpha = 0.9;
      ctx.fillRect(cxr, by, wd, bh);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = COL.bg; ctx.lineWidth = 1;
      ctx.strokeRect(cxr, by, wd, bh);
      if (wd > 44) label(ctx, nm, cxr + wd / 2, by + bh / 2, '#0d1117', 12);
      if (wd > 60) label(ctx, v.toFixed(2), cxr + wd / 2, by + bh + 12, col, 11);
      cxr += wd;
    });
    // 文字推导
    label(ctx, `平均矢量 = ${t1.toFixed(2)}·U₁ + ${t2.toFixed(2)}·U₂ + ${t0.toFixed(2)}·0`,
      x0, 132, COL.white, 13, 'left');
    const mx = ax / S, my = -ay / S;
    const mag = Math.hypot(mx, my), ang = Math.atan2(my, mx) * 180 / Math.PI;
    label(ctx, `　　　　 = 幅值 ${mag.toFixed(3)} Udc，方向 ${((ang % 360) + 360) % 360 | 0}°`,
      x0, 156, COL.accent, 13, 'left');
    label(ctx, 'T₁ : T₂ 的比例 → 决定方向（端点落在两矢量连线上）', x0, 190, COL.dim, 11.5, 'left');
    label(ctx, '零矢量 T₀ 掺多少 → 决定大小（掺得越多，越往原点拉）', x0, 212, COL.dim, 11.5, 'left');
    label(ctx, '橙点 = 一点零矢量都不掺时能到的最远处（六边形边界）', x0, 234, COL.warn, 11.5, 'left');
    label(ctx, '两个矢量 + 零矢量 = 覆盖整个三角形扇区', x0, 256, COL.dim, 11.5, 'left');

    readout.textContent = `T₁=${t1.toFixed(2)}  T₂=${t2.toFixed(2)}  T₀=${t0.toFixed(2)}  平均矢量 |U|=${mag.toFixed(3)} Udc`;
  }
  function tick() { draw(); requestAnimationFrame(tick); }
  [s1, s2].forEach(el => el.addEventListener('input', draw));
  document.addEventListener('canvas-theme-change', draw);
  tick();
})();

/* ============================================================
   图 4-4：七段式时序（六边形 + 时间条 + 三相 PWM 波形）
   ============================================================ */
(function sv7seg() {
  const c = setupCanvas('cv-sv-7seg');
  if (!c) return;
  const player = makePlayer('btn-7seg-play');
  const sPos = document.getElementById('seg-pos');
  const sTh = document.getElementById('seg-th');
  const sMod = document.getElementById('seg-mod');
  const vPos = document.getElementById('seg-pos-val');
  const vTh = document.getElementById('seg-th-val');
  const vMod = document.getElementById('seg-mod-val');
  const readout = document.getElementById('seg-readout');
  let pos = 0.30;

  function draw() {
    const m = +sMod.value / 100;
    const deg = +sTh.value;
    vMod.textContent = m.toFixed(2);
    vTh.textContent = deg + '°';
    vPos.textContent = pos.toFixed(2);
    const r = svCalc(m, deg);

    const { ctx } = c;
    ctx.clearRect(0, 0, c.w, c.h);

    /* ---------- 上左：六边形 ---------- */
    const cx = 100, cy = 100, R = 60, S = R / (2 / 3);
    drawHex(ctx, cx, cy, R);
    for (let i = 0; i < 6; i++) {
      const v = svVec(SV_SW[i]);
      arrow(ctx, cx, cy, cx + v[0] * S, cy - v[1] * S, COL.grid, 1.3, 5);
      label(ctx, 'U' + (i + 1), cx + v[0] * S * 1.2, cy - v[1] * S * 1.2 - 1,
        (i === r.s - 1 || i === r.s % 6) ? COL.accent : COL.dim, 11);
    }
    // 当前段
    let acc = 0, cur = 0;
    for (let i = 0; i < 7; i++) {
      if (pos < acc + r.segDur[i] || i === 6) { cur = i; break; }
      acc += r.segDur[i];
    }
    const segCol = [COL.dim, COL.good, COL.beta, COL.warn, COL.beta, COL.good, COL.dim];
    const cvv = svVec(r.segSw[cur]);
    if (cur === 0 || cur === 3) {
      ctx.fillStyle = segCol[cur];
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill();
      label(ctx, cur === 3 ? 'U₇' : 'U₀', cx + 14, cy - 12, segCol[cur], 12, 'left');
    } else {
      arrow(ctx, cx, cy, cx + cvv[0] * S, cy - cvv[1] * S, segCol[cur], 3.2, 10);
    }
    arrow(ctx, cx, cy, cx + r.ua * S, cy - r.ub * S, COL.white, 3, 11);
    label(ctx, `扇区 ${r.s}`, cx, 26, COL.accent, 12);

    /* ---------- 上右：七段时间条 ---------- */
    const x0 = 190, x1 = 545, by = 48, bh = 38;
    label(ctx, '一个 PWM 周期分成 7 段（左右对称）', (x0 + x1) / 2, 28, COL.dim, 12);
    let cxr = x0;
    for (let i = 0; i < 7; i++) {
      const wd = r.segDur[i] * (x1 - x0);
      ctx.fillStyle = segCol[i]; ctx.globalAlpha = cur === i ? 1 : 0.5;
      ctx.fillRect(cxr, by, wd, bh);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = COL.bg; ctx.lineWidth = 1;
      ctx.strokeRect(cxr, by, wd, bh);
      if (wd > 30) label(ctx, r.segSw[i].join(''), cxr + wd / 2, by + bh / 2, '#0d1117', 11);
      cxr += wd;
    }
    const sx = x0 + pos * (x1 - x0);
    ctx.strokeStyle = COL.warn; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, by - 6); ctx.lineTo(sx, by + bh + 6); ctx.stroke();
    const curName = cur === 0 ? 'U₀' : cur === 3 ? 'U₇' : 'U' + ((cur === 1 || cur === 5) ? r.s : (r.s % 6) + 1);
    label(ctx, `当前：${curName} (${r.segSw[cur].join('')})`, x0, 112, segCol[cur], 13, 'left');
    label(ctx, `T₁=${r.t1.toFixed(3)}  T₂=${r.t2.toFixed(3)}  T₀=${(2 * r.t0).toFixed(3)}`, x0, 136, COL.dim, 12, 'left');
    label(ctx, `占空比  D=(${r.d.map(v => v.toFixed(3)).join(', ')})`, x0, 160, COL.dim, 12, 'left');

    /* ---------- 下：三相 PWM 波形 ---------- */
    label(ctx, '三相 PWM 波形（白色箭头 = 平均矢量）：中心对齐 → 每相一周期只开关两次', 70, 190, COL.dim, 12, 'left');
    const xL = 70, xR = 545, mid = (xL + xR) / 2, W = xR - xL;
    const yT = [214, 262, 310], yB = [246, 294, 342];
    const pc = [COL.a, COL.b, COL.c];
    for (let ph = 0; ph < 3; ph++) {
      const d = r.d[ph], hw = d * W / 2;
      ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xL, yB[ph]); ctx.lineTo(xR, yB[ph]); ctx.stroke();
      ctx.fillStyle = pc[ph]; ctx.globalAlpha = 0.14;
      ctx.fillRect(mid - hw, yT[ph], 2 * hw, yB[ph] - yT[ph]);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pc[ph]; ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(xL, yB[ph]);
      ctx.lineTo(mid - hw, yB[ph]);
      ctx.lineTo(mid - hw, yT[ph]);
      ctx.lineTo(mid + hw, yT[ph]);
      ctx.lineTo(mid + hw, yB[ph]);
      ctx.lineTo(xR, yB[ph]);
      ctx.stroke();
      label(ctx, 'ABC'[ph], 52, (yT[ph] + yB[ph]) / 2, pc[ph], 14, 'left');
      label(ctx, 'D=' + d.toFixed(3), xR - 2, yT[ph] - 9, COL.dim, 11, 'right');
    }
    const wx = xL + pos * W;
    ctx.strokeStyle = COL.warn; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(wx, 198); ctx.lineTo(wx, 350); ctx.stroke();
    label(ctx, '← 一个 PWM 周期 Ts →', mid, 362, COL.dim, 11);

    readout.textContent = `θ=${deg}°  扇区 ${r.s}${r.over ? '（过调制已限幅）' : ''}  当前 ${curName}(${r.segSw[cur].join('')})  T₁=${r.t1.toFixed(2)} T₂=${r.t2.toFixed(2)} T₀=${(2 * r.t0).toFixed(2)}`;
  }
  function tick() {
    if (player.playing) {
      pos = (pos + 0.004) % 1;
      sPos.value = Math.round(pos * 1000);
    } else {
      pos = +sPos.value / 1000;
    }
    draw(); requestAnimationFrame(tick);
  }
  sPos.addEventListener('input', () => { pos = +sPos.value / 1000; draw(); });
  [sTh, sMod].forEach(el => el.addEventListener('input', draw));
  document.addEventListener('canvas-theme-change', draw);
  tick();
})();

/* ============================================================
   图 4-3b：扇区法全景（六边形扇区 + 作用时间 + 两套编号对照）
   ============================================================ */
(function sectorPanel() {
  const c = setupCanvas('cv-sector');
  if (!c) return;
  const { ctx, w, h } = c;
  const player = makePlayer('btn-sec-play');
  const sTh = document.getElementById('sec-th');
  const sMod = document.getElementById('sec-mod');
  const vTh = document.getElementById('sec-th-val');
  const vMod = document.getElementById('sec-mod-val');
  const readout = document.getElementById('sec-readout');
  const segBox = document.getElementById('seg-sector-mode');
  let mode = 'geo', theta = 37;

  segBox.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    mode = b.dataset.val;
    segBox.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    draw();
  });
  sTh.addEventListener('input', () => { theta = +sTh.value; vTh.textContent = theta + '°'; draw(); });
  sMod.addEventListener('input', () => { vMod.textContent = (+sMod.value / 100).toFixed(2); draw(); });

  /* 符号位扇区（模拟原版 code 直接映射），用于对照演示 */
  function sectFromCode(code) {
    const M = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
    return M[code] || 1;
  }

  function draw() {
    const m = +sMod.value / 100;
    vTh.textContent = theta + '°';
    vMod.textContent = m.toFixed(2);
    const r = svCalc(m, theta);
    const secN = mode === 'geo' ? r.s : sectFromCode(r.code);
    const vk = secN, vk1 = (secN % 6) + 1;
    const R6 = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

    ctx.clearRect(0, 0, w, h);

    /* ---------- 左：六边形 + 扇形 ---------- */
    const cx = 185, cy = 172, R = 118, S = R / (2 / 3);
    for (let i = 1; i <= 6; i++) {
      const a0 = (i - 1) * Math.PI / 3, a1 = i * Math.PI / 3;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      for (let k = 0; k <= 20; k++) {
        const a = a0 + (a1 - a0) * k / 20;
        ctx.lineTo(cx + Math.cos(a) * R, cy - Math.sin(a) * R);
      }
      ctx.closePath();
      ctx.fillStyle = i === secN ? 'rgba(77,208,166,0.14)' : COL.faint;
      ctx.fill();
    }
    ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = i * Math.PI / 3, x = cx + Math.cos(a) * R, y = cy - Math.sin(a) * R;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    /* 内切圆 + 外接圆 */
    const Rlin = R * Math.cos(Math.PI / 6);
    ctx.setLineDash([4, 4]); ctx.strokeStyle = COL.grid; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, Rlin, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(231,76,60,0.5)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    /* 6 个基本矢量 */
    for (let i = 0; i < 6; i++) {
      const v = svVec(SV_SW[i]);
      const hot = (i + 1 === vk || i + 1 === vk1);
      arrow(ctx, cx, cy, cx + v[0] * S, cy - v[1] * S, hot ? COL.good : COL.grid, hot ? 2.6 : 1.3, hot ? 9 : 5);
      label(ctx, 'U' + (i + 1), cx + v[0] * S * 1.13, cy - v[1] * S * 1.13, hot ? COL.good : COL.dim, 11.5);
    }
    /* 加权路径 */
    const V1 = svVec(SV_SW[vk - 1]), V2 = svVec(SV_SW[vk1 - 1]);
    const p1x = cx + V1[0] * S * r.t1, p1y = cy - V1[1] * S * r.t1;
    const p2x = p1x + V2[0] * S * r.t2, p2y = p1y - V2[1] * S * r.t2;
    ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6;
    ctx.strokeStyle = COL.good;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p1x, p1y); ctx.stroke();
    ctx.strokeStyle = COL.beta;
    ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke();
    ctx.setLineDash([]);
    /* 目标矢量 */
    arrow(ctx, cx, cy, cx + r.ua * S, cy - r.ub * S, r.over ? COL.warn : COL.white, 3.2, 11);
    label(ctx, r.over ? 'Uref（过调制·已限幅）' : 'Uref',
      cx + r.ua * S * 1.05, cy - r.ub * S * 1.05 - 13, r.over ? COL.warn : COL.white, 12);
    /* 角度弧 */
    ctx.strokeStyle = COL.warn; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, -theta * Math.PI / 180, true); ctx.stroke();
    label(ctx, theta.toFixed(0) + '°',
      cx + 42 * Math.cos(theta * Math.PI / 360), cy - 42 * Math.sin(theta * Math.PI / 360) - 10, COL.warn, 11);
    /* αβ 轴 */
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx - R - 22, cy); ctx.lineTo(cx + R + 30, cy);
    ctx.moveTo(cx, cy - R - 22); ctx.lineTo(cx, cy + R + 34); ctx.stroke();
    label(ctx, 'α', cx + R + 36, cy + 2, COL.dim, 12);
    label(ctx, 'β', cx, cy - R - 30, COL.dim, 12);
    /* 圆标注（带引线，避免压住矢量） */
    ctx.strokeStyle = '#3a4658'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(cx + Rlin * Math.cos(20 * Math.PI / 180), cy - Rlin * Math.sin(20 * Math.PI / 180));
    ctx.lineTo(cx + Rlin * Math.cos(20 * Math.PI / 180) + 22, cy - Rlin * Math.sin(20 * Math.PI / 180) - 26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + R * Math.cos(152 * Math.PI / 180), cy - R * Math.sin(152 * Math.PI / 180));
    ctx.lineTo(cx + R * Math.cos(152 * Math.PI / 180) - 8, cy - R * Math.sin(152 * Math.PI / 180) - 16);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, '内切圆 Udc/√3（m=1）', cx + Rlin * Math.cos(20 * Math.PI / 180) + 26,
      cy - Rlin * Math.sin(20 * Math.PI / 180) - 30, COL.dim, 10.5, 'left');
    label(ctx, '外接圆 2Udc/3（方波）', cx + R * Math.cos(152 * Math.PI / 180),
      cy - R * Math.sin(152 * Math.PI / 180) - 22, 'rgba(231,76,60,.9)', 10.5);

    /* ---------- 右：时间轴 ---------- */
    const x0 = 430, x1 = 915, by = 76, bh = 42;
    label(ctx, '一个 PWM 周期 Ts 的时间分配', (x0 + x1) / 2, 44, COL.dim, 12.5);
    const cols = [COL.dim, COL.good, COL.beta, COL.warn, COL.beta, COL.good, COL.dim];
    const names = ['U₀', 'U' + vk, 'U' + vk1, 'U₇', 'U' + vk1, 'U' + vk, 'U₀'];
    let cur = x0;
    for (let i = 0; i < 7; i++) {
      const wd = r.segDur[i] * (x1 - x0);
      ctx.fillStyle = cols[i]; ctx.globalAlpha = 0.9;
      ctx.fillRect(cur, by, wd, bh); ctx.globalAlpha = 1;
      ctx.strokeStyle = COL.bg; ctx.lineWidth = 1; ctx.strokeRect(cur, by, wd, bh);
      if (wd > 30) label(ctx, names[i], cur + wd / 2, by + bh / 2, '#0d1117', 12.5);
      cur += wd;
    }
    const segCum = []; let acc = 0;
    for (let i = 0; i < 7; i++) { segCum.push(acc); acc += r.segDur[i]; }
    label(ctx, 'T1/2', x0 + (x1 - x0) * (segCum[1] + r.segDur[1] / 2), by + bh + 15, COL.good, 11);
    label(ctx, 'T2/2', x0 + (x1 - x0) * (segCum[2] + r.segDur[2] / 2), by + bh + 15, COL.beta, 11);
    label(ctx, 'T0/2', x0 + (x1 - x0) * (segCum[3] + r.segDur[3] / 2), by + bh + 15, COL.warn, 11);
    label(ctx, 't1 = T1/Ts = ' + r.t1.toFixed(3), x0, by - 18, COL.good, 12.5, 'left');
    label(ctx, 't2 = T2/Ts = ' + r.t2.toFixed(3), x0 + 186, by - 18, COL.beta, 12.5, 'left');
    label(ctx, 't0 = T0/(2Ts) = ' + r.t0.toFixed(3), x0 + 372, by - 18, COL.warn, 12.5, 'left');

    /* 三相开关条带 */
    const py = 200, PH = 17;
    label(ctx, '三相上管通断（1=上管通）', x0, py - 20, COL.dim, 12, 'left');
    for (let p = 0; p < 3; p++) {
      const col = [COL.a, COL.b, COL.c][p];
      label(ctx, 'ABC'[p], x0 - 14, py + p * (PH + 9) + PH / 2, col, 12.5);
      for (let i = 0; i < 7; i++) {
        const on = r.segSw[i][p];
        const wd = r.segDur[i] * (x1 - x0), x = x0 + segCum[i] * (x1 - x0);
        ctx.fillStyle = on ? col : COL.boxFill;
        ctx.globalAlpha = on ? 0.9 : 1;
        ctx.fillRect(x, py + p * (PH + 9), wd, PH);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = COL.grid; ctx.lineWidth = 0.8;
        ctx.strokeRect(x, py + p * (PH + 9), wd, PH);
      }
    }

    readout.textContent = `code=${r.code}　${mode === 'geo' ? '几何扇区 ' + secN : '符号位扇区 ' + R6[secN]}`
      + `　合成用 U${vk} & U${vk1}　T1=${r.t1.toFixed(3)} T2=${r.t2.toFixed(3)} T0=${(r.t0 * 2).toFixed(3)}`
      + (r.over ? '　⚠ 过调制（已限幅）' : '');
  }
  function tick() {
    if (player.playing) { theta = (theta + 0.45) % 360; if (sTh) sTh.value = Math.round(theta); draw(); }
    requestAnimationFrame(tick);
  }
  document.addEventListener('canvas-theme-change', draw);
  draw();
  requestAnimationFrame(tick);
})();

/* ============================================================
   图 4-3c：七段式时间轴 + 三相桥臂状态（扇区法配套）
   ============================================================ */
(function segDetailPanel() {
  const c = setupCanvas('cv-seg-detail');
  if (!c) return;
  const { ctx, w, h } = c;
  const player = makePlayer('btn-seg2-play');
  const sPos = document.getElementById('seg2-pos');
  const sTh = document.getElementById('seg2-th');
  const sMod = document.getElementById('seg2-mod');
  const vPos = document.getElementById('seg2-pos-val');
  const vTh = document.getElementById('seg2-th-val');
  const vMod = document.getElementById('seg2-mod-val');
  const readout = document.getElementById('seg2-readout');
  let pos = 0.30;

  sPos.addEventListener('input', () => { pos = +sPos.value / 1000; draw(); });
  [sTh, sMod].forEach(el => el.addEventListener('input', draw));

  function draw() {
    const m = +sMod.value / 100, deg = +sTh.value;
    vPos.textContent = pos.toFixed(2); vTh.textContent = deg + '°'; vMod.textContent = m.toFixed(2);
    const r = svCalc(m, deg);
    ctx.clearRect(0, 0, w, h);

    /* 左：小六边形 */
    const cx = 112, cy = 140, R = 74, S = R / (2 / 3);
    for (let i = 1; i <= 6; i++) {
      const a0 = (i - 1) * Math.PI / 3, a1 = i * Math.PI / 3;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      for (let k = 0; k <= 12; k++) {
        const a = a0 + (a1 - a0) * k / 12;
        ctx.lineTo(cx + Math.cos(a) * R, cy - Math.sin(a) * R);
      }
      ctx.closePath();
      ctx.fillStyle = i === r.s ? 'rgba(77,208,166,0.16)' : COL.faint; ctx.fill();
    }
    ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.3; ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = i * Math.PI / 3, x = cx + Math.cos(a) * R, y = cy - Math.sin(a) * R;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const v = svVec(SV_SW[i]);
      const hot = (i === r.s - 1 || i === r.s % 6);
      arrow(ctx, cx, cy, cx + v[0] * S, cy - v[1] * S, hot ? COL.good : COL.grid, 2, 6);
      label(ctx, 'U' + (i + 1), cx + v[0] * S * 1.16, cy - v[1] * S * 1.16, hot ? COL.good : COL.dim, 10.5);
    }
    let acc = 0, curSeg = 6;
    for (let i = 0; i < 7; i++) { if (pos < acc + r.segDur[i] || i === 6) { curSeg = i; break; } acc += r.segDur[i]; }
    const scol = [COL.dim, COL.good, COL.beta, COL.warn, COL.beta, COL.good, COL.dim];
    const cvv = svVec(r.segSw[curSeg]);
    const isZero = (curSeg === 0 || curSeg === 3);
    if (isZero) {
      ctx.fillStyle = scol[curSeg];
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill();
      label(ctx, curSeg === 3 ? 'U₇' : 'U₀', cx + 16, cy - 12, scol[curSeg], 12);
    } else {
      arrow(ctx, cx, cy, cx + cvv[0] * S, cy - cvv[1] * S, scol[curSeg], 3.4, 10);
    }
    arrow(ctx, cx, cy, cx + r.ua * S, cy - r.ub * S, COL.white, 2.8, 10);
    label(ctx, '扇区 ' + r.s, cx, cy + R + 44, COL.accent, 12);
    label(ctx, 't1=' + r.t1.toFixed(2) + '  t2=' + r.t2.toFixed(2) + '  t0=' + r.t0.toFixed(3),
      cx, cy + R + 62, COL.dim, 11);

    /* 右：时间条 */
    const x0 = 250, x1 = 920, by = 88, bh = 46;
    label(ctx, '七段式时间轴（宽度 = 实际时长）', (x0 + x1) / 2, 52, COL.dim, 12.5);
    const cum = []; let a2 = 0;
    for (let i = 0; i < 7; i++) { cum.push(a2); a2 += r.segDur[i]; }
    const sn = ['U₀', 'U' + r.s, 'U' + (r.s % 6 + 1), 'U₇', 'U' + (r.s % 6 + 1), 'U' + r.s, 'U₀'];
    let cur = x0;
    for (let i = 0; i < 7; i++) {
      const wd = r.segDur[i] * (x1 - x0);
      ctx.fillStyle = scol[i]; ctx.globalAlpha = 0.88;
      ctx.fillRect(cur, by, wd, bh); ctx.globalAlpha = 1;
      ctx.strokeStyle = COL.bg; ctx.lineWidth = 1; ctx.strokeRect(cur, by, wd, bh);
      if (wd > 34) {
        const dark = (i === 1 || i === 5);
        label(ctx, sn[i], cur + wd / 2, by + bh / 2 - 6, dark ? '#0d1117' : '#ffffff', 12.5);
        label(ctx, r.segSw[i].join(''), cur + wd / 2, by + bh / 2 + 10, dark ? '#0d1117' : '#ffffff', 10.5);
      }
      cur += wd;
    }
    const sx = x0 + pos * (x1 - x0);
    ctx.strokeStyle = COL.white; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(sx, by - 12); ctx.lineTo(sx, by + bh + 22); ctx.stroke();
    ctx.fillStyle = COL.white;
    ctx.beginPath(); ctx.arc(sx, by - 14, 3.4, 0, TAU); ctx.fill();

    /* 三相 PWM */
    const py = 196, PH = 15;
    label(ctx, '三相上管通断（中心对齐，每相一整段）', x0, py - 22, COL.dim, 12, 'left');
    for (let p = 0; p < 3; p++) {
      const col = [COL.a, COL.b, COL.c][p];
      label(ctx, 'ABC'[p], x0 - 16, py + p * (PH + 9) + PH / 2, col, 12.5);
      for (let i = 0; i < 7; i++) {
        const on = r.segSw[i][p];
        const wd = r.segDur[i] * (x1 - x0), x = x0 + cum[i] * (x1 - x0);
        ctx.fillStyle = on ? col : COL.boxFill;
        ctx.globalAlpha = on ? 0.9 : 1;
        ctx.fillRect(x, py + p * (PH + 9), wd, PH);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = COL.grid; ctx.lineWidth = 0.8;
        ctx.strokeRect(x, py + p * (PH + 9), wd, PH);
      }
    }
    readout.textContent = `当前段 ${curSeg + 1}/7 → `
      + `${isZero ? (curSeg === 0 ? 'U₀(000)' : 'U₇(111)') : 'U' + r.s + ' / U' + (r.s % 6 + 1)}`
      + `（开关码 ${r.segSw[curSeg].join('')}）　T1=${r.t1.toFixed(3)}Ts  T2=${r.t2.toFixed(3)}Ts  T0=${(2 * r.t0).toFixed(3)}Ts`;
  }
  function tick() {
    if (player.playing) {
      pos += 0.0032; if (pos > 1) pos = 0;
      if (sPos) sPos.value = Math.round(pos * 1000);
      draw();
    }
    requestAnimationFrame(tick);
  }
  document.addEventListener('canvas-theme-change', draw);
  draw();
  requestAnimationFrame(tick);
})();

/* ============================================================
   图 4-5：SVPWM 六边形 + 马鞍波（含 SPWM 对比）
   ============================================================ */
(function svpwmViz() {
  const hex = setupCanvas('cv-sv-hex');
  const duty = setupCanvas('cv-sv-duty');
  if (!hex || !duty) return;
  const player = makePlayer('btn-sv-play');
  const modSlider = document.getElementById('sv-mod');
  const modVal = document.getElementById('sv-mod-val');
  const spwmBtn = document.getElementById('btn-sv-spwm');
  const readout = document.getElementById('sv-readout');
  let tDeg = 0, showSpwm = false;

  spwmBtn.addEventListener('click', () => {
    showSpwm = !showSpwm;
    spwmBtn.classList.toggle('active', showSpwm);
    spwmBtn.textContent = showSpwm ? '✓ 已叠加 SPWM 正弦波' : '对比：叠加 SPWM 正弦波';
  });

  // 基本有效矢量角度：U1=0°, U2=60°, ... U6=300°
  const baseVec = [];
  for (let i = 0; i < 6; i++) baseVec.push(i * Math.PI / 3);

  function draw() {
    // m 定义：m=1.0 → 相电压幅值 0.5·Udc（SPWM 满调制）
    //         m=1.1547 → 0.577·Udc（SVPWM 线性上限，2/√3 倍）
    const m = +modSlider.value / 100;
    modVal.textContent = m.toFixed(2);
    const th = tDeg * Math.PI / 180;
    // 空间矢量（相电压幅值 = m/2；六边形上按 2/3 → R 缩放）
    const refAlpha = 0.75 * m * Math.cos(th), refBeta = 0.75 * m * Math.sin(th);
    // 扇区 (0..5)
    let sector = Math.floor(((th % TAU) + TAU) % TAU / (Math.PI / 3));
    const over = m > 1.1547;

    // --- 左：六边形 ---
    {
      const { ctx, cx, cy } = hex; const R = 115;
      ctx.clearRect(0, 0, hex.w, hex.h);
      ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = i * Math.PI / 3;
        const x = cx + Math.cos(a) * R, y = cy - Math.sin(a) * R;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = baseVec[i];
        const x = cx + Math.cos(a) * R, y = cy - Math.sin(a) * R;
        const inSector = (i === sector || i === (sector + 1) % 6);
        arrow(ctx, cx, cy, x, y, inSector ? COL.dq : COL.dim, inSector ? 3 : 1.5, inSector ? 9 : 6);
        label(ctx, 'U' + (i + 1), cx + Math.cos(a) * (R + 16), cy - Math.sin(a) * (R + 16), inSector ? COL.dq : COL.dim, 12);
      }
      // 内切圆 = 线性调制上限
      ctx.strokeStyle = COL.grid; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(cx, cy, R * Math.cos(Math.PI / 6), 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      // 期望矢量
      const rx = cx + refAlpha * R, ry = cy - refBeta * R;
      arrow(ctx, cx, cy, rx, ry, over ? COL.warn : COL.white, 3, 10);
      label(ctx, 'Uref', (cx + rx) / 2 + 24, (cy + ry) / 2 - 10, over ? COL.warn : COL.white, 12);
      label(ctx, `扇区 ${sector + 1}`, cx, 16, COL.accent, 14);
      label(ctx, over ? '⚠ 已超出六边形 → 过调制失真' : '虚线圆 = 线性调制上限', cx, cy + R + 20, over ? COL.warn : COL.dim, 11);
    }
    // --- 右：马鞍波（+SPWM 对比） ---
    {
      const { ctx, w, h } = duty;
      ctx.clearRect(0, 0, w, h);
      const top = 24, bot = h - 26, mid = (top + bot) / 2;
      // 0 / 0.5 / 1 三条参考线
      ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
      [top, mid, bot].forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); });
      label(ctx, '1.0', w - 6, top - 9, COL.dim, 10, 'right');
      label(ctx, '0.5', w - 6, mid - 9, COL.dim, 10, 'right');
      label(ctx, '0', w - 6, bot + 10, COL.dim, 10, 'right');

      const colors = [COL.a, COL.b, COL.c];
      const yOf = d => bot - Math.max(-0.06, Math.min(1.06, d)) * (bot - top);

      // SPWM 对比：要产生同样大小的相电压，正弦调制波需要 (m/2)·cos + 0.5
      if (showSpwm) {
        for (let ph = 0; ph < 3; ph++) {
          ctx.strokeStyle = colors[ph]; ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 3]); ctx.globalAlpha = 0.75;
          ctx.beginPath();
          for (let x = 0; x <= w; x++) {
            const tt = (x / w) * TAU + th;
            const base = Math.cos(tt - ph * TAU / 3);
            const dSp = (m / 2) * base + 0.5;
            const y = yOf(dSp);
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.setLineDash([]); ctx.globalAlpha = 1;
        }
      }
      // SVPWM 马鞍波
      for (let ph = 0; ph < 3; ph++) {
        ctx.strokeStyle = colors[ph]; ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let x = 0; x <= w; x++) {
          const tt = (x / w) * TAU + th;
          const a0 = m * Math.cos(tt);
          const b0 = m * Math.cos(tt - TAU / 3);
          const c0 = m * Math.cos(tt + TAU / 3);
          const arr = [a0, b0, c0];
          const midv = (Math.max(...arr) + Math.min(...arr)) / 2;
          const y = yOf((arr[ph] - midv + 1) / 2);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      label(ctx, 'Ta', 16, 12, COL.a, 12);
      label(ctx, 'Tb', 44, 12, COL.b, 12);
      label(ctx, 'Tc', 72, 12, COL.c, 12);
      label(ctx, showSpwm ? '实线 = SVPWM 马鞍波　虚线 = SPWM 正弦调制波（同样输出，它会先削顶）'
        : '三相占空比（马鞍波）', w / 2, h - 9, showSpwm ? COL.warn : COL.dim, 11);
    }
    const pct = (m / 1.1547 * 100).toFixed(0);
    readout.textContent = `m=${m.toFixed(2)} → 相电压幅值 ${(m / 2).toFixed(3)}·Udc（SVPWM 上限的 ${pct}%）  θ=${(tDeg % 360).toFixed(0)}°  扇区 ${sector + 1}`;
  }
  function tick() {
    if (player.playing) tDeg = (tDeg + 0.9) % 360;
    draw(); requestAnimationFrame(tick);
  }
  modSlider.addEventListener('input', draw);
  spwmBtn.addEventListener('click', draw);
  document.addEventListener('canvas-theme-change', draw);
  tick();
})();

/* ============================================================
   图 4-6：24V 母线全景动画
   ① 端电压：原始目标 12V+正弦（虚线，会越界）→ 平移 k 后塞进 0~24V（实线）
      浮动中点 n = 12V + k（黄线，3 倍频摆动）
   ② 相电压 = 端电压 − n：k 被中点浮动吃掉，仍是纯正弦
   ③ 占空比 = 端电压/24V：马鞍波；白虚线 = 三相公共电平 0.5 + k/24
   ============================================================ */
(function bus24VViz() {
  const cv = setupCanvas('cv-24v');
  if (!cv) return;
  const { ctx, w, h } = cv;
  const player = makePlayer('btn-24v-play');
  const modSlider = document.getElementById('mv-mod');
  const modVal = document.getElementById('mv-mod-val');
  const spdSlider = document.getElementById('mv-spd');
  const spdVal = document.getElementById('mv-spd-val');
  const origBtn = document.getElementById('btn-24v-orig');
  const readout = document.getElementById('mv-readout');
  let tDeg = 20, showOrig = true;

  const UDC = 24, HALF = 12, PHMAX = UDC / Math.sqrt(3);   // 13.856V
  const PCOL = [COL.a, COL.b, COL.c];

  origBtn.addEventListener('click', () => {
    showOrig = !showOrig;
    origBtn.classList.toggle('active', showOrig);
    origBtn.textContent = showOrig ? '✓ 原始目标电压（虚线）' : '显示原始目标电压';
  });

  /* ---- 面板布局（三个纵向堆叠子图） ---- */
  const px0 = 56, px1 = w - 16;
  const P = {
    term: { top: 22, bot: 320, vmin: -3, vmax: 27 },      // 端电压
    ph:   { top: 360, bot: 500, vmin: -16, vmax: 16 },    // 相电压
    duty: { top: 536, bot: 628, vmin: -0.06, vmax: 1.06 } // 占空比
  };
  const yOf = (p, v) => p.bot - (v - p.vmin) / (p.vmax - p.vmin) * (p.bot - p.top);
  const xOf = f => px0 + f * (px1 - px0);

  function hline(p, v, color, width = 1, dash = null) {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(px0, yOf(p, v)); ctx.lineTo(px1, yOf(p, v)); ctx.stroke();
    ctx.setLineDash([]);
  }
  function vline(x, y0, y1, color, dash = [4, 4]) {
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.setLineDash([]);
  }
  function drawArr(arr, p, color, width = 2, dash = null, alpha = 1) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i < arr.length; i++) {
      const x = xOf(i / (arr.length - 1)), y = yOf(p, arr[i]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const m = +modSlider.value / 100;
    modVal.textContent = m.toFixed(2);
    const spd = +spdSlider.value;
    spdVal.textContent = spd;
    const th = tDeg * Math.PI / 180;
    const A = m * PHMAX;

    /* 逐采样点算全部曲线（“现在” = 窗口最左端） */
    const N = 300;
    const orig = [[], [], []], shift = [[], [], []], phV = [[], [], []], dut = [[], [], []];
    const kArr = [], nArr = [];
    for (let i = 0; i <= N; i++) {
      const ang = th + (i / N) * TAU;
      const v = [0, 1, 2].map(ph => A * Math.cos(ang - ph * TAU / 3));
      const vmax = Math.max(...v), vmin = Math.min(...v);
      const k = -(vmax + vmin) / 2;          // 零序平移量（V）
      const n = HALF + k;                    // 浮动中点对 V− 的电压
      for (let ph = 0; ph < 3; ph++) {
        orig[ph].push(HALF + v[ph]);         // 平移前的端电压目标
        shift[ph].push(HALF + v[ph] + k);    // 平移后的端电压
        phV[ph].push(v[ph]);                 // 相电压（= 端电压 − 中点）
        dut[ph].push((HALF + v[ph] + k) / UDC);
      }
      kArr.push(k); nArr.push(n);
    }
    const kNow = kArr[0];

    /* ---- ① 端电压面板 ---- */
    const pT = P.term;
    hline(pT, 24, COL.dim, 1.2); label(ctx, '24V（V+ 母线）', px0 + 6, yOf(pT, 24) - 10, COL.dim, 11, 'left');
    hline(pT, 0, COL.dim, 1.2);  label(ctx, '0V（V−）', px0 + 6, yOf(pT, 0) + 11, COL.dim, 11, 'left');
    hline(pT, 12, COL.grid, 1, [4, 4]); label(ctx, '12V = Udc/2', px1 - 6, yOf(pT, 12) - 9, COL.dim, 10.5, 'right');
    if (showOrig) for (let ph = 0; ph < 3; ph++) drawArr(orig[ph], pT, PCOL[ph], 1.3, [5, 4], 0.55);
    for (let ph = 0; ph < 3; ph++) drawArr(shift[ph], pT, PCOL[ph], 2);
    drawArr(nArr, pT, COL.warn, 2.6);
    label(ctx, '浮动中点 n = 12V + k', px1 - 6, yOf(pT, nArr[0]) - 12, COL.warn, 11.5, 'right');
    label(ctx, '① 端电压视角（桥臂中点对 V−）· 实线 = 平移 k 后', px0 + 6, pT.top + 4, COL.white, 12.5, 'left');
    if (showOrig) label(ctx, '虚线 = 原始目标（会越界）', px1 - 6, pT.top + 4, COL.dim, 11, 'right');
    /* k 标注：12V 与 n 之间的小括号 */
    const yA = yOf(pT, HALF), yB = yOf(pT, HALF + kNow);
    ctx.strokeStyle = COL.warn; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(px0 + 3, yA); ctx.lineTo(px0 + 3, yB); ctx.stroke();
    label(ctx, `k=${kNow >= 0 ? '+' : ''}${kNow.toFixed(2)}V`, px0 + 11, (yA + yB) / 2, COL.warn, 11, 'left');

    /* ---- ② 相电压面板 ---- */
    const pP = P.ph;
    hline(pP, 0, COL.grid, 1);
    hline(pP, PHMAX, COL.dim, 1, [4, 4]); hline(pP, -PHMAX, COL.dim, 1, [4, 4]);
    label(ctx, '±13.86V（满调制 = 24/√3）', px1 - 6, yOf(pP, PHMAX) - 9, COL.dim, 10.5, 'right');
    for (let ph = 0; ph < 3; ph++) drawArr(phV[ph], pP, PCOL[ph], 2);
    label(ctx, '② 相电压 = 端电压 − 浮动中点 → k 被吃掉，仍是纯正弦', px0 + 6, pP.top + 4, COL.white, 12.5, 'left');

    /* ---- ③ 占空比面板 ---- */
    const pD = P.duty;
    hline(pD, 0, COL.dim, 1); hline(pD, 1, COL.dim, 1);
    label(ctx, '1.0', px0 - 8, yOf(pD, 1), COL.dim, 10.5, 'right');
    label(ctx, '0', px0 - 8, yOf(pD, 0), COL.dim, 10.5, 'right');
    hline(pD, 0.5, COL.grid, 1, [4, 4]);
    const cmArr = kArr.map(k => 0.5 + k / UDC);
    drawArr(cmArr, pD, COL.white, 1.4, [5, 4]);
    for (let ph = 0; ph < 3; ph++) drawArr(dut[ph], pD, PCOL[ph], 2);
    label(ctx, '③ 占空比 = 端电压 / 24V · 白虚线 = 共模 0.5 + k/24', px0 + 6, pD.top + 4, COL.white, 12.5, 'left');

    /* ---- “现在”竖线 + 角度刻度 ---- */
    vline(px0, P.term.top, P.duty.bot, COL.dim);
    label(ctx, '现在', px0, P.duty.bot + 11, COL.dim, 10.5);
    for (const d of [90, 180, 270, 360]) {
      label(ctx, `+${d}°`, xOf(d / 360), P.duty.bot + 11, COL.dim, 10);
    }

    /* ---- 读数 ---- */
    const dNow = [dut[0][0], dut[1][0], dut[2][0]];
    readout.textContent =
      `θ=${Math.round(tDeg) % 360}°  m=${m.toFixed(2)} → A=${A.toFixed(2)}V  ` +
      `k=${kNow >= 0 ? '+' : ''}${kNow.toFixed(2)}V  n=${(HALF + kNow).toFixed(2)}V  ` +
      `D = ${dNow.map(d => d.toFixed(2)).join(' / ')}`;
  }

  function tick() {
    if (player.playing) tDeg = (tDeg + (+spdSlider.value)) % 360;
    draw(); requestAnimationFrame(tick);
  }
  modSlider.addEventListener('input', draw);
  spdSlider.addEventListener('input', draw);
  origBtn.addEventListener('click', draw);
  document.addEventListener('canvas-theme-change', draw);
  tick();
})();

/* ============================================================
   图 6-1：编码器对齐示意（静态图）—— 强吸到电角度 0，读出 offset
   ============================================================ */
(function alignViz() {
  const cv = setupCanvas('cv-align');
  if (!cv) return;
  const { ctx, w, h } = cv;
  const PC = [COL.a, COL.b, COL.c];

  function draw() {
    ctx.clearRect(0, 0, w, h);

    /* ---------- 左：电机截面，转子被吸到 A 相轴线 ---------- */
    const mx = 195, my = 162, R = 104;
    label(ctx, '① 开环强吸：θe = 0，i_d ≈ 30% 额定', 20, 22, COL.white, 13.5, 'left');
    ctx.strokeStyle = COL.dim; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(mx, my, R, 0, TAU); ctx.stroke();
    for (let ph = 0; ph < 3; ph++) {
      const a = ph * 120 * Math.PI / 180;
      const cx = mx + Math.cos(a) * R, cy = my - Math.sin(a) * R;
      ctx.fillStyle = PC[ph];
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, TAU); ctx.fill();
      label(ctx, 'ABC'[ph], cx, cy, '#fff', 11);
    }
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(mx - R - 26, my); ctx.lineTo(mx + R + 26, my); ctx.stroke();
    ctx.setLineDash([]);
    arrow(ctx, mx + R - 6, my, mx + R + 26, my, COL.a, 2, 7);
    label(ctx, 'A 相轴线（电角度 0）', mx + R + 32, my + 30, COL.dim, 11.5, 'left');
    ctx.fillStyle = COL.boxFill;
    ctx.beginPath(); ctx.arc(mx, my, 52, 0, TAU); ctx.fill();
    ctx.fillStyle = COL.a;
    ctx.beginPath(); ctx.arc(mx, my, 40, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COL.c;
    ctx.beginPath(); ctx.arc(mx, my, 40, Math.PI / 2, 3 * Math.PI / 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx, my, 52, 0, TAU); ctx.stroke();
    label(ctx, 'N', mx + 26, my, '#fff', 13);
    label(ctx, 'S', mx - 26, my, '#fff', 13);
    label(ctx, '转子 d 轴（N 极）被吸到 A 相轴线', mx, my + R + 34, COL.accent, 12);

    /* ---------- 右：编码器刻度盘，吸稳瞬间读 350° ---------- */
    const ex = 615, ey = 162, r = 104;
    label(ctx, '② 吸稳瞬间读 MT6701：offset = 350°', 470, 22, COL.white, 13.5, 'left');
    ctx.strokeStyle = COL.dim; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.stroke();
    for (let d = 0; d < 360; d += 30) {
      const a = d * Math.PI / 180;
      ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(a) * (r - 9), ey - Math.sin(a) * (r - 9));
      ctx.lineTo(ex + Math.cos(a) * r, ey - Math.sin(a) * r);
      ctx.stroke();
      if (d % 90 === 0) label(ctx, d + '°', ex + Math.cos(a) * (r + 18), ey - Math.sin(a) * (r + 18), COL.dim, 11);
    }
    ctx.fillStyle = COL.accent;
    ctx.beginPath(); ctx.arc(ex + r, ey, 5, 0, TAU); ctx.fill();
    label(ctx, '对齐点(0°)', ex + r - 42, ey + 40, COL.accent, 11);
    const na = 350 * Math.PI / 180;
    ctx.strokeStyle = COL.warn; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(ex, ey);
    ctx.lineTo(ex + Math.cos(na) * (r - 18), ey - Math.sin(na) * (r - 18)); ctx.stroke();
    ctx.fillStyle = COL.warn;
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, TAU); ctx.fill();
    label(ctx, '350°', ex + Math.cos(na) * (r - 36), ey - Math.sin(na) * (r - 36) - 16, COL.warn, 12.5);

    /* ---------- 底部公式 ---------- */
    label(ctx, '之后每次：θe = dir × (θenc − 350°) × p　（例：θenc=10°, dir=+1, p=7 → (10−350) mod 360 = 20° → θe = 140°）',
      w / 2, h - 12, COL.accent, 12);
  }

  draw();
  document.addEventListener('canvas-theme-change', draw);
})();

/* ============================================================
   图 5-1：FOC 控制框图（整洁正交布线版）
   布局：前向通路在上方一排；反馈行（编码器/Clarke/Park）在下方；
   θ_e 走顶部虚线干道，ω / ia,ib 走底部干道，仅一处跨越（跳线弧）。
   ============================================================ */
(function blockDiagram() {
  const cv = setupCanvas('cv-block-diagram');
  if (!cv) return;
  const { ctx, w, h } = cv;

  /* ---------- 基础图元 ---------- */
  function box(x, y, bw, bh, txt, color, sub = '') {
    ctx.fillStyle = COL.boxFill;
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 8); ctx.fill(); ctx.stroke();
    label(ctx, txt, x + bw / 2, y + bh / 2 - (sub ? 8 : 0), color, 14);
    if (sub) label(ctx, sub, x + bw / 2, y + bh / 2 + 12, COL.dim, 10.5);
  }
  function sumPoint(x, y, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.stroke();
    label(ctx, 'Σ', x, y + 1, color, 14);
  }
  function poly(pts, color, width = 1.8, dash = null) {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function dot(x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
  }
  /* 竖线在 (x,y) 处的跳线弧（向右凸） */
  function hopV(x, y, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, 7, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    /* ===== 布局常量 ===== */
    const my = 92, bh = 48, by = my - bh / 2;        // 前向通路
    const fy = 272, fh = 44, ftop = fy - fh / 2;     // 反馈行
    const spd = COL.warn, cur = COL.accent, plant = '#e67e22', fb = COL.fb;

    /* ===== 分组标注 ===== */
    label(ctx, '外环：速度环', 144, 30, spd, 13);
    label(ctx, '内环：电流环（dq 解耦）', 420, 30, cur, 13);

    /* ===== 前向通路 ===== */
    sumPoint(74, my, spd);                       // Σ1
    box(98, by, 92, bh, '速度 PI', spd, '外环');
    sumPoint(236, my, cur);                      // Σ2
    box(260, by, 92, bh, '电流 PI', cur, 'id / iq 双环');
    box(396, by, 92, bh, '反 Park', cur, 'dq → αβ');
    box(532, by, 92, bh, 'SVPWM', cur, '逆变器驱动');
    box(668, by, 92, bh, 'PMSM', plant, '电机本体');

    // 前向连线与信号名
    arrow(ctx, 34, my, 60, my, spd, 2.2, 8);
    label(ctx, 'ω_ref', 44, my - 32, spd, 12);   // 抬高到与其它信号名同一水平线，避开 Σ1 的「+」号
    arrow(ctx, 86, my, 98, my, spd, 2.2, 8);
    arrow(ctx, 190, my, 222, my, spd, 2.2, 8);
    label(ctx, 'i_q_ref', 206, my - 32, spd, 11.5);
    arrow(ctx, 248, my, 260, my, cur, 2.2, 8);
    arrow(ctx, 352, my, 396, my, cur, 2.2, 8);
    label(ctx, 'u_d, u_q', 374, my - 32, cur, 11.5);
    arrow(ctx, 488, my, 532, my, cur, 2.2, 8);
    label(ctx, 'u_α, u_β', 510, my - 32, cur, 11.5);
    arrow(ctx, 624, my, 668, my, cur, 2.2, 8);
    label(ctx, '三相 PWM', 640, my - 32, cur, 11.5, 'right');
    arrow(ctx, 760, my, 812, my, plant, 2.2, 8);
    label(ctx, '转速输出', 786, my + 20, COL.dim, 11);

    // 求和点 +/- 标记
    label(ctx, '+', 56, my - 14, spd, 13);
    label(ctx, '−', 88, my + 15, spd, 14);
    label(ctx, '+', 218, my - 14, cur, 13);
    label(ctx, '−', 250, my + 15, cur, 14);

    /* ===== 反馈行 ===== */
    box(690, ftop, 146, fh, '编码器/观测器', spd, 'θ_e, ω');
    box(396, ftop, 92, fh, 'Clarke', cur, 'abc → αβ');
    box(532, ftop, 92, fh, 'Park', cur, 'αβ → dq');

    /* ===== 反馈连线 ===== */
    // 1) i_a,i_b：电机 → 底部干道 → Clarke 底
    poly([[680, by + bh], [680, 318], [442, 318], [442, ftop + fh + 10]], fb);
    arrow(ctx, 442, ftop + fh + 10, 442, ftop + fh + 1, fb, 1.8, 7);
    label(ctx, 'i_a, i_b', 560, 310, fb, 11.5);
    // 2) 轴位置：电机 → 编码器
    poly([[738, by + bh], [738, ftop - 10]], fb);
    arrow(ctx, 738, ftop - 10, 738, ftop - 1, fb, 1.8, 7);
    label(ctx, 'θ_m', 756, 180, fb, 11);
    // 3) Clarke → Park
    arrow(ctx, 488, fy, 532, fy, cur, 2, 7);
    // 4) i_d,i_q：Park 顶 → Σ2 底
    poly([[578, ftop], [578, 164], [236, 164], [236, my + 24]], fb);
    arrow(ctx, 236, my + 24, 236, my + 14, fb, 1.8, 7);
    label(ctx, 'i_d, i_q', 410, 156, fb, 11.5);
    // 5) θ_e（虚线）：编码器右侧 → 顶部干道 → 反Park 顶 / Park 右
    poly([[836, fy], [866, fy], [866, 38], [442, 38]], fb, 1.5, [5, 4]);
    arrow(ctx, 442, 38, 442, by - 2, fb, 1.5, 7);
    dot(656, 38, fb);
    poly([[656, 38], [656, my - 15]], fb, 1.5, [5, 4]);
    hopV(656, my, fb);                    // 跨越三相 PWM 连线
    poly([[656, my + 15], [656, fy], [632, fy]], fb, 1.5, [5, 4]);
    arrow(ctx, 632, fy, 625, fy, fb, 1.5, 6);
    label(ctx, 'θ_e', 762, 30, fb, 12);
    // 6) ω：编码器底 → 底部干道 → Σ1 底
    poly([[763, ftop + fh], [763, 330], [74, 330], [74, my + 24]], fb);
    arrow(ctx, 74, my + 24, 74, my + 14, fb, 1.8, 7);
    label(ctx, 'ω 速度反馈', 180, 346, fb, 11.5);
  }

  draw();
  document.addEventListener('canvas-theme-change', draw);
})();

/* ============================================================
   图 5-2：双闭环阶跃响应仿真
   ============================================================ */
(function closedLoop() {
  const cv = setupCanvas('cv-loop');
  if (!cv) return;
  const { ctx, w, h } = cv;
  const kpSlider = document.getElementById('lp-kp');
  const kiSlider = document.getElementById('lp-ki');
  const readout = document.getElementById('lp-readout');
  let data = null;

  function simulate() {
    const Kp = +kpSlider.value / 10, Ki = +kiSlider.value / 10;
    const dt = 0.001, T = 1.2, N = Math.floor(T / dt);
    const J = 0.0005, B = 0.0001, Kt = 0.05; // 简化电机参数
    let wSpeed = 0, iq = 0, integ = 0;
    const wRef = 100; // 阶跃目标 rad/s
    const iqMax = 20;
    data = { spd: [], iq: [], id: [], t: [] };
    for (let i = 0; i < N; i++) {
      const err = wRef - wSpeed;
      integ += Ki * err * dt;
      integ = Math.max(-iqMax, Math.min(iqMax, integ));
      let iqRef = Kp * err + integ;
      iqRef = Math.max(-iqMax, Math.min(iqMax, iqRef));
      // 电流环近似为一阶滞后
      iq += (iqRef - iq) * dt / 0.005;
      const Te = Kt * iq;
      wSpeed += (Te - B * wSpeed) / J * dt;
      if (i % 10 === 0) {
        data.spd.push(wSpeed); data.iq.push(iq); data.id.push(0);
        data.t.push(i * dt);
      }
    }
    readout.textContent = `Kp=${Kp.toFixed(1)} Ki=${Ki.toFixed(1)}  稳态≈${wSpeed.toFixed(0)} rad/s`;
  }

  function draw() {
    if (!data) return;
    ctx.clearRect(0, 0, w, h);
    const left = 50, right = w - 20, top = 20, bot = h - 30;
    ctx.strokeStyle = COL.grid; ctx.strokeRect(left, top, right - left, bot - top);
    const maxSpd = 130, maxIq = 22;
    // 目标速度虚线
    ctx.strokeStyle = COL.faint; ctx.setLineDash([5, 5]);
    const yRef = bot - (100 / maxSpd) * (bot - top);
    ctx.beginPath(); ctx.moveTo(left, yRef); ctx.lineTo(right, yRef); ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, 'ω_ref', left + 22, yRef - 10, COL.white, 11);
    // 速度
    ctx.strokeStyle = COL.good; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < data.spd.length; i++) {
      const x = left + (i / data.spd.length) * (right - left);
      const y = bot - (data.spd[i] / maxSpd) * (bot - top);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    // iq
    ctx.strokeStyle = COL.warn; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < data.iq.length; i++) {
      const x = left + (i / data.iq.length) * (right - left);
      const y = bot - (data.iq[i] / maxIq) * (bot - top) * 0.5 - 30;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    // 图例
    label(ctx, 'ω 速度', w - 150, 16, COL.good, 12, 'left');
    label(ctx, 'iq 转矩电流', w - 150, 34, COL.warn, 12, 'left');
    label(ctx, '时间 →', w / 2, h - 10, COL.dim, 11);
  }

  document.getElementById('btn-loop-run').addEventListener('click', () => { simulate(); draw(); });
  kpSlider.addEventListener('input', () => { simulate(); draw(); });
  kiSlider.addEventListener('input', () => { simulate(); draw(); });
  document.addEventListener('canvas-theme-change', draw);
  simulate(); draw();
})();

/* ============================================================
   导航高亮 + 移动端折叠
   ============================================================ */
(function nav() {
  const tocItems = document.querySelectorAll('#toc li');
  const chapters = document.querySelectorAll('.chapter');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        tocItems.forEach(li => li.classList.toggle('active', 'ch' + li.dataset.ch === e.target.id));
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px' });
  chapters.forEach(ch => obs.observe(ch));

  document.getElementById('btn-toc-toggle').addEventListener('click', () => {
    const btn = document.getElementById('btn-toc-toggle');
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    if (mobile) {
      const open = document.body.classList.toggle('nav-open');
      btn.textContent = open ? '»' : '«';
      btn.title = open ? '收起目录' : '展开目录';
    } else {
      const collapsed = document.body.classList.toggle('nav-collapsed');
      btn.textContent = collapsed ? '»' : '«';
      btn.title = collapsed ? '展开目录' : '收起目录';
    }
  });
})();

/* ============================================================
   设置面板：主题 / 字体大小 / 字体种类（localStorage 持久化）
   ============================================================ */
(function settings() {
  const btn = document.getElementById('btn-settings');
  const panel = document.getElementById('settings-panel');
  if (!btn || !panel) return;
  const root = document.documentElement;
  const KEY = 'foc-settings';
  const FONTS = {
    sans: '"Segoe UI","Microsoft YaHei","PingFang SC",sans-serif',
    serif: 'Georgia,"SimSun","Songti SC",serif',
    mono: '"Cascadia Code",Consolas,"Courier New",monospace'
  };
  const defaults = { theme: 'dark', fontSize: 16, font: 'sans' };

  function load() {
    try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY)) || {}); }
    catch (e) { return Object.assign({}, defaults); }
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  const fontSlider = document.getElementById('set-fontsize');
  const fsVal = document.getElementById('fs-val');

  function apply(s) {
    root.setAttribute('data-theme', s.theme);
    root.style.setProperty('--font-size', s.fontSize + 'px');
    root.style.setProperty('--font-body', FONTS[s.font] || FONTS.sans);
    if (typeof applyCanvasTheme === 'function') applyCanvasTheme(s.theme);
    // 同步控件状态
    document.querySelectorAll('#seg-theme button').forEach(b =>
      b.classList.toggle('active', b.dataset.val === s.theme));
    document.querySelectorAll('#seg-font button').forEach(b =>
      b.classList.toggle('active', b.dataset.val === s.font));
    if (fontSlider) fontSlider.value = s.fontSize;
    if (fsVal) fsVal.textContent = s.fontSize + 'px';
  }

  let state = load();

  // 主题
  document.getElementById('seg-theme').addEventListener('click', e => {
    const v = e.target.closest('button') && e.target.closest('button').dataset.val;
    if (!v) return;
    state.theme = v; apply(state); save(state);
  });
  // 字体种类
  document.getElementById('seg-font').addEventListener('click', e => {
    const v = e.target.closest('button') && e.target.closest('button').dataset.val;
    if (!v) return;
    state.font = v; apply(state); save(state);
  });
  // 字体大小
  if (fontSlider) fontSlider.addEventListener('input', () => {
    state.fontSize = +fontSlider.value; apply(state); save(state);
  });
  // 恢复默认
  document.getElementById('btn-set-reset').addEventListener('click', () => {
    state = Object.assign({}, defaults); apply(state); save(state);
  });
  // 面板开合
  btn.addEventListener('click', e => { e.stopPropagation(); panel.classList.toggle('open'); });
  document.addEventListener('click', e => {
    if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') panel.classList.remove('open'); });

  apply(state);
})();

/* ---------- 分段选择按钮（第 7 章状态切换） ---------- */
function segSwitch(ids, cb) {
  const btns = ids.map(id => document.getElementById(id)).filter(Boolean);
  btns.forEach((b, i) => b.addEventListener('click', () => {
    btns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    cb(i);
  }));
}

/* ============================================================
   图 7-1：三相逆变桥主回路（电流路径动画）
   ============================================================ */
/* ============================================================
   图 7-1：三相逆变桥主回路（导通 / 续流 三状态）
   ============================================================ */
(function bridgeTopology() {
  const cv = setupCanvas('cv-hbridge');
  if (!cv) return;
  const { ctx } = cv;
  const ro = document.getElementById('hb-readout');
  let state = 0; // 0=上管导通 1=下管导通（反向） 2=续流
  const TXT = [
    'A 相上管导通：相电流是交流 —— 正半周从 A 相流出，负半周反向流回，都走 Q4/Q8 沟道（方向自动交替）',
    '固定观察负半周：电流反向经 Q4、Q8 沟道流动（同步整流）',
    '死区/续流：双管关断，电感电流经体二极管续流（橙色）'
  ];
  segSwitch(['btn-hb-high', 'btn-hb-low', 'btn-hb-free'], i => {
    state = i; if (ro) ro.textContent = TXT[i];
  });

  // 画布 860×400。母线电容(60) | 桥臂 A(200) B(400) C(600) | 电机圆符号(757,191) r=58
  const yVBUS = 66, yGND = 316;
  const legs = [200, 400, 600];
  const uT = 96, uB = 166;           // 上管
  const lT = 216, lB = 286;          // 下管
  const phY = [175, 191, 207];       // 三相线：直接从相 node 水平引出（落在间隙 166..216 内）
  const cX = 757, cY = 191, cR = 58; // 电机圆符号
  const NAMES = [['Q4', 'Q7'], ['Q5', 'Q8'], ['Q6', 'Q9']];
  const RS = ['R26', 'R31', 'R38'];
  const line = (x0, y0, x1, y1, w, c) => {
    ctx.strokeStyle = c || COL.dim; ctx.lineWidth = w || 2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  };
  const dot = (x, y) => { ctx.fillStyle = COL.dim; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); };

  function draw(t) {
    ctx.clearRect(0, 0, cv.w, cv.h);
    // 顶部图例 / 型号
    label(ctx, '栅极 12R 来自 FD6288T 三相驱动（见 7.2）', 380, 26, COL.dim, 11.5);
    label(ctx, 'CSD18540Q5B × 6', 740, 26, COL.fb, 11);
    // 母线
    line(40, yVBUS, 600, yVBUS, 3);
    line(40, yGND, 600, yGND, 3);
    label(ctx, 'VBUS (48V)', 110, yVBUS - 14, COL.white, 12.5);
    label(ctx, 'PGND', 80, yGND + 16, COL.dim, 11.5);
    capV(ctx, 60, yVBUS, yGND, '');
    label(ctx, 'C42~C47', 76, 185, COL.dim, 10.5, 'left');
    label(ctx, '10μF×6', 76, 203, COL.dim, 10.5, 'left');
    // 三个桥臂
    legs.forEach((x, i) => {
      line(x, yVBUS, x, uT);            // 上管 D 接母线
      line(x, lB + 22, x, yGND);        // 下管 S 经 Rs 接地
      // 相线：相 node 直接水平引出到电机圆（跨过右边桥臂处画跳线弧 = 不相连）
      hLine(ctx, x, cX - cR + 2, phY[i], legs.slice(i + 1).map(l => [l, phY[i]]), 1.5);
      dot(x, phY[i]);
      dot(x, yGND);
      label(ctx, ['MA', 'MB', 'MC'][i], x + 38, phY[i] - 8, COL.dim, 10.5, 'left');
      // 栅极短桩：12R + HO/LO（来源见图例）
      const guY = (uT + uB) / 2, glY = (lT + lB) / 2;
      line(x - 36, guY, x - 64, guY, 1.5);
      gateRes(ctx, x - 64, guY, 28, '12R');
      line(x - 92, guY, x - 64, guY, 1.5);
      label(ctx, 'HO' + (i + 1), x - 96, guY, COL.fb, 10, 'right');
      line(x - 36, glY, x - 64, glY, 1.5);
      gateRes(ctx, x - 64, glY, 28, '12R');
      line(x - 92, glY, x - 64, glY, 1.5);
      label(ctx, 'LO' + (i + 1), x - 96, glY, COL.fb, 10, 'right');
      // 1mΩ 采样电阻
      resistorV(ctx, x, lB + 4, 18, RS[i] + ' 1mΩ', false);
    });
    // 桥臂 MOSFET
    const on = legs.map((_, i) => state === 2 ? [false, false] : [i === 0, i === 1]);
    const freewheel = state === 2;
    legs.forEach((x, i) => {
      mosfetV(ctx, x, uT, uB, freewheel && i === 0, on[i][0], NAMES[i][0], false);
      mosfetV(ctx, x, lT, lB, freewheel && i === 1, on[i][1], NAMES[i][1], false);
    });
    // 电机：M / 3~ 圆符号
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cX, cY, cR, 0, TAU); ctx.stroke();
    label(ctx, 'M', cX, cY - 8, COL.white, 26);
    label(ctx, '3~', cX, cY + 18, COL.dim, 13);
    // 电流回路（全正交、穿过元件实体、闭合）
    const pos = Math.floor(t / 2.5) % 2 === 0;
    let loop, txt, bgs, hops;
    if (state === 2) {
      loop = [[40, yGND], [200, yGND], [200, phY[0]], [720, phY[0]], [720, phY[1]], [400, phY[1]], [400, yVBUS], [40, yVBUS], [40, yGND]];
      txt = '死区续流：① PGND → Q7 体二极管 → ② 进电机 → ③ 出电机 → ④ Q5 体二极管 → VBUS';
      bgs = [[120, yGND, '①'], [660, phY[0], '②'], [520, phY[1], '③'], [400, 80, '④']];
      hops = [[400, phY[0]], [600, phY[0]], [600, phY[1]]];
    } else if (pos) {
      loop = [[40, yVBUS], [200, yVBUS], [200, phY[0]], [720, phY[0]], [720, phY[1]], [400, phY[1]], [400, yGND], [40, yGND], [40, yVBUS]];
      txt = '正半周 ia>0：① VBUS → Q4 → ② MA 进电机 → ③ MB 出 → Q8 → ④ R31(1mΩ) → PGND';
      bgs = [[140, yVBUS, '①'], [660, phY[0], '②'], [520, phY[1], '③'], [140, yGND, '④']];
      hops = [[400, phY[0]], [600, phY[0]], [600, phY[1]]];
    } else {
      loop = [[40, yGND], [400, yGND], [400, phY[1]], [720, phY[1]], [720, phY[0]], [200, phY[0]], [200, yVBUS], [40, yVBUS], [40, yGND]];
      txt = '负半周 ia<0：① PGND → R31 → Q8 → ② MB 进电机 → ③ MA 出 → Q4 → ④ VBUS（同步整流）';
      bgs = [[200, yGND, '①'], [520, phY[1], '②'], [660, phY[0], '③'], [140, yVBUS, '④']];
      hops = [[600, phY[1]], [600, phY[0]], [400, phY[0]]];
    }
    const loopColor = state === 2 ? COL.warn : COL.good;
    flowPath(ctx, loop, t, loopColor, { nArrows: 4, nDots: 5, speed: 50, hops });
    badges(ctx, bgs, loopColor);
    label(ctx, txt, 430, 384, state === 2 ? COL.warn : COL.dim, 12);
    if (state === 0) label(ctx, pos ? 'ia > 0  正半周' : 'ia < 0  负半周', 260, yVBUS - 14, pos ? COL.good : COL.c, 12);
  }
  let t0 = null;
  function tick(ts) {
    if (t0 === null) t0 = ts;
    draw((ts - t0) / 1000);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ============================================================
   图 7-2：自举驱动电路（充电 / 供电 两状态）
   ============================================================ */
(function bootstrapDrive() {
  const cv = setupCanvas('cv-bootstrap');
  if (!cv) return;
  const { ctx } = cv;
  const ro = document.getElementById('bs-readout');
  let state = 0; // 0=充电 1=供电
  const TXT = [
    'VS≈GND：12V 经自举二极管 D 给 Cb 充到 ≈12V（充电窗口）',
    'VS≈Vbus：VB 被举升到 Vbus+12V，Cb 就地给驱动级供电，uGS≈12V'
  ];
  segSwitch(['btn-bs-charge', 'btn-bs-drive'], i => {
    state = i; if (ro) ro.textContent = TXT[i];
  });

  const yRail = 36, yGND = 264;
  // 版式：电源(20-155) | 驱动IC(70-230) | 自举(155-262) | 半桥(560) | 电机(636-816)
  // 底部说明栏 y>=284，元件与导线一律不进入
  const icX = 70, icY = 90, icW = 160, icH = 160;      // 框 70..230 × 90..250
  const d6X = 155;                                      // D6 在 IC 正上方，y 36..70
  const c50X = 300, c50T = 70, c50B = 110;              // C50 在框右侧，y 70..110（x=300 让回流竖线避开 HO1 标签）
  const vb1Y = 70, ho1Y = 120, vs1Y = 170, lo1Y = 220;  // 三条水平网络线
  const hbX = 560, uT = 90, uB = 150, mid = 170, lT = 190, lB = 250;
  const line = (x0, y0, x1, y1, w, c) => {
    ctx.strokeStyle = c || COL.dim; ctx.lineWidth = w || 2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  };
  const dot = (x, y) => { ctx.fillStyle = COL.dim; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); };
  function draw(t) {
    ctx.clearRect(0, 0, cv.w, cv.h);
    // ---- 轨道 ----
    line(20, yRail, d6X, yRail, 3);            // VCC 轨（到 D6 阳极）
    line(520, yRail, 600, yRail, 3);           // VBUS 轨（到半桥）
    line(20, yGND, 600, yGND, 3);              // 地轨
    label(ctx, 'VCC +12V', 82, yRail - 12, COL.white, 11.5);
    label(ctx, 'VBUS', 560, yRail - 12, COL.white, 11.5);
    label(ctx, 'PGND', 48, yGND - 12, COL.dim, 11);
    line(560, yRail, 560, uT, 2);              // VBUS → Q4 漏极
    // ---- 驱动 IC 框 ----
    ctx.fillStyle = COL.boxFill; ctx.strokeStyle = COL.grid; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(icX, icY, icW, icH, 4);
    else ctx.rect(icX, icY, icW, icH);
    ctx.fill(); ctx.stroke();
    label(ctx, 'FD6288T', 140, icY + 24, COL.white, 13);
    label(ctx, '栅极驱动 IC', 140, icY + 41, COL.dim, 10);
    // 左侧引脚：VCC 上拉到 12V 轨；HIN/LIN 来自 MCU
    line(48, yRail, 48, 110, 2);
    line(48, 110, icX, 110, 1.5);
    label(ctx, 'VCC', 64, 104, COL.dim, 10, 'right');
    line(38, 160, 38, 200, 1.5);
    line(38, 160, icX, 160, 1.5);
    line(38, 200, icX, 200, 1.5);
    label(ctx, 'HIN1', 64, 154, COL.dim, 10, 'right');
    label(ctx, 'LIN1', 64, 194, COL.dim, 10, 'right');
    label(ctx, 'MCU', 38, 216, COL.dim, 9.5);
    // 右侧引脚桩 + 标签（标签在桩线上方，不压线）
    const pin = (nm, yy, hot) => {
      line(icX + icW, yy, 268, yy, 1.5);
      label(ctx, nm, icX + icW + 6, yy - 9, hot ? COL.warn : COL.dim, 10, 'left');
    };
    pin('HO1', ho1Y, state === 1);
    pin('VS1', vs1Y, false);
    pin('LO1', lo1Y, false);
    // VB1 从框顶出（x=185），上到 VB1 网络线；标签放桩线左侧避开设 VB1 的回路竖线
    line(185, icY, 185, vb1Y, 1.5);
    label(ctx, 'VB1', 171, 82, state === 1 ? COL.warn : COL.dim, 9.5, 'right');
    // ---- 自举：D6（VCC→VB1）+ C50（VB1→VS1）----
    diodeV(ctx, d6X, yRail, vb1Y, '', state === 0);
    label(ctx, 'D6', d6X + 13, 50, COL.fb, 10, 'left');
    line(d6X, vb1Y, c50X, vb1Y, 2);            // VB1 网络线
    dot(185, vb1Y);
    capV(ctx, c50X, c50T, c50B, '', 'left');
    label(ctx, 'C50 1μF', c50X + 12, 80, COL.dim, 10, 'left');
    line(c50X, c50B, c50X, vs1Y, 2);           // C50 下到 VS1 网络线
    dot(c50X, vs1Y);
    // VS1 网络线：引脚桩 → 半桥中点
    line(c50X, vs1Y, hbX, vs1Y, 2);
    // ---- 半桥 + 电机 ----
    mosfetV(ctx, hbX, uT, uB, null, state === 1, 'Q4', false);
    mosfetV(ctx, hbX, lT, lB, null, state === 0, 'Q7', false);
    line(hbX, uB, hbX, lT, 2);                 // 相 node（148..190 中点 170 已含）
    line(hbX, lB, hbX, yGND, 2);
    line(hbX, mid, 636, mid, 2);               // 相线 → 电机
    dot(hbX, mid);
    ctx.fillStyle = COL.boxFill; ctx.strokeStyle = COL.grid;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(636, 148, 180, 44, 6);
    else ctx.rect(636, 148, 180, 44);
    ctx.fill(); ctx.stroke();
    label(ctx, '电机相线（电感负载）', 726, 166, COL.dim, 11);
    label(ctx, '→ MA', 726, 183, COL.fb, 10);
    // ---- 栅极驱动虚线：HO1（经框内到栅极）、LO1 ----
    ctx.save(); ctx.setLineDash([5, 4]);
    ctx.strokeStyle = state === 1 ? COL.warn : COL.fb; ctx.lineWidth = 1.4;
    ctx.beginPath();
    strokePath(ctx, [[185, icY], [185, ho1Y], [hbX - 36, ho1Y]], [[c50X, ho1Y]]);
    ctx.stroke();
    ctx.strokeStyle = COL.fb;
    ctx.beginPath(); ctx.moveTo(icX + icW, lo1Y); ctx.lineTo(hbX - 36, lo1Y); ctx.stroke();
    ctx.restore();
    // ---- 回路（全正交、沿元件走、闭合）----
    if (state === 0) {
      const loop = [[20, yRail], [d6X, yRail], [d6X, vb1Y], [c50X, vb1Y], [c50X, vs1Y], [hbX, vs1Y], [hbX, yGND], [20, yGND], [20, yRail]];
      flowPath(ctx, loop, t, COL.good, { nArrows: 4, nDots: 5 });
      badges(ctx, [[90, yRail, '①'], [230, vb1Y, '②'], [430, vs1Y, '③'], [560, 260, '④']], COL.good);
      label(ctx, '充电回路：① VCC → D6 → ② C50 → ③ VS（≈0V，Q7 导通拉低）→ ④ PGND', 430, 304, COL.good, 11.5);
      label(ctx, 'VB ≈ 12V    VS ≈ 0V', 430, 324, COL.warn, 11.5);
    } else {
      const loop = [[c50X, vb1Y], [185, vb1Y], [185, ho1Y], [hbX - 36, ho1Y], [hbX, ho1Y], [hbX, vs1Y], [c50X, vs1Y], [c50X, c50B]];
      flowPath(ctx, loop, t, COL.good, { nArrows: 4, nDots: 5, hops: [[c50X, ho1Y]] });
      badges(ctx, [[240, vb1Y, '①'], [400, ho1Y, '②'], [560, 162, '③'], [430, vs1Y, '④']], COL.good);
      label(ctx, '供电回路：① C50(+) → VB1 → HO1 → ② Q4 栅极 → ③ 源极 VS → ④ C50(−)，D6 反偏截止', 430, 304, COL.good, 11.5);
      label(ctx, 'VB ≈ VBUS+12V    VS ≈ VBUS    VB−VS 恒为 12V', 430, 324, COL.warn, 11.5);
    }
  }
  let t0 = null;
  function tick(ts) {
    if (t0 === null) t0 = ts;
    draw((ts - t0) / 1000);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ============================================================
   图 7-3：电流采样电路（三种电阻位置 + 放大链路）
   ============================================================ */
(function shuntSampling() {
  const cv = setupCanvas('cv-shunt');
  if (!cv) return;
  const { ctx } = cv;
  const ro = document.getElementById('sh-readout');
  let mode = 0; // 0=三电阻 1=下桥臂两电阻 2=母线单电阻
  const TXT = [
    '三电阻：每相一个，任意时刻可读相电流，信息最全、成本最高',
    '下桥臂两电阻：仅下管导通时电流流过 Rs，注意采样时机（见 2.5），ic 用公式算出',
    '母线单电阻：母线电流呈"拼块"，需多点采样重构三相，成本最低'
  ];
  segSwitch(['btn-sh-3', 'btn-sh-2', 'btn-sh-1'], i => {
    mode = i; if (ro) ro.textContent = TXT[i];
  });

  const yT = 60, yB = 300;
  const legs = [150, 290, 430];  // A/B/C 桥臂 x
  const uT = 90, uB = 150;       // 上管
  const lT = 210, lB = 270;      // 下管
  const phY = [160, 180, 200];   // 三相线高度（落在桥臂间隙 150..210 内）
  const mX = 520, mW = 110;      // 电机盒 520..630 × 140..250
  const line = (x0, y0, x1, y1, w, c) => {
    ctx.strokeStyle = c || COL.dim; ctx.lineWidth = w || 2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  };
  const dot = (x, y) => { ctx.fillStyle = COL.dim; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); };
  function draw(t) {
    ctx.clearRect(0, 0, cv.w, cv.h);
    line(40, yT, 500, yT, 3);
    if (mode === 2) {
      line(40, yB, 70, yB, 3);
      resistorH(ctx, 70, yB, 50, '', true);
      line(120, yB, 500, yB, 3);
      label(ctx, 'Rs 1mΩ', 148, yB + 16, COL.warn, 10);
      label(ctx, 'PGND', 70, yB + 16, COL.dim, 11);
    } else {
      line(40, yB, 500, yB, 3);
      label(ctx, 'PGND', 70, yB + 16, COL.dim, 11);
    }
    label(ctx, 'VBUS', 90, yT - 14, COL.white, 12);
    // 三个桥臂（相 node 从间隙直接水平引出：A@160 / B@180 / C@200）
    legs.forEach((x, i) => {
      line(x, yT, x, uT);
      if (mode === 1) {                                 // 下桥臂采样：电阻串进源极回路
        line(x, lB, x, 278);
        if (i < 2) resistorV(ctx, x, 278, 18, 'Rs 1mΩ', true);
        else line(x, 296, x, yB);
      } else {
        line(x, lB, x, yB);
      }
      mosfetV(ctx, x, uT, uB, null, false, '', false);
      mosfetV(ctx, x, lT, lB, null, false, '', false);
      hLine(ctx, x, mX, phY[i], legs.slice(i + 1).map(l => [l, phY[i]]), 1.5); // 相线：全水平进电机盒，跨桥臂处跳线
      dot(x, phY[i]);
      dot(x, yB);
    });
    // mode 0：三只 Rs 串在相线上（靠近电机盒）
    if (mode === 0) {
      phY.forEach(y => resistorH(ctx, 470, y, 24, '', true));
      label(ctx, 'Rs 1mΩ', 482, 146, COL.warn, 9.5);
    }
    // 电机盒：三相线水平进入
    ctx.fillStyle = COL.boxFill; ctx.strokeStyle = COL.grid; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(mX, 140, mW, 110, 6);
    else ctx.rect(mX, 140, mW, 110);
    ctx.fill(); ctx.stroke();
    label(ctx, 'MA', 532, 152, COL.fb, 9, 'left');
    label(ctx, 'MB', 532, 172, COL.fb, 9, 'left');
    label(ctx, 'MC', 532, 192, COL.fb, 9, 'left');
    label(ctx, '电机（三相绕组）', 575, 232, COL.dim, 10.5);
    // 采样点指示
    if (mode === 0) {
      arrow(ctx, 510, 128, 510, 146, COL.warn, 1.5, 5);
      label(ctx, '采样点', 510, 120, COL.warn, 10.5);
    } else if (mode === 1) {
      arrow(ctx, 118, 287, 136, 287, COL.warn, 1.5, 5);
      label(ctx, '采样点', 114, 287, COL.warn, 10.5, 'right');
    } else {
      arrow(ctx, 95, 272, 95, 290, COL.warn, 1.5, 5);
      label(ctx, '采样点', 95, 264, COL.warn, 10.5);
    }
    // 回路：VBUS → A 上管 → 相线 A → 绕组 → 相线 B → B 下管 → PGND（全正交闭合）
    const loop = [[50, yT], [150, yT], [150, phY[0]], [mX, phY[0]], [570, phY[0]], [570, phY[1]], [mX, phY[1]], [290, phY[1]], [290, yB], [50, yB], [50, yT]];
    const pos = Math.floor(t / 2.5) % 2 === 0;
    flowPath(ctx, pos ? loop : loop.slice().reverse(), t, COL.good, { nArrows: 3, nDots: 4, hops: [[290, phY[0]], [430, phY[1]]] });
    badges(ctx, [[100, yT, '①'], [455, phY[0], '②'], [570, 170, '③'], [450, phY[1], '④'], [260, yB, '⑤']], COL.good);
    label(ctx, pos ? '正半周 ia > 0' : '负半周 ia < 0', 260, yT - 14, pos ? COL.good : COL.c, 11);
    label(ctx, '① VBUS → ② A 相 Rs → ③ 绕组 → ④ B 相 Rs → ⑤ PGND', 200, 322, COL.dim, 11, 'left');
    label(ctx, [
      '当前：ia 流过 A 相 Rs，ib 流过 B 相 Rs —— 两相电流同时可读',
      '当前：ia 流过 A 臂下桥 Rs（A 下管导通时）；ic 由 ia+ib+ic=0 算出',
      '当前：母线 Rs 中流过当前导通相的相电流，一个周期拼出三相'
    ][mode], 50, 342, COL.warn, 11.5, 'left');
    // 信号链（右侧，y 60..116，与电机盒上下错开）
    label(ctx, '采样信号链', 705, 48, COL.white, 13);
    const chain = [
      [560, 'Rs 压降', 'i·Rs  (mV 级)'],
      [660, '运放', '×G + Vref/2'],
      [760, 'ADC', '→ MCU']
    ];
    chain.forEach(([x, a, b]) => {
      ctx.fillStyle = COL.boxFill; ctx.strokeStyle = COL.grid; ctx.lineWidth = 1.5;
      ctx.fillRect(x, 60, 90, 56); ctx.strokeRect(x, 60, 90, 56);
      label(ctx, a, x + 45, 82, COL.white, 12);
      label(ctx, b, x + 45, 102, COL.dim, 9.5);
    });
    arrow(ctx, 651, 88, 659, 88, COL.fb, 1.5, 6);
    arrow(ctx, 751, 88, 759, 88, COL.fb, 1.5, 6);
    label(ctx, 'V_ADC = G·i·Rs + Vref/2', 705, 140, COL.dim, 11.5);
    label(ctx, '零点被 Vref/2 抬到量程中间', 705, 160, COL.fb, 10);
  }
  let t0 = null;
  function tick(ts) {
    if (t0 === null) t0 = ts;
    draw((ts - t0) / 1000);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ============================================================
   图 7-4：Buck 辅助电源（两回路交替 + 电源链）
   ============================================================ */
(function buckSupply() {
  const cv = setupCanvas('cv-buck');
  if (!cv) return;
  const { ctx } = cv;
  const ro = document.getElementById('buck-readout');
  const T = 2.6, DUTY = 0.5;
  let lastPhase = -1;

  const yIn = 40, yGND = 270;
  // 版式：输入(40-130) | U2(130-250) | SW/D5(250-310) | L1(314-346) | 分压(380) | 输出(580-620) | 负载(655-705)
  // 底部说明栏 y>=288，元件与导线一律不进入
  const icX = 130, icY = 90, icW = 120, icH = 140;   // 框 130..250 × 90..230
  const swX = 200, swPinY = 150, l1X = 330, d5X = 296, fbX = 380;
  const line = (x0, y0, x1, y1, w, c) => {
    ctx.strokeStyle = c || COL.dim; ctx.lineWidth = w || 2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  };
  const dot = (x, y) => { ctx.fillStyle = COL.dim; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); };
  function draw(t) {
    ctx.clearRect(0, 0, cv.w, cv.h);
    const on = (t % T) < T * DUTY;
    if ((on ? 1 : 0) !== lastPhase) {
      lastPhase = on ? 1 : 0;
      if (ro) ro.textContent = on
        ? '内部开关导通：VBUS → SW → L1 → 负载，电感储能'
        : '开关关断：电感电流经 D5（SS34）续流，继续向负载供电';
    }
    // ---- 轨道 ----
    line(40, yIn, 130, yIn, 3);                // VBUS 轨
    line(40, yGND, 710, yGND, 3);              // 地轨
    label(ctx, 'VBUS (24V)', 85, yIn - 12, COL.white, 11.5);
    label(ctx, 'PGND', 140, yGND - 12, COL.dim, 11);
    // ---- 输入电容 ----
    capV(ctx, 70, yIn, yGND, '');
    label(ctx, 'C22 2.2μF', 84, 155, COL.dim, 10, 'left');
    dot(70, yIn); dot(70, yGND); dot(112, yIn); dot(112, yGND);
    // ---- U2 框 ----
    ctx.fillStyle = COL.boxFill; ctx.strokeStyle = COL.grid; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(icX, icY, icW, icH, 4);
    else ctx.rect(icX, icY, icW, icH);
    ctx.fill(); ctx.stroke();
    label(ctx, 'TPS54560', 190, icY + 12, COL.white, 12.5);
    label(ctx, 'Buck 60V/3A', 190, icY + 28, COL.dim, 9.5);
    // 左侧引脚：VIN 上拉到 VBUS，GND 下到地，EN 悬空桩
    line(112, yIn, 112, 130, 2);
    line(112, 130, icX, 130, 1.5);
    label(ctx, 'VIN', 108, 123, COL.dim, 10, 'right');
    line(icX, 180, 116, 180, 1.5);
    label(ctx, 'EN', 112, 173, COL.dim, 10, 'right');
    line(icX, 200, 112, 200, 1.5);
    line(112, 200, 112, yGND, 2);
    label(ctx, 'GND', 108, 193, COL.dim, 10, 'right');
    // 右侧引脚：BOOT / SW / FB
    line(icX + icW, 110, 264, 110, 1.5);
    label(ctx, 'BOOT', 254, 101, COL.dim, 9.5, 'left');
    hLine(ctx, icX + icW, 330, 190, [[d5X, 190]], 1.5);  // FB 引脚线，跨 D5 竖线处跳线
    label(ctx, 'FB', 254, 181, COL.dim, 10, 'left');
    // 内部开关示意：VIN 节点 → 开关 → SW 节点
    line(icX, 130, swX, 130, 1.5);
    line(swX, 130, swX, swPinY, 1.5, on ? COL.good : COL.dim);
    ctx.strokeStyle = on ? COL.good : COL.dim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(swX, 130); ctx.lineTo(swX, 136); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(swX, 145); ctx.lineTo(swX, swPinY); ctx.stroke();
    if (on) { ctx.fillStyle = COL.good; ctx.fillRect(swX - 5, 136, 10, 9); }
    else { ctx.fillStyle = COL.boxFill; ctx.fillRect(swX - 5, 136, 10, 9); ctx.strokeRect(swX - 5, 136, 10, 9); }
    line(swX, swPinY, icX + icW, swPinY, 2);
    label(ctx, 'SW', 254, 141, COL.dim, 10, 'left');
    // ---- SW 节点 → L1 → Vout（全水平）----
    line(icX + icW, swPinY, l1X - 16, swPinY, 2);
    dot(d5X, swPinY);
    ctx.strokeStyle = COL.white; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(l1X - 16, swPinY);
    for (let i = 0; i < 4; i++) {
      const cx = l1X - 16 + (i + 0.5) * 8;
      ctx.arc(cx, swPinY, 4, Math.PI, 0, false);
    }
    ctx.stroke();
    label(ctx, 'L1 6.8μH', l1X, swPinY - 14, COL.dim, 10.5);
    line(l1X + 16, swPinY, 710, swPinY, 2);    // Vout 轨
    label(ctx, 'VOUT +12V', 470, swPinY - 12, COL.white, 11.5);
    // ---- D5 续流二极管：SW 节点 → PGND，阴极朝上 ----
    ctx.strokeStyle = !on ? COL.warn : COL.dim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(d5X, swPinY); ctx.lineTo(d5X, 205); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d5X, 219); ctx.lineTo(d5X, yGND); ctx.stroke();
    ctx.fillStyle = !on ? COL.warn : 'transparent';
    ctx.beginPath(); ctx.moveTo(d5X - 8, 219); ctx.lineTo(d5X + 8, 219); ctx.lineTo(d5X, 205);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d5X - 8, 205); ctx.lineTo(d5X + 8, 205); ctx.stroke();
    label(ctx, 'D5 SS34', d5X + 14, 222, !on ? COL.warn : COL.dim, 10, 'left');
    // ---- 反馈分压：Vout → R15 → FB → R17 → PGND ----
    line(fbX, swPinY, fbX, 170, 1.5);
    dot(fbX, swPinY);
    resistorV(ctx, fbX, 170, 35, 'R15 100k', false);
    line(fbX, 205, fbX, 215, 1.5);
    dot(fbX, 210);
    resistorV(ctx, fbX, 215, 35, 'R17 10k', false);
    line(fbX, 250, fbX, yGND, 1.5);
    dot(fbX, yGND);
    line(fbX, 210, 330, 210, 1.5);             // 中点抽头 → FB 引脚
    line(330, 210, 330, 190, 1.5);
    label(ctx, '反馈分压', 348, 243, COL.fb, 9.5);
    // ---- 输出电容 ----
    capV(ctx, 580, swPinY, yGND, '');
    label(ctx, 'C23 10μF', 564, 210, COL.dim, 10, 'right');
    capV(ctx, 610, swPinY, yGND, '');
    label(ctx, 'C24', 624, 210, COL.dim, 10, 'left');
    dot(580, swPinY); dot(580, yGND); dot(610, swPinY); dot(610, yGND);
    // ---- 负载 ----
    ctx.fillStyle = COL.boxFill; ctx.strokeStyle = COL.grid; ctx.lineWidth = 1.5;
    ctx.fillRect(655, 190, 50, 70); ctx.strokeRect(655, 190, 50, 70);
    label(ctx, '负载', 680, 225, COL.dim, 11);
    line(680, swPinY, 680, 190, 1.5);
    line(680, 260, 680, yGND, 1.5);
    dot(680, swPinY); dot(680, yGND);
    // ---- 板上电源链 ----
    label(ctx, '板上电源链', 722, 42, COL.white, 12);
    const boxes = [
      [600, 50, 'VBUS', '24V'],
      [690, 50, 'Buck', '12V 驱动'],
      [780, 50, 'LDO', '3.3V MCU']
    ];
    boxes.forEach(([x, y, a, b]) => {
      ctx.fillStyle = COL.boxFill; ctx.strokeStyle = COL.grid;
      ctx.fillRect(x, y, 64, 38); ctx.strokeRect(x, y, 64, 38);
      label(ctx, a, x + 32, y + 12, COL.white, 11);
      label(ctx, b, x + 32, y + 28, COL.dim, 9.5);
    });
    arrow(ctx, 666, 69, 688, 69, COL.fb, 1.5, 6);
    arrow(ctx, 756, 69, 778, 69, COL.fb, 1.5, 6);
    // ---- 回路（全正交、沿元件走、闭合）----
    if (on) {
      const loop = [[50, yIn], [112, yIn], [112, 130], [icX, 130], [swX, 130], [swX, swPinY], [250, swPinY], [l1X - 16, swPinY], [l1X + 16, swPinY], [680, swPinY], [680, yGND], [50, yGND], [50, yIn]];
      flowPath(ctx, loop, t, COL.good, { nArrows: 4, nDots: 5 });
      badges(ctx, [[85, yIn, '①'], [225, swPinY, '②'], [370, swPinY, '③'], [720, 225, '④'], [480, yGND, '⑤']], COL.good);
      label(ctx, '开关导通：① VBUS → ② SW → ③ L1 → ④ 负载 → ⑤ PGND，电感储能', 430, 306, COL.good, 11.5);
      label(ctx, '占空比 D = Vout/Vbus = 12/24 = 50%', 430, 324, COL.warn, 11.5);
    } else {
      const loop = [[d5X, yGND], [d5X, swPinY], [l1X - 16, swPinY], [l1X + 16, swPinY], [680, swPinY], [680, yGND], [d5X, yGND]];
      flowPath(ctx, loop, t, COL.warn, { nArrows: 3, nDots: 4 });
      badges(ctx, [[d5X, 246, '①'], [370, swPinY, '②'], [530, swPinY, '③'], [700, yGND, '④']], COL.warn);
      label(ctx, '开关关断：PGND → ① D5 续流 → ② SW → L1 → ③ 负载 → ④ PGND，输出不断流', 430, 306, COL.warn, 11.5);
      label(ctx, '电感电流不能突变，D5 给它留了一条回路', 430, 324, COL.dim, 11);
    }
  }
  let t0 = null;
  function tick(ts) {
    if (t0 === null) t0 = ts;
    draw((ts - t0) / 1000);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ============================================================
   图形放大灯箱：点击任意动画画布 → 全屏放大查看（动画继续播放）
   ============================================================ */
(function lightbox() {
  const lb = document.getElementById('lightbox');
  const closeBtn = document.getElementById('lightbox-close');
  if (!lb || !closeBtn) return;
  let origin = null; // 记录画布原来的位置，关闭时还原

  document.querySelectorAll('.viz-block canvas').forEach(cv => {
    cv.title = '点击放大查看';
    cv.addEventListener('click', () => {
      if (origin) return;
      origin = { parent: cv.parentNode, next: cv.nextSibling };
      lb.appendChild(cv);
      // 按视口可用空间等比放大（最多 2.4 倍）
      const scale = Math.min(
        (window.innerWidth * 0.92) / cv.width,
        (window.innerHeight * 0.82) / cv.height,
        2.4
      );
      cv.style.width = Math.round(cv.width * scale) + 'px';
      cv.style.height = Math.round(cv.height * scale) + 'px';
      lb.classList.add('open');
      lb.setAttribute('aria-hidden', 'false');
    });
  });

  function close() {
    if (!origin) return;
    const cv = lb.querySelector('canvas');
    if (cv) {
      cv.style.width = '';
      cv.style.height = '';
      origin.parent.insertBefore(cv, origin.next);
    }
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    origin = null;
  }

  lb.addEventListener('click', e => { if (e.target !== lb.querySelector('canvas')) close(); });
  closeBtn.addEventListener('click', e => { e.stopPropagation(); close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();



/* ============================================================
   图 8-2：电流采样换算链（分流电阻 → 运放 → 偏置 → ADC → 安培）
   ============================================================ */
(function currChain() {
  const c = setupCanvas('cv-curr-chain');
  if (!c) return;
  const { ctx, w, h } = c;

  const RSH = 0.005, GAIN = 30, VREF = 3.3, VOFF = 1.65, FS = 4095;
  const MA_PER_LSB = VREF * 1000 / FS / GAIN / RSH;   // ≈ 5.37 mA

  const iSlider = document.getElementById('cc-i');
  const sweepBtn = document.getElementById('btn-cc-sweep');
  const readout = document.getElementById('cc-readout');

  let I = 4.5, sweeping = false, sweepT = 0;
  if (iSlider) iSlider.addEventListener('input', () => { I = +iSlider.value / 10; sweeping = false; });
  if (sweepBtn) sweepBtn.addEventListener('click', () => {
    sweeping = !sweeping; sweepT = 0;
    sweepBtn.textContent = sweeping ? '⏸ 停止扫描' : '▶ 扫一遍 −10A→+10A';
    sweepBtn.classList.toggle('active', sweeping);
  });

  function rrect(x, y, ww, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + ww - r, y); ctx.quadraticCurveTo(x + ww, y, x + ww, y + r);
    ctx.lineTo(x + ww, y + hh - r); ctx.quadraticCurveTo(x + ww, y + hh, x + ww - r, y + hh);
    ctx.lineTo(x + r, y + hh); ctx.quadraticCurveTo(x, y + hh, x, y + hh - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function box(x, y, ww, hh, title, value, color) {
    ctx.fillStyle = COL.boxFill; ctx.strokeStyle = color; ctx.lineWidth = 1.6;
    rrect(x, y, ww, hh, 9); ctx.fill(); ctx.stroke();
    label(ctx, title, x + ww / 2, y + 18, COL.dim, 11.5);
    label(ctx, value, x + ww / 2, y + hh / 2 + 10, color, 16);
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const Ush = I * RSH * 1000;                       // mV
    const Vout = VOFF - I * RSH * GAIN;               // V（反相 + 偏置）
    const code = Math.max(0, Math.min(FS, Math.round(Vout / VREF * FS)));
    const Iback = (2048 - code) * MA_PER_LSB / 1000;  // A

    const bw = 148, bh = 84, y0 = 78, gap = 34;
    const xs = [40, 40 + bw + gap, 40 + 2 * (bw + gap), 40 + 3 * (bw + gap), 40 + 4 * (bw + gap)];
    box(xs[0], y0, bw, bh, '① 相电流 I', I.toFixed(2) + ' A', COL.white);
    box(xs[1], y0, bw, bh, '② 分流电阻 5 mΩ', Ush.toFixed(1) + ' mV', COL.a);
    box(xs[2], y0, bw, bh, '③ 运放 ×30 反相+偏置', Vout.toFixed(3) + ' V', COL.b);
    box(xs[3], y0, bw, bh, '④ ADC 12bit / 3.3V', 'code = ' + code, COL.c);
    box(xs[4], y0, bw, bh, '⑤ 减零点 ×5.37mA', Iback.toFixed(2) + ' A', COL.accent);

    for (let i = 0; i < 4; i++) {
      arrow(ctx, xs[i] + bw + 3, y0 + bh / 2, xs[i + 1] - 4, y0 + bh / 2, COL.dim, 2, 7);
    }

    /* --- ADC 输入电压标尺 --- */
    const sx = 60, sy = 236, sw = w - 200, sh = 34;
    ctx.fillStyle = COL.grid; ctx.globalAlpha = 0.5;
    rrect(sx, sy, sw, sh, 6); ctx.fill(); ctx.globalAlpha = 1;
    // 零电流位置
    const frac = Math.max(0, Math.min(1, Vout / VREF));
    const g = ctx.createLinearGradient(sx, 0, sx + sw, 0);
    g.addColorStop(0, COL.a); g.addColorStop(0.5, COL.accent); g.addColorStop(1, COL.b);
    ctx.fillStyle = g; ctx.globalAlpha = 0.85;
    rrect(sx, sy, sw * frac, sh, 6); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = COL.dim; ctx.lineWidth = 1;
    rrect(sx, sy, sw, sh, 6); ctx.stroke();
    // 1.65V 中点线
    ctx.setLineDash([3, 3]); ctx.strokeStyle = COL.white; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(sx + sw * 0.5, sy - 8); ctx.lineTo(sx + sw * 0.5, sy + sh + 8); ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, '1.65 V（零点 2048）', sx + sw * 0.5, sy - 16, COL.white, 11.5);
    label(ctx, '0 V', sx, sy + sh + 18, COL.dim, 11);
    label(ctx, '3.3 V', sx + sw, sy + sh + 18, COL.dim, 11);
    label(ctx, 'ADC 输入电压范围', sx - 6, sy + sh / 2, COL.dim, 11.5, 'right');
    // 当前值游标
    ctx.fillStyle = COL.white;
    ctx.beginPath();
    ctx.moveTo(sx + sw * frac, sy - 3); ctx.lineTo(sx + sw * frac - 5, sy - 11); ctx.lineTo(sx + sw * frac + 5, sy - 11);
    ctx.closePath(); ctx.fill();

    /* --- 关键点提示 --- */
    const notes = [
      '零电流 ⇒ code = 2048（不是 0）',
      '电流为正 ⇒ 运放反相 ⇒ code 减小',
      '1 LSB = ' + MA_PER_LSB.toFixed(2) + ' mA，±10 A 量程约 11 bit'
    ];
    notes.forEach((t, i) => label(ctx, '· ' + t, w - 130, 250 + i * 22, COL.dim, 11.5, 'left'));

    if (readout) {
      readout.textContent = `I=${I.toFixed(2)} A → U=${Ush.toFixed(1)} mV → Vout=${Vout.toFixed(3)} V → code=${code} → 回算 ${Iback.toFixed(2)} A`;
    }
  }

  let last = null;
  function tick(ts) {
    if (last === null) last = ts;
    const dt = (ts - last) / 1000; last = ts;
    if (sweeping) {
      sweepT += dt / 6;
      if (sweepT > 1) { sweepT = 0; sweeping = false; if (sweepBtn) { sweepBtn.textContent = '▶ 扫一遍 −10A→+10A'; sweepBtn.classList.remove('active'); } }
      I = -10 + 20 * sweepT;
      if (iSlider) iSlider.value = Math.round(I * 10);
    }
    draw();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ============================================================
   图 8-3：三环软件分频调度（20k / 4k / 1.33k）
   ============================================================ */
(function sched() {
  const c = setupCanvas('cv-sched');
  if (!c) return;
  const { ctx, w, h } = c;

  const X0 = 118, X1 = w - 40;
  const rows = [
    { y: 96, name: '电流环', div: 1, color: COL.a, note: '20 kHz · 50 µs · 每个 ADC 中断都跑' },
    { y: 168, name: '速度环', div: 5, color: COL.b, note: '4 kHz · 250 µs · 每 5 个电流环' },
    { y: 240, name: '位置环', div: 15, color: COL.c, note: '1.33 kHz · 750 µs · 每 3 个速度环' }
  ];
  const NBEAT = 30;   // 显示的节拍数

  let beat = 0, playing = true;
  const playBtn = document.getElementById('btn-sc-play');
  const slider = document.getElementById('sc-time');
  const readout = document.getElementById('sc-readout');
  if (playBtn) playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? '⏸ 暂停' : '▶ 播放';
    playBtn.classList.toggle('active', playing);
  });
  if (slider) slider.addEventListener('input', () => { beat = +slider.value; });

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const dx = (X1 - X0) / NBEAT;
    const cur = Math.floor(beat) % NBEAT;

    rows.forEach(r => {
      label(ctx, r.name, X0 - 16, r.y - 14, r.color, 13, 'right');
      label(ctx, r.note, X0 - 16, r.y + 4, COL.dim, 10.5, 'right');
      // 基线
      ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X0, r.y + 18); ctx.lineTo(X1, r.y + 18); ctx.stroke();
      for (let i = 0; i < NBEAT; i++) {
        const x = X0 + dx * (i + 0.5);
        const on = (i % r.div === 0);
        if (!on) {
          ctx.fillStyle = COL.grid;
          ctx.beginPath(); ctx.arc(x, r.y + 18, 2.5, 0, TAU); ctx.fill();
          continue;
        }
        const isCur = (i === cur);
        ctx.strokeStyle = r.color; ctx.lineWidth = isCur ? 3.4 : 2.2;
        ctx.beginPath(); ctx.moveTo(x, r.y + 18); ctx.lineTo(x, r.y - 6); ctx.stroke();
        ctx.fillStyle = r.color;
        ctx.beginPath(); ctx.arc(x, r.y - 6, isCur ? 5 : 3.4, 0, TAU); ctx.fill();
        if (isCur) {
          ctx.globalAlpha = 0.25; ctx.fillStyle = r.color;
          ctx.beginPath(); ctx.arc(x, r.y - 6, 11, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        }
      }
    });

    // 执行游标
    const xc = X0 + dx * (cur + 0.5);
    ctx.strokeStyle = COL.white; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(xc, 52); ctx.lineTo(xc, 272); ctx.stroke();
    ctx.globalAlpha = 1;

    // 底部说明
    label(ctx, '← 时间', X0, 292, COL.dim, 11, 'left');
    label(ctx, '一次 ADC 注入中断 = 一个节拍（50 µs）；速度环/位置环靠计数器分频挂在同一个中断里', (X0 + X1) / 2, 292, COL.dim, 11.5);

    if (readout) {
      const i = Math.floor(beat) % NBEAT;
      const tasks = ['电流环'];
      if (i % 5 === 0) tasks.push('速度环');
      if (i % 15 === 0) tasks.push('位置环');
      readout.textContent = `节拍 #${i}（t=${(i * 0.05).toFixed(2)} ms）→ 本次执行：${tasks.join(' + ')}`;
    }
  }

  let last = null;
  function tick(ts) {
    if (last === null) last = ts;
    const dt = (ts - last) / 1000; last = ts;
    if (playing) {
      beat += dt * 6;                      // 每秒 6 个节拍
      if (beat >= 600) beat = 0;
      if (slider) slider.value = Math.floor(beat);
    }
    draw();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ============================================================
   第 8 章 v2：STM32G4 外设时序（重做）
   图 8-1：TIM1 中心对齐全景（三角波/CH1/CH1N/MOS状态/OC4REF/ADC注入）
   ============================================================ */
(function tim1Timing() {
  const c = setupCanvas('cv-tim1-timing');
  if (!c) return;
  const { ctx, w, h } = c;

  const ARR  = 4249;         // 自动重装载寄存器
  const PSC  = 0;            // 预分频器
  const FCK  = 170e6;        // 定时器时钟 = SYSCLK
  const TPWM = 50;           // 一个 PWM 周期 50 us
  const CCR4 = ARR - 3;      // 扳机通道比较值

  const X0 = 130, X1 = w - 92;  // 左侧留 130px 给刻度文字, 右侧留 92px, 防止文字被裁
  const R = {
    tri   : { top: 66,  bot: 186 },
    ch1   : { hi: 218,  lo: 250  },
    ch1n  : { hi: 274,  lo: 306  },
    mos   : { y: 332,   h: 30    },
    oc4   : { hi: 392,  lo: 420  },
    adc   : { y: 446,   h: 44    },
    axis  : 512,
    legend: 576
  };

  const xOf    = phi => X0 + phi * (X1 - X0);
  const cntOf  = phi => ARR * (1 - Math.abs(2 * phi - 1));   // 三角波 0→ARR→0
  const yTri   = cnt => R.tri.bot - (cnt / ARR) * (R.tri.bot - R.tri.top);

  let phi = 0.5, playing = true, slow = false, dtC = 40, duty = 68;
  const CCR1 = () => Math.round(duty / 100 * ARR);

  /* MOS 桥臂状态: 2=上管ON 1=死区(两管都关) 0=下管ON */
  function mosState(p) {
    const d = cntOf(p) - CCR1();
    if (Math.abs(d) <= dtC / 2) return 1;
    return d < 0 ? 2 : 0;
  }
  const ch1On  = p => mosState(p) === 2;
  const ch1nOn = p => mosState(p) === 0;

  const playBtn = document.getElementById('btn-t1-play');
  const slowBtn = document.getElementById('btn-t1-slow');
  const tSlider = document.getElementById('t1-time');
  const dSlider = document.getElementById('t1-dt');
  const uSlider = document.getElementById('t1-duty');
  const readout = document.getElementById('t1-readout');

  if (playBtn) playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? '⏸ 暂停' : '▶ 播放';
    playBtn.classList.toggle('active', playing);
  });
  if (slowBtn) slowBtn.addEventListener('click', () => {
    slow = !slow;
    slowBtn.textContent = slow ? '🐢 慢放中 ×0.15' : '🐢 慢放 ×0.15';
    slowBtn.classList.toggle('active', slow);
  });
  if (tSlider) tSlider.addEventListener('input', () => { phi = +tSlider.value / 1000; });
  if (dSlider) dSlider.addEventListener('input', () => { dtC = +dSlider.value; });
  if (uSlider) uSlider.addEventListener('input', () => { duty = +uSlider.value; });

  function rrect(x, y, ww, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + ww - r, y); ctx.quadraticCurveTo(x + ww, y, x + ww, y + r);
    ctx.lineTo(x + ww, y + hh - r); ctx.quadraticCurveTo(x + ww, y + hh, x + ww - r, y + hh);
    ctx.lineTo(x + r, y + hh); ctx.quadraticCurveTo(x, y + hh, x, y + hh - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function rrectFill(x, y, ww, hh, r, fill) {
    ctx.save(); ctx.fillStyle = fill; rrect(x, y, ww, hh, r); ctx.fill(); ctx.restore();
  }
  /* 数字波形 */
  function digi(row, onFn, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 2.2;
    ctx.beginPath();
    let prev = null;
    for (let i = 0; i <= 1200; i++) {
      const p = i / 1200, x = xOf(p), y = onFn(p) ? row.hi : row.lo;
      if (prev === null) ctx.moveTo(x, y);
      else if (prev !== y) { ctx.lineTo(x, prev); ctx.lineTo(x, y); }
      else ctx.lineTo(x, y);
      prev = y;
    }
    ctx.stroke();
  }
  function baseLine(y) {
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X0 - 22, y); ctx.lineTo(X1 + 6, y); ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const ccr1 = CCR1();
    const dtNs = dtC * (2 / FCK) * 1e9;

    /* ---------- 采样窗口底纹: 三相下管全通区域 ---------- */
    const winPhi = (ARR - ccr1 + dtC / 2) / (2 * ARR);       // 半宽(以 phi 计)
    ctx.save();
    ctx.fillStyle = COL.accent; ctx.globalAlpha = 0.10;
    ctx.fillRect(xOf(0.5 - winPhi), R.tri.top - 12, xOf(winPhi) - xOf(-winPhi) + (xOf(winPhi) - xOf(0)), R.adc.y + R.adc.h - R.tri.top + 16);
    ctx.restore();
    ctx.setLineDash([4, 4]); ctx.strokeStyle = COL.accent; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xOf(0.5), R.tri.top - 12); ctx.lineTo(xOf(0.5), R.adc.y + R.adc.h + 4); ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, '采样窗口：三相下管全通', xOf(0.5), R.tri.top - 22, COL.accent, 12);

    /* ---------- ① 计数器三角波 ---------- */
    label(ctx, '① 计数器 CNT（中心对齐模式 1：上数到 ARR 再下数）', 14, R.tri.top - 22, COL.white, 12.5, 'left');
    baseLine(R.tri.bot + 6);
    // ARR 参考线
    ctx.setLineDash([3, 3]); ctx.strokeStyle = COL.dim; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X0 - 22, R.tri.top); ctx.lineTo(X1 + 6, R.tri.top); ctx.stroke();
    ctx.setLineDash([]);
    // CCR1 比较线
    ctx.setLineDash([5, 4]); ctx.strokeStyle = COL.a; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(X0, yTri(ccr1)); ctx.lineTo(X1, yTri(ccr1)); ctx.stroke();
    ctx.globalAlpha = 1; ctx.setLineDash([]);
    // 三角波
    ctx.beginPath();
    for (let i = 0; i <= 500; i++) { const p = i / 500; i ? ctx.lineTo(xOf(p), yTri(cntOf(p))) : ctx.moveTo(xOf(p), yTri(cntOf(p))); }
    ctx.strokeStyle = COL.white; ctx.lineWidth = 2.2; ctx.stroke();
    label(ctx, 'ARR=' + ARR, X0 - 12, R.tri.top, COL.dim, 11, 'right');
    label(ctx, '0', X0 - 12, R.tri.bot, COL.dim, 11, 'right');
    label(ctx, 'CCR1=' + ccr1, X1 + 10, yTri(ccr1), COL.a, 11, 'left');
    label(ctx, '上数 →', xOf(0.25), R.tri.bot + 20, COL.dim, 11);
    label(ctx, '← 下数', xOf(0.75), R.tri.bot + 20, COL.dim, 11);

    /* ---------- ②③ 互补输出 ---------- */
    label(ctx, '② CH1 → A 相上管栅极', 14, R.ch1.hi - 14, COL.a, 12, 'left');
    label(ctx, '③ CH1N → A 相下管栅极', 14, R.ch1n.hi - 14, COL.b, 12, 'left');
    [R.ch1, R.ch1n].forEach(r => { baseLine(r.hi); baseLine(r.lo); });
    digi(R.ch1, ch1On, COL.a);
    digi(R.ch1n, ch1nOn, COL.b);
    label(ctx, 'ON', X0 - 12, R.ch1.hi, COL.dim, 10.5, 'right');
    label(ctx, 'OFF', X0 - 12, R.ch1.lo, COL.dim, 10.5, 'right');
    label(ctx, '上管通', X1 + 10, R.ch1.hi, COL.a, 10.5, 'left');
    label(ctx, '下管通', X1 + 10, R.ch1n.hi, COL.b, 10.5, 'left');

    /* ---------- ④ MOS 桥臂实际状态带 ---------- */
    label(ctx, '④ A 相桥臂实际状态', 14, R.mos.y - 12, COL.white, 12, 'left');
    const seg = 900;
    for (let i = 0; i < seg; i++) {
      const p0 = i / seg, p1 = (i + 1) / seg, s = mosState(p0);
      const fill = s === 2 ? COL.a : (s === 1 ? COL.warn : COL.b);
      rrectFill(xOf(p0) - 0.6, R.mos.y, xOf(p1) - xOf(p0) + 1.2, R.mos.h, 3, fill);
    }
    ctx.globalAlpha = 0.9;
    label(ctx, '上管 ON', xOf(0.14), R.mos.y + R.mos.h / 2, COL.white, 11.5);
    label(ctx, '死区 两管都关', xOf(0.5) + 0, R.mos.y + R.mos.h / 2 - 22, COL.white, 10.5);
    label(ctx, '下管 ON', xOf(0.5), R.mos.y + R.mos.h / 2, COL.white, 11.5);
    label(ctx, '上管 ON', xOf(0.86), R.mos.y + R.mos.h / 2, COL.white, 11.5);
    ctx.globalAlpha = 1;
    label(ctx, '状态', X0 - 12, R.mos.y + R.mos.h / 2, COL.dim, 10.5, 'right');

    /* ---------- ⑤ OC4REF 扳机 ---------- */
    label(ctx, '⑤ CH4 的 OC4REF（Mode2, CCR4=ARR−3，无物理引脚）', 14, R.oc4.hi - 14, COL.warn, 12, 'left');
    baseLine(R.oc4.hi); baseLine(R.oc4.lo);
    digi(R.oc4, p => cntOf(p) > CCR4, COL.warn);
    label(ctx, '扳机脉冲', X1 + 10, R.oc4.hi, COL.warn, 10.5, 'left');
    const trigPhi = 0.5 - 3 / (2 * ARR);
    arrow(ctx, xOf(trigPhi), R.oc4.hi - 3, xOf(trigPhi), R.oc4.lo + 14, COL.warn, 2, 7);
    label(ctx, '↑ ADC 注入触发', xOf(trigPhi) + 46, R.oc4.lo + 16, COL.warn, 11, 'left');

    /* ---------- ⑥ ADC 注入全过程(时间已放大) ---------- */
    label(ctx, '⑥ ADC 注入转换（此段时间已放大 ≈200×）', 14, R.adc.y - 12, COL.white, 12, 'left');
    const ax = xOf(trigPhi);
    ctx.save();
    ctx.strokeStyle = COL.dim; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ax, R.oc4.lo); ctx.lineTo(ax, R.adc.y + R.adc.h + 6); ctx.stroke();
    ctx.restore();
    const bw1 = 34, bw2 = 62;                          // 采样 / 转换 示意宽度
    rrectFill(ax + 2, R.adc.y + 6, bw1, R.adc.h - 14, 4, COL.c);
    label(ctx, '采样', ax + 2 + bw1 / 2, R.adc.y + 20, COL.white, 10.5);
    label(ctx, '59 ns', ax + 2 + bw1 / 2, R.adc.y + 34, COL.dim, 9.5);
    rrectFill(ax + 2 + bw1 + 3, R.adc.y + 6, bw2, R.adc.h - 14, 4, COL.dq);
    label(ctx, '12bit 逐次逼近', ax + 2 + bw1 + 3 + bw2 / 2, R.adc.y + 20, COL.white, 10.5);
    label(ctx, '≈353 ns', ax + 2 + bw1 + 3 + bw2 / 2, R.adc.y + 34, COL.dim, 9.5);
    ctx.fillStyle = COL.warn;
    ctx.beginPath(); ctx.arc(ax + 2 + bw1 + 3 + bw2 + 12, R.adc.y + R.adc.h / 2, 5, 0, TAU); ctx.fill();
    label(ctx, 'JEOC 中断 → 电流环开始跑', ax + 2 + bw1 + 3 + bw2 + 20, R.adc.y + R.adc.h / 2, COL.warn, 11, 'left');
    label(ctx, '此刻：三相下管全通，分流电阻上的电流 = 相电流', ax + 2, R.axis - 10, COL.accent, 11, 'left');

    /* ---------- 时间轴 ---------- */
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X0, R.axis); ctx.lineTo(X1, R.axis); ctx.stroke();
    for (let k = 0; k <= 4; k++) {
      const x = xOf(k / 4);
      ctx.beginPath(); ctx.moveTo(x, R.axis); ctx.lineTo(x, R.axis + 5); ctx.stroke();
      if (k === 4) continue;   // 50 µs 刻度略去, 避免与右侧说明文字重叠
      label(ctx, (k * TPWM / 4).toFixed(1) + ' µs', x, R.axis + 16, COL.dim, 10.5);
    }
    label(ctx, '一个 PWM 周期 = 2×ARR = 8500 个计数 = 50 µs @170 MHz（PSC=0）', X1, R.axis + 34, COL.dim, 10.5, 'right');

    /* ---------- 游标 + 读数 ---------- */
    const xc = xOf(phi), cntNow = Math.round(cntOf(phi));
    ctx.strokeStyle = COL.white; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(xc, R.tri.top - 12); ctx.lineTo(xc, R.axis); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = COL.white;
    ctx.beginPath(); ctx.arc(xc, yTri(cntOf(phi)), 4.5, 0, TAU); ctx.fill();

    /* ---------- 图例 ---------- */
    const lg = [['上管导通', COL.a], ['死区(两管都关)', COL.warn], ['下管导通', COL.b]];
    let lx = X0 - 60;
    lg.forEach(([t, col]) => {
      rrectFill(lx, R.legend - 7, 16, 14, 3, col);
      label(ctx, t, lx + 22, R.legend, COL.dim, 11, 'left');
      lx += 22 + t.length * 11 + 26;
    });

    if (readout) {
      const st = mosState(phi);
      const txt = st === 2 ? '上管导通（电流经上管流入电机）'
                : st === 1 ? '死区：上下管都关断（体二极管续流）'
                : '下管导通（分流电阻上有相电流）';
      readout.textContent = `t=${(phi * TPWM).toFixed(1)} µs | CNT=${cntNow} | CCR1=${ccr1} | ${txt} | 死区 ${dtC}→${dtNs.toFixed(0)} ns | 占空比 ${(duty).toFixed(0)}%`;
    }
  }

  let last = null;
  function tick(ts) {
    if (last === null) last = ts;
    const dt = (ts - last) / 1000; last = ts;
    if (playing) {
      phi += dt / (slow ? 20 : 3);
      if (phi > 1) phi -= 1;
      if (tSlider) tSlider.value = Math.round(phi * 1000);
    }
    draw();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ============================================================
   图 8-2：PSC / ARR / CCR / CNT 四个寄存器到底是干什么的
   ============================================================ */
(function regConcept() {
  const c = setupCanvas('cv-psc-arr');
  if (!c) return;
  const { ctx, w, h } = c;
  const FCK = 170e6;

  let psc = 0, arr = 4249, duty = 68;
  const sP = document.getElementById('rg-psc');
  const sA = document.getElementById('rg-arr');
  const sD = document.getElementById('rg-duty');
  const ro = document.getElementById('rg-readout');
  if (sP) sP.addEventListener('input', () => { psc = +sP.value; });
  if (sA) sA.addEventListener('input', () => { arr = +sA.value; });
  if (sD) sD.addEventListener('input', () => { duty = +sD.value; });

  function rrect(x, y, ww, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + ww - r, y); ctx.quadraticCurveTo(x + ww, y, x + ww, y + r);
    ctx.lineTo(x + ww, y + hh - r); ctx.quadraticCurveTo(x + ww, y + hh, x + ww - r, y + hh);
    ctx.lineTo(x + r, y + hh); ctx.quadraticCurveTo(x, y + hh, x, y + hh - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function card(x, y, ww, hh, name, val, sub, color) {
    ctx.save();
    ctx.fillStyle = COL.boxFill; ctx.strokeStyle = color; ctx.lineWidth = 1.8;
    rrect(x, y, ww, hh, 9); ctx.fill(); ctx.stroke();
    ctx.restore();
    label(ctx, name, x + ww / 2, y + 17, color, 13);
    label(ctx, val,  x + ww / 2, y + 40, COL.white, 17);
    label(ctx, sub,  x + ww / 2, y + 60, COL.dim, 10.5);
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const fck   = FCK / (psc + 1);
    const fpwm  = fck / (2 * (arr + 1));
    const ccr   = Math.round(duty / 100 * arr);
    const okHz  = Math.abs(fpwm - 20000) < 1;

    /* 四张卡片 */
    const cw = 196, chh = 82, cy = 22, gap = 22;
    const xs = [26, 26 + (cw + gap), 26 + 2 * (cw + gap), 26 + 3 * (cw + gap)];
    card(xs[0], cy, cw, chh, 'PSC  预分频器', String(psc), '把 170 MHz 分给计数器', COL.c);
    card(xs[1], cy, cw, chh, 'ARR  自动重装载', String(arr), '决定 PWM 周期（频率）', COL.a);
    card(xs[2], cy, cw, chh, 'CCR  捕获/比较', String(ccr), '决定占空比（脉宽）', COL.b);
    card(xs[3], cy, cw, chh, 'CNT  计数器', '实时变化', '硬件自己 +1 / −1', COL.accent);

    /* 计算链 */
    const cy2 = 132;
    label(ctx, '170 MHz',  xs[0] + cw / 2, cy2, COL.dim, 12);
    label(ctx, '÷(PSC+1)', xs[0] + cw / 2, cy2 + 20, COL.c, 11);
    label(ctx, (fck / 1e6).toFixed(1) + ' MHz', xs[1] + cw / 2, cy2, COL.white, 13);
    label(ctx, '÷(ARR+1)÷2', xs[1] + cw / 2, cy2 + 20, COL.a, 11);
    label(ctx, (fpwm / 1000).toFixed(2) + ' kHz', xs[2] + cw / 2, cy2, COL.warn, 14);
    label(ctx, 'PWM 频率', xs[2] + cw / 2, cy2 + 20, COL.dim, 11);
    label(ctx, duty.toFixed(0) + ' %', xs[3] + cw / 2, cy2, COL.warn, 14);
    label(ctx, '占空比 = CCR/ARR', xs[3] + cw / 2, cy2 + 20, COL.dim, 11);
    arrow(ctx, xs[0] + cw + 2, cy2 + 6, xs[1] - 4, cy2 + 6, COL.dim, 1.8, 6);
    arrow(ctx, xs[1] + cw + 2, cy2 + 6, xs[2] - 4, cy2 + 6, COL.dim, 1.8, 6);

    /* 波形区 */
    const WX0 = 150, WX1 = w - 60, WTop = 196, WBot = 300;   // 左侧留白给 ARR/CCR 标签
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(WX0 - 14, WBot + 8); ctx.lineTo(WX1 + 4, WBot + 8); ctx.stroke();
    // ARR 线
    ctx.setLineDash([3, 3]); ctx.strokeStyle = COL.dim;
    ctx.beginPath(); ctx.moveTo(WX0 - 14, WTop); ctx.lineTo(WX1 + 4, WTop); ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, 'ARR=' + arr, WX0 - 10, WTop - 7, COL.a, 10.5, 'right');
    // 三角波 CNT
    ctx.beginPath();
    for (let i = 0; i <= 400; i++) {
      const p = i / 400, cnt = arr * (1 - Math.abs(2 * p - 1));
      const y = WBot - (cnt / arr) * (WBot - WTop);
      i ? ctx.lineTo(WX0 + p * (WX1 - WX0), y) : ctx.moveTo(WX0 + p * (WX1 - WX0), y);
    }
    ctx.strokeStyle = COL.white; ctx.lineWidth = 2; ctx.stroke();
    label(ctx, 'CNT', WX1 + 8, (WTop + WBot) / 2, COL.white, 11, 'left');
    // CCR 线
    const yccr = WBot - (ccr / arr) * (WBot - WTop);
    ctx.setLineDash([5, 4]); ctx.strokeStyle = COL.b;
    ctx.beginPath(); ctx.moveTo(WX0 - 14, yccr); ctx.lineTo(WX1 + 4, yccr); ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, 'CCR=' + ccr, WX0 - 10, yccr - 7, COL.b, 10.5, 'right');
    // PWM 输出
    const PY0 = 322, PY1 = 356;
    ctx.strokeStyle = COL.grid;
    ctx.beginPath(); ctx.moveTo(WX0 - 14, PY1); ctx.lineTo(WX1 + 4, PY1); ctx.stroke();
    ctx.beginPath();
    let prev = null;
    for (let i = 0; i <= 400; i++) {
      const p = i / 400, cnt = arr * (1 - Math.abs(2 * p - 1));
      const y = (cnt < ccr) ? PY0 : PY1;
      const x = WX0 + p * (WX1 - WX0);
      if (prev === null) ctx.moveTo(x, y);
      else if (prev !== y) { ctx.lineTo(x, prev); ctx.lineTo(x, y); }
      else ctx.lineTo(x, y);
      prev = y;
    }
    ctx.strokeStyle = COL.a; ctx.lineWidth = 2.2; ctx.stroke();
    label(ctx, 'CH1 输出', WX0 - 10, (PY0 + PY1) / 2, COL.a, 10.5, 'right');
    label(ctx, 'CNT < CCR → 输出有效电平', WX1, PY0 - 12, COL.dim, 10.5, 'right');

    /* 公式与提示 */
    label(ctx, 'f_PWM = f_CK_CNT / [ 2 × (ARR+1) ]     占空比 = CCR / (ARR+1)',
          w / 2, 380, COL.white, 13);
    const tip = okHz
      ? '✔ 当前正是项目设定：PSC=0、ARR=4249 → 20.00 kHz'
      : '⚠ PWM 频率已偏离 20 kHz —— FOC 里 ARR/PSC 一旦定下来就别再动，改占空比只改 CCR';
    label(ctx, tip, w / 2, 402, okHz ? COL.accent : COL.warn, 11.5);

    if (ro) {
      ro.textContent = `PSC=${psc} → f_CK_CNT=${(fck / 1e6).toFixed(2)} MHz | ARR=${arr} → f_PWM=${(fpwm / 1000).toFixed(3)} kHz | 周期=${(1e6 / fpwm).toFixed(2)} µs | CCR=${ccr} → 占空比 ${duty}%`;
    }
  }
  requestAnimationFrame(function loop() { draw(); requestAnimationFrame(loop); });
})();

/* ============================================================
   图 8-3：三相桥 + 时间轴 MOS 管开关状态
   —— 上管下管怎么控制 / 为什么 CNT=ARR 时上管全关
   ============================================================ */
(function bridgeMOS() {
  const c = setupCanvas('cv-bridge-mos');
  if (!c) return;
  const { ctx, w, h } = c;

  const ARR = 4249, TPWM = 50;
  const PH = [
    { name: 'U', d: 0.72, col: COL.a },
    { name: 'V', d: 0.50, col: COL.b },
    { name: 'W', d: 0.28, col: COL.c }
  ];
  let phi = 0.5, playing = true;
  const playBtn = document.getElementById('btn-bm-play');
  const tSlider = document.getElementById('bm-time');
  const ro = document.getElementById('bm-readout');
  if (playBtn) playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? '⏸ 暂停' : '▶ 播放';
    playBtn.classList.toggle('active', playing);
  });
  if (tSlider) tSlider.addEventListener('input', () => { phi = +tSlider.value / 1000; });

  const cntOf = p => ARR * (1 - Math.abs(2 * p - 1));
  /* 某相状态: 2=上管ON 0=下管ON (为简洁此处不画死区) */
  const stateOf = (d, p) => (cntOf(p) < Math.round(d * ARR) ? 2 : 0);

  const X0 = 96, X1 = w - 40;
  const rowY = [250, 304, 358];       // U / V / W 时间轴行
  const rowH = 26;

  function rrect(x, y, ww, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + ww - r, y); ctx.quadraticCurveTo(x + ww, y, x + ww, y + r);
    ctx.lineTo(x + ww, y + hh - r); ctx.quadraticCurveTo(x + ww, y + hh, x + ww - r, y + hh);
    ctx.lineTo(x + r, y + hh); ctx.quadraticCurveTo(x, y + hh, x, y + hh - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* 画一个 MOSFET 符号（简化矩形 + 沟道线），on 时高亮 */
  function mos(x, y, on, col) {
    ctx.save();
    ctx.fillStyle = on ? col : COL.boxFill;
    ctx.strokeStyle = on ? col : COL.dim;
    ctx.lineWidth = on ? 2.4 : 1.4;
    rrect(x - 17, y, 34, 32, 5); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (on) {
      ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = col;
      rrect(x - 22, y - 5, 44, 42, 7); ctx.fill(); ctx.restore();
    }
    ctx.strokeStyle = on ? COL.white : COL.dim; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x + 10, y + 8); ctx.lineTo(x + 10, y + 24); ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const cnt = cntOf(phi);

    /* ================= 上半部分：三相桥 ================= */
    const busY = 44, gndY = 176;
    const armX = [250, 430, 610];
    const midY = 110;

    ctx.strokeStyle = COL.white; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(150, busY); ctx.lineTo(700, busY); ctx.stroke();
    label(ctx, 'V+ 母线', 140, busY, COL.warn, 11.5, 'right');
    ctx.beginPath(); ctx.moveTo(150, gndY); ctx.lineTo(700, gndY); ctx.stroke();
    label(ctx, 'V−（分流电阻）', 140, gndY, COL.dim, 11.5, 'right');

    const st = PH.map(ph => stateOf(ph.d, phi));

    PH.forEach((ph, i) => {
      const x = armX[i];
      // 上管 / 下管
      ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, busY); ctx.lineTo(x, 60); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, 128); ctx.lineTo(x, gndY); ctx.stroke();
      mos(x, 60, st[i] === 2, ph.col);
      mos(x, 128, st[i] === 0, ph.col);
      label(ctx, ph.name + '+', x + 30, 76, st[i] === 2 ? ph.col : COL.dim, 11.5, 'left');
      label(ctx, ph.name + '−', x + 30, 144, st[i] === 0 ? ph.col : COL.dim, 11.5, 'left');
      // 中点 → 电机
      ctx.strokeStyle = st[i] === 2 ? ph.col : COL.dim; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 110); ctx.lineTo(740, midY); ctx.stroke();
      // 电流方向箭头：上管通=流入电机, 下管通=流出
      if (st[i] === 2) arrow(ctx, x + 4, 92, x + 4, 108, ph.col, 2, 6);
      if (st[i] === 0) arrow(ctx, x - 4, 112, x - 4, 126, ph.col, 2, 6);
    });
    // 电机
    ctx.fillStyle = COL.boxFill; ctx.strokeStyle = COL.white; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(770, midY, 26, 0, TAU); ctx.fill(); ctx.stroke();
    label(ctx, 'M', 770, midY, COL.white, 15);
    ctx.strokeStyle = COL.dim; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(740, midY); ctx.lineTo(744, midY); ctx.stroke();

    label(ctx, '三相逆变桥（当前时刻导通情况）', 150, 22, COL.white, 12.5, 'left');

    /* ================= 下半部分：时间轴状态 ================= */
    const winHalf = (ARR - Math.round(Math.max(PH[0].d, PH[1].d, PH[2].d) * ARR)) / (2 * ARR);
    ctx.save(); ctx.fillStyle = COL.accent; ctx.globalAlpha = 0.12;
    ctx.fillRect(xOf(0.5 - winHalf), rowY[0] - 16, (xOf(winHalf) - xOf(0)) * 2, rowY[2] + rowH + 12 - (rowY[0] - 16));
    ctx.restore();
    ctx.setLineDash([4, 4]); ctx.strokeStyle = COL.accent; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(xOf(0.5), rowY[0] - 16); ctx.lineTo(xOf(0.5), rowY[2] + rowH + 6); ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, '采样窗口', xOf(0.5), rowY[0] - 22, COL.accent, 11.5);

    PH.forEach((ph, i) => {
      const y = rowY[i];
      label(ctx, ph.name + ' 相', X0 - 18, y + rowH / 2, ph.col, 12, 'right');
      const seg = 700;
      for (let k = 0; k < seg; k++) {
        const p0 = k / seg, p1 = (k + 1) / seg, s = stateOf(ph.d, p0);
        ctx.save(); ctx.fillStyle = s === 2 ? ph.col : COL.grid;
        ctx.fillRect(xOf(p0) - 0.6, y, xOf(p1) - xOf(p0) + 1.2, rowH);
        ctx.restore();
      }
      ctx.strokeStyle = COL.dim; ctx.lineWidth = 1;
      ctx.strokeRect(xOf(0), y, xOf(1) - xOf(0), rowH);
      label(ctx, '上管ON', xOf(0.10), y + rowH / 2, COL.white, 10.5);
      label(ctx, '下管ON', xOf(0.5), y + rowH / 2, COL.white, 10.5);
      label(ctx, '上管ON', xOf(0.90), y + rowH / 2, COL.white, 10.5);
      label(ctx, '占空比 ' + (ph.d * 100).toFixed(0) + '%', X1 - 6, y + rowH / 2, ph.col, 10.5, 'right');
    });

    /* 时间轴 */
    const axY = rowY[2] + rowH + 26;
    ctx.strokeStyle = COL.grid; ctx.beginPath(); ctx.moveTo(X0, axY); ctx.lineTo(X1, axY); ctx.stroke();
    for (let k = 0; k <= 4; k++) {
      const x = X0 + (X1 - X0) * k / 4;
      ctx.beginPath(); ctx.moveTo(x, axY); ctx.lineTo(x, axY + 5); ctx.stroke();
      label(ctx, (k * TPWM / 4).toFixed(1) + ' µs', x, axY + 16, COL.dim, 10.5);
    }
    label(ctx, 'CNT = ARR（三角波顶点）', xOf(0.5), axY + 16, COL.accent, 10.5);

    /* 游标 */
    const xc = X0 + (X1 - X0) * phi;
    ctx.strokeStyle = COL.white; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(xc, rowY[0] - 16); ctx.lineTo(xc, axY); ctx.stroke();
    ctx.globalAlpha = 1;

    /* 说明 */
    const allLow = st.every(s => s === 0);
    label(ctx, allLow
            ? '三相上管全部关断、下管全部导通 → 此刻分流电阻上的电流就是相电流（采样点）'
            : '各相上管按自己的 CCR 依次关断；只有 CNT 接近 ARR 时三相才同时为下管导通',
          150, 204, allLow ? COL.accent : COL.dim, 11.5, 'left');

    if (ro) {
      const on = [];
      PH.forEach((ph, i) => on.push(ph.name + (st[i] === 2 ? '+（上管）' : '−（下管）')));
      ro.textContent = `t=${(phi * TPWM).toFixed(1)} µs | CNT=${Math.round(cnt)} | 导通：${on.join('  ')} | ${allLow ? '✔ 采样窗口' : ''}`;
    }
  }
  function xOf(p) { return X0 + p * (X1 - X0); }

  let last = null;
  function tick(ts) {
    if (last === null) last = ts;
    const dt = (ts - last) / 1000; last = ts;
    if (playing) {
      phi += dt / 5;
      if (phi > 1) phi -= 1;
      if (tSlider) tSlider.value = Math.round(phi * 1000);
    }
    draw();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
