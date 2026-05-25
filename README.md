<div align="center">

# 🌸 こいとゆう (koitoyuu) のブログ

**基于 [saicaca/fuwari](https://github.com/saicaca/fuwari) 由 AI 二次魔改的个人博客**

[![Astro](https://img.shields.io/badge/Astro-5.x-FF5D01?logo=astro&logoColor=white)](https://astro.build)
[![Svelte](https://img.shields.io/badge/Svelte-5.x-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

[🖥️ 在线预览](https://koitoyuu.github.io) · [📦 原始模板](https://github.com/saicaca/fuwari)

以及此版本的魔改基础来自 [流转星(Betsy)/fuwari](https://github.com/Besty0728/fuwar)，原作者 [Betsy](https://github.com/Besty0728)

</div>

---

## ✍️ 关于作者

嵌入式开发者，热爱 STM32、机器视觉与电子设计竞赛。

- **GitHub** — [@koitoyuu111](https://github.com/koitoyuu111)
- **Bilibili** — [こいとゆう](https://space.bilibili.com/455256147)

---

## ✨ 功能特性

在保留原版 Fuwari 优雅设计的基础上，本版本包含：

### 📝 内容增强
- **目录导航 (TOC)** — 长文自动生成右侧目录，快速跳转
- **文章置顶** — 支持 `pinned: true` 将重要文章置顶显示
- **文章排序** — 悬浮按钮支持按发布时间 / 更新时间排序
- **数学公式** — KaTeX 渲染，支持 LaTeX 语法
- **代码块增强** — 可折叠代码、行号显示、GitHub Dark 主题
- **Mermaid 图表** — 文章内嵌流程图、时序图等

### 🎨 视觉体验
- **自定义背景图** — 本地背景图，opacity 可调
- **平滑页面过渡** — Swup 驱动的页面切换动画
- **Fancybox 图片灯箱** — 点击图片放大查看

### 🔧 站点功能
- **友链系统** — JSON 文件管理，支持 `_order.json` 排序
- **写作统计** — 字数、阅读时间、年度发文图表
- **RSS / Sitemap** — 自动生成
- **分享按钮** — 一键复制文章链接
- **Cookie 同意** — 简化的隐私提示

---

## 🚀 快速开始

### 环境要求
- **Node.js** 18+
- **pnpm** 9+

### 安装与运行

```bash
git clone https://github.com/koitoyuu111/koitoyuu111.github.io.git
pnpm install
pnpm dev
```

---

## ⚙️ 常用命令

| 命令 | 说明 |
| :--- | :--- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建生产版本 |
| `pnpm preview` | 预览生产构建 |
| `pnpm new-post "标题"` | 创建新文章 |

---

## 📝 文章 Frontmatter

```yaml
---
title: 文章标题
published: 2025-01-01
description: 文章摘要
image: ./cover.jpg
tags: [技术, 教程]
draft: false
pinned: true          # 置顶
---
```

---

## 🌐 部署

通过 GitHub Actions 自动部署至 GitHub Pages，推送 `main` 分支即自动构建发布。

---

## 📄 许可证

本项目基于 [MIT License](./LICENSE) 开源，内容遵循 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 协议。

---

<div align="center">

**基于 [Fuwari](https://github.com/saicaca/fuwari) 魔改 | こいとゆう (koitoyuu)**

</div>
