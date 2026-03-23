---
name: 章节叙事 Prompt 与输出格式升级
overview: 将章节生成 prompt 升级为「人生传记编剧」结构化模板，输出改为单标题 + 叙事阶段 + 一致性说明 + 反馈请求；增加叙事偏好设置；导出 TXT 仅含标题与摘要。
todos: []
isProject: false
---

# 章节叙事 Prompt 与输出格式升级

## 一、目标

- 用「人生传记编剧」结构化 prompt（Role / Input Context / Narrative Goals / Style / Processing Steps / Output / Constraint）替换当前简单任务/约束式 prompt。
- 输出格式从「3 标题 + 摘要 + 2 反思问题」改为「单标题 + 摘要 + 叙事阶段 + 一致性说明 + 可选反馈请求」。
- 增加叙事偏好设置（语调、忌讳词、核心价值、Persona），并写入 prompt 的 Style Guidelines / User Persona。
- **导出 TXT**：正文中**仅顺序输出「标题」「摘要」**，不导出叙事阶段、一致性说明、反馈请求。

---

## 二、Prompt 结构（按你提供的模板优化）

### Role

你是一位极具洞察力的「人生传记编剧」。你的核心任务是将用户离散的日程数据、角色标签和情绪反馈，重构为一段连贯、深刻且具有成长弧光的第一人称人生叙事。

### Input Context（数据映射）

| 占位 | 数据来源 | 说明 |
|------|----------|------|
| Role Tags | `options.roleTags` | 已有，直接注入。 |
| Event Data | `eventLines` + `journalBlock` + `dailyContextBlock` | 保持现有 formatEventForChapter（含意义/高光/星标/角色/长期目标）+ 日记 + 每日上下文。 |
| Long-term Goals | 从本周期 `events` 聚合 `longTermGoals` 去重 | 在 generateChapter 内计算后注入。 |
| User Persona | `options.narrativePersona`（来自设置） | 未设置时写「未设置，请使用中性第一人称」。 |

### Narrative Goals

1. **第一人称叙事**：必须使用「我」或「我们」视角，严禁出现「用户」「你」等第三人称代词。
2. **从事实中升华**：不写流水账。将具体「任务」转化为「人生隐喻」（如：作为守门人的坚守、作为家庭支柱的付出）。
3. **动态叙事阶段识别**：根据事件密度和角色变化，自动判断并标记当前处于「蛰伏期」「爆发期」或「转型期」。
4. **一致性与伏笔**：在总结中体现当前行为与长期目标的联系，并留下指向下一章节的隐喻性伏笔。

### Style Guidelines（由设置注入，未设置则省略或写「未设置」）

- Tone: `narrativeTone`（如：硬核且反思、极简且客观）
- Taboos: `narrativeTaboos`（用户不希望看到的表达或套路）
- Values: `narrativeCoreValues`（用户最看重的维度，如：自我进化、家人陪伴）

### Processing Steps (Chain of Thought)

1. **分析**：对比本期数据与上一期的语义重心（Semantic Drift），识别当前的叙事阶段。（若传入 `previousPeriodEventSummary` 则写入上一期摘要供对比）
2. **提炼**：寻找本期数据中的「意义峰值」事件，将其作为叙事高潮。
3. **映射**：将日常琐事通过 User Persona 映射为价值观表达。
4. **撰写**：以「我」的视角，完成一篇 500–2000 字的叙事摘要。

### Output Format (JSON)

```json
{
  "chapterTitle": "一个有文学感的章节标题",
  "narrativeSummary": "第一人称叙事正文，全程使用「我」；可用 **粗体** 与 ==高亮== 标记关键句",
  "narrativePhase": "蛰伏期 | 爆发期 | 转型期",
  "coherenceNote": "当前行为如何呼应长期目标，以及对未来的伏笔",
  "feedbackRequest": "（可选）一句简短的自我评价或反思"
}
```

### Constraint

- 必须基于真实数据，不得虚构未发生的事实。
- 若用户本期情感反馈包含负面情绪，请将其转化为「认知升级的契机」，而非单纯的心理慰藉。

---

## 三、类型与输出格式变更

### 3.1 新输出类型

**文件**：[src/lib/gemini.ts](src/lib/gemini.ts)

- `WeeklyChapterOutput` 改为：
  - `chapterTitle: string`
  - `narrativeSummary: string`
  - `narrativePhase: string`
  - `coherenceNote: string`
  - `feedbackRequest?: string`
- 删除：`chapterTitles`、`reflectionQuestions`。

### 3.2 生成选项扩展

**文件**：[src/lib/gemini.ts](src/lib/gemini.ts)

- `GenerateChapterOptions` 增加可选：
  - `narrativePersona?: string`
  - `narrativeTone?: string`
  - `narrativeTaboos?: string[]` 或逗号分隔字符串
  - `narrativeCoreValues?: string[]` 或逗号分隔字符串
  - `previousPeriodEventSummary?: string`（用于「对比本期与上一期」）

### 3.3 存储与旧数据兼容

**文件**：[src/lib/chaptersStorage.ts](src/lib/chaptersStorage.ts)

- `SavedChapter` 继承新 `WeeklyChapterOutput`，保留 `id`、`periodKey`、`periodLabel`、`generatedAt`；删除 `selectedTitleIndex`。
- **旧数据兼容**：读取时若存在 `chapterTitles` 或 `reflectionQuestions`，映射为：`chapterTitle = chapterTitles[selectedTitleIndex ?? 0] ?? chapterTitles[0]`，`narrativePhase = ''`，`coherenceNote = ''`，`feedbackRequest = reflectionQuestions?.[0] ?? ''`；返回时使用新形状（可选：不写回 localStorage，仅内存兼容）。

### 3.4 导出 TXT（按需求调整）

**文件**：[src/lib/chaptersStorage.ts](src/lib/chaptersStorage.ts)

- **正文内容仅两项、顺序固定**：
  1. **标题**（`chapterTitle`）
  2. **摘要**（`narrativeSummary`，经 `stripSummaryMarkdown` 去 Markdown）
- **不导出**：叙事阶段、一致性说明、反馈请求。这些字段仅在应用内展示与编辑，不写入 TXT 文件。
- `updateChapter` 的 patch 类型改为新字段集合（含 `chapterTitle`、`narrativePhase`、`coherenceNote`、`feedbackRequest`）。

---

## 四、叙事偏好设置（本期实现）

### 4.1 类型

**文件**：[src/types.ts](src/types.ts)

- `AppSettings` 增加可选：
  - `narrativeTone?: string`
  - `narrativeTaboos?: string[]`
  - `narrativeCoreValues?: string[]`
  - `narrativePersona?: string`
- 保证旧设置 JSON 无这些字段时仍可解析。

### 4.2 设置 UI

**文件**：[src/components/SettingsModal.tsx](src/components/SettingsModal.tsx)

- 新增区块「章节叙事偏好」/「Chapter narrative preferences」：
  - **叙事语调**：单行或短文本，placeholder 如「硬核且反思、极简且客观」
  - **忌讳表达**：多标签或逗号分隔，placeholder 如「不希望出现的词或套路」
  - **核心价值**：多标签或逗号分隔，placeholder 如「自我进化、家人陪伴」
  - **Persona / 风格一句话**：单行可选，placeholder 如「语调与价值观偏好（可选）」
- 通过 `onUpdateSettings({ ...settings, narrativeTone, narrativeTaboos, narrativeCoreValues, narrativePersona })` 持久化。

### 4.3 数据流

- App 将 `settings`（或叙事相关字段）传给 `CollectionView`。
- `CollectionView` 传给 `ChapterNarrativeCard`。
- `ChapterNarrativeCard` 在 `handleGenerate` 中把上述字段与 `periodLabel`、`roleTags`、`dayMetaInPeriod` 等传入 `generateChapter`。

---

## 五、上一期摘要（可选）

- 在 `ChapterNarrativeCard` 中，对 `previousPeriodEvents` 做简单统计（条数、角色分布、出现的 longTermGoals），拼成 2–3 句文字作为 `previousPeriodEventSummary` 传入 `generateChapter`，供 Processing Step 1「对比本期与上一期」使用。

---

## 六、前端 UI 调整

### 6.1 ChapterViewModal

**文件**：[src/components/ChapterViewModal.tsx](src/components/ChapterViewModal.tsx)

- 展示与编辑：**单标题**、叙事摘要、**叙事阶段**、**一致性说明**、**反馈请求**（可选）。
- 删除：三选一标题、两个反思问题的展示与编辑。
- 编辑态字段：`editTitle`、`editSummary`、`editPhase`、`editCoherenceNote`、`editFeedbackRequest`；保存时 `updateChapter` 传入新字段。

### 6.2 ChapterNarrativeCard

**文件**：[src/components/ChapterNarrativeCard.tsx](src/components/ChapterNarrativeCard.tsx)

- 接收叙事偏好（或从 settings 解构），传入 `generateChapter`。
- 保存对象使用新结构：`chapterTitle`、`narrativePhase`、`coherenceNote`、`feedbackRequest`。
- 可选：生成 `previousPeriodEventSummary` 并传入 `generateChapter`。

### 6.3 CollectionView 与 App

**文件**：[src/components/CollectionView.tsx](src/components/CollectionView.tsx)、[src/App.tsx](src/App.tsx)

- `CollectionView` 增加 props：叙事偏好相关（或整体 `settings`）。
- App 渲染 `CollectionView` 时传入 `settings` 或叙事相关字段。

---

## 七、实现顺序

1. **类型与存储**：改 `WeeklyChapterOutput`、`SavedChapter`，旧数据兼容，`updateChapter` / `exportChapterToTxt` 适配（**导出仅标题+摘要**）。
2. **设置**：`AppSettings` 扩展 + SettingsModal 叙事偏好区块。
3. **数据流**：App → CollectionView → ChapterNarrativeCard 传递叙事偏好；ChapterNarrativeCard 聚合 longTermGoals、可选生成 previousPeriodEventSummary。
4. **Prompt**：在 `generateChapter` 中重写为完整 Role / Input / Narrative Goals / Style / Processing Steps / Output / Constraint，解析新 JSON。
5. **Modal 与卡片**：ChapterViewModal 单标题 + 阶段 + 一致性 + 反馈请求；ChapterNarrativeCard 保存与打开逻辑改用新字段。

---

## 八、涉及文件汇总

| 文件 | 变更要点 |
|------|----------|
| [src/types.ts](src/types.ts) | AppSettings 增加 narrativeTone, narrativeTaboos, narrativeCoreValues, narrativePersona |
| [src/lib/gemini.ts](src/lib/gemini.ts) | WeeklyChapterOutput 新形状；GenerateChapterOptions 新选项；prompt 全文替换；解析新 JSON |
| [src/lib/chaptersStorage.ts](src/lib/chaptersStorage.ts) | SavedChapter 新形状；旧数据兼容；updateChapter 新字段；**exportChapterToTxt 仅输出标题+摘要** |
| [src/components/SettingsModal.tsx](src/components/SettingsModal.tsx) | 新增「章节叙事偏好」区块 |
| [src/components/ChapterViewModal.tsx](src/components/ChapterViewModal.tsx) | 单标题 + 阶段 + 一致性 + 反馈请求的展示与编辑 |
| [src/components/ChapterNarrativeCard.tsx](src/components/ChapterNarrativeCard.tsx) | 叙事偏好入参；保存新形状；可选 previousPeriodEventSummary |
| [src/components/CollectionView.tsx](src/components/CollectionView.tsx) | 接收叙事偏好并传给 ChapterNarrativeCard |
| [src/App.tsx](src/App.tsx) | 将 settings 或叙事字段传给 CollectionView |
