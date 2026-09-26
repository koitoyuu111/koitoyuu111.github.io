/* ============================================================
   鼠标粒子拖尾（轻量版）
   设计取舍：
   - 只在真的有鼠标（hover + fine pointer）时启用；触屏 / 触摸板优先设备不加载
   - 尊重「减少动态效果」系统设置（prefers-reduced-motion）
   - 粒子上限 56 个，鼠标停下就自然淡出，**空闲时不跑 rAF**（不占 CPU）
   - 颜色跟随站点主题变量（--accent / --accent2），亮暗主题自动适配
   - 覆盖层 pointer-events:none，不挡任何点击

   ⚠️ 坐标系（2026-09-26 修 bug，别再改回去）：
   站点的「网页缩放」是 `document.documentElement.style.zoom = k`（foc-tools.js）。
   `zoom` 会把**整个子树一起缩放**，包括本覆盖层 —— 于是画布的视觉尺寸变成
   innerWidth×k，而绘制缓冲区还是 innerWidth×dpr，两者不等 ⇒ 粒子被拉伸，
   离原点越远偏得越多（实测 125% 缩放下鼠标在 (900,660) 时粒子飘到 (1130,829)）。
   所以这里**不假设缓冲区与视觉尺寸的关系**：
     · 覆盖层样式尺寸按 zoom 反折算 + 用实测 rect 校正一次，保证精确铺满视口；
     · 记录 S = 缓冲区像素 / 视觉像素，鼠标坐标一律走 (clientX - rect.left) * S；
     · 粒子的半径 / 速度 / 重力也乘 S，不同缩放下观感一致。
   几何只在 resize / zoom / dpr 变化时重算（读 inline style + innerWidth，不触发重排）。
   ============================================================ */
(function () {
  'use strict';
  if (typeof window.matchMedia !== 'function') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var MAX = 56;
  var cv = document.createElement('canvas');
  cv.id = 'cursor-fx';
  // 显式豁免 perf.js 的「离屏画布静音」：本覆盖层永远在视口内，
  // 万一被静音（clearRect/fill 变空操作）鼠标拖尾就整条失效。
  cv.dataset.noMute = '1';
  document.documentElement.appendChild(cv);   // 挂 <html>：少受 body 内布局影响
  var ctx = cv.getContext('2d');

  var W = 0, H = 0;      // 绘制缓冲区尺寸（设备像素）
  var S = 1;             // 1 视觉像素 = S 个缓冲区像素
  var RL = 0, RT = 0;    // 覆盖层的 rect.left / rect.top
  var sig = null;

  function layout(force) {
    // 这几个读操作都很便宜，不会强制重排
    var vw = window.innerWidth || 1, vh = window.innerHeight || 1;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    var sigNow = vw + 'x' + vh + '@' + dpr + 'z' + z;
    if (!force && sigNow === sig) return;
    sig = sigNow;

    // ① 先按 zoom 反折算设样式尺寸（zoom 会把样式尺寸再放大 z 倍）
    var w = vw / z, h = vh / z;
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    var r = cv.getBoundingClientRect();
    // ② 用实测 rect 校正一次：不管 zoom 是从哪来的（root / 祖先 transform），
    //    这一步都能把"视觉尺寸 = 视口"对齐
    if (r.width > 1 && Math.abs(r.width - vw) > 1) {
      w *= vw / r.width;
      h *= vh / r.height;
      cv.style.width = w + 'px';
      cv.style.height = h + 'px';
      r = cv.getBoundingClientRect();
    }
    W = cv.width = Math.max(1, Math.round(vw * dpr));
    H = cv.height = Math.max(1, Math.round(vh * dpr));
    S = (r.width > 1) ? W / r.width : dpr;
    RL = r.left; RT = r.top;
  }
  layout(true);
  window.addEventListener('resize', function () { layout(true); }, { passive: true });

  function themeColors() {
    var cs = getComputedStyle(document.documentElement);
    var a = (cs.getPropertyValue('--accent') || '#4dd0a6').trim();
    var b = (cs.getPropertyValue('--accent2') || a).trim();
    return [a, b, a];
  }
  var colors = themeColors();
  document.addEventListener('canvas-theme-change', function () { colors = themeColors(); });
  document.addEventListener('theme-change', function () { colors = themeColors(); });

  var parts = [];
  var lastX = 0, lastY = 0, hasLast = false, rafId = 0;

  /* x, y 是「画布本地视觉像素」坐标 */
  function spawn(x, y) {
    if (parts.length >= MAX) return;
    var ang = Math.random() * Math.PI * 2, sp = (0.12 + Math.random() * 0.5) * S;
    parts.push({
      x: x * S, y: y * S,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.25 * S,
      r: (1.4 + Math.random() * 2.4) * S,
      life: 1, decay: 0.016 + Math.random() * 0.022,
      c: colors[(Math.random() * colors.length) | 0]
    });
  }

  function loop() {
    rafId = 0;
    ctx.clearRect(0, 0, W, H);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.x += p.vx; p.y += p.vy;            // 已在缓冲区像素单位
      p.vy += 0.012 * S;                   // 轻微下沉，像星屑
      p.life -= p.decay;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life) * 0.85;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.4 + p.life * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (parts.length) rafId = requestAnimationFrame(loop);
    else ctx.clearRect(0, 0, W, H);        // 空闲：停 rAF，不留残影
  }

  window.addEventListener('mousemove', function (e) {
    layout();                                   // zoom / 视口变了就重算（便宜）
    var vx = e.clientX - RL, vy = e.clientY - RT;      // 画布本地视觉像素
    if (hasLast) {
      var dx = e.clientX - lastX, dy = e.clientY - lastY;   // 视觉像素
      var n = Math.min(3, Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy) / 20)));
      for (var i = 0; i < n; i++) {
        spawn(vx + (Math.random() - 0.5) * 7, vy + (Math.random() - 0.5) * 7);
      }
    }
    lastX = e.clientX; lastY = e.clientY; hasLast = true;
    if (!rafId) rafId = requestAnimationFrame(loop);
  }, { passive: true });

  window.addEventListener('mouseleave', function () { hasLast = false; }, { passive: true });
})();
