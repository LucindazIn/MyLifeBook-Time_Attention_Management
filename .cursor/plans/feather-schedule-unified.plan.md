---
name: Feather-Schedule 布局与 i18n 统一
overview: 合并「2:1 布局 + Vibes 指标」与「顶部导航对齐」两份计划，并增加中英文界面/视图一致性检查与修复需求。
todos: []
isProject: false
---

# Feather Schedule：布局、导航与 i18n 统一计划

---

## 第一部分：充分利用全页界面规模（首要规则）

### 需求

- **最大化可视区域**：当前 `max-w-3xl mx-auto px-4` 的窄容器限制了桌面端内容密度，尤其日历/年视图格子太小、空白区域过多。
- **灵活响应式**：大屏充分利用宽度，小屏保持紧凑可读；关键信息（事件、标签、统计）可视密度提升。

### 调整方案

1. **外层容器放宽**
  - 桌面端（`lg`/`xl`）改用 `max-w-7xl` 或 `max-w-full px-6`；不再强制居中小容器。  
  - 当前 `max-w-3xl`（约 768px）→ 目标 `max-w-7xl`（约 1280px）或按断点：
    - `md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]`。
  - 保持移动端 `px-4` 的边距，防止贴边。
2. **月视图（CalendarView）**
  - 日历格子高度随可用宽度自适应，避免过度留白。  
  - 周平均统计卡片与日历在同一行或紧邻，不挤占格子高度。  
  - 考虑：侧边栏模式（日历左侧，统计右侧）或日历下方横向条形统计。
3. **年视图（YearView）**
  - 12 个月份卡片从当前 3 列（小）改为响应式 4/5/6 列：  
    - `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6`。
  - 每个 mini 月历高度放宽，避免挤压。  
  - 年度平均文案放在顶部通栏，宽度与下方网格对齐。
4. **日视图 2:1 布局**
  - 左栏（2/3）Timeline 高度随内容自适应，右栏（1/3）Sticky 定位（`sticky top-4`），滚动时右侧 widgets 保持可见。  
  - 大屏时 Day Vibes slider 可横向并排显示，减少纵向空间占用。
5. **header/footer**
  - 与主内容区宽度对齐，使用相同 `max-w-`* 断点，视觉上形成完整条带而非“中间一截”。  
  - 可考虑全宽 header + 内部居中对齐内容，或全宽保持一致。

### 涉及文件与修改点

- [src/App.tsx](src/App.tsx) 约 389 行外层容器：调整 `max-w-3xl` → 响应式 `max-w-7xl` 等。  
- [src/components/CalendarView.tsx](src/components/CalendarView.tsx)：日历格子自适应高度、周平均统计布局。  
- [src/components/YearView.tsx](src/components/YearView.tsx)：月份网格列数改为响应式 4/5/6 列。  
- [src/App.tsx](src/App.tsx) 日视图左右列：右列加 `sticky top-4`，左列宽度自适应。  
- 相关 CSS：检查 `min-h`、`h-`* 固定高度，改为 `min-h-*` 或 `h-auto` 避免溢出/留白。

---

## 第二部分：顶部导航对齐优化

### 问题诊断

当前 [src/App.tsx](src/App.tsx) 中 header 结构（约 416–478 行）：

- **左侧**：单行 `flex`（登录/退出 + 视图下拉 + 搜索 + 设置），高度一致。
- **右侧**：`flex-col` 多行堆叠：
  - 第一行：语言切换（带 `mb-2`）
  - 第二行：日期导航（上一页 / 今天·日期 / 下一页）
  - 第三行（条件）：月/年视图的标签筛选 chips

导致现象：桌面端左侧是“一条线”，右侧是“一竖条”，整体不对齐、视觉重心不稳，且语言切换单独一行显得突兀。

### 调整方案

1. **桌面端单行布局（md 及以上）**
  - 将右侧由 `flex flex-col items-end gap-2` 改为单行：`flex flex-row items-center gap-4 flex-wrap`，使「语言切换 + 日期导航 + 标签 chips」在同一行。  
  - 去掉语言切换外包层的 `mb-2`，统一用同一套 gap。  
  - 标签 chips 可用 `flex-wrap` 或 `overflow-x-auto`，保证至少「语言 + 日期导航」始终同一行。
2. **统一垂直对齐与高度**
  - header 保持 `items-center`。  
  - 移除“今天”链接上的 `mb-1`（约 451 行），用统一 padding/line-height 控制对齐。
3. **移动端**
  - 保持 `flex-col`，顺序：先左侧组，再右侧组；右侧组内可为纵向或横向紧凑，保证触摸目标足够大。
4. **可选**
  - header 设 `min-h-14` 并保持 `items-center`，使左右高度一致。

### 涉及文件与修改点

- [src/App.tsx](src/App.tsx) 约 452–477 行：右侧容器改为桌面端单行 `flex-row items-center`，去掉语言行 `mb-2`，统一 gap。  
- [src/App.tsx](src/App.tsx) 约 449 行：“今天”按钮去掉 `mb-1`。  
- [src/App.tsx](src/App.tsx) 约 416 行：可选增加 `min-h-14`。

---

## 第三部分：中英文界面与视图一致性（i18n 检查）

### 需求

- **选中文时**：界面和各视图内不得出现英文文案（系统/品牌名如 “Feather Schedule” 可保留，或改为「羽程」等统一品牌译名）。
- **选英文时**：界面和各视图内不得出现中文文案。

### 检查范围

- **全局与导航**：[src/App.tsx](src/App.tsx) — 顶部 header（登录/退出、视图切换、今天、同步失败、正在同步等）、footer、错误/提示条。
- **弹窗与表单**：AuthModal、SettingsModal、OnboardingModal、AddEventModal、SearchModal、ScheduleSuggestionModal — 所有按钮、标签、placeholder、错误信息、说明文字。
- **日视图**：DayHeader（日期、日名、标签）、Timeline、Add Event 按钮、Day Vibes 卡片标题与 slider 标签、SurpriseWidgets（Quote/Visual/Song 等）、DailyJournal 标题与 snippet。
- **月视图**：CalendarView — 星期标题、月份标题、周平均能量等统计文案、空状态、tooltip。
- **年视图**：YearView — 月份名、年度平均文案、月度状态 tooltip、空状态。
- **其他组件**：Chatbot、CalendarView 单元格内 dayTag 展示、导出/导入、设置项标签与描述。

### 实施方式

1. **清单化**：按组件/页面列出所有面向用户的字符串，标注当前是否随 `settings.language` 切换；未切换的记为待修复。
2. **统一模式**：所有 UI 文案通过 `settings.language === 'zh'` 分支或统一文案表（如 `uiStrings[language].xxx`）输出，避免硬编码单语。
3. **回归检查**：切换语言后逐页、逐弹窗检查，确保无漏网之鱼；特别关注错误信息、placeholder、tooltip、fallback 文案。
4. **品牌与第三方**：若保留 “Feather Schedule”“Crafted with Gemini” 等，在中文模式下可考虑统一译为「羽程日程」「由 Gemini 驱动」等，或保留英文并在计划中注明例外。

### 涉及文件（需逐文件扫字符串）

- [src/App.tsx](src/App.tsx)
- [src/components/AuthModal.tsx](src/components/AuthModal.tsx)
- [src/components/SettingsModal.tsx](src/components/SettingsModal.tsx)
- [src/components/OnboardingModal.tsx](src/components/OnboardingModal.tsx)
- [src/components/AddEventModal.tsx](src/components/AddEventModal.tsx)
- [src/components/SearchModal.tsx](src/components/SearchModal.tsx)
- [src/components/ScheduleSuggestionModal.tsx](src/components/ScheduleSuggestionModal.tsx)
- [src/components/DayHeader.tsx](src/components/DayHeader.tsx)
- [src/components/Timeline.tsx](src/components/Timeline.tsx)
- [src/components/SurpriseWidgets.tsx](src/components/SurpriseWidgets.tsx)
- [src/components/DailyJournal.tsx](src/components/DailyJournal.tsx)
- [src/components/CalendarView.tsx](src/components/CalendarView.tsx)
- [src/components/YearView.tsx](src/components/YearView.tsx)
- [src/components/Chatbot.tsx](src/components/Chatbot.tsx)
- 以及其余包含用户可见文案的组件与 lib（如 day name 生成、导出文件名等）。

---

## 第四部分：2:1 布局与 Vibes 指标

### 目标与约束

- **左右布局**：采用 2:1 比例（左 2/3：DayHeader + Add + Timeline；右 1/3：Day Vibes + Quote/Visual/Song + Daily Journal）。
- **情绪/能量指标**：
  - 每日记录 3 个数值：能量值、心情、专注度（0–100）。
  - 在 **月视图** 显示按周聚合的平均值（by week），在 **年视图** 显示按月聚合的平均值（by month）。
  - 年度（by year）先不做单独视图，只在 YearView 顶部预留一个轻量总览区域，未来再细化。

### 一、数据层设计（最小增量，扩展 day_meta）

- 在 Supabase 的 `day_meta` 表中，为每个日期增加 3 个可选字段：
  - `energy_level smallint null`  (0–100)
  - `mood_level smallint null`
  - `focus_level smallint null`
- 对应前端类型（`DayMeta` 派生）只在 repo 层解析：`dayMeta[dateKey].energy/mood/focus?: number`。
- 现有 `listAllDayMeta()` / `upsertDayMeta()` 扩展字段即可，不新增表。

### 二、日视图：右栏 Day Vibes + 左栏 2:1 布局

**布局（App.tsx）**

- 在 day 视图渲染处，用 2:1 网格把主区域拆成左右两列：
  - 外层容器：`className="mt-6 grid gap-6 md:grid-cols-3"`
  - 左列：`className="md:col-span-2 space-y-6"`（DayHeader + Add Event + Timeline）
  - 右列：`className="md:col-span-1 space-y-4"`（Day Vibes + SurpriseWidgets + DailyJournal）

**Day Vibes 卡片（右栏顶部）**

- 标题：`Today’s Vibes / 今天的状态`；三个 slider：Energy / Mood / Focus；语义标注：Energy 😴↔⚡，Mood 😔↔🙂，Focus 🌫️↔🎯。
- 从 `day_meta` 读当天值初始化；拖动时更新本地 state，`onChangeEnd` 或 `onBlur` 时写回 `upsertDayMeta()`。

### 三、月视图：by week 平均值（CalendarView）

- 前端按当前月日期从 `dayMeta` 取 energy/mood/focus，按周分组求平均；无记录的周可不显示或灰显。
- 在 [src/components/CalendarView.tsx](src/components/CalendarView.tsx) 维持原有格子布局，在月视图下方加小卡片（方案 B）：如「本月周平均能量：W1 60 / W2 75 / ...」，文案随 `settings.language` 中英切换。

### 四、年视图：by month 平均值（YearView）

- 按月份聚合当月有记录日子的 average energy/mood/focus。
- 在 [src/components/YearView.tsx](src/components/YearView.tsx) 的 month 卡片右上角或标题下加小圆点/小条（0–40 灰、40–70 橙、70–100 绿），hover tooltip 如 `Avg energy: 72/100` 或 `72E/65M/80F`；tooltip 文案随语言。
- YearView 顶部预留年度平均文案：zh `2026 年平均能量：68/100`，en `Yearly avg energy: 68/100`。

### 五、Journal & snippets & keywords

- Daily Journal 右栏底部，标题「今日回顾 / Today’s Reflection」；snippet 按钮中英文各一套。
- Event snippets 保留在 AddEventModal 内。
- 今日关键词放在 DayHeader 右侧 #chip，点击追加到 day_tag 或事件 tags。

### 六、执行顺序建议

1. 数据层：扩展 `day_meta`（3 个 level 字段），更新 dayMetaRepo。
2. 日视图布局：App.tsx `md:grid-cols-3`，左/右列 + Day Vibes 卡片。
3. 月视图：CalendarView 按周聚合 + 月度统计小卡片。
4. 年视图：YearView 每月平均值 + 月卡片标记 + 年度平均文案。
5. Journal snippets 与 DayHeader 关键词 chips。

---

## 第五部分：周章节叙事 AI（人生档案整理师）

产品底层逻辑：将用户过去一周的「事件列表」与「日记」提炼为**叙事章节**，由 AI 扮演「人生档案整理师」，输出章节名备选、叙事摘要与反思引导。实现入口：`src/lib/gemini.ts` 中的 `generateWeeklyChapter`。

### Role（角色）

你是一位深谙叙事结构的「人生档案整理师」。你的任务是根据用户过去一周的「事件列表」和「日记」，提炼出这一周的**叙事章节**，而非罗列流水账。

### Task（任务）

1. **数据聚类**：识别用户本周的核心活动，并按用户设置的「角色标签」（如创作者、健身者等）进行归类；若用户未设置角色标签，则按事件 tags / type / label 做合理聚类。
2. **叙事提炼**：寻找这一周的「转折点」或「高光时刻」，用一条主线串联；严禁逐条复述事件流水账。
3. **情绪感知**：从用户的日记中捕捉情绪倾向，给叙事赋予温度，而非冷冰冰的报告。
4. **引导生成**：给出 3 个备选的「章节标题」，风格要求：文学感、悬念感或总结性，供用户选择。

### Output Format（结构化输出）

- **本周章节名**：AI 提供 3 个方案，供用户选择或作为默认标题。
- **叙事摘要**：200–300 字，包含：这段时间的**主旋律**、**关键成就**（1–3 点）、**角色的平衡点**（多角色/多主题间的取舍或融合）。
- **叙事反思引导**：根据本周数据生成 2 个深度反思题，例如：「如果本周是电影，这个转折点意味着什么？」

### Constraint（约束）

- **严禁**重复事件流水账；叙事须为提炼与整合后的「这一周的缩影」。
- AI 叙事**中性偏激励**：不夸大、不毒鸡汤，确保用户觉得「这就是我这一周的缩影」。
- **严禁**过度修饰或虚构未在事件/日记中出现的内容。

### 实现说明

- 输入：本周 `ScheduleEvent[]`、本周各天 `journal`（`Record<dateKey, string>`）、语言、可选 `roleTags?: string[]`。
- 输出类型：`{ chapterTitles: [string, string, string]; narrativeSummary: string; reflectionQuestions: [string, string] }`。
- 与现有 `generateDayName`、`generateDailySummary` 同属叙事向 AI，tone 保持一致（文学感 + 反思），周维度禁止流水账并增加转折点/主旋律/反思题。

---

## 执行顺序总览

1. **首要规则**：**全页界面规模（第一部分）**，放宽容器、优化各视图密度。此规则优先于所有其他 UI 设计决策。
2. **优先**：顶部导航对齐（第二部分），快速改善首屏观感。
3. **并行**：中英文一致性检查与修复（第三部分），避免新功能继续引入单语文案。
4. **功能**：2:1 布局 + Day Vibes + 月/年视图 Vibes 展示（第四部分），在更宽的布局上落地。


