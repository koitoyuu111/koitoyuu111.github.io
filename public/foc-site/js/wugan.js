/* ============================================================
   第 10 章 · 无感控制 —— 三个交互动画
   依赖 main.js 的全局：COL（共享调色板）、setupCanvas()、makePlayer()；
   主题重绘：本文件**不**监听 'canvas-theme-change'（COL 是同一对象，被原地 mutate），
   而是靠 makeViz() + loop() 里 `if (viz.visible) viz.draw()` 的常驻 tick 每帧重绘 ——
   只要画布在视口内就自动跟上新配色，暂停态也一样。
   参数口径：除特别注明外，按本章手册的口径
   （ψf = 0.005 Wb, p = 14, R_s = 1.0 Ω, L_s = 0.5 mH，24 V 母线，10 kHz PWM）。
   ============================================================ */
(function () {
  'use strict';

  const TAU2 = Math.PI * 2;
  const P = (typeof COL !== 'undefined') ? COL : {
    a: '#e74c3c', b: '#2ecc71', c: '#3498db', white: '#f5f5f5', dim: '#8b98ad',
    grid: '#2a3446', accent: '#4dd0a6', warn: '#f39c12', good: '#2ecc71',
    faint: 'rgba(255,255,255,.15)', fb: '#7a879a'
  };
  const $id = (id) => document.getElementById(id);

  function makeViz(cvId) {
    let s = null;
    if (typeof setupCanvas === 'function') s = setupCanvas(cvId);
    else { const cv = $id(cvId); if (cv) s = { cv, ctx: cv.getContext('2d'), w: cv.width, h: cv.height }; }
    if (!s) return null;
    const viz = { s, visible: true, draw: function () {} };
    if (typeof IntersectionObserver !== 'undefined') {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { viz.visible = e.isIntersecting; });
      }, { rootMargin: '120px' }).observe(s.cv);
    }
    return viz;
  }
  function loop(viz) {
    if (!viz) return;
    (function tick() { if (viz.visible) viz.draw(); requestAnimationFrame(tick); })();
  }
  function txt(ctx, str, x, y, color, size, align, weight) {
    ctx.fillStyle = color;
    ctx.font = (weight ? weight + ' ' : '') + (size || 12) + 'px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const rpm2we = (n, p) => n / 60 * TAU2 * p;      // rpm(机械) → 电角速度 rad/s

  /* ============================================================
     图 10-1：观测器/PLL 的收敛过程（真实角 vs 估计角）
     ============================================================ */
  (function obsConv() {
    const viz = makeViz('cv-obs-conv');
    if (!viz) return;
    const nSl = $id('oc-n'), bwSl = $id('oc-bw'), errSl = $id('oc-err');
    const ro = $id('oc-readout'), btnReset = $id('oc-reset');
    const player = (typeof makePlayer === 'function') ? makePlayer('btn-oc-play') : { playing: false };
    const W = viz.s.w, H = viz.s.h;

    // 慢放系数：ωn=150 Hz 时收敛只要几毫秒，原速播放肉眼看不见
    const SLOW = 0.01;
    let th = 0, thHat = 0, wHat = 0, dth = 0, hist = [], tPrev = 0, tSettle = -1, tRun = 0;

    function reset() {
      th = 0; thHat = -(+errSl.value) * D2R;
      wHat = rpm2we(+nSl.value, 14);   // 频率已同步，只演示"相位收敛"
      hist = []; tSettle = -1; tRun = 0;
    }
    reset();
    if (btnReset) btnReset.addEventListener('click', reset);

    viz.draw = function () {
      const now = performance.now();
      const dt = Math.min(0.02, (now - tPrev) / 1000 || 0.016); tPrev = now;
      const n = +nSl.value, we = rpm2we(n, 14);
      const wnRad = TAU2 * (+bwSl.value);                     // 环路自然频率 rad/s
      const zeta = 0.707, Kp = 2 * zeta * wnRad, Ki = wnRad * wnRad;

      if (player.playing) {
        // 固定步长积分（rAF 帧率 16 ms 对 ωn=942 rad/s 会数值发散）
        const dts = dt * SLOW, H = 1e-4;
        const steps = Math.min(300, Math.max(1, Math.ceil(dts / H)));
        const h = dts / steps;
        for (let k = 0; k < steps; k++) {
          th += we * h;
          const eps = Math.sin(th - thHat);
          wHat += h * (Ki * eps);                 // ω̂ = Kp·ε + Ki∫ε
          thHat += h * (wHat + Kp * eps);         // θ̂ = ∫ω̂
        }
        dth = ((th - thHat + Math.PI) % TAU2 + TAU2) % TAU2 - Math.PI;
        tRun += dts;
        if (tSettle < 0 && Math.abs(dth) < 0.0873) tSettle = tRun;   // 收敛到 5°
        hist.push(dth * R2D);
        if (hist.length > 900) hist.shift();
      }

      const ctx = viz.s.ctx;
      ctx.clearRect(0, 0, W, H);

      /* ---- 左：矢量盘 ---- */
      const cx = 118, cy = H / 2, R = 88;
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - R - 14, cy); ctx.lineTo(cx + R + 14, cy);
      ctx.moveTo(cx, cy - R - 14); ctx.lineTo(cx, cy + R + 14); ctx.stroke();
      txt(ctx, 'α', cx + R + 18, cy, P.dim, 11, 'left');
      const arrow = (ang, len, col, wdt) => {
        ctx.strokeStyle = col; ctx.lineWidth = wdt || 2.6;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(-ang) * len, cy + Math.sin(-ang) * len); ctx.stroke();
      };
      arrow(th, R, P.white, 3);                    // 真实转子位置
      arrow(thHat, R, P.accent, 3);                // 估计位置
      // Δθ 圆弧
      ctx.strokeStyle = P.warn; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.62, Math.min(-th, -thHat), Math.max(-th, -thHat)); ctx.stroke();
      txt(ctx, 'Δθ=' + (dth * R2D).toFixed(1) + '°', cx, cy + R + 26, P.warn, 12.5, 'center', '600');
      txt(ctx, '白=真实 θ', cx, cy - R - 26, P.white, 11, 'center');
      txt(ctx, '青=估计 θ̂', cx, cy - R - 11, P.accent, 11, 'center');

      /* ---- 右：Δθ(t) 时间轨迹 ---- */
      const gx0 = 250, gy0 = 34, gw = W - 250 - 22, gh = H - 34 - 62;
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(gx0, gy0, gw, gh); ctx.stroke();
      const DMAX = 90;
      [-60, -30, 0, 30, 60].forEach(function (v) {
        const y = gy0 + gh / 2 - v / DMAX * (gh / 2);
        ctx.strokeStyle = v === 0 ? P.dim : P.grid;
        ctx.beginPath(); ctx.moveTo(gx0, y); ctx.lineTo(gx0 + gw, y); ctx.stroke();
        txt(ctx, v + '°', gx0 - 6, y, P.dim, 10.5, 'right');
      });
      // ±5° 收敛带
      ctx.fillStyle = 'rgba(46,204,113,.12)';
      const b1 = gy0 + gh / 2 - 5 / DMAX * (gh / 2), b2 = gy0 + gh / 2 + 5 / DMAX * (gh / 2);
      ctx.fillRect(gx0, b1, gw, b2 - b1);
      txt(ctx, '±5°（判定收敛）', gx0 + gw - 4, b1 - 8, P.good, 10.5, 'right');
      // 轨迹
      ctx.strokeStyle = P.accent; ctx.lineWidth = 2.2; ctx.beginPath();
      for (let i = 0; i < hist.length; i++) {
        const x = gx0 + i / 899 * gw;
        const y = gy0 + gh / 2 - Math.max(-DMAX, Math.min(DMAX, hist[i])) / DMAX * (gh / 2);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      const last = hist.length ? hist[hist.length - 1] : 0;
      if (hist.length) {
        const y = gy0 + gh / 2 - Math.max(-DMAX, Math.min(DMAX, last)) / DMAX * (gh / 2);
        ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(gx0 + hist.length / 899 * gw, y, 4, 0, 7); ctx.fill();
      }
      txt(ctx, 'Δθ 时间轨迹（°）', gx0 + 6, gy0 - 12, P.dim, 11.5, 'left');
      txt(ctx, 'ωn=' + (+bwSl.value).toFixed(0) + ' Hz  ζ=0.707  ' +
               (tSettle >= 0 ? '收敛用时 ' + (tSettle * 1000).toFixed(0) + ' ms' : '尚未收敛'),
          gx0 + 6, gy0 + gh + 16, tSettle >= 0 ? P.good : P.warn, 11.5, 'left');

      ro.textContent = 'n=' + n + 'rpm（ωe=' + we.toFixed(0) + 'rad/s）  初始误差 ' + (+errSl.value).toFixed(0) +
        '°  ωn=' + (+bwSl.value).toFixed(0) + 'Hz  当前 Δθ=' + (dth * R2D).toFixed(2) + '°  ' +
        (tSettle >= 0 ? '已收敛(' + (tSettle * 1000).toFixed(1) + 'ms)' : '收敛中') +
        '   [时间轴慢放 100×]   → 带宽越高收敛越快，但抗噪声越差';
    };
    [nSl, bwSl, errSl].forEach(function (el) { if (el) el.addEventListener('input', reset); });
    loop(viz);
  })();

  /* ============================================================
     图 10-2：PLL 归一化的意义 —— 不归一化时带宽随转速漂
     ============================================================ */
  (function pllGain() {
    const viz = makeViz('cv-pll-gain');
    if (!viz) return;
    const normChk = $id('pg-norm'), bwSl = $id('pg-bw'), ro = $id('pg-readout');
    const player = (typeof makePlayer === 'function') ? makePlayer('btn-pg-play') : { playing: false };
    const W = viz.s.w, H = viz.s.h;

    const PSI = 0.005, P_POLES = 14;
    const SPEEDS = [150, 1000, 3000];                 // rpm
    const COLS = [P.dim, P.accent, P.warn];
    const SLOW = 0.01;                                // 慢放 100×
    let sims = null, tPrev = 0;

    function init() {
      const wn0 = TAU2 * (+bwSl.value);
      const norm = normChk ? normChk.checked : true;
      const E0 = rpm2we(1000, P_POLES) * PSI;
      sims = SPEEDS.map(function (n) {
        const E = rpm2we(n, P_POLES) * PSI;           // 反电动势幅值
        // 不归一化：环路增益 ∝ E（以 1000 rpm 为基准整定）
        const k = norm ? 1 : (E / E0);
        return { n: n, E: E, k: k, th: 0, thHat: -60 * D2R,
                 wHat: rpm2we(n, P_POLES),      // 频率已同步，只比"相位收敛"
                 hist: [], wn: wn0 * Math.sqrt(k), zeta: 0.707 * Math.sqrt(k) };
      });
    }
    init();
    if (normChk) normChk.addEventListener('change', init);
    if (bwSl) bwSl.addEventListener('input', init);

    viz.draw = function () {
      const now = performance.now();
      const dt = Math.min(0.02, (now - tPrev) / 1000 || 0.016); tPrev = now;
      if (!sims) init();
      if (player.playing) {
        const dts = dt * SLOW, H = 1e-4;
        const steps = Math.min(300, Math.max(1, Math.ceil(dts / H)));
        const h = dts / steps;
        sims.forEach(function (s) {
          const we = rpm2we(s.n, P_POLES);
          const Kp = 2 * s.zeta * s.wn, Ki = s.wn * s.wn;
          for (let k = 0; k < steps; k++) {
            s.th += we * h;
            const eps = Math.sin(s.th - s.thHat);
            s.wHat += h * (Ki * eps);
            s.thHat += h * (s.wHat + Kp * eps);
          }
          const d = ((s.th - s.thHat + Math.PI) % TAU2 + TAU2) % TAU2 - Math.PI;
          s.hist.push(d * R2D);
          if (s.hist.length > 900) s.hist.shift();
        });
      }

      const ctx = viz.s.ctx;
      ctx.clearRect(0, 0, W, H);
      const gx0 = 96, gy0 = 40, gw = W - 96 - 30, gh = H - 40 - 74;
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(gx0, gy0, gw, gh); ctx.stroke();
      const DMAX = 60;
      [-45, -30, -15, 0, 15, 30, 45].forEach(function (v) {
        const y = gy0 + gh / 2 - v / DMAX * (gh / 2);
        ctx.strokeStyle = v === 0 ? P.dim : P.grid;
        ctx.beginPath(); ctx.moveTo(gx0, y); ctx.lineTo(gx0 + gw, y); ctx.stroke();
        if (v % 15 === 0) txt(ctx, v + '°', gx0 - 7, y, P.dim, 10.5, 'right');
      });
      ctx.fillStyle = 'rgba(46,204,113,.12)';
      const b1 = gy0 + gh / 2 - 3 / DMAX * (gh / 2), b2 = gy0 + gh / 2 + 3 / DMAX * (gh / 2);
      ctx.fillRect(gx0, b1, gw, b2 - b1);

      sims.forEach(function (s, i) {
        ctx.strokeStyle = COLS[i]; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let j = 0; j < s.hist.length; j++) {
          const x = gx0 + j / 899 * gw;
          const y = gy0 + gh / 2 - Math.max(-DMAX, Math.min(DMAX, s.hist[j])) / DMAX * (gh / 2);
          j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      });
      /* 图例 */
      let lx = gx0 + 10, ly = gy0 - 24;
      sims.forEach(function (s, i) {
        ctx.fillStyle = COLS[i]; ctx.fillRect(lx, ly - 4, 14, 4);
        txt(ctx, s.n + ' rpm（ωn=' + s.wn.toFixed(0) + ', ζ=' + s.zeta.toFixed(2) + '）',
            lx + 19, ly, P.dim, 11, 'left');
        lx += 210;
      });
      txt(ctx, normChk.checked ? '✔ 已归一化：三条曲线重合 → 带宽与转速无关'
                              : '✘ 未归一化：环路增益 ∝ E = ωe·ψf → 低速迟钝、高速振荡',
          gx0 + 4, gy0 + gh + 18, normChk.checked ? P.good : P.a, 12, 'left', '600');
      txt(ctx, '基准整定：ωn = ' + (+bwSl.value).toFixed(0) + ' Hz @1000 rpm', gx0 + 4, gy0 + gh + 38, P.dim, 11, 'left');

      ro.textContent = (normChk.checked ? '归一化 ON' : '归一化 OFF') +
        '  基准 ωn=' + (+bwSl.value).toFixed(0) + 'Hz  ' +
        sims.map(function (s) { return s.n + 'rpm:ωn=' + s.wn.toFixed(0) + '/ζ=' + s.zeta.toFixed(2); }).join('  ');
    };
    loop(viz);
  })();

  /* ============================================================
     图 10-3：低速为什么失效 —— Δθ = ΔV / E，E ∝ 转速
     对比"手册参数"与"4310 实测参数"两套口径
     ============================================================ */
  (function lowSpeed() {
    const viz = makeViz('cv-low-speed');
    if (!viz) return;
    const nSl = $id('ls-n'), tdSl = $id('ls-td'), fSl = $id('ls-f'), ro = $id('ls-readout');
    const W = viz.s.w, H = viz.s.h;

    const SETS = [
      { name: '旧占位参数 ψf=5.0mWb, Rs=1.0Ω', psi: 0.005, Rs: 1.0, col: P.c,
        rsErr: 0.20 * 1.0 },                       // ΔRs·i = 0.2 V
      { name: '4310 规格书 ψf=10.3mWb, Rs=5.35Ω', psi: 0.01032, Rs: 5.35, col: P.warn,
        rsErr: 0.20 * 5.35 }                       // ΔRs·i = 1.07 V
    ];
    const DEV = 0.7;                                // 器件压降（MOSFET/二极管）
    const NMIN = 5, NMAX = 3000;
    const X = (n) => { const t = (Math.log10(n) - Math.log10(NMIN)) / (Math.log10(NMAX) - Math.log10(NMIN));
                       return t; };

    function dth(set, n, td, f, compRs) {
      const we = rpm2we(n, 14);
      const E = we * set.psi;                       // 相反电动势峰值
      if (E <= 1e-9) return Infinity;
      const dV = td * 1e-6 * f * 24 + DEV + (compRs ? 0 : set.rsErr);
      return Math.min(180, dV / E * R2D);
    }

    viz.draw = function () {
      // 滑杆给的是 0~100 的对数刻度索引 → 映射到 5~3000 rpm
      const nRaw = Math.pow(10, Math.log10(NMIN) +
                            (+nSl.value) / 100 * (Math.log10(NMAX) - Math.log10(NMIN)));
      const n = Math.max(NMIN, Math.round(nRaw));
      const td = +tdSl.value, f = +fSl.value;
      const ctx = viz.s.ctx;
      ctx.clearRect(0, 0, W, H);
      const gx0 = 62, gy0 = 40, gw = W - 62 - 150, gh = H - 40 - 76;
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(gx0, gy0, gw, gh); ctx.stroke();
      const Y = (d) => gy0 + gh - Math.min(d, 180) / 180 * gh;

      /* 失效区（>90°） */
      ctx.fillStyle = 'rgba(231,76,60,.10)';
      ctx.fillRect(gx0, gy0, gw, Y(90) - gy0);
      [30, 60, 90, 120, 180].forEach(function (v) {
        ctx.strokeStyle = v === 90 ? P.a : P.grid;
        ctx.setLineDash(v === 90 ? [5, 4] : []);
        ctx.beginPath(); ctx.moveTo(gx0, Y(v)); ctx.lineTo(gx0 + gw, Y(v)); ctx.stroke();
        ctx.setLineDash([]);
        txt(ctx, v + '°', gx0 - 6, Y(v), v === 90 ? P.a : P.dim, 10.5, 'right');
      });
      txt(ctx, '> 90° = 观测器失效区', gx0 + gw - 4, Y(90) - 10, P.a, 11, 'right');
      /* 转速轴（对数） */
      [10, 30, 100, 300, 1000, 3000].forEach(function (nn) {
        const x = gx0 + X(nn) * gw;
        ctx.strokeStyle = P.grid;
        ctx.beginPath(); ctx.moveTo(x, gy0); ctx.lineTo(x, gy0 + gh); ctx.stroke();
        txt(ctx, nn, x, gy0 + gh + 13, P.dim, 10.5, 'center');
      });
      txt(ctx, '转速 n (rpm, 对数轴)', gx0 + gw / 2, gy0 + gh + 32, P.dim, 12, 'center');
      txt(ctx, 'Δθ 角度误差 (°)', gx0 - 50, gy0 - 14, P.dim, 12, 'left');

      /* 两条曲线 */
      SETS.forEach(function (set) {
        ctx.strokeStyle = set.col; ctx.lineWidth = 2.4; ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 300; i++) {
          const nn = Math.pow(10, Math.log10(NMIN) + (Math.log10(NMAX) - Math.log10(NMIN)) * i / 300);
          const d = dth(set, nn, td, f, false);
          const x = gx0 + i / 300 * gw, y = Y(d);
          started ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), started = true);
        }
        ctx.stroke();
      });
      /* 当前转速标记 */
      const xm = gx0 + X(n) * gw;
      ctx.strokeStyle = P.white; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(xm, gy0); ctx.lineTo(xm, gy0 + gh); ctx.stroke();
      ctx.setLineDash([]);
      SETS.forEach(function (set) {
        const d = dth(set, n, td, f, false);
        if (d <= 180) { ctx.fillStyle = set.col; ctx.beginPath(); ctx.arc(xm, Y(d), 5, 0, 7); ctx.fill(); }
      });
      /* 图例 */
      let ly = gy0 + 12;
      SETS.forEach(function (set) {
        ctx.fillStyle = set.col; ctx.fillRect(gx0 + 12, ly - 4, 14, 4);
        txt(ctx, set.name, gx0 + 31, ly, P.dim, 11.5, 'left');
        ly += 18;
      });

      const d1 = dth(SETS[0], n, td, f, false), d2 = dth(SETS[1], n, td, f, false);
      ro.textContent = 'n=' + n + 'rpm  t_dead=' + td.toFixed(1) + 'µs  PWM=' + (f / 1000).toFixed(0) +
        'kHz  死区误差=' + (td * 1e-6 * f * 24).toFixed(2) + 'V+器件0.7V  ' +
        'Δθ(旧占位)=' + d1.toFixed(1) + '°  Δθ(规格书)=' + d2.toFixed(1) + '°  ' +
        (d2 < 30 ? '低速仍可用' : d2 < 90 ? '⚠ 已劣化' : '✗ 失效');
    };
    [nSl, tdSl, fSl].forEach(function (el) { if (el) el.addEventListener('input', function () {}); });
    loop(viz);
  })();
})();
