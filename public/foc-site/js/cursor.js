/* ============================================================
   鼠标粒子拖尾（轻量版）
   设计取舍：
   - 只在真的有鼠标（hover + fine pointer）时启用；触屏 / 触摸板优先设备不加载
   - 尊重「减少动态效果」系统设置（prefers-reduced-motion）
   - 粒子上限 56 个，鼠标停下就自然淡出，**空闲时不跑 rAF**（不占 CPU）
   - 颜色跟随站点主题变量（--accent / --accent2），亮暗主题自动适配
   - 覆盖层 pointer-events:none，不挡任何点击
   ============================================================ */
(function () {
  'use strict';
  if (typeof window.matchMedia !== 'function') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var MAX = 56;
  var cv = document.createElement('canvas');
  cv.id = 'cursor-fx';
  document.body.appendChild(cv);
  var ctx = cv.getContext('2d');
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var W = 0, H = 0;

  function resize() {
    W = cv.width = Math.floor(window.innerWidth * dpr);
    H = cv.height = Math.floor(window.innerHeight * dpr);
    cv.style.width = window.innerWidth + 'px';
    cv.style.height = window.innerHeight + 'px';
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

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

  function spawn(x, y) {
    if (parts.length >= MAX) return;
    var ang = Math.random() * Math.PI * 2, sp = 0.12 + Math.random() * 0.5;
    parts.push({
      x: x * dpr, y: y * dpr,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.25,
      r: (1.4 + Math.random() * 2.4) * dpr,
      life: 1, decay: 0.016 + Math.random() * 0.022,
      c: colors[(Math.random() * colors.length) | 0]
    });
  }

  function loop() {
    rafId = 0;
    ctx.clearRect(0, 0, W, H);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.x += p.vx * dpr; p.y += p.vy * dpr;
      p.vy += 0.012 * dpr;                 // 轻微下沉，像星屑
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
    if (hasLast) {
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      var n = Math.min(3, Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy) / 20)));
      for (var i = 0; i < n; i++) {
        spawn(e.clientX + (Math.random() - 0.5) * 7, e.clientY + (Math.random() - 0.5) * 7);
      }
    }
    lastX = e.clientX; lastY = e.clientY; hasLast = true;
    if (!rafId) rafId = requestAnimationFrame(loop);
  }, { passive: true });

  window.addEventListener('mouseleave', function () { hasLast = false; }, { passive: true });
})();
