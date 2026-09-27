/* ============================================================
   第 13 章 · SMO + PLL 无感全流程 —— 两个交互动画
   依赖 main.js 的全局：COL（共享调色板）、TAU、setupCanvas()、makePlayer()、label()

   图 13-1  cv-smo-err  滑模观测器内部波形：到达阶段 → 滑模阶段；切换函数/增益/边界层/滤波截止 可调
   图 13-2  cv-smo-pll  SMO → PLL 全流程：θ̂ 追踪 θ、Δθ、ω̂，以及"增益随转速漂移 vs E_pk 归一化"

   ⚠️ 口径：全部按 4310 规格书定版（Rs=5.35 Ω、Ls=5.32 mH、ψf=10.3 mWb、p=14），
           与 ch10/ch11 正文的"简化教学参数集"不同（那里 ψf=5 mWb / Rs=1 Ω / Ls=0.5 mH）。
   ⚠️ 性能约定（与站点其它动画一致）：默认暂停；只在"播放中 / 控件变动 / 主题变化 / 重回视口"时重绘，
           不做无条件每帧 draw()。
   ============================================================ */
(function () {
  'use strict';
  /* 启动自证标记：脚本是否执行、执行那一刻画布是否存在（排查"静默不运行"用） */
  try {
    window.__smoBoot = (window.__smoBoot || 0) + 1;
    window.__smoDbg = {
      err: !!document.getElementById('cv-smo-err'),
      pll: !!document.getElementById('cv-smo-pll'),
      btn: !!document.getElementById('btn-smo-play'),
      ready: document.readyState
    };
  } catch (e) { /* 忽略 */ }

  const TAU2 = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const P = (typeof COL !== 'undefined') ? COL : {
    a: '#e74c3c', b: '#2ecc71', c: '#3498db', white: '#f5f5f5', dim: '#8b98ad',
    grid: '#2a3446', accent: '#4dd0a6', warn: '#f39c12', good: '#2ecc71',
    faint: 'rgba(255,255,255,.15)', fb: '#7a879a'
  };

  /* ---------------- 4310 定版参数 ---------------- */
  const MOT = {
    p: 14,
    Rs: 5.35,          // 规格：10.7 Ω(线) ÷ 2；实测 7.5 Ω 见正文 9.x
    Ls: 5.32e-3,
    psi: 10.3e-3,      // ψf（峰值口径）
    Ts: 50e-6          // PWM 20 kHz → 控制周期
  };
  const rpmToWe = (n) => n / 60 * TAU2 * MOT.p;
  const weToRpm = (we) => we * 60 / (TAU2 * MOT.p);

  function mkAnim(cvId) {
    const cv = $(cvId);
    if (!cv) return null;
    const ctx = cv.getContext('2d');
    const o = { cv, ctx, w: cv.width, h: cv.height };
    if (typeof setupCanvas === 'function') {
      const s = setupCanvas(cvId);
      if (s) { o.ctx = s.ctx; o.w = s.w; o.h = s.h; o.cx = s.cx; o.cy = s.cy; }
    }
    return o;
  }
  const L = (ctx, t, x, y, c, s, a) =>
    (typeof label === 'function') ? label(ctx, t, x, y, c, s, a) : null;

  function axisBase(ctx, x0, x1, yMid, xlab, ylab, yTop, yBot) {
    ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, yMid); ctx.lineTo(x1, yMid); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, yTop); ctx.lineTo(x0, yBot); ctx.stroke();
    L(ctx, xlab, x1, yMid + 16, P.dim, 11, 'right');
    L(ctx, ylab, x0 - 6, yTop + 4, P.dim, 11, 'right');
  }

  /* ============================================================
     图 13-1：滑模观测器内部波形
     ============================================================ */
  (function smoErr() {
    const A = mkAnim('cv-smo-err');
    if (!A) return;
    const ctx = A.ctx, W = A.w, H = A.h;

    const btnReset = $('btn-smo-reset');
    const kSl = $('smo-k'), phiSl = $('smo-phi'), fcSl = $('smo-fc');
    const kVal = $('smo-k-val'), phiVal = $('smo-phi-val'), fcVal = $('smo-fc-val');
    const ro = $('smo-readout'), player = makePlayer('btn-smo-play');

    let mode = 'sat';                       // sign | sat | sig
    const btnMode = { sign: $('btn-smo-f-sign'), sat: $('btn-smo-f-sat'), sig: $('btn-smo-f-sig') };
    function setMode(m) {
      mode = m;
      Object.keys(btnMode).forEach((kk) => {
        if (btnMode[kk]) btnMode[kk].classList.toggle('active', kk === m);
      });
      requestDraw();
    }
    Object.keys(btnMode).forEach((kk) => {
      if (btnMode[kk]) btnMode[kk].addEventListener('click', () => { setMode(kk); reset(); });
    });

    /* --- 工况：固定 916 rpm（最坏点），E_pk = 13.83 V --- */
    const N_RPM = 916;
    const WE = rpmToWe(N_RPM);                 // 1342.93 rad/s
    const EPK = WE * MOT.psi;                  // 13.83 V
    const I_AMP = 1.0;                         // 相电流峰值 1 A
    const TS = MOT.Ts, SUB = 40, HH = TS / SUB;
    /* ⚠️ SUB 不能太小：边界层内等效极点 = −(Rs + k/Φ)/Ls，
       显式欧拉稳定要求 H·(k/Φ)/Ls < 2 ⇒ Φ > H·k/(2Ls)。
       SUB=20(H=2.5 µs) 时 Φ ≥ 10 mA 都稳；SUB=10 时 Φ=10 mA 会数值发散。 */
    const T_WIN = 15e-3, N_ENV = Math.round(T_WIN / TS);      // 到达阶段 15 ms / 300 点
    const N_DET = 26;                                         // 细节窗 26×50µs = 1.3 ms
    const NOISE = 3 * 5.3724e-3;                              // ≈3 LSB ≈ 16 mA 采样噪声

    /* 解析给定的"真实电流/电压"：i = I·cos(θe)，u = Rs·i + Ls·di/dt + e
       ⇒ 观测器看到的是完全一致 (u, i) 对，只有 i 带噪声、估计初值故意给错。 */
    function truth(t) {
      const th = WE * t;
      const ia = I_AMP * Math.cos(th), ib = I_AMP * Math.sin(th);
      const dia = -I_AMP * WE * Math.sin(th), dib = I_AMP * WE * Math.cos(th);
      const ea = -EPK * Math.sin(th), eb = EPK * Math.cos(th);
      const ua = MOT.Rs * ia + MOT.Ls * dia + ea;
      const ub = MOT.Rs * ib + MOT.Ls * dib + eb;
      return { th, ia, ib, ea, eb, ua, ub };
    }

    let t = 0, iah = 0, ibh = 0, lpfA = 0, lpfB = 0, zA = 0, zB = 0;
    let env = [], det = [], tReach = -1, p2p = 0, relErr = 0;
    let noiseA = 0, noiseB = 0;

    function reset() {
      t = 0;
      const tr = truth(0);
      iah = tr.ia + 0.5; ibh = tr.ib + 0.3;     // 故意给错初值 → 有"到达阶段"
      lpfA = 0; lpfB = 0; zA = 0; zB = 0;
      env = []; det = []; tReach = -1; p2p = 0; relErr = 0;
      requestDraw();
    }

    function sw(x) {                            // 切换函数
      if (mode === 'sign') return x > 0 ? 1 : (x < 0 ? -1 : 0);
      if (mode === 'sat') return Math.max(-1, Math.min(1, x));
      return 2 / (1 + Math.exp(-6 * x)) - 1;    // sigmoid
    }

    /* 推进一个控制周期 Ts（内部 SUB 个子步，z 在 Ts 内保持不变 = 实际代码的采样保持） */
    function step() {
      const k = +kSl.value, PHI = +phiSl.value * 1e-3;
      const fc = +fcSl.value;
      const alpha = 1 - Math.exp(-TAU2 * fc * TS);          // 一阶 LPF 离散系数

      const tr = truth(t);
      const imA = tr.ia + noiseA, imB = tr.ib + noiseB;      // 带噪测量
      const sA = iah - imA, sB = ibh - imB;

      zA = k * sw(sA / PHI);
      zB = k * sw(sB / PHI);

      for (let i = 0; i < SUB; i++) {
        const tt = t + i * HH;
        const u = truth(tt);
        iah += HH * (u.ua - MOT.Rs * iah - zA) / MOT.Ls;
        ibh += HH * (u.ub - MOT.Rs * ibh - zB) / MOT.Ls;
      }
      lpfA += alpha * (zA - lpfA);
      lpfB += alpha * (zB - lpfB);

      /* 噪声在下一个周期重新抽（模拟每次采样独立） */
      noiseA = (Math.random() * 2 - 1) * NOISE;
      noiseB = (Math.random() * 2 - 1) * NOISE;

      if (env.length < N_ENV) env.push(Math.hypot(sA, sB));
      if (tReach < 0 && env.length > 3 && Math.hypot(sA, sB) < PHI) tReach = t;

      det.push({ s: sA, z: zA, e: tr.ea, l: lpfA });
      if (det.length > N_DET) det.shift();

      /* 抖振 = z 相对其低频估计 LPF(z) 的峰峰值 —— 这才是 PLL 真正要抑制的量。
         （直接用 z 的满幅摆动会把 sat/sigmoid 的直流分量也算进去，指标会失真）
         LPF 的相位滞后单独报，不要和「估计误差」混为一谈。 */
      let mn = 1e9, mx = -1e9, se = 0;
      for (const d of det) {
        const rp = d.z - d.l;
        if (rp < mn) mn = rp;
        if (rp > mx) mx = rp;
        se += Math.abs(d.l - d.e);
      }
      p2p = det.length ? mx - mn : 0;
      relErr = det.length ? (se / det.length) / EPK * 100 : 0;

      t += TS;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const k = +kSl.value, PHI = +phiSl.value * 1e-3, fc = +fcSl.value;
      if (kVal) kVal.textContent = k + ' V';
      if (phiVal) phiVal.textContent = (+phiSl.value) + ' mA';
      if (fcVal) fcVal.textContent = fc + ' Hz';

      /* 标题行 */
      L(ctx, '图 13-1  滑模观测器内部波形', 16, 20, P.white, 14, 'left');
      L(ctx, '工况：' + N_RPM + ' rpm  E_pk=' + EPK.toFixed(2) + ' V  I=' + I_AMP.toFixed(1) +
            ' A  Ts=' + (TS * 1e6).toFixed(0) + ' µs   切换函数：' + mode +
            '   k=' + k + ' V   Φ=' + (+phiSl.value) + ' mA' +
            '   sign 抖振理论幅度 k·Ts/Ls = ' + (k * TS / MOT.Ls).toFixed(2) + ' A',
        16, 38, P.dim, 11.5, 'left');

      /* ---------- 行 1：到达阶段 |ĩ| ---------- */
      const X0 = 92, X1 = W - 26;
      const r1T = 62, r1B = 186, r1M = (r1T + r1B) / 2;
      axisBase(ctx, X0, X1, r1B, '时间 →  0 ~ ' + (T_WIN * 1e3).toFixed(0) + ' ms', '|ĩ| / A', r1T, r1B);
      const envMax = 0.5;
      ctx.strokeStyle = P.accent; ctx.lineWidth = 1.6;
      ctx.beginPath();
      env.forEach((v, i) => {
        const x = X0 + i / (N_ENV - 1) * (X1 - X0);
        const y = r1B - Math.min(envMax, v) / envMax * (r1B - r1T);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
      /* Φ 边界线 */
      const yPhi = r1B - Math.min(envMax, PHI) / envMax * (r1B - r1T);
      ctx.strokeStyle = P.warn; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(X0, yPhi); ctx.lineTo(X1, yPhi); ctx.stroke();
      ctx.setLineDash([]);
      L(ctx, '边界层 Φ=' + (+phiSl.value) + ' mA', X1 - 4, yPhi - 9, P.warn, 11, 'right');
      /* 到达时间标记 */
      if (tReach >= 0) {
        const xr = X0 + Math.min(1, tReach / T_WIN) * (X1 - X0);
        ctx.strokeStyle = P.good; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(xr, r1T); ctx.lineTo(xr, r1B); ctx.stroke();
        ctx.setLineDash([]);
        L(ctx, '到达 t=' + (tReach * 1e3).toFixed(2) + ' ms', xr + 6, r1T + 10, P.good, 11, 'left');
      }
      L(ctx, '① 到达阶段 → 滑模阶段：|ĩ| 单调压进边界层 Φ 后不再离开',
        X0 + 4, r1T - 6, P.dim, 11.5, 'left');

      /* ---------- 行 2：细节窗 ĩ ---------- */
      const r2T = 212, r2B = 268, r2M = (r2T + r2B) / 2;
      axisBase(ctx, X0, X1, r2M, '最近 ' + (N_DET * TS * 1e3).toFixed(2) + ' ms（每点 = 一个 Ts）',
               'ĩ_α / mA', r2T, r2B);
      const sMax = Math.max(PHI * 2, 0.02) * 1e3;
      ctx.strokeStyle = P.c; ctx.lineWidth = 1.6;
      ctx.beginPath();
      det.forEach((d, i) => {
        const x = X0 + (det.length > 1 ? i / (det.length - 1) : 0) * (X1 - X0);
        const y = r2M - Math.max(-sMax, Math.min(sMax, d.s * 1e3)) / sMax * (r2B - r2T) / 2;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
      L(ctx, '② 滑模阶段：ĩ 被压在 ±Φ 内高频抖动（抖振）', X0 + 4, r2T - 6, P.dim, 11.5, 'left');

      /* ---------- 行 3：z / e / LPF(z) ---------- */
      const r3T = 292, r3B = 352, r3M = (r3T + r3B) / 2;
      axisBase(ctx, X0, X1, r3M, '', '电压 / V', r3T, r3B);
      const vMax = EPK * 1.25;
      function poly(key, color, w) {
        ctx.strokeStyle = color; ctx.lineWidth = w || 1.6;
        ctx.beginPath();
        det.forEach((d, i) => {
          const x = X0 + (det.length > 1 ? i / (det.length - 1) : 0) * (X1 - X0);
          const y = r3M - Math.max(-vMax, Math.min(vMax, d[key])) / vMax * (r3B - r3T) / 2;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.stroke();
      }
      poly('e', P.fb, 2);            // 真值 e_α（参考）
      poly('z', P.warn, 1.5);        // 切换项 z_α（抖振）
      poly('l', P.good, 2.2);        // LPF(z_α) ≈ ê_α
      L(ctx, '③ z_α（切换项，抖振）   e_α（真值）   LPF(z_α) ≈ ê_α',
        X0 + 4, r3T - 6, P.dim, 11.5, 'left');
      L(ctx, '—— e_α 真值', X1 - 250, r3T - 6, P.fb, 11, 'left');
      L(ctx, '—— z_α', X1 - 160, r3T - 6, P.warn, 11, 'left');
      L(ctx, '—— LPF(z)', X1 - 84, r3T - 6, P.good, 11, 'left');

      if (ro) {
        const reachTxt = (tReach >= 0)
          ? '到达时间 ' + (tReach * 1e3).toFixed(2) + ' ms'
          : '⚠ |ĩ| 始终没能压进边界层（k 太大 / Φ 太小 → 纯抖振）';
        const fe = WE / TAU2;
        const lagDeg = Math.atan2(fe, fc) * 180 / Math.PI;      // LPF 在电频率处的相位滞后
        ro.textContent = '抖振[z−LPF(z)]峰峰值 ' + p2p.toFixed(1) + ' V（' +
          (p2p / (2 * EPK) * 100).toFixed(0) + '% of 2E_pk）　LPF 相位滞后 ' + lagDeg.toFixed(1) +
          '°（可补偿）　LPF(z) 与 e 瞬时偏差 ' + relErr.toFixed(1) + '% E_pk（含滞后，非纯幅值误差）　' +
          '|ĩ| 稳态≈' + (env.length ? (env[env.length - 1] * 1e3).toFixed(0) : '—') + ' mA　' + reachTxt;
      }
    }

    let needDraw = false;
    function requestDraw() { needDraw = true; }

    [kSl, phiSl, fcSl].forEach((el) => { if (el) el.addEventListener('input', requestDraw); });

    let last = null;
    function tick(ts) {
      if (needDraw || player.playing) {
        if (player.playing) {
          if (last === null) last = ts;
          const steps = Math.min(4, Math.max(1, Math.round((ts - last) / 1000 / TS)));
          for (let i = 0; i < steps; i++) step();
          last = ts;
          if (t > T_WIN && env.length >= N_ENV) { /* 继续跑，只滚细节窗 */ }
        }
        draw();
        needDraw = false;
      } else {
        last = null;
      }
      requestAnimationFrame(tick);
    }

    document.addEventListener('canvas-theme-change', requestDraw);
    document.addEventListener('canvas-redraw', requestDraw);
    if (btnReset) btnReset.addEventListener('click', reset);
    Object.keys(btnMode).forEach((kk) => { if (btnMode[kk]) btnMode[kk].classList.add('btn-ghost'); });
    setMode('sat');
    reset();
    requestAnimationFrame(tick);
  })();

  /* ============================================================
     图 13-2：SMO → PLL 全流程
     ============================================================ */
  (function smoPll() {
    const A = mkAnim('cv-smo-pll');
    if (!A) return;
    const ctx = A.ctx, W = A.w, H = A.h;

    const wnSl = $('pll-wn'), ztSl = $('pll-zeta'), spdSl = $('pll-n');
    const wnVal = $('pll-wn-val'), ztVal = $('pll-zeta-val'), spdVal = $('pll-n-val');
    const normBtn = $('btn-pll-norm'), resetBtn = $('btn-pll-reset');
    const ro = $('pll-readout'), player = makePlayer('btn-pll-play');

    let normalized = true;
    if (normBtn) normBtn.addEventListener('click', () => {
      normalized = !normalized;
      normBtn.classList.toggle('active', normalized);
      normBtn.textContent = normalized ? '√ E_pk 归一化：开' : '√ E_pk 归一化：关';
      reset();
    });

    const TS2 = 20e-6;            // 仿真步长（真实代码 50 µs，这里细一点便于观察）
    const STEPS_PER_FRAME = 24;
    const T_END = 60e-3;          // 仿真总时长
    const RAMP = 10e-3;           // 0 → 目标转速 用 10 ms
    const N_CURVE = Math.round(T_END / TS2 / 6);   // 曲线抽样点数

    let t = 0, thE = 0, thH = 0, wH = 0, integ = 0;
    let curve = [], wnEff = 0, zetaEff = 0, overshoot = 0, dthMax = 0, dthSS = 0, wPeak = 0, settled = -1;

    function gains() {
      const wn = TAU2 * (+wnSl.value), ze = (+ztSl.value) / 100;   // 滑块 30..120 ⇒ ζ 0.30..1.20
      const nTgt = +spdSl.value, weTgt = rpmToWe(nTgt), epkTgt = weTgt * MOT.psi;
      if (normalized) return { wn, ze, Kp: 2 * ze * wn, Ki: wn * wn, norm: true };
      return { wn, ze, Kp: 2 * ze * wn / epkTgt, Ki: wn * wn / epkTgt, norm: false, epkTgt };
    }

    function reset() {
      t = 0; thE = 0; thH = 0; wH = 0; integ = 0;
      curve = []; overshoot = 0; dthSS = 0; wPeak = 0; settled = -1;
      requestDraw();
    }

    function stepSim() {
      const G = gains();
      const nTgt = +spdSl.value, weTgt = rpmToWe(nTgt);
      const we = t < RAMP ? weTgt * t / RAMP : weTgt;        // 转速斜坡（恒定角加速）
      const epk = we * MOT.psi;                              // 真实反电动势幅值
      thE += we * TS2;

      /* 鉴相：ε = ê_α… 实际由 SMO 提供，幅值就是 E_pk ⇒ ε = E_pk·sin(Δθ) */
      const dth = thE - thH;
      const eps = epk * Math.sin(dth);

      /* E_pk 归一化：除以 Ê = |ω̂_e|·ψf（低速加下限防除零） */
      let epsIn = eps;
      let Kp = G.Kp, Ki = G.Ki;
      if (normalized) {
        const epkHat = Math.max(Math.abs(wH) * MOT.psi, 0.55 * MOT.psi);   // 下限 ≈55 rpm 的 E_pk
        epsIn = eps / epkHat;
      }
      integ += Ki * epsIn * TS2;
      wH = Kp * epsIn + integ;
      thH += wH * TS2;

      /* 统计 */
      wnEff = Math.sqrt(Math.max(0, epk) * Ki);
      zetaEff = wnEff > 1e-6 ? epk * Kp / (2 * wnEff) : 0;
      if (weToRpm(wH) > wPeak) wPeak = weToRpm(wH);
      if (t < RAMP && Math.abs(dth) > dthMax) dthMax = Math.abs(dth);
      if (settled < 0 && t > RAMP && Math.abs(weToRpm(wH) - nTgt) < nTgt * 0.02) settled = t;

      if (curve.length < N_CURVE * 8) {
        curve.push({ t, dth: dth, w: weToRpm(wH), we: weToRpm(we), sn: Math.sin(thE), sh: Math.sin(thH) });
      }
      t += TS2;
      if (t >= T_END) {
        overshoot = nTgt > 0 ? Math.max(0, (wPeak - nTgt) / nTgt * 100) : 0;
        dthSS = Math.abs(thE - thH);
      }
      return null;                       // 统计量都写在闭包变量里，draw() 直接读
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const G = gains();
      const nTgt = +spdSl.value, weTgt = rpmToWe(nTgt), epkTgt = weTgt * MOT.psi;
      if (wnVal) wnVal.textContent = (+wnSl.value) + ' Hz';
      if (ztVal) ztVal.textContent = ((+ztSl.value) / 100).toFixed(2);
      if (spdVal) spdVal.textContent = nTgt + ' rpm';

      L(ctx, '图 13-2  SMO → PLL 全流程：θ̂ 追踪与 ω̂ 收敛', 16, 20, P.white, 14, 'left');
      L(ctx, 'ω_n=' + (+wnSl.value) + ' Hz(设)  ζ=' + (+ztSl.value).toFixed(2) +
            '   目标 ' + nTgt + ' rpm  E_pk(目标)=' + epkTgt.toFixed(2) + ' V   ' +
            (normalized ? 'E_pk 归一化：开（增益与转速无关）' : 'E_pk 归一化：关（增益固定在目标转速整定）'),
        16, 38, P.dim, 11.5, 'left');

      const X0 = 92, X1 = W - 26;
      const rows = [
        { t: 62, b: 170, lab: 'sin θ_e（灰） / sin θ̂（青）' },
        { t: 190, b: 268, lab: 'Δθ / °' },
        { t: 288, b: 366, lab: '转速 / rpm' }
      ];
      const xOf = (tt) => X0 + Math.min(1, tt / T_END) * (X1 - X0);

      /* 行 1：sin 追踪（真值画虚线，贴合时也能看清两条） */
      const r1 = rows[0], m1 = (r1.t + r1.b) / 2;
      axisBase(ctx, X0, X1, m1, '', 'sin', r1.t, r1.b);
      [['sn', P.fb, 2.4, [4, 3]], ['sh', P.accent, 1.6, null]].forEach(([kk, cc, ww, dash]) => {
        ctx.strokeStyle = cc; ctx.lineWidth = ww;
        ctx.setLineDash(dash || []);
        ctx.beginPath();
        curve.forEach((p, i) => {
          const y = m1 - p[kk] * (r1.b - r1.t) / 2 * 0.92;
          i ? ctx.lineTo(xOf(p.t), y) : ctx.moveTo(xOf(p.t), y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      });
      L(ctx, '① θ̂（青）追上 θ_e（灰）：加速段有滞后，稳态后贴合', X0 + 4, r1.t - 6, P.dim, 11.5, 'left');
      L(ctx, '—— sin θ_e', X1 - 190, r1.t - 6, P.fb, 11, 'left');
      L(ctx, '—— sin θ̂', X1 - 96, r1.t - 6, P.accent, 11, 'left');

      /* 行 2：Δθ */
      const r2 = rows[1], m2 = (r2.t + r2.b) / 2;
      const dMax = 90;
      axisBase(ctx, X0, X1, m2, '', 'Δθ / °', r2.t, r2.b);
      ctx.strokeStyle = P.warn; ctx.lineWidth = 1.6;
      ctx.beginPath();
      curve.forEach((p, i) => {
        const d = Math.max(-dMax, Math.min(dMax, p.dth * 180 / Math.PI));
        const y = m2 - d / dMax * (r2.b - r2.t) / 2;
        i ? ctx.lineTo(xOf(p.t), y) : ctx.moveTo(xOf(p.t), y);
      });
      ctx.stroke();
      L(ctx, '② 角度误差 Δθ：加速期滞后（∝ α/ω_n²），稳态≈0', X0 + 4, r2.t - 6, P.dim, 11.5, 'left');
      L(ctx, '+' + dMax + '°', X0 - 6, r2.t + 6, P.dim, 10, 'right');
      L(ctx, '−' + dMax + '°', X0 - 6, r2.b - 6, P.dim, 10, 'right');

      /* 行 3：ω̂ 与 ω_e */
      const r3 = rows[2], m3 = (r3.t + r3.b) / 2;
      const wMax = Math.max(nTgt * 1.35, 200);
      axisBase(ctx, X0, X1, m3, '时间 → 0 ~ ' + (T_END * 1e3).toFixed(0) + ' ms', 'n / rpm', r3.t, r3.b);
      [['we', P.fb, 1.4], ['w', P.accent, 2]].forEach(([kk, cc, ww]) => {
        ctx.strokeStyle = cc; ctx.lineWidth = ww;
        ctx.beginPath();
        curve.forEach((p, i) => {
          const y = r3.b - Math.min(wMax, p[kk]) / wMax * (r3.b - r3.t);
          i ? ctx.lineTo(xOf(p.t), y) : ctx.moveTo(xOf(p.t), y);
        });
        ctx.stroke();
      });
      L(ctx, '③ ω̂（青，PLL 输出）跟随 ω_e（灰，转速斜坡）', X0 + 4, r3.t - 6, P.dim, 11.5, 'left');
      L(ctx, nTgt + ' rpm', X0 - 6, r3.b - nTgt / wMax * (r3.b - r3.t) - 10, P.dim, 10, 'right');
      L(ctx, '—— ω_e', X1 - 176, r3.t - 6, P.fb, 11, 'left');
      L(ctx, '—— ω̂', X1 - 100, r3.t - 6, P.accent, 11, 'left');

      if (ro) {
        const wnUse = normalized ? G.wn : wnEff;
        const zeUse = normalized ? G.ze : zetaEff;
        const alpha = weTgt / RAMP;                       // rad/s²（恒定角加速）
        const thTheory = wnUse > 1e-6 ? alpha / (wnUse * wnUse) * 180 / Math.PI : 0;
        const dthNow = Math.abs(thE - thH) * 180 / Math.PI;
        ro.textContent = '实际 ω_n=' + wnUse.toFixed(0) + ' rad/s(' + (wnUse / TAU2).toFixed(0) +
          ' Hz)　实际 ζ=' + zeUse.toFixed(3) +
          '　当前 Δθ=' + dthNow.toFixed(1) + '°（加速期理论 α/ω_n² = ' + thTheory.toFixed(1) + '°）' +
          '　加速期峰值 Δθ=' + (dthMax * 180 / Math.PI).toFixed(1) + '°' +
          '　超调 ' + overshoot.toFixed(1) + '%' +
          (t >= T_END ? '　稳态 Δθ=' + (dthSS * 180 / Math.PI).toFixed(2) + '°' : '') +
          (settled >= 0 ? '　进入 ±2% 用 ' + (settled * 1e3).toFixed(1) + ' ms' : '');
      }
    }

    let needDraw = false;
    function requestDraw() { needDraw = true; }
    [wnSl, ztSl, spdSl].forEach((el) => { if (el) el.addEventListener('input', requestDraw); });

    let last = null;
    function tick(ts) {
      if (needDraw || player.playing) {
        if (player.playing && t < T_END) {
          for (let i = 0; i < STEPS_PER_FRAME && t < T_END; i++) stepSim();
        }
        draw();
        needDraw = false;
      }
      requestAnimationFrame(tick);
    }

    document.addEventListener('canvas-theme-change', requestDraw);
    document.addEventListener('canvas-redraw', requestDraw);
    if (resetBtn) resetBtn.addEventListener('click', reset);
    if (normBtn) normBtn.classList.toggle('active', normalized);
    reset();
    requestAnimationFrame(tick);
  })();
})();
