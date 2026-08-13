#!/usr/bin/env node
/**
 * 从不蒜子(busuanzi)拉取每篇文章的 PV，写入 src/data/post-views.json
 *
 * 原理：busuanzi 公开接口按请求的 Referer 统计单页 PV，
 * 因此携带文章 URL 作为 Referer 即可拿到该文章的 page_pv。
 *
 * 用法：
 *   node scripts/update-post-views.mjs
 *
 * 注意：
 *   - 每次请求会被不蒜子计入一次访问（+1 PV），每天跑一次影响可忽略。
 *   - 请求间有 400ms 间隔，避免触发限流。
 *   - 站点根地址通过 SITE_URL 环境变量覆盖，默认 https://koitoyuu111.github.io
 */

import { readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const POSTS_DIR = join(ROOT_DIR, 'src', 'content', 'posts');
const DATA_FILE = join(ROOT_DIR, 'src', 'data', 'post-views.json');

const SITE_URL = (process.env.SITE_URL || 'https://koitoyuu111.github.io').replace(/\/$/, '');

function getPostSlugs() {
    if (!existsSync(POSTS_DIR)) return [];
    return readdirSync(POSTS_DIR)
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace(/\.md$/, ''));
}

async function fetchPageViews(slug) {
    const url = `https://busuanzi.ibruce.info/busuanzi?jsonpCallback=cb`;
    const res = await fetch(url, {
        headers: {
            Referer: `${SITE_URL}/posts/${slug}/`,
            'User-Agent': 'Mozilla/5.0 (koitoyuu-blog views updater)',
        },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    // 返回形如 try{cb({"site_uv":95,"page_pv":21,...});}catch(e){}
    const m = text.match(/"page_pv":(\d+)/);
    return m ? Number.parseInt(m[1], 10) : 0;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    const slugs = getPostSlugs();
    if (slugs.length === 0) {
        console.error('未找到文章文件');
        process.exit(1);
    }

    console.log(`共 ${slugs.length} 篇文章，开始拉取 PV...`);
    const views = [];

    for (const slug of slugs) {
        try {
            const pv = await fetchPageViews(slug);
            views.push({ slug, views: pv });
            console.log(`  ${slug}: ${pv}`);
        } catch (error) {
            console.warn(`  ${slug}: 拉取失败 (${error.message})，跳过`);
            views.push({ slug, views: 0 });
        }
        await sleep(400);
    }

    views.sort((a, b) => b.views - a.views);

    mkdirSync(join(ROOT_DIR, 'src', 'data'), { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(views, null, 2) + '\n', 'utf-8');

    const top5 = views.slice(0, 5).map((v) => v.slug).join(',');
    console.log(`\n已写入 ${DATA_FILE}`);
    console.log(`TOP5: ${top5}`);

    // 供 CI 使用
    console.log(`TOP5_SLUGS=${top5}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
