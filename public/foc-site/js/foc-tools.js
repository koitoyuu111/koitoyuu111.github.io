/* ============================================================
   FOC 学习站 · 工具层（搜索定位 / 网页缩放 / 宽表格滚动容器）
   ------------------------------------------------------------
   - 纯增量脚本，不改动站点原有 main.js 的任何逻辑
   - 所有样式在 foc-tools.css，配色走站点 CSS 变量（会被博客调色板覆盖）
   ============================================================ */
(function () {
  "use strict";

  var ZOOM_KEY = "foc-zoom";
  var ZOOM_MIN = 0.5;
  var ZOOM_MAX = 1.6;
  var ZOOM_STEP = 0.1;

  /* ---------------- 工具函数 ---------------- */

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
      }
    }
    return n;
  }

  function isTypingTarget(node) {
    if (!node) return false;
    var t = node.tagName;
    return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || node.isContentEditable === true;
  }

  /* ---------------- 1. 宽表格 → 横向滚动容器 ---------------- */

  function wrapTables() {
    var tables = document.querySelectorAll("#content table, main table");
    Array.prototype.forEach.call(tables, function (t) {
      var parent = t.parentElement;
      if (parent && parent.classList && parent.classList.contains("ft-table-scroll")) return;
      var wrap = el("div", "ft-table-scroll");
      wrap.setAttribute("tabindex", "0");
      wrap.setAttribute("role", "region");
      wrap.setAttribute("aria-label", "可横向滚动的表格");
      if (parent) parent.insertBefore(wrap, t);
      wrap.appendChild(t);
    });
  }

  /* ---------------- 1.5 代码块复制按钮 ---------------- */

  var LANG_LABEL = {
    c: "C",
    cpp: "C++",
    csharp: "C#",
    python: "Python",
    javascript: "JS",
    js: "JS",
    typescript: "TS",
    bash: "Bash",
    shell: "Shell",
    asm: "ASM",
    makefile: "Makefile",
    matlab: "MATLAB",
    json: "JSON",
    yaml: "YAML",
    ini: "INI",
  };

  function readCodeText(codeEl) {
    // 从 DOM 取文本（而不是 innerHTML），实体字符已自动还原
    return (codeEl.textContent || "").replace(/\s+$/, "");
  }

  function copyText(text) {
    // 优先用异步剪贴板 API；在非安全上下文（例如局域网 http）下回退到 execCommand
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "readonly");
      ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error("execCommand copy failed"));
    });
  }

  function mountCodeCopy() {
    var blocks = document.querySelectorAll("#content pre, main pre");
    Array.prototype.forEach.call(blocks, function (pre) {
      if (pre.parentElement && pre.parentElement.classList.contains("ft-code-wrap")) return;

      var wrap = el("div", "ft-code-wrap");
      if (pre.parentNode) pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var code = pre.querySelector("code") || pre;
      // 语言角标：直接用 main.js 给出的 language-xxx class
      var langMatch = /language-([\w+#-]+)/.exec(code.className || "");
      if (langMatch) {
        var tag = el("span", "ft-code-lang");
        tag.textContent = LANG_LABEL[langMatch[1].toLowerCase()] || langMatch[1].toUpperCase();
        wrap.appendChild(tag);
      }

      var btn = el("button", "ft-copy-btn", { type: "button", title: "复制这段代码" });
      btn.setAttribute("aria-label", "复制代码");
      btn.textContent = "复制";
      wrap.appendChild(btn);

      btn.addEventListener("click", function () {
        copyText(readCodeText(code)).then(
          function () {
            btn.textContent = "已复制 ✓";
            btn.classList.add("ft-copied");
            window.setTimeout(function () {
              btn.textContent = "复制";
              btn.classList.remove("ft-copied");
            }, 1600);
          },
          function () {
            btn.textContent = "复制失败";
            window.setTimeout(function () { btn.textContent = "复制"; }, 1600);
          }
        );
      });
    });
  }

  /* ---------------- 2. 建立搜索索引 ---------------- */

  var INDEX = [];

  function makeSlug(text) {
    var s = String(text)
      .toLowerCase()
      .replace(/[\s\u00a0]+/g, "-")
      .replace(/[^\w\u4e00-\u9fa5-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return "ft-" + (s || "sec");
  }

  function buildIndex() {
    var root = document.getElementById("content");
    if (!root) return;
    var headings = root.querySelectorAll("h1, h2, h3, h4");
    var chapter = "FOC 学习站";
    INDEX = [];

    Array.prototype.forEach.call(headings, function (h) {
      var text = (h.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;

      var level = parseInt(h.tagName.charAt(1), 10) || 2;

      // 章节归属：h1/h2 视为新的「分组标题」
      if (level <= 2) chapter = text;

      // 没有 id 的标题补一个语义化锚点，保证可跳转、可分享
      if (!h.id) {
        var base = makeSlug(text);
        var slug = base;
        var n = 2;
        while (document.getElementById(slug)) {
          slug = base + "-" + n;
          n += 1;
        }
        h.id = slug;
      }
      h.style.scrollMarginTop = "26px";

      INDEX.push({ id: h.id, text: text, level: level, chapter: chapter, node: h });
    });
  }

  function highlight(text, tokens) {
    // 直接用 DOM 组装，避免 innerHTML 注入
    var frag = document.createDocumentFragment();
    var lower = text.toLowerCase();
    var marks = [];
    tokens.forEach(function (tk) {
      if (!tk) return;
      var from = 0;
      var at = lower.indexOf(tk, from);
      while (at !== -1) {
        marks.push([at, at + tk.length]);
        from = at + tk.length;
        at = lower.indexOf(tk, from);
      }
    });
    if (!marks.length) {
      frag.appendChild(document.createTextNode(text));
      return frag;
    }
    marks.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [marks[0]];
    for (var i = 1; i < marks.length; i += 1) {
      var last = merged[merged.length - 1];
      if (marks[i][0] <= last[1]) last[1] = Math.max(last[1], marks[i][1]);
      else merged.push(marks[i]);
    }
    var pos = 0;
    merged.forEach(function (m) {
      if (m[0] > pos) frag.appendChild(document.createTextNode(text.slice(pos, m[0])));
      var mk = document.createElement("mark");
      mk.textContent = text.slice(m[0], m[1]);
      frag.appendChild(mk);
      pos = m[1];
    });
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
    return frag;
  }

  /* ---------------- 3. 网页缩放 ---------------- */

  function getZoom() {
    var v = parseFloat(localStorage.getItem(ZOOM_KEY));
    if (!isFinite(v) || v <= 0) return 1;
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));
  }

  var zoomLabel = null;

  function applyZoom(scale, persist) {
    var root = document.documentElement;
    if (Math.abs(scale - 1) < 0.001) {
      root.style.zoom = "";
    } else {
      root.style.zoom = String(scale);
    }
    if (persist !== false) {
      try { localStorage.setItem(ZOOM_KEY, String(scale)); } catch (e) { /* 隐私模式忽略 */ }
    }
    if (zoomLabel) zoomLabel.textContent = Math.round(scale * 100) + "%";
  }

  function stepZoom(delta) {
    var next = Math.round((getZoom() + delta) * 100) / 100;
    next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    applyZoom(next);
  }

  function fitWidth() {
    var root = document.documentElement;
    var prev = root.style.zoom;
    root.style.zoom = "1";
    var need = root.scrollWidth || 1;
    var have = root.clientWidth || 1;
    root.style.zoom = prev;

    if (need <= have) { applyZoom(1); return; }
    var s = Math.floor((have / need) * 100) / 100;
    s = Math.min(1, Math.max(ZOOM_MIN, s));
    applyZoom(s);
  }

  /* ---------------- 4. 右上角工具条 ---------------- */

  function mountToolbar() {
    if (document.getElementById("foc-tools")) return;

    var bar = el("div", null, { id: "foc-tools", role: "toolbar", "aria-label": "学习站工具条" });

    var searchBtn = el("button", null, { type: "button", id: "ft-open-search", title: "搜索并定位章节（快捷键 / 或 Ctrl+K）" });
    var sIcon = el("span", "ft-icon");
    sIcon.textContent = "🔍";
    var sLabel = el("span", "ft-label");
    sLabel.textContent = "搜索";
    searchBtn.appendChild(sIcon);
    searchBtn.appendChild(sLabel);

    var sep1 = el("span", "ft-sep");

    var out = el("button", null, { type: "button", id: "ft-zoom-out", title: "缩小（显示更多内容）" });
    out.textContent = "A−";
    var lab = el("button", "ft-zoom-label", { type: "button", id: "ft-zoom-reset", title: "点击恢复 100%" });
    lab.textContent = "100%";
    var zin = el("button", null, { type: "button", id: "ft-zoom-in", title: "放大" });
    zin.textContent = "A+";
    var fit = el("button", null, { type: "button", id: "ft-fit", title: "适应宽度：自动缩放到内容刚好放下" });
    fit.textContent = "⤢";

    bar.appendChild(searchBtn);
    bar.appendChild(sep1);
    bar.appendChild(out);
    bar.appendChild(lab);
    bar.appendChild(zin);
    bar.appendChild(fit);
    document.body.appendChild(bar);

    zoomLabel = lab;

    searchBtn.addEventListener("click", function () { openSearch(); });
    out.addEventListener("click", function () { stepZoom(-ZOOM_STEP); });
    zin.addEventListener("click", function () { stepZoom(ZOOM_STEP); });
    lab.addEventListener("click", function () { applyZoom(1); });
    fit.addEventListener("click", fitWidth);
  }

  /* ---------------- 5. 搜索面板 ---------------- */

  var searchRoot = null;
  var searchInput = null;
  var searchMeta = null;
  var searchList = null;
  var resultNodes = [];
  var activeIdx = -1;
  var lastFocus = null;

  function mountSearch() {
    if (searchRoot) return;

    searchRoot = el("div", null, { id: "ft-search", hidden: "hidden", role: "dialog", "aria-modal": "true", "aria-label": "站内搜索" });
    var box = el("div", null, { id: "ft-search-box" });

    var head = el("div", null, { id: "ft-search-head" });
    var icon = el("span", "ft-icon");
    icon.textContent = "🔍";
    searchInput = el("input", null, {
      id: "ft-search-input",
      type: "text",
      autocomplete: "off",
      spellcheck: "false",
      placeholder: "搜索章节或知识点…  ↑↓ 选择 · Enter 跳转 · Esc 关闭",
      "aria-label": "搜索关键词",
    });
    head.appendChild(icon);
    head.appendChild(searchInput);

    searchMeta = el("div", null, { id: "ft-search-meta" });
    searchList = el("div", null, { id: "ft-search-results" });

    box.appendChild(head);
    box.appendChild(searchMeta);
    box.appendChild(searchList);
    searchRoot.appendChild(box);
    document.body.appendChild(searchRoot);

    searchInput.addEventListener("input", function () { runSearch(searchInput.value); });
    searchRoot.addEventListener("mousedown", function (e) {
      if (e.target === searchRoot) closeSearch();
    });
    document.addEventListener("keydown", onGlobalKey);
  }

  function openSearch() {
    if (!searchRoot) mountSearch();
    if (!searchRoot.hidden) return;
    lastFocus = document.activeElement;
    searchRoot.hidden = false;
    searchInput.value = "";
    runSearch("");
    searchInput.focus();
  }

  function closeSearch() {
    if (!searchRoot || searchRoot.hidden) return;
    searchRoot.hidden = true;
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function runSearch(q) {
    var raw = (q || "").trim();
    var tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);

    var hits = INDEX;
    if (tokens.length) {
      hits = INDEX.filter(function (item) {
        var hay = item.text.toLowerCase();
        return tokens.every(function (tk) { return hay.indexOf(tk) !== -1; });
      });
    }

    searchList.textContent = "";
    resultNodes = [];
    activeIdx = -1;

    if (!hits.length) {
      searchMeta.textContent = raw ? "没有匹配结果" : "输入关键词，例如：Clarke、SVPWM、死区、自举电容";
      var empty = el("div", "ft-empty");
      empty.textContent = INDEX.length
        ? (raw ? "换个关键词试试" : "共 " + INDEX.length + " 个可跳转标题")
        : "未找到可搜索的标题";
      searchList.appendChild(empty);
      return;
    }

    var shown = hits.slice(0, 60);
    searchMeta.textContent = raw
      ? "找到 " + hits.length + " 个结果" + (hits.length > shown.length ? "（显示前 " + shown.length + " 个）" : "")
      : "共 " + INDEX.length + " 个可跳转标题，输入关键词可筛选";

    shown.forEach(function (item, i) {
      var btn = el("button", "ft-hit", { type: "button" });
      btn.setAttribute("data-index", String(i));

      var title = el("span", "ft-hit-title");
      title.appendChild(raw ? highlight(item.text, tokens) : document.createTextNode(item.text));

      var path = el("span", "ft-hit-path");
      var depth = item.level >= 4 ? "›› " : item.level === 3 ? "› " : "";
      path.textContent = depth + (item.chapter && item.chapter !== item.text ? item.chapter : "");

      btn.appendChild(title);
      if (path.textContent) btn.appendChild(path);

      btn.addEventListener("click", function () { jumpTo(item, btn); });
      btn.addEventListener("mousemove", function () { setActive(i, false); });

      searchList.appendChild(btn);
      resultNodes.push({ node: btn, item: item });
    });
  }

  function setActive(i, scroll) {
    if (!resultNodes.length) return;
    if (activeIdx >= 0 && resultNodes[activeIdx]) resultNodes[activeIdx].node.classList.remove("active");
    activeIdx = (i + resultNodes.length) % resultNodes.length;
    var entry = resultNodes[activeIdx];
    entry.node.classList.add("active");
    if (scroll) entry.node.scrollIntoView({ block: "nearest" });
  }

  function jumpTo(item, btn) {
    if (btn) {
      resultNodes.forEach(function (r) { if (r.node !== btn) r.node.classList.remove("active"); });
      btn.classList.add("active");
    }
    closeSearch();

    var target = document.getElementById(item.id);
    if (!target) return;

    try { history.replaceState(null, "", "#" + item.id); } catch (e) { /* file:// 忽略 */ }
    target.scrollIntoView({ behavior: "smooth", block: "start" });

    target.classList.remove("ft-flash");
    // 强制重排以便动画可以重复触发
    void target.offsetWidth;
    target.classList.add("ft-flash");
    window.setTimeout(function () { target.classList.remove("ft-flash"); }, 1900);
  }

  function onGlobalKey(e) {
    var typing = isTypingTarget(e.target);

    // 打开搜索
    if (!typing && (e.key === "/" || ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")))) {
      e.preventDefault();
      openSearch();
      return;
    }

    if (!searchRoot || searchRoot.hidden) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(activeIdx + 1, true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(activeIdx - 1, true);
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && resultNodes[activeIdx]) {
        e.preventDefault();
        resultNodes[activeIdx].node.click();
      } else if (resultNodes.length) {
        e.preventDefault();
        resultNodes[0].node.click();
      }
    }
  }

  /* ---------------- 启动 ---------------- */

  ready(function () {
    wrapTables();
    mountCodeCopy();
    buildIndex();
    mountToolbar();
    mountSearch();
    applyZoom(getZoom(), false);

    // 站内已存在的 #btn-toc-toggle（收起目录）保持原样，不干预
  });
})();
