export const PAGE_SIZE = 8;

export const LIGHT_MODE = "light",
	DARK_MODE = "dark",
	AUTO_MODE = "auto";
export const DEFAULT_THEME: "light" | "dark" | "auto" = AUTO_MODE;

// Banner height unit: vh
export const BANNER_HEIGHT = 35;
export const BANNER_HEIGHT_EXTEND = 30;
export const BANNER_HEIGHT_HOME: number = BANNER_HEIGHT + BANNER_HEIGHT_EXTEND;

// The height the main panel overlaps the banner, unit: rem
export const MAIN_PANEL_OVERLAPS_BANNER_HEIGHT = 3.5;

// Page width: rem
export const PAGE_WIDTH = 92;

// 全站总访问量：显示值 = SITE_PV_BASE + max(0, 真实不蒜子PV - SITE_PV_CALIBRATION)
// 即从 BASE 起步，之后随真实访问量 1:1 增长。
// 想改成直接显示不蒜子原始值，把 SITE_PV_BASE 设为 0、SITE_PV_CALIBRATION 设为 0 即可。
/** 起步显示值 */
export const SITE_PV_BASE = 100;
/** 校准基准：把展示值切成 SITE_PV_BASE 那一刻，不蒜子在正式域名上的真实 PV */
export const SITE_PV_CALIBRATION = 562;
/**
 * 只有这些域名才启用「真实增量」。原因：
 * 不蒜子对未注册的 host（如 localhost / 127.0.0.1）会返回全局聚合值（实测 8061 万），
 * 本地开发时打开会看到一个天文数字 —— 之前"访问量激增"就是这么来的。
 * 本地一律显示 SITE_PV_BASE。
 * 如果以后绑定了自定义域名，记得把新域名加进来。
 */
export const SITE_PV_ACTIVE_HOSTS = ["koitoyuu111.github.io"];
/** 增量合理性上限：超过这个数说明取到的是聚合值而非本站数据，直接回退到起步值 */
export const SITE_PV_MAX_DELTA = 1000000;
