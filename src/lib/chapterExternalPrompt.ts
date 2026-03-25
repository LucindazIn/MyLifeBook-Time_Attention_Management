import type { ScheduleEvent } from '@/types';
import {
  buildChapterPeriodDataBlocks,
  type ChapterPeriodContextOptions,
} from '@/lib/chapterContextFormat';

export interface ChapterPeriodExportMeta {
  periodStart: string;
  periodEnd: string;
  exportedAt: string;
}

export function buildChapterPeriodExportText(
  events: ScheduleEvent[],
  journalEntriesByDate: Record<string, string>,
  options: ChapterPeriodContextOptions & ChapterPeriodExportMeta
): string {
  const { periodLabel, periodStart, periodEnd, exportedAt, language = 'en' } = options;
  const langIsZh = language === 'zh';
  const blocks = buildChapterPeriodDataBlocks(events, journalEntriesByDate, options);

  const header = langIsZh
    ? `人生之书 — 章节周期导出\n周期：${periodLabel}\n日期范围：${periodStart} .. ${periodEnd}\n导出时间：${exportedAt}\n`
    : `My Life Book — Chapter Period Export\nPeriod: ${periodLabel}\nRange: ${periodStart} .. ${periodEnd}\nExported: ${exportedAt}\n`;

  const roleSection = langIsZh
    ? `=== Suggested Role (System Message) ===
你是一位「人生档案整理师」，擅长叙事结构。你会把用户本周期的事件与日记写成一段人生章节——不是时间线或条目清单。叙事是用户自己的故事：始终用第一人称「我/我们」书写；不要用第三人称指代用户（避免「他/她」「用户」「他们」）。
你不必扮演「分类员」或「平衡各栏目的编辑」：若材料里出现多种身份、标签或面向，让它们像真实生活一样自然交织；不要为了「雨露均沾」而机械分配篇幅。
`
    : `=== Suggested Role (System Message) ===
You are a "life archivist" skilled in narrative structure. You turn the user's events and journal for this period into one narrative chapter—not a timeline or bullet list. The story is the user's own: always write in first person ("I" / "we"). Never refer to the user in third person ("they", "the user", "he/she").
You are not a taxonomist or a spreadsheet editor: if several roles, tags, or facets appear, let them interleave the way life does—do not allocate space evenly or force one paragraph per label.
`;

  const taskSection = buildTaskSection(langIsZh, periodLabel, blocks.roleBlock);

  const periodDataHeader = langIsZh
    ? `=== Period Data ===

事件列表（含意义与高光/星标标注）：
${blocks.eventLines}

日记（按日期）：
${blocks.journalBlock}
${blocks.dailyContextBlock ? `\n\n${blocks.dailyContextBlock}` : ''}
`
    : `=== Period Data ===

Events (with meaning and highlight/starred when present):
${blocks.eventLines}

Journal (by date):
${blocks.journalBlock}
${blocks.dailyContextBlock ? `\n\n${blocks.dailyContextBlock}` : ''}
`;

  const tail = langIsZh
    ? `=== Expected Model Output (Two Parts) ===
(1) 一个 JSON 对象，内含章节名与章节内容两项（键名见 User Message；不要用 markdown 代码块包裹 JSON）。
(2) 在 JSON 结束后先空两行，再输出一句固定提示（纯文本，见 User Message）。
`
    : `=== Expected Model Output (Two Parts) ===
(1) One JSON object with chapter name and chapter content (key names in User Message; do not wrap the JSON in a markdown code block).
(2) After the JSON, leave two blank lines, then output one fixed reminder line (plain text, see User Message).
`;

  return `${header}\n${roleSection}\n${taskSection}\n${periodDataHeader}\n${tail}`.trim() + '\n';
}

function buildTaskSection(
  langIsZh: boolean,
  periodLabel: string,
  roleBlock: string
): string {
  if (langIsZh) {
    return `=== User Message — Task ===
下面给出用户在「${periodLabel}」期间的事件列表、日记与可选每日上下文。请完成下列任务。

${roleBlock ? roleBlock + '\n\n' : ''}任务：
1. 把握本周期里牵动情绪或反复出现的主题，把核心活动织进一段可读的人生叙事；不要逐条罗列事件表，也不要为了「身份/角色」而做机械分块。
2. 找出转折或高光；不要逐条罗列事件。标有 [高光] 的事件视为里程碑并在叙事中突出。
3. 若事件含「意义」字段，优先引用或编织进叙事作为锚点，尊重用户原话。
4. 若事件关联长期目标，可点出这些行动如何推进目标。若有每日上下文（当日名/标签或能量/情绪），可适度引用以增强连贯。
5. 结合日记感知情绪，使叙事有温度。
6. 拟定**唯一一个**章节名：可文学感、悬念感或总结感（用户可能会改）。
7. 章节内容的篇幅、人称与 Markdown 强调，须符合下方「输出结构」中 **章节内容** 一段。

约束：
- **章节内容**必须用第一人称；禁止用第三人称写用户。
- 禁止复述扁平事件列表；整体读起来要像「这一段的缩影」。
- 语气：中性偏鼓励；不夸大、不有毒积极。
- 禁止编造素材中没有的事实或细节。
- **语言**：**章节名**与**章节内容**须使用**简体中文**，与「人生之书」当前界面语言一致；即使下方 Period Data 中含英文片段，仍须用中文撰写。

输出结构（先理解内容，再按最后一项封装为 JSON）：

**章节名**
单行；长度不超过 60 个字符（按 JavaScript 字符串 .length 计数）。

**章节内容**
第一人称；长度不少于 500 个字符且不超过 2000 个字符（.length）；正文内可使用 Markdown：**双星号**包裹关键句；可选用 ==双等号== 表示高亮。

**封装为 JSON**：将上述「章节名」与「章节内容」合并为**一个** JSON 对象（单行或多行均可），**不要用 markdown 代码块包裹**。两个键名固定为英文字段名 chapterTitle 与 narrativeSummary（便于粘贴回人生之书），键名本身不必翻译。章节内容中若需出现英文双引号，在 JSON 字符串内须写成 \\"（反斜杠加双引号）转义，否则会导致用户粘贴后无法解析。

**固定提示行（在 JSON 之后）**：JSON 结束后，先连续输出**两个空行**（即两段换行之间留出两行空白），再单独一行输出下面这句话，**纯文本，不属于 JSON**，一字不差：
现在可以将上方内容复制回人生之书中保存本章。
`;
  }

  return `=== User Message — Task ===
Below are the user's events, journal, and optional daily context for "${periodLabel}". Complete the following tasks.

${roleBlock ? roleBlock + '\n\n' : ''}Tasks:
1. Find the emotional through-lines and recurring themes of this period, and weave the core activities into one readable story—do not mirror the event list, and do not carve the chapter into rigid blocks by role or identity.
2. Find turning points or highlights; do not list events one by one. Treat events marked [highlight] as milestones and emphasize them in the narrative.
3. When an event has a "meaning" field, quote or weave it into the narrative as anchor points—respect the user's words.
4. When events link to long-term goals, note how they advance those goals. When daily context (day name/tag or energy/mood) exists, you may cite it for coherence.
5. Read emotion from the journal and give the narrative warmth.
6. Propose exactly one chapter name (title): literary, suspenseful, or summative (the user may edit).
7. The chapter content must meet the length, person, and Markdown rules under **Chapter Content** in the output structure below.

Constraints:
- **Chapter Content** must be first person only; never third person for the user.
- Do not repeat a flat event list; the piece should read like "this period in a nutshell."
- Tone: neutral to encouraging. No exaggeration, no toxic positivity.
- Do not invent facts not present in the source material.
- **Language**: **Chapter Name** and **Chapter Content** must be in **English**, matching the My Life Book UI language for this export. Even if Period Data contains Chinese or other fragments, keep both in English.

Output structure (understand the content first, then wrap as JSON in the final step):

**Chapter Name**
One line; **at most 60 characters** (JavaScript string .length).

**Chapter Content**
First person; **at least 500 and at most 2000 characters** (.length); you may use **bold** and ==highlight== in the text.

**Wrap as JSON**: Combine the above **Chapter Name** and **Chapter Content** into **one** JSON object (single or multi-line). **Do not** wrap it in a markdown code block. Use the ASCII key names chapterTitle and narrativeSummary (for pasting back into My Life Book). The chapterTitle value corresponds to **Chapter Name**; narrativeSummary corresponds to **Chapter Content**. If the narrative must include a literal double-quote character, escape it as \\" (backslash then quote) inside the JSON string so pasting back parses correctly.

**Fixed reminder line (after the JSON)**: After the JSON, output **two blank lines** (two empty lines between the JSON and the next line), then on its own line output the following **plain text**, **not** part of JSON, **verbatim**:
You Can Now Copy The Above Into My Life Book To Save This Chapter.
`;
}

export function sanitizeChapterExportFilenameSegment(label: string): string {
  return label.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 80);
}
