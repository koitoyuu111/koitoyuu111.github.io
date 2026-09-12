/* ============================================================
   FOC 学习站 · 博客主题桥接（必须同步加载在 <head> 里）
   ------------------------------------------------------------
   为什么必须放在学习站自己这边、而且必须同步（不能 defer）：

   学习站的 main.js 在 </body> 前**同步**执行，每次加载都会把
       root.setAttribute('data-theme', s.theme)   // 默认 dark
       applyCanvasTheme(s.theme)                  // COL 重置成自己的青色
   执行一遍。如果配色靠父页在 iframe 的 load 事件里注入，那一定晚于
   main.js，就会出现「先学习站自己的青绿/深色 → 再翻成主站配色」的闪色。

   放在这里同步执行，等于在**首次绘制之前**就把主站调色板写进
   document.head 末尾（后写覆盖 style.css），从根上没有翻转。
   之后再在 DOMContentLoaded / load 各补一次，把 main.js 改回去的
   data-theme 和画布 COL 拉回来。
   ============================================================ */
(function () {
  "use strict";

  var STYLE_ID = "blog-theme-bridge";

  // 只有在被同源父页 iframe 嵌入时才起作用；独立打开学习站时保持自己的配色
  var parentDoc = null;
  var parentWin = null;
  try {
    if (window.parent && window.parent !== window && window.parent.document) {
      parentDoc = window.parent.document;
      parentWin = window.parent;
    }
  } catch (e) {
    parentDoc = null;
  }

  function readVar(cs, name, fallback) {
    var v = cs.getPropertyValue(name);
    return (v || "").trim() || fallback;
  }

  // 上一次应用过的调色板指纹：没变就不重写 <style>（重写会让整篇样式重算，很贵）
  var lastSig = null;

  // 主站滚动时会频繁改 documentElement.style（Layout 里的 --banner-height-extend），
  // 所以观察回调不能直接做重活：统一走 200ms 尾去抖，读计算样式也不会每帧触发强制重算。
  var syncTimer = 0;
  function scheduleSync() {
    if (syncTimer) return;
    syncTimer = window.setTimeout(function () {
      syncTimer = 0;
      sync();
    }, 200);
  }

  /** 画布配色：只在真的不同时才改并派发重绘事件（派发会让 28 个画布全部重画） */
  function applyCanvasColors(p) {
    try {
      if (typeof COL === "undefined" || !COL) return;
      if (
        COL.accent === p.primary &&
        COL.white === p.text &&
        COL.dim === p.muted &&
        COL.grid === p.divider &&
        COL.boxFill === p.cardBg &&
        COL.fb === p.muted
      ) {
        return;
      }
      COL.accent = p.primary;
      COL.white = p.text;
      COL.dim = p.muted;
      COL.grid = p.divider;
      COL.boxFill = p.cardBg;
      COL.fb = p.muted;
      document.dispatchEvent(new CustomEvent("canvas-theme-change"));
    } catch (e) {
      /* 画布桥接失败不影响站点功能 */
    }
  }

  function sync() {
    if (!parentDoc || !parentDoc.documentElement || !document.head) return false;

    var bd = parentDoc.documentElement;
    var cs = parentWin.getComputedStyle(bd);
    var isDark = bd.classList.contains("dark");

    var hue = readVar(cs, "--hue", "345");
    var primary = readVar(cs, "--primary", "oklch(0.75 0.14 345)");
    var cardBg = readVar(cs, "--card-bg", isDark ? "oklch(0.23 0.015 345)" : "#ffffff");
    var divider = readVar(cs, "--line-divider", "rgba(255,255,255,0.08)");
    var codeBg = readVar(cs, "--codeblock-bg", "oklch(0.17 0.015 345)");
    var text = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)";
    var muted = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";
    var chipBg = readVar(cs, "--btn-regular-bg", isDark ? "oklch(0.33 0.035 345)" : "oklch(0.95 0.025 345)");
    var chipBgHover = readVar(cs, "--btn-regular-bg-hover", isDark ? "oklch(0.38 0.04 345)" : "oklch(0.9 0.05 345)");
    var chipFg = readVar(cs, "--btn-content", isDark ? "oklch(0.75 0.1 345)" : "oklch(0.55 0.12 345)");

    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

    var sig = [isDark, hue, primary, cardBg, divider, codeBg, chipBg, chipBgHover, chipFg].join("|");
    if (sig !== lastSig) {
      lastSig = sig;
      var style = document.getElementById(STYLE_ID);
      if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
      }
      style.textContent =
        "html, body { background: " + cardBg + " !important; }" +
        // 选择器权重加倍：本脚本在 style.css **之前**执行，插入的 <style> 也会排在前面，
        // 所以必须靠 :root:root / [data-theme][data-theme] 把权重提到 (0,2,0)，
        // 才能稳定压过 style.css 里的 :root / [data-theme="dark"]（(0,1,0)）。
        ":root:root, [data-theme][data-theme] {" +
        "  --hue: " + hue + ";" +
        "  --bg: " + cardBg + ";" +
        "  --bg2: color-mix(in oklab, " + cardBg + " 88%, " + primary + " 12%);" +
        "  --panel: color-mix(in oklab, " + cardBg + " 93%, " + primary + " 7%);" +
        "  --border: " + divider + ";" +
        "  --text: " + text + ";" +
        "  --muted: " + muted + ";" +
        "  --accent: " + primary + ";" +
        "  --accent2: " + primary + ";" +
        "  --accent-soft: color-mix(in oklab, " + primary + " 14%, transparent);" +
        "  --hover-bg: color-mix(in oklab, " + primary + " 10%, transparent);" +
        "  --code-bg: " + codeBg + ";" +
        "  --btn-text: #fff;" +
        "  --ft-chip-bg: " + chipBg + ";" +
        "  --ft-chip-bg-hover: " + chipBgHover + ";" +
        "  --ft-chip-fg: " + chipFg + ";" +
        "}" +
        "#btn-settings, #settings-panel { display: none !important; }";
    }

    applyCanvasColors({
      primary: primary,
      text: text,
      muted: muted,
      divider: divider,
      cardBg: cardBg,
    });

    return true;
  }

  // 暴露给父页：主站那边只负责在 iframe load 时调用它，避免两处各写一份调色板逻辑
  window.__focBlogTheme = { sync: sync };

  if (!parentDoc) return; // 独立打开：不干预

  /** 告诉父页「调色板已经应用好了，可以显示了」 */
  function notifyParent() {
    window.__focThemeApplied = true;
    try {
      if (typeof parentWin.__focThemeReady === "function") parentWin.__focThemeReady();
    } catch (e) {
      /* 父页还没准备好回调也没关系 */
    }
    // 直接揭晓父页里的 iframe。这一句是关键：swup 无刷新跳转进 /foc/ 时，
    // 父页那段模块脚本不会重跑，只能由 iframe 自己（它的文档每次都会执行脚本）来揭晓。
    try {
      var fr = parentDoc.getElementById("foc-frame");
      if (fr && fr.classList) fr.classList.remove("invisible");
    } catch (e) {
      /* 忽略 */
    }
  }

  if (sync()) notifyParent(); // ① 首次绘制前

  document.addEventListener("DOMContentLoaded", sync); // ② main.js 之后
  window.addEventListener("load", function () {
    // ③ 兜底
    sync();
    // 即使同步失败也不能在父页留一块空白，宁可显示成学习站自己的配色
    try {
      var fr = parentDoc.getElementById("foc-frame");
      if (fr && fr.classList) fr.classList.remove("invisible");
    } catch (e) {
      /* 忽略 */
    }
  });

  // ④ 主站切换明暗 / 换主题色时同步（同源，可跨文档观察）
  //    注意这里的 style：主站滚动时会频繁写 --banner-height-extend，
  //    所以回调只能走 scheduleSync 去抖，绝不能在里面直接读计算样式/改 DOM。
  try {
    new MutationObserver(scheduleSync).observe(parentDoc.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
  } catch (e) {
    /* 观察父文档失败就退回被动同步 */
  }

  // ⑤ 学习站自己这边如果被 main.js 改了 data-theme，也拉回来
  try {
    var last = document.documentElement.getAttribute("data-theme");
    new MutationObserver(function () {
      var now = document.documentElement.getAttribute("data-theme");
      if (now === last) return;
      last = now;
      sync();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  } catch (e) {
    /* 忽略 */
  }
})();
