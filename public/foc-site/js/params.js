/* ============================================================
   第 9 章 · 电机参数详解 —— 三个交互动画
   依赖 main.js 的全局：COL（共享调色板，随主题原地更新）、
   setupCanvas()、makePlayer()；主题切换听 document 上的
   'canvas-theme-change' 事件。
   例机参数集中在 MOTOR 里，换电机只改这一处。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 例机：4310 关节电机（本章全部算例都用它） ---------- */
  const MOTOR = {
    p: 14,          // 极对数
    Rs: 5.35,       // 相电阻 Ω（25°C）
    Ld: 5.32e-3,    // d 轴电感 H
    Lq: 5.32e-3,    // q 轴电感 H
    Kt: 0.217       // 扭矩常数 N·m/A（峰值口径；4310 规格书写 0.30 是有效值口径）
  };
  MOTOR.psi = MOTOR.Kt / (1.5 * MOTOR.p);   // 磁链 ψf = Kt/(1.5p) ≈ 10.3 mWb

  const RPM2RAD = Math.PI / 30;             // rpm → rad/s（机械）
  const U_CEIL = (udc) => udc / Math.sqrt(3); // SVPWM 线性区：相电压峰值上限

  /* id=0 稳态所需相电压峰值 |u| = √((ωe·Lq·iq)² + (Rs·iq + ωe·ψ)²) */
  function uRequired(we, iq) {
    return Math.hypot(MOTOR.Lq * iq * we, MOTOR.Rs * iq + MOTOR.psi * we);
  }
  /* id=0 时电压极限允许的最高电角速度（解一元二次）；iq=0 → U/ψ */
  function weMax(iq, udc) {
    const U = U_CEIL(udc);
    const a = MOTOR.Lq * MOTOR.Lq * iq * iq + MOTOR.psi * MOTOR.psi;
    const b = 2 * MOTOR.Rs * iq * MOTOR.psi;
    const c = MOTOR.Rs * MOTOR.Rs * iq * iq - U * U;
    const d = b * b - 4 * a * c;
    return d < 0 ? 0 : (-b + Math.sqrt(d)) / (2 * a);
  }
  const weToRpm = (we) => we / MOTOR.p * 30 / Math.PI;  // 电角速度→机械 rpm

  /* ---------- 基础设施 ---------- */
  const P = (typeof COL !== 'undefined') ? COL : {
    a: '#e74c3c', b: '#2ecc71', c: '#3498db', white: '#f5f5f5', dim: '#8b98ad',
    grid: '#2a3446', accent: '#4dd0a6', warn: '#f39c12', good: '#2ecc71',
    faint: 'rgba(255,255,255,.15)', fb: '#7a879a'
  };

  function makeViz(cvId) {
    let s = null;
    if (typeof setupCanvas === 'function') s = setupCanvas(cvId);
    else {
      const cv = document.getElementById(cvId);
      if (cv) s = { cv, ctx: cv.getContext('2d'), w: cv.width, h: cv.height };
    }
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
    ctx.font = (weight ? weight + ' ' : '') + (size || 12) +
               'px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }
  const $id = (id) => document.getElementById(id);

  /* ============================================================
     图 9-1：反电动势与电压预算
     上：三相反电动势波形 + 可用电压天花板
     下：所需电压 |u| 的构成条（BEMF + 阻抗压降） vs 上限
     ============================================================ */
  (function bemfViz() {
    const viz = makeViz('cv-bemf');
    if (!viz) return;
    const nSl = $id('bemf-n'), iqSl = $id('bemf-iq'), udcSl = $id('bemf-udc');
    const ro = $id('bemf-readout');
    const player = (typeof makePlayer === 'function') ? makePlayer('btn-bemf-play')
                                                       : { playing: false };
    let phase = 0, tPrev = 0;
    const W = viz.s.w, H = viz.s.h;

    viz.draw = function () {
      const now = performance.now();
      const dt = Math.min(0.05, (now - tPrev) / 1000 || 0.016); tPrev = now;
      if (player.playing) phase += dt * 2.4;          // 波形滚动（示意速度）

      const n = +nSl.value, iq = +iqSl.value, udc = +udcSl.value;
      const wm = n * RPM2RAD, we = wm * MOTOR.p;
      const Epk = we * MOTOR.psi;                      // 反电动势相峰值
      const U = U_CEIL(udc);                           // 可用相电压峰值上限
      const us = uRequired(we, iq);                    // 该状态所需 |u|
      const nMax = weToRpm(weMax(iq, udc));            // 此电流下最高转速
      const ok = us <= U;

      const ctx = viz.s.ctx;
      ctx.clearRect(0, 0, W, H);

      /* ---- 上半：波形 ---- */
      const wTop = 12, hTop = 178, midY = wTop + hTop / 2, halfH = hTop / 2 - 14;
      const k = (0.72 * halfH) / U;                    // 天花板固定在 72% 高度
      // 天花板
      ctx.strokeStyle = P.warn; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(46, midY - U * k); ctx.lineTo(W - 12, midY - U * k);
      ctx.moveTo(46, midY + U * k); ctx.lineTo(W - 12, midY + U * k); ctx.stroke();
      ctx.setLineDash([]);
      txt(ctx, '可用电压上限 Udc/√3 = ' + U.toFixed(1) + ' V（相峰值）', W - 16, midY - U * k - 11, P.warn, 12, 'right');
      // 零线
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(46, midY); ctx.lineTo(W - 12, midY); ctx.stroke();
      // 三相波形（裁剪在波形区内）
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, wTop + hTop + 4); ctx.clip();
      const cols = [P.a, P.b, P.c];
      for (let ph = 0; ph < 3; ph++) {
        ctx.strokeStyle = cols[ph]; ctx.lineWidth = 1.8; ctx.beginPath();
        for (let px = 46; px <= W - 12; px += 2) {
          const th = phase + (px - 46) / (W - 58) * Math.PI * 4;   // 2 个周期
          const e = Epk * Math.cos(th - ph * 2.0944);
          const y = midY - e * k;
          px === 46 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
        }
        ctx.stroke();
      }
      ctx.restore();
      txt(ctx, 'A', 38, midY - Math.min(Epk, U * 1.3) * k, P.a, 12, 'right');
      txt(ctx, 'B', 38, midY - Math.min(Epk, U * 1.3) * k * 0.35, P.b, 12, 'right');
      txt(ctx, 'C', 38, midY + Math.min(Epk, U * 1.3) * k * 0.35, P.c, 12, 'right');
      txt(ctx, 'n=' + n + ' rpm → e_pk = ωe·ψf = ' + Epk.toFixed(2) + ' V',
          50, wTop + hTop + 14, P.white, 12.5, 'left', '600');

      /* ---- 下半：电压预算条 ---- */
      const bx = 46, bw = W - 58 - 150, by = H - 64, bh = 26;
      const bScale = bw / (U * 1.38);                  // 天花板固定在条的 72% 处
      // 底槽
      ctx.fillStyle = P.faint; ctx.fillRect(bx, by, bw, bh);
      // BEMF 分量
      const wE = Math.min(Epk, us) * bScale;
      ctx.fillStyle = P.accent; ctx.fillRect(bx, by, wE, bh);
      // 阻抗压降分量（|u| − BEMF，展示用拆分）
      const wZ = Math.max(0, us - Epk) * bScale;
      ctx.fillStyle = P.warn; ctx.fillRect(bx + wE, by, Math.min(wZ, bx + bw - (bx + wE)), bh);
      // 超出天花板的部分（饱和）
      if (us > U) {
        const wOver = (us - U) * bScale;
        ctx.fillStyle = P.a;
        ctx.fillRect(bx + U * bScale, by, Math.min(wOver, bx + bw - bx - U * bScale), bh);
      }
      // 天花板刻线
      ctx.strokeStyle = P.warn; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx + U * bScale, by - 7); ctx.lineTo(bx + U * bScale, by + bh + 7); ctx.stroke();
      txt(ctx, '上限 ' + U.toFixed(1) + ' V', bx + U * bScale, by - 16, P.warn, 11.5, 'center');
      // 图例
      const ly = by + bh + 14;
      ctx.fillStyle = P.accent; ctx.fillRect(bx, ly - 4, 12, 8);
      txt(ctx, '反电动势 ωe·ψf=' + Epk.toFixed(1) + 'V', bx + 17, ly, P.dim, 11.5, 'left');
      ctx.fillStyle = P.warn; ctx.fillRect(bx + 200, ly - 4, 12, 8);
      txt(ctx, '电阻+电抗压降 ' + Math.max(0, us - Epk).toFixed(1) + 'V', bx + 217, ly, P.dim, 11.5, 'left');
      // 状态
      if (ok) {
        txt(ctx, '裕量 ' + (((U - us) / U) * 100).toFixed(0) + '%', W - 16, by + bh / 2, P.good, 15, 'right', '700');
      } else {
        txt(ctx, '⚠ 电压饱和', W - 16, by + bh / 2, P.a, 15, 'right', '700');
      }

      ro.textContent = 'n=' + n + 'rpm  iq=' + (+iq).toFixed(1) + 'A  |u|=' + us.toFixed(2) +
        'V / ' + U.toFixed(1) + 'V  ' + (ok ? '裕量' + (((U - us) / U) * 100).toFixed(0) + '%' : '饱和') +
        '  此电流下最高≈' + nMax.toFixed(0) + 'rpm';
    };
    document.addEventListener('canvas-theme-change', function () { /* COL 原地更新，下一帧自动生效 */ });
    loop(viz);
  })();

  /* ============================================================
     图 9-2：扭矩-转速曲线（恒转矩区 / 电压极限区 / 弱磁包络）
     ============================================================ */
  (function tnViz() {
    const viz = makeViz('cv-tn');
    if (!viz) return;
    const udcSl = $id('tn-udc'), imaxSl = $id('tn-imax'), fwChk = $id('tn-fw');
    const ro = $id('tn-readout');
    const player = (typeof makePlayer === 'function') ? makePlayer('btn-tn-play')
                                                       : { playing: false };
    const W = viz.s.w, H = viz.s.h;
    const NMAX = 1500;                       // 横轴：rpm
    let cache = null, cursor = 0, tPrev = 0;

    function compute() {
      const udc = +udcSl.value, imax = +imaxSl.value, fw = fwChk.checked;
      const U = U_CEIL(udc), N = 240;
      const pts = [], ptsFW = [];
      let nBase = NMAX, pBest = 0, pBestN = 0;
      for (let i = 0; i <= N; i++) {
        const n = i / N * NMAX, wm = n * RPM2RAD, we = wm * MOTOR.p;
        /* id=0：解 max iq */
        const A0 = we * we * MOTOR.Lq * MOTOR.Lq + MOTOR.Rs * MOTOR.Rs;
        const B0 = 2 * MOTOR.Rs * we * MOTOR.psi;
        const C0 = we * we * MOTOR.psi * MOTOR.psi - U * U;
        let iq0;
        if (C0 > 0) {
          iq0 = 0;                       // 已越过空载极限转速：任何电流都跑不动
        } else {
          const D0 = B0 * B0 - 4 * A0 * C0;          // C0≤0 ⇒ D0>0
          const root = (-B0 + Math.sqrt(D0)) / (2 * A0);
          iq0 = Math.min(imax, Math.max(0, root));
          if (root < imax && nBase === NMAX) nBase = n;   // 电压开始限制的点 = 基速
        }
        const T0 = MOTOR.Kt * iq0;
        pts.push([n, T0]);
        if (T0 * wm > pBest && n > 0) { pBest = T0 * wm; pBestN = n; }
        /* 弱磁：在 id≤0 里采样，电流圆内最大化扭矩 */
        if (fw) {
          let best = T0;
          for (let k = 1; k <= 22; k++) {
            const id = -imax * k / 22;
            const psiD = MOTOR.psi + MOTOR.Ld * id;
            if (psiD < 0.15 * MOTOR.psi) continue;
            const circle = Math.sqrt(Math.max(0, imax * imax - id * id));
            const A = we * we * MOTOR.Lq * MOTOR.Lq + MOTOR.Rs * MOTOR.Rs;
            const B = 2 * MOTOR.Rs * we * (psiD - MOTOR.Lq * id);
            const C = MOTOR.Rs * MOTOR.Rs * id * id + we * we * psiD * psiD - U * U;
            let iq = circle;
            if (C > 0) {
              const D = B * B - 4 * A * C;
              if (D <= 0) continue;
              iq = Math.min(circle, Math.max(0, (-B + Math.sqrt(D)) / (2 * A)));
            }
            const T = MOTOR.Kt * iq + 1.5 * MOTOR.p * (MOTOR.Ld - MOTOR.Lq) * id * iq;
            if (T > best) best = T;
          }
          ptsFW.push([n, best]);
        }
      }
      cache = { udc, imax, fw, pts, ptsFW, nBase, pBest, pBestN,
                Tmax: MOTOR.Kt * imax };
    }

    viz.draw = function () {
      const now = performance.now();
      const dt = Math.min(0.05, (now - tPrev) / 1000 || 0.016); tPrev = now;
      if (!cache || cache.udc !== +udcSl.value || cache.imax !== +imaxSl.value ||
          cache.fw !== fwChk.checked) compute();
      if (player.playing) { cursor += dt * 90; if (cursor > NMAX) cursor = 0; }

      const ctx = viz.s.ctx;
      ctx.clearRect(0, 0, W, H);
      const x0 = 56, y0 = 16, w = W - 56 - 20, h = H - 66 - y0;
      const Taxis = cache.Tmax * 1.18;
      const X = (n) => x0 + n / NMAX * w;
      const Y = (T) => y0 + h - T / Taxis * h;

      /* 网格与坐标 */
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1; ctx.fillStyle = P.dim;
      for (let n = 0; n <= NMAX; n += 250) {
        const x = X(n);
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + h); ctx.stroke();
        txt(ctx, n, x, y0 + h + 12, P.dim, 11, 'center');
      }
      for (let k = 0; k <= 4; k++) {
        const T = Taxis * k / 4, y = Y(T);
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
        txt(ctx, T.toFixed(2), x0 - 7, y, P.dim, 11, 'right');
      }
      txt(ctx, '转速 n (rpm)', x0 + w / 2, H - 22, P.dim, 12, 'center');
      txt(ctx, 'T (N·m)', x0 - 40, y0 + 2, P.dim, 12, 'left');

      /* 基速虚线 */
      if (cache.nBase < NMAX) {
        ctx.strokeStyle = P.faint; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(X(cache.nBase), y0); ctx.lineTo(X(cache.nBase), y0 + h); ctx.stroke();
        ctx.setLineDash([]);
        txt(ctx, '基速≈' + cache.nBase.toFixed(0), X(cache.nBase) + 4, y0 + 9, P.dim, 11, 'left');
      }

      /* id=0 包络 */
      ctx.strokeStyle = P.accent; ctx.lineWidth = 2.4; ctx.beginPath();
      cache.pts.forEach(function (pt, i) { i ? ctx.lineTo(X(pt[0]), Y(pt[1])) : ctx.moveTo(X(pt[0]), Y(pt[1])); });
      ctx.stroke();
      /* 弱磁包络 */
      if (cache.fw && cache.ptsFW.length) {
        ctx.strokeStyle = P.warn; ctx.lineWidth = 2; ctx.setLineDash([7, 4]); ctx.beginPath();
        cache.ptsFW.forEach(function (pt, i) { i ? ctx.lineTo(X(pt[0]), Y(pt[1])) : ctx.moveTo(X(pt[0]), Y(pt[1])); });
        ctx.stroke(); ctx.setLineDash([]);
      }
      /* 图例 */
      ctx.fillStyle = P.accent; ctx.fillRect(x0 + 8, y0 + 6, 14, 4);
      txt(ctx, 'id=0（MTPA，本机 Ld=Lq）', x0 + 27, y0 + 8, P.dim, 11.5, 'left');
      if (cache.fw) {
        ctx.fillStyle = P.warn; ctx.fillRect(x0 + 8, y0 + 24, 14, 4);
        txt(ctx, '弱磁包络（id<0 换转速）', x0 + 27, y0 + 26, P.dim, 11.5, 'left');
      }
      /* 峰值功率点 */
      if (cache.pBestN > 0) {
        const Tp = (cache.pts[Math.round(cache.pBestN / NMAX * 240)] || [0, 0])[1];
        ctx.fillStyle = P.good;
        ctx.beginPath(); ctx.arc(X(cache.pBestN), Y(Tp), 4, 0, 7); ctx.fill();
        txt(ctx, '峰值功率≈' + cache.pBest.toFixed(1) + 'W @' + cache.pBestN.toFixed(0) + 'rpm',
            X(cache.pBestN), Y(Tp) - 12, P.good, 11.5, cache.pBestN > NMAX * 0.7 ? 'right' : 'center');
      }
      /* 扫描光标 */
      const nc = cursor, wm = nc * RPM2RAD;
      let Tc = 0;
      for (const pt of cache.pts) if (pt[0] >= nc) { Tc = pt[1]; break; }
      ctx.strokeStyle = P.faint;
      ctx.beginPath(); ctx.moveTo(X(nc), y0); ctx.lineTo(X(nc), y0 + h); ctx.stroke();
      ctx.fillStyle = P.white;
      ctx.beginPath(); ctx.arc(X(nc), Y(Tc), 4.5, 0, 7); ctx.fill();

      ro.textContent = '堵转 T=' + cache.Tmax.toFixed(2) + 'N·m（' + cache.imax.toFixed(1) + 'A）  基速≈' +
        (cache.nBase < NMAX ? cache.nBase.toFixed(0) + 'rpm' : '>' + NMAX) +
        '  峰值功率≈' + cache.pBest.toFixed(1) + 'W  当前 n=' + nc.toFixed(0) + ' T=' + Tc.toFixed(2) + 'N·m';
    };
    [udcSl, imaxSl].forEach(function (el) { el && el.addEventListener('input', compute); });
    fwChk && fwChk.addEventListener('change', compute);
    loop(viz);
  })();

  /* ============================================================
     图 9-3：电流环一阶阶跃响应 —— τ = L/R
     ============================================================ */
  (function tauViz() {
    const viz = makeViz('cv-tau');
    if (!viz) return;
    const rSl = $id('tau-r'), lSl = $id('tau-l'), ro = $id('tau-readout');
    const player = (typeof makePlayer === 'function') ? makePlayer('btn-tau-play')
                                                       : { playing: false };
    const W = viz.s.w, H = viz.s.h;
    const I = 1.0;                      // 阶跃目标 1 A
    let tCur = 0, tPrev = 0;

    viz.draw = function () {
      const now = performance.now();
      const dt = Math.min(0.05, (now - tPrev) / 1000 || 0.016); tPrev = now;
      const R = +rSl.value, L = +lSl.value / 1000;    // mH → H
      const tau = L / R;
      if (player.playing) { tCur += dt / (6 * tau); if (tCur > 1) tCur = 0; }

      const ctx = viz.s.ctx;
      ctx.clearRect(0, 0, W, H);
      const x0 = 56, y0 = 18, w = W - 56 - 20, h = H - 60 - y0;
      const tMax = 6 * tau;
      const X = (t) => x0 + t / tMax * w;
      const Y = (i) => y0 + h - i / (I * 1.15) * h;

      /* 网格 */
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
      for (let k = 0; k <= 6; k++) {
        ctx.beginPath(); ctx.moveTo(X(k * tau), y0); ctx.lineTo(X(k * tau), y0 + h); ctx.stroke();
        txt(ctx, (k * tau * 1000).toFixed(1) + 'ms', X(k * tau), y0 + h + 12, P.dim, 10.5, 'center');
      }
      [0, 0.5, 1].forEach(function (v) {
        ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x0 + w, Y(v)); ctx.stroke();
        txt(ctx, v.toFixed(1) + 'A', x0 - 7, Y(v), P.dim, 11, 'right');
      });

      /* 63.2% 线 与 τ 标记 */
      ctx.strokeStyle = P.warn; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(x0, Y(0.632 * I)); ctx.lineTo(x0 + w, Y(0.632 * I)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(tau), Y(0)); ctx.lineTo(X(tau), Y(0.632 * I)); ctx.stroke();
      ctx.setLineDash([]);
      txt(ctx, '63.2%', x0 + w - 4, Y(0.632 * I) - 10, P.warn, 11, 'right');
      txt(ctx, 'τ=L/R=' + (tau * 1000).toFixed(2) + 'ms', X(tau), y0 + 2, P.warn, 11.5, 'center');

      /* 10%→90% 上升时间括号（=2.2τ） */
      const t10 = 0.10536 * tau, t90 = 2.3026 * tau;
      ctx.strokeStyle = P.dim;
      ctx.beginPath(); ctx.moveTo(X(t10), y0 + h - 10); ctx.lineTo(X(t90), y0 + h - 10); ctx.stroke();
      txt(ctx, '10→90% = 2.2τ', X((t10 + t90) / 2), y0 + h - 20, P.dim, 11, 'center');

      /* 响应曲线 */
      ctx.strokeStyle = P.accent; ctx.lineWidth = 2.4; ctx.beginPath();
      for (let px = 0; px <= w; px += 2) {
        const t = px / w * tMax;
        const i = I * (1 - Math.exp(-t / tau));
        px ? ctx.lineTo(x0 + px, Y(i)) : ctx.moveTo(x0, Y(i));
      }
      ctx.stroke();

      /* 光标 */
      const tc = tCur * tMax, ic = I * (1 - Math.exp(-tc / tau));
      ctx.strokeStyle = P.faint;
      ctx.beginPath(); ctx.moveTo(X(tc), y0); ctx.lineTo(X(tc), y0 + h); ctx.stroke();
      ctx.fillStyle = P.white;
      ctx.beginPath(); ctx.arc(X(tc), Y(ic), 4.5, 0, 7); ctx.fill();
      txt(ctx, 'i=' + ic.toFixed(2) + 'A', X(tc) + 8, Y(ic) - 10, P.white, 11.5, 'left');

      ro.textContent = 'R=' + (+R).toFixed(2) + 'Ω  L=' + (+lSl.value).toFixed(1) +
        'mH  →  τ=L/R=' + (tau * 1000).toFixed(2) + 'ms  10→90%≈' + (2.2 * tau * 1000).toFixed(2) +
        'ms  一阶带宽≈' + (1 / (2 * Math.PI * tau)).toFixed(0) + 'Hz';
    };
    [rSl, lSl].forEach(function (el) { el && el.addEventListener('input', function () { tCur = 0; }); });
    loop(viz);
  })();

  /* ============================================================
     🧮 口径换算器：峰值 / 有效值是同一股电流的两种「报数」
     ============================================================ */
  (function unitViz() {
    const viz = makeViz('cv-unit');
    if (!viz) return;
    const iSl = $id('un-i'), ro = $id('un-readout');
    const W = viz.s.w, H = viz.s.h;
    const RS = 5.35, S2 = Math.SQRT2;
    const KT_PK = 0.217;                 // 峰值口径（本站/FOC）
    const KT_RMS = KT_PK * S2;           // 有效值口径 ≈ 0.3069（规格书写 0.3）

    viz.draw = function () {
      const irms = +iSl.value, ipk = irms * S2;
      const T = KT_PK * ipk;                        // = KT_RMS * irms
      const Pcu = 1.5 * RS * ipk * ipk;             // = 3 * RS * irms^2（恒等）
      const ctx = viz.s.ctx;
      ctx.clearRect(0, 0, W, H);

      /* ---- 左：波形与两条参考线 ---- */
      const x0 = 44, x1 = 470, cy = H / 2, k = 92 / (2.0 * S2);   // 满量程 = 2 A 有效值
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x1, cy); ctx.stroke();
      const hline = (valA, col, lab, dy) => {
        const y = cy - valA * k, y2 = cy + valA * k;
        ctx.strokeStyle = col; ctx.lineDashOffset = 0; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y);
        ctx.moveTo(x0, y2); ctx.lineTo(x1, y2); ctx.stroke();
        ctx.setLineDash([]);
        txt(ctx, lab, x1 - 4, y + dy, col, 12, 'right', '600');
      };
      hline(ipk, P.accent, '峰值 I_pk = ' + ipk.toFixed(2) + ' A', -10);
      hline(irms, P.good, '有效值 I_rms = ' + irms.toFixed(2) + ' A', 14);
      ctx.strokeStyle = P.white; ctx.lineWidth = 2.4; ctx.beginPath();
      for (let px = x0; px <= x1; px += 2) {
        const th = (px - x0) / (x1 - x0) * Math.PI * 4;
        const y = cy - ipk * k * Math.sin(th);
        px === x0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
      }
      ctx.stroke();
      txt(ctx, '同一股电流的波形', x0, 18, P.dim, 12.5, 'left');

      /* ---- 右：两种口径的账本 ---- */
      const bx = 508;
      txt(ctx, '两种口径的账本', bx, 26, P.accent, 13.5, 'left', '700');
      txt(ctx, 'I_rms = ' + irms.toFixed(2) + ' A  ⇔  I_pk = ' + ipk.toFixed(2) + ' A',
          bx, 52, P.white, 13, 'left', '600');
      txt(ctx, '峰值口径  ' + KT_PK.toFixed(3) + ' N·m/A × ' + ipk.toFixed(2) + ' A',
          bx, 88, P.accent, 13, 'left');
      txt(ctx, '= ' + T.toFixed(3) + ' N·m', bx + 268, 88, P.accent, 13, 'left', '700');
      txt(ctx, '有效值口径 ' + KT_RMS.toFixed(3) + ' N·m/A × ' + irms.toFixed(2) + ' A',
          bx, 112, P.good, 13, 'left');
      txt(ctx, '= ' + T.toFixed(3) + ' N·m', bx + 268, 112, P.good, 13, 'left', '700');
      txt(ctx, '↑ 同一个扭矩 ✓（所以 K_t^pk = √2 · K_t^rms）', bx, 136, P.white, 12.5, 'left');
      ctx.strokeStyle = P.faint; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, 156); ctx.lineTo(W - 20, 156); ctx.stroke();
      txt(ctx, '铜损也一样（峰值/有效值口径恒等）', bx, 176, P.dim, 12.5, 'left');
      txt(ctx, '1.5·R·I_pk²  = 1.5×5.35×' + (ipk * ipk).toFixed(2) + ' = ' + Pcu.toFixed(1) + ' W',
          bx, 202, P.accent, 13, 'left');
      txt(ctx, '3·R·I_rms²   = 3×5.35×' + (irms * irms).toFixed(2) + ' = ' + Pcu.toFixed(1) + ' W',
          bx, 226, P.good, 13, 'left');
      txt(ctx, '↑ 发热只认有效值，但两种报数必然给出同一个数', bx, 250, P.dim, 12, 'left');

      ro.textContent = 'I_rms=' + irms.toFixed(2) + 'A ⇔ I_pk=' + ipk.toFixed(2) + 'A  ｜  '
        + '峰值口径 ' + KT_PK.toFixed(3) + '×' + ipk.toFixed(2) + '=' + T.toFixed(3) + 'N·m  ｜  '
        + '有效值口径 ' + KT_RMS.toFixed(3) + '×' + irms.toFixed(2) + '=' + T.toFixed(3) + 'N·m  ｜  '
        + '同一个扭矩 ✓  ｜  铜损 ' + Pcu.toFixed(1) + 'W（两种口径同值）';
    };
    loop(viz);
  })();
})();
