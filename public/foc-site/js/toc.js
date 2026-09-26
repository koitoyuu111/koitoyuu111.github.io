/* ============================================================
   侧栏二级目录：把每章的 h2 展开成可点的小点
   - 读取 #toc > li[data-ch]，在对应 <section.chapter> 里找 h2 生成子列表
   - caret 手动展开/收起；滚动时同步"当前章展开"，并高亮当前小节
   - ⚠️ 不在这里改写被监听元素的 class、也不做自动滚动，
     避免 IntersectionObserver / MutationObserver 与滚动互相触发导致主线程打转
   ============================================================ */
(function () {
  'use strict';
  var toc = document.getElementById('toc');
  if (!toc) return;
  var liList = [].slice.call(toc.children).filter(function (el) {
    return el.tagName === 'LI' && el.dataset && el.dataset.ch !== undefined;
  });
  if (!liList.length) return;

  var curLi = null;
  var allH = [];

  liList.forEach(function (li) {
    var sec = document.getElementById('ch' + li.dataset.ch);
    if (!sec) return;
    var hs = [].slice.call(sec.querySelectorAll('h2'));
    if (!hs.length) return;

    var ul = document.createElement('ul');
    ul.className = 'toc-sub';
    hs.forEach(function (h, i) {
      if (!h.id) h.id = 's-ch' + li.dataset.ch + '-' + (i + 1);
      var sli = document.createElement('li');
      var sa = document.createElement('a');
      sa.href = '#' + h.id;
      sa.textContent = h.textContent.replace(/\s+/g, ' ').trim();
      sa.title = sa.textContent;
      sli.appendChild(sa);
      ul.appendChild(sli);
      h.__tocLi = sli;
      allH.push(h);
    });
    li.appendChild(ul);
    li.classList.add('has-sub');

    var caret = document.createElement('button');
    caret.type = 'button';
    caret.className = 'toc-caret';
    caret.textContent = '▶';
    caret.title = '展开 / 收起本节';
    caret.setAttribute('aria-label', '展开或收起本节');
    caret.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = li.classList.toggle('open');
      li.dataset.manual = open ? '1' : '';
    });
    li.appendChild(caret);

    li.__hs = hs;
  });

  /* 当前章同步：只看不写循环 —— 每次滚动做一遍，不监听自己写的 class */
  var syncTimer = null;
  function syncActiveChapter() {
    var act = null;
    for (var i = 0; i < liList.length; i++) {
      if (liList[i].classList.contains('active')) { act = liList[i]; break; }
    }
    /* 当前板块高亮：最后一个位于当前章之前的组标 */
    var kids = [].slice.call(toc.children);
    var ai = act ? kids.indexOf(act) : -1;
    var groups = kids.filter(function (el) {
      return el.classList && el.classList.contains('toc-group');
    });
    var curG = null;
    groups.forEach(function (g) { if (kids.indexOf(g) < ai) curG = g; });
    groups.forEach(function (g) { g.classList.toggle('cur-group', g === curG); });

    liList.forEach(function (li) {
      if (!li.__hs) return;
      if (li === act) {
        if (!li.classList.contains('open')) li.classList.add('open');
        li.dataset.manual = '';            // 回到自动模式
      } else if (li.classList.contains('open') && li.dataset.manual !== '1') {
        li.classList.remove('open');
      }
    });
  }
  window.addEventListener('scroll', function () {
    if (syncTimer) return;
    syncTimer = setTimeout(function () { syncTimer = null; syncActiveChapter(); }, 200);
  }, { passive: true });

  /* 打开当前章（首屏 / 带 hash 进来） */
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(syncActiveChapter);
  else syncActiveChapter();

  /* 当前小节高亮：只改 .cur（不改被上面的逻辑读写的属性），且不自动滚动页面 */
  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var sli = e.target.__tocLi;
        if (!sli || sli === curLi) return;
        if (curLi) curLi.classList.remove('cur');
        sli.classList.add('cur');
        curLi = sli;
      });
    }, { rootMargin: '-6% 0px -74% 0px' });
    allH.forEach(function (h) { io.observe(h); });
  }
})();
