import type {
	AntiLeechConfig,
	ExpressiveCodeConfig,
	ImageFallbackConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
	UmamiConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "koitoyuu",
	subtitle: "嵌入式开发 · 机器视觉 · STM32",
	description:
		"こいとゆう的个人博客，分享嵌入式开发、机器视觉、STM32项目经验与电子设计竞赛记录",

	keywords: ["嵌入式", "STM32", "机器视觉", "OpenMV", "PID控制", "电子设计竞赛", "K230"],
	lang: "zh_CN",
	themeColor: {
		hue: 345,
		fixed: true,
		forceDarkMode: false,
	},
	banner: {
		enable: false,
		src: "",
		position: "center",
		credit: {
			enable: false,
			text: "",
			url: "",
		},
	},
	background: {
		enable: true,
		src: "/images/bg.jpg",
		position: "center",
		size: "cover",
		repeat: "no-repeat",
		attachment: "scroll",
		opacity: 0.35,
	},
	toc: {
		enable: true,
		depth: 2,
	},
	favicon: [],
	apps: [
		{
			name: "GitHub",
			url: "https://github.com/koitoyuu111",
			image: "/favicon/github.webp",
			description: "个人 GitHub 主页",
			external: true,
		},
	],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.Works,
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "/images/avatar.jpg",
	name: "こいとゆう",
	bio: ["嵌入式开发 · 机器视觉 · STM32", "好きこそものの上手なれ"],
	links: [
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/koitoyuu111",
		},
		{
			name: "Bilibili",
			icon: "fa6-brands:bilibili",
			url: "https://space.bilibili.com/455256147",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const imageFallbackConfig: ImageFallbackConfig = {
	enable: false,
	originalDomain: "",
	fallbackDomain: "",
};

export const umamiConfig: UmamiConfig = {
	enable: false,
	baseUrl: "",
	shareId: "",
	timezone: "Asia/Shanghai",
};

export const antiLeechConfig: AntiLeechConfig = {
	enable: false,
	officialSites: [],
	debug: false,
	warningTitle: "",
	warningMessage: "",
};

export const googleAnalyticsConfig = {
	enable: false,
	measurementId: "",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	theme: "github-dark",
};
