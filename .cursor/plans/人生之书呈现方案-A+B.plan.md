---
name: 人生之书呈现方案
overview: 已选定 A+B：去掉位图，用主题 token + 排版表达「书」，并叠加极淡 CSS 渐变与内阴影纸感；保留 Swiper 结构。
todos:
  - id: decide-direction
    content: Confirm A-only vs A+B vs layout D (user/product choice)
    status: completed
  - id: strip-bitmaps
    content: Remove lifebook PNG + photo backgrounds; use theme text/borders + serif hierarchy
    status: completed
  - id: css-paper-gradient
    content: "Add very subtle light-mode gradient + inset highlight; dark-mode via tokens/dark: variants"
    status: completed
  - id: cleanup-assets
    content: Remove public/lifebook/*.png; refactor lifeBookArt.ts to export shared classes only (no image URLs)
    status: completed
  - id: toc-chronological-order
    content: Life Book uses oldest-first chapter order (generatedAt asc); keep getChapters() newest-first elsewhere or add order option
    status: completed
isProject: false
---

# 人生之书：已定方案 A + B（极淡渐变）

**已执行（代码已落地）**：`lifeBookArt` 改为 token + `lifeBookPageCard`；已删 `public/lifebook/*.png`；`getChapters({ order: 'asc' })` 用于 `App` 中人生之书；默认 `getChapters()` 仍为降序。

## 决策

采用 **A（应用主题 + 排版隐喻）** + **B（纯 CSS 极淡纸张渐变）**，**不再使用** `public/lifebook/*.png` 全幅贴图。

### A — 主题与排版

- 页面使用 `**var(--app-surface)`、`var(--app-border)`、`var(--app-text)`、`var(--app-muted)`**（见 `[src/index.css](src/index.css)`）。
- **封面**：可选竖向书脊（如 `border-l-4` + accent）；输入与引言层级用衬线/字重区分。
- **内页 / 目录 / 封底 / 结束页**：去掉金纸专用硬编码色（`lifeBookInk`、`lifeBookReadingPanel` 等）与重阴影。
- **文件**：`[src/components/lifebook/LifeBookCover.tsx](src/components/lifebook/LifeBookCover.tsx)`、`[LifeBookChapterSpread.tsx](src/components/lifebook/LifeBookChapterSpread.tsx)`、`[LifeBookTOC.tsx](src/components/lifebook/LifeBookTOC.tsx)`、`[LifeBookBackCover.tsx](src/components/lifebook/LifeBookBackCover.tsx)`、`[LifeBookEndPage.tsx](src/components/lifebook/LifeBookEndPage.tsx)`、`[LifeBookEmptyCover.tsx](src/components/lifebook/LifeBookEmptyCover.tsx)`。

### B — 极淡渐变（无照片）

- **浅色**：最外层书页卡片叠 **极淡** 线性渐变（如 amber/stone 低透明度），叠在 surface 上，实调以「几乎看不出但略暖」为准。
- **纸感**：`inset` 顶边高光（如 `inset 0 1px 0 rgba(255,255,255,0.5)`）+ 现有圆角。
- **暗色**：不用大块浅色渐变；用 **更轻的 inset** + surface 层级，或 `dark:` 下渐变近零透明度。

### `[src/lib/lifeBookArt.ts](src/lib/lifeBookArt.ts)`

- 移除图片 URL 与 `lifeBookBackgroundStyle`。
- 改为导出 **共用 class**（如 `lifeBookPageCard`：渐变 + inset + border + dark 变体）。

### 清理

- 删除 `[public/lifebook/](public/lifebook/)` 下 PNG。

### 目录与章节顺序（越早越前）

- **问题**：`[getChapters()](src/lib/chaptersStorage.ts)` 当前按 `generatedAt` **降序**（越新越前），人生之书目录 `[LifeBookTOC](src/components/lifebook/LifeBookTOC.tsx)` 与 Swiper 内章节页 `[LifeBookView](src/components/LifeBookView.tsx)` 沿用该顺序，表现为「新章节在目录最上」。
- **目标**：人生之书中 **越早生成的章节越排在最前**（时间正序），与「书从前往后阅读」一致。
- **注意**：`[ChapterNarrativeCard](src/components/ChapterNarrativeCard.tsx)` 用 `getChapters()` 展示「可查看章节」列表，通常仍希望 **最近优先**；不宜全局改 `getChapters()` 为升序。
- **建议实现**（任选其一，实施时二选一写清）：
  - 为 `getChapters` 增加可选参数，例如 `getChapters({ order: 'asc' | 'desc' })`，默认 `'desc'` 保持现有行为；`[App.tsx](src/App.tsx)` 传入 `lifeBookChapters` 时用 `order: 'asc'`，使目录、翻页、侧栏与 **同一次序** 的 `buildLifeBookPlainText` / `exportLifeBookToTxt` / `exportLifeBookToMd` / 复制全书一致。
  - 或新增 `getChaptersChronological()`（仅升序），仅在人生之书入口与导出使用；导出函数若接收 `chapters` 数组，需确保传入的已是升序数组。

## 验收

- 明暗主题对比度足够，不依赖重 `text-shadow`。
- 渐变克制，与全站 `--app-`* 一致。
- 小屏/桌面布局与滚动正常。
- 人生之书目录与正文翻页顺序为 **生成时间升序**；导出/复制全书顺序与之一致；时间聚合页章节列表仍为 **最近优先**（若仍用 `getChapters` 默认序）。

## 非本次范围

- C（SVG 装饰）、D（分栏阅读器）。

