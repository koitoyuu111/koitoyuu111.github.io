/// <reference types="mdast" />
import { h } from "hastscript";

/**
 * Creates a responsive Bilibili video embed.
 *
 * Usage in markdown:
 *   ::bilibili{id="BV1xx411c7mD"}
 *   ::bilibili{id="BV1xx411c7mD" page="2"}
 *
 * @param {Object} properties - Directive attributes (id/bvid, page).
 * @returns {import('mdast').Parent} The created element.
 */
export function BilibiliComponent(properties) {
	const bvid = properties.id || properties.bvid;
	if (!bvid) {
		return h(
			"div",
			{ class: "hidden" },
			'Invalid directive. ("id" or "bvid" attribute is required, e.g. ::bilibili{id="BV1xx411c7mD"})',
		);
	}

	const page = properties.page || "1";

	return h("div", { class: "bilibili-video" }, [
		h("iframe", {
			src: `https://player.bilibili.com/player.html?bvid=${bvid}&page=${page}&high_quality=1&danmaku=1&autoplay=0`,
			scrolling: "no",
			border: "0",
			frameborder: "no",
			framespacing: "0",
			allowfullscreen: "true",
			loading: "lazy",
			title: "Bilibili 视频",
		}),
	]);
}
