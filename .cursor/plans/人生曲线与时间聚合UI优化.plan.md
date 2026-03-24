---
name: 人生曲线与时间聚合 UI 优化
overview: 人生曲线卡片小标题与占比展示、全时间段起始日与长期目标弹层布局稳定；时间聚合改名为 Time Synthesis 并统一英文首字母大写；Year/Month 视图标题下增加 3 个 KPI 年均/月均副标题。
todos: []
isProject: false
---

# 人生曲线与时间聚合 · 实现与 UI 优化

---

## 一、人生曲线卡片（RoleBalanceCard）调整

### 1.1 小标题修改

**文件**: [src/components/RoleBalanceCard.tsx](src/components/RoleBalanceCard.tsx)

- 图 1 小标题：改为 **「生命能量（按角色分类）」**（英文 "Life Energy (By Role)"）。
- 图 2 小标题：改为 **「生命能量（按目标分类）」**（英文 "Life Energy (By Goal)"）。

### 1.2 去掉图上方各 tag 占比趋势

- 删除两张图**上方**的「各 tag 对应占比趋势」区块（`roleTrend.size > 0` / `goalTrend.size > 0` 时渲染的「角色名 +Δ%」「目标名 +Δ%」）。
- 保留图下方的图例（角色/目标色块 + 生命能量线说明）。

### 1.3 拖拽语义

- 保持现状：仅总生命能量可拖拽，两张图共用同一套按日能量；各 tag 为占比展示，不提供单独可调点。如需可在图例旁加一句说明。

### 1.4 全时间段起始日

- **全时间段**起始日 = 用户**第一次有「带 role 或 longTermGoals」的事件**的日期。
- 计算：仅考虑 `e.role != null && e.role !== ''` 或 `(e.longTermGoals?.length ?? 0) > 0` 的事件，取其 `startTime` 的最小日期的 0 点；若无则 `earliestEventDate = null`，fallback 沿用现有（如 `subDays(now, 365)`）。

### 1.5 长期目标卡片布局稳定

- 点击长期目标卡片内任意 tag 时，原页面卡片不要发生位移。
- **对策**：在 [LongTermGoalsCard.tsx](src/components/LongTermGoalsCard.tsx) 中使用 **React Portal**（`createPortal`）将 `LongTermGoalDetailModal` 挂载到 `document.body`，使弹层脱离卡片 DOM，避免布局重排。
- 若全局存在 body scroll lock，可增加 `scrollbar-gutter: stable` 等防止滚动条消失导致位移。

---

## 二、UI 优化：Time Synthesis 命名与英文首字母大写

### 2.1 时间聚合页面改名与副标题

**文件**: [src/App.tsx](src/App.tsx)

- 将「Moment Ultra」改为 **「Time Synthesis」**（所有出现处：导航项 label、view 切换时的 title、按钮 title 等，见约 567、759、793、1102–1104、1068 行）。
- 在时间聚合页面**居中主标题**下增加副标题（仅英文时显示）：**「timeline weaving, crafting narrations」**（小写保持，作为副标题风格）。中文保持「时间聚合」不变，副标题可省略或使用「时间线编织，书写叙事」等。

### 2.2 时间聚合页内英文 Capitalizing Initial

在**时间聚合（Collection）页面**内，所有英文文案统一为首字母大写（Title Case）。涉及组件与示例：


| 位置                                                              | 当前英文                                                                                                                                                                   | 改为                                                                                                                                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [RoleBalanceCard](src/components/RoleBalanceCard.tsx)           | Life curve, Life energy, By role, By goal, Export PNG, Add to Life Book, This month, Last 3 months, All time, No events…, Life Energy (By Role), Life Energy (By Goal) | Life Curve, Life Energy, By Role, By Goal, Export PNG, Add to Life Book, This Month, Last 3 Months, All Time, No Events…, Life Energy (By Role), Life Energy (By Goal) |
| [StatsSummaryView](src/components/StatsSummaryView.tsx)         | Overview, This week, Long-term goals, Days with tags, Tags used, Top tags                                                                                              | Overview, This Week, Long-Term Goals, Days With Tags, Tags Used, Top Tags                                                                                              |
| [LongTermGoalsCard](src/components/LongTermGoalsCard.tsx)       | Long-term goals, No long-term goals yet…                                                                                                                               | Long-Term Goals, No Long-Term Goals Yet…                                                                                                                               |
| [RoleEnergyCard](src/components/RoleEnergyCard.tsx)             | 若有英文标签                                                                                                                                                                 | 首字母大写                                                                                                                                                                  |
| [EventVolumeCard](src/components/EventVolumeCard.tsx)           | 若有英文标签                                                                                                                                                                 | 首字母大写                                                                                                                                                                  |
| [ChapterNarrativeCard](src/components/ChapterNarrativeCard.tsx) | 若在 Collection 内展示且有英文                                                                                                                                                  | 首字母大写                                                                                                                                                                  |


- 实现：在上述组件的 `language === 'en'` 分支中，将展示给用户的英文字符串改为 Title Case（每个单词首字母大写，介词/冠词可按风格保留小写如 "to", "the" 或统一大写）。注意仅改**时间聚合页内**展示的文案；若某组件也在 Day 视图等复用，可仅当来自 Collection 时应用 Title Case，或全局统一英文 Title Case（需与产品一致）。

---

## 三、UI 优化：Year / Month 视图 KPI 副标题

### 3.1 数据来源

- 3 个 KPI：**Energy（能量）、Mood（心情）、Focus（专注）**，与 [YearView](src/components/YearView.tsx) / [CalendarView](src/components/CalendarView.tsx) 中已有 `dayVibes`（或 App 中的 `dayVibesData`）一致，数值为 0–100。
- 年均：该年所有日期的 `dayVibes` 中 energy/mood/focus 的非空值求平均，保留整数。
- 月均：该月所有日期的 `dayVibes` 中 energy/mood/focus 的非空值求平均，保留整数。

### 3.2 Year View：年份下增加 3 个 KPI 年均

**位置**: [src/App.tsx](src/App.tsx) 中 Row 2 的 header（约 1098–1107 行），当前为 `viewMode !== 'day'` 时显示居中标题（年份/月份/时间聚合）。

- 当 `viewMode === 'year'` 时：
  - 主标题：保持现有 `leftDateTitle`（即年份，如 "2025" 或 "2025年"）。
  - 副标题：在年份**下方**新增一行，横向、居中，展示 3 个 KPI 的**年平均值**：Energy ⚡ XX · Mood 🙂 XX · Focus 🎯 XX（无数据时显示 "-" 或省略该指标）。格式与 [YearView](src/components/YearView.tsx) 中 METRICS（labelEn/labelZh、icon）一致。
- 年均计算：在 App 中根据 `currentDate` 的年份 + `dayVibesData`，筛选该年所有 dateKey，对 energy/mood/focus 分别求平均（只计有值的日期）；可抽成小函数或内联。

### 3.3 Month View：月份下增加 3 个 KPI 月均

**位置**: 同上，Row 2 header。

- 当 `viewMode === 'month'` 时：
  - 主标题：保持现有 `leftDateTitle`（即月份，如 "2025年 3月" 或 "March 2025"）。
  - 副标题：在月份**下方**新增一行，横向、居中，展示 3 个 KPI 的**月平均值**：Energy ⚡ XX · Mood 🙂 XX · Focus 🎯 XX（无数据时显示 "-" 或省略）。

### 3.4 实现要点

- 在 App 中为 `viewMode === 'year'` 和 `viewMode === 'month'` 分别计算 `yearKpiAvg` 和 `monthKpiAvg`（结构如 `{ energy: number | null, mood: number | null, focus: number | null }`），传入或直接在 header 区块内使用 `dayVibesData` 与 `currentDate` 计算。
- 副标题样式：略小字号、`text-muted` 或 `var(--app-muted)`，与主标题间距适中，横排、居中（flex justify-center gap-x-4 或类似），与 YearView 内月份卡片上的 KPI 展示风格可一致（图标 + 数值）。

---

## 四、涉及文件汇总


| 文件                                                                           | 变更                                                                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [src/components/RoleBalanceCard.tsx](src/components/RoleBalanceCard.tsx)     | 小标题「生命能量（按角色/目标分类）」；移除图上方 tag 占比趋势；`earliestEventDate` 改为“首次带 role 或 longTermGoals 的事件”的最小日期。                            |
| [src/components/LongTermGoalsCard.tsx](src/components/LongTermGoalsCard.tsx) | 使用 `createPortal` 将 LongTermGoalDetailModal 挂载到 `document.body`。                                                         |
| [src/App.tsx](src/App.tsx)                                                   | Moment Ultra → Time Synthesis；时间聚合页副标题 "timeline weaving, crafting narrations"；Year/Month 视图主标题下增加 3 KPI 年均/月均副标题（居中横排）。 |
| [src/components/StatsSummaryView.tsx](src/components/StatsSummaryView.tsx)   | 时间聚合页英文文案 Title Case（如 Long-Term Goals, This Week, Overview）。                                                            |
| [src/components/LongTermGoalsCard.tsx](src/components/LongTermGoalsCard.tsx) | 英文 Long-Term Goals 等 Title Case。                                                                                         |
| 其他 Collection 子组件                                                            | 若有英文展示，统一首字母大写（见上表）。                                                                                                     |


