/**
 * 全站总访问量展示逻辑（不蒜子 PV → 起步值 + 真实增量）
 * ------------------------------------------------------------
 * 需求背景：
 *   - 直接用不蒜子的原始 PV，数字会因为自己反复刷新而虚高（"激增"）；
 *   - 但完全写死成固定值，又变成一个永远不变的假数字（"不加了"）。
 * 折中做法：
 *   显示值 = SITE_PV_BASE + max(0, 真实PV - SITE_PV_CALIBRATION)
 *   即从 100 起步，之后每来一次真实访问就 +1。
 *
 * 调节方式：只改 src/constants/constants.ts 里的两个常量。
 */
import {
	SITE_PV_BASE,
	SITE_PV_CALIBRATION,
	SITE_PV_ACTIVE_HOSTS,
	SITE_PV_MAX_DELTA,
} from "../constants/constants";

/** 当前是否跑在正式域名上（本地 dev / 预览不算） */
function isActiveHost(): boolean {
	if (typeof location === "undefined") return false;
	const host = location.hostname;
	return SITE_PV_ACTIVE_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

/** 读不蒜子回填进隐藏 span 的真实全站 PV；还没回填时返回 NaN */
function readRawPv(): number {
	const el = document.getElementById("busuanzi_value_site_pv");
	if (!el) return NaN;
	const digits = (el.textContent || "").replace(/[^\d]/g, "");
	if (!digits) return NaN;
	const n = parseInt(digits, 10);
	return Number.isFinite(n) ? n : NaN;
}

/** 计算要展示的数字 */
export function computeDisplayPv(): number {
	// 本地开发：不蒜子会返回全局聚合值，直接显示起步值
	if (!isActiveHost()) return SITE_PV_BASE;

	const raw = readRawPv();
	if (!Number.isFinite(raw)) return SITE_PV_BASE;

	const delta = raw - SITE_PV_CALIBRATION;
	if (delta <= 0) return SITE_PV_BASE;
	// 增量离谱 → 取到的是聚合值，回退
	if (delta > SITE_PV_MAX_DELTA) return SITE_PV_BASE;
	return SITE_PV_BASE + delta;
}

/** 把数字写进页面上所有展示位（主页 hero + 侧栏卡片 + 徽章） */
export function paintSitePv(): void {
	const v = String(computeDisplayPv());

	const hero = document.getElementById("hero-site-pv");
	if (hero && hero.textContent !== v) hero.textContent = v;

	const card = document.getElementById("site-pageviews");
	if (card && card.textContent !== v) {
		card.textContent = v;
		card.classList.add("stats-loaded");
	}

	const badge = document.getElementById("visitor-badge-count");
	if (badge && badge.textContent !== v) badge.textContent = v;
}

let watching = false;

/** 隐藏 span 里是否已经有真实数字了（有就不用再轮询） */
function hasRawPv(): boolean {
	const el = document.getElementById("busuanzi_value_site_pv");
	return !!el && /\d/.test(el.textContent || "");
}

/** swup 无刷新跳转后 hero 元素会被重建，需要重画 */
function hookSwup(cb: () => void): void {
	const win = window as unknown as {
		swup?: { hooks?: { on?: (name: string, fn: () => void) => void } };
	};
	const bind = () => {
		win.swup?.hooks?.on?.("page:view", cb);
	};
	if (win.swup) bind();
	else document.addEventListener("swup:enable", bind, { once: true });
}

/**
 * 启动同步：立即画一次，然后把「不蒜子异步回填」和「swup 换页」两种情况接住。
 *
 * 这里刻意**不用 MutationObserver 观察整个 body**：
 * 之前用 {childList, subtree, characterData} 观察 document.body，等于给全站每一次
 * 文字/节点变动都挂了一个回调，开销随页面复杂度线性上升（滚动、动画都会被牵连）。
 * 改成「短时轮询 + swup 钩子」，成本固定且尽早结束。
 */
export function watchSitePv(): void {
	paintSitePv();
	if (watching || typeof document === "undefined" || !document.body) return;
	watching = true;

	// 不蒜子脚本是 async 的，回填到就停，最多轮 12 秒
	let ticks = 0;
	const timer = window.setInterval(() => {
		ticks += 1;
		paintSitePv();
		if (hasRawPv() || ticks > 30) window.clearInterval(timer);
	}, 400);

	document.addEventListener("astro:page-load", paintSitePv);
	hookSwup(paintSitePv);
}
