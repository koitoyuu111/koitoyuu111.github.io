/* ============================================================
   性能优化（2026-09-26）
   背景：本站有 35 个画布动画，但 main.js 里没有任何"离屏暂停"，
        实测滚到正文中段时 35 个画布全在视口外，仍有 616 次/秒的动画回调、
        约 164 ms/s 的 JS 开销（≈16% CPU）+ 长任务 → 明显卡顿。

   两条措施：
   ① 全局限帧 30 fps —— 所有动画共用一个节拍（原来各自 60 fps）
   ② 离屏画布不绘制 —— 视口外的画布，把"会真正光栅化"的绘制调用换成空操作；
      数学状态照常推进（save/restore/beginPath/arc 等状态类调用不拦截），
      回到视口后第一帧自然重画，观感无差别。
      前提已验证：main.js / params.js / wugan.js 都不读画布像素（getImageData/toDataURL 均为 0 次）。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- ① 全局限帧 ---------- */
  var FPS = 30;
  var INTERVAL = 1000 / FPS;
  var _raf = window.requestAnimationFrame.bind(window);
  var queue = [];
  var pending = false;
  var last = 0;

  window.requestAnimationFrame = function (cb) {
    queue.push(cb);
    if (!pending) { pending = true; _raf(flush); }
    return queue.length;
  };

  function flush(t) {
    pending = false;
    if (!last || t - last >= INTERVAL) {
      last = t;
      var list = queue.splice(0, queue.length);
      for (var i = 0; i < list.length; i++) {
        try { list[i](t); } catch (e) { /* 单个动画出错不影响其它 */ }
      }
    }
    if (queue.length) { pending = true; _raf(flush); }
  }

  /* ---------- ② 离屏画布不绘制 ---------- */
  var DRAW = ['clearRect', 'fillRect', 'strokeRect', 'fill', 'stroke',
              'fillText', 'strokeText', 'drawImage', 'putImageData'];

  /* 画布"重回视口"时广播一次 canvas-redraw。
     为什么需要：静音期间动画的绘制调用被吞掉了（例如主题切换时各动画监听
     'canvas-theme-change' 调的 draw()）。对"默认暂停"的动画来说，之后 tick
     不再每帧 draw()，滚回来就永远停留在旧配色 —— 广播一次让它补画一帧。 */
  function requestRedraw() {
    try { document.dispatchEvent(new CustomEvent('canvas-redraw')); } catch (e) { /* 忽略 */ }
  }

  function initCanvasMute() {
    if (typeof IntersectionObserver === 'undefined') return;
    var list = [].slice.call(document.querySelectorAll('canvas'));
    list.forEach(function (cv) {
      // 标了 data-no-mute 的画布（如鼠标拖尾覆盖层）不参与静音 —— 它本身就不绘制重内容
      if (cv.dataset && cv.dataset.noMute) return;
      var ctx = null;
      try { ctx = cv.getContext('2d'); } catch (e) { return; }
      if (!ctx) return;
      var orig = {};
      DRAW.forEach(function (m) { if (typeof ctx[m] === 'function') orig[m] = ctx[m]; });
      var muted = null;
      function setMuted(on) {
        if (muted === on) return;
        muted = on;
        DRAW.forEach(function (m) {
          if (!orig[m]) return;
          ctx[m] = on ? function () {} : orig[m];
        });
      }
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          setMuted(!e.isIntersecting);
          if (e.isIntersecting) requestRedraw();
        });
      }, { rootMargin: '240px 0px' }).observe(cv);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCanvasMute);
  } else {
    initCanvasMute();
  }

  /* 切到后台标签页时重置节拍，回来不追赶 */
  document.addEventListener('visibilitychange', function () { if (!document.hidden) last = 0; });
})();
