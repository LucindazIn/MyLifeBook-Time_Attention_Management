import type { ScheduleEvent } from '@/types';

/** Same shape as former `GenerateChapterOptions` in gemini (period narrative context). */
export interface ChapterPeriodContextOptions {
  language?: string;
  roleTags?: string[];
  periodLabel: string;
  dayNamesInPeriod?: Record<string, { name: string; isManual: boolean }>;
  dayTagsInPeriod?: Record<string, string>;
  dayVibesInPeriod?: Record<string, { energy?: number; mood?: number; focus?: number }>;
}

export function formatEventForChapter(e: ScheduleEvent, langIsZh: boolean): string {
  const tags = e.tags?.length ? ` [${e.tags.join(', ')}]` : '';
  const label = e.label?.text ? ` (${e.label.text})` : '';
  const meaning = e.meaning?.trim()
    ? ` | ${langIsZh ? '意义' : 'meaning'}: ${e.meaning.trim()}`
    : '';
  const badges: string[] = [];
  if (e.highlight) badges.push(langIsZh ? '高光' : 'highlight');
  if (e.starred) badges.push(langIsZh ? '星标' : 'starred');
  const badge = badges.length ? ` [${badges.join(',')}]` : '';
  const role = e.role?.trim()
    ? ` | ${langIsZh ? '角色' : 'role'}: ${e.role.trim()}`
    : '';
  const goals =
    e.longTermGoals?.length && e.longTermGoals.some((g) => g?.trim())
      ? ` | ${langIsZh ? '长期目标' : 'long-term goals'}: ${e.longTermGoals.filter((g) => g?.trim()).join(', ')}`
      : '';
  return `- ${e.title}${label}${tags}${badge} @ ${e.startTime} ${e.completed ? '✓' : ''}${meaning}${role}${goals}`;
}

export interface ChapterPeriodDataBlocks {
  eventLines: string;
  journalBlock: string;
  dailyContextBlock: string;
  roleBlock: string;
}

export function buildChapterPeriodDataBlocks(
  events: ScheduleEvent[],
  journalEntriesByDate: Record<string, string>,
  options: ChapterPeriodContextOptions
): ChapterPeriodDataBlocks {
  const language = options.language ?? 'en';
  const langIsZh = language === 'zh';
  const { roleTags, dayNamesInPeriod, dayTagsInPeriod, dayVibesInPeriod } = options;

  const eventLines = events.length
    ? events.map((e) => formatEventForChapter(e, langIsZh)).join('\n')
    : langIsZh
      ? '（本周期暂无事件）'
      : '(No events in this period)';

  const journalLines = Object.entries(journalEntriesByDate)
    .filter(([, text]) => text?.trim())
    .map(([date, text]) => `[${date}]: ${text.trim()}`)
    .join('\n\n');
  const journalBlock = journalLines
    ? journalLines
    : langIsZh
      ? '（本周期暂无日记）'
      : '(No journal entries in this period)';

  const roleBlock: string =
    roleTags?.length
      ? langIsZh
        ? `用户在应用里为这段时间标记了若干生活面向（角色标签）：${roleTags.join('、')}。它们只是理解用户的线索，不是写作提纲：不必逐条对照、不必平均分配篇幅，更不必按标签分节；只在有助于呈现「这段日子如何展开」时，让这些面向在叙事里自然交织。`
        : `The user noted these life facets (role tags) in the app: ${roleTags.join(', ')}. Treat them as gentle context—not an outline. Do not mirror each tag with a matching paragraph, split the chapter by tag, or aim for equal coverage; weave facets only when they help the story of this period feel true.`
      : '';

  const allDates = new Set<string>([
    ...(dayNamesInPeriod ? Object.keys(dayNamesInPeriod) : []),
    ...(dayTagsInPeriod ? Object.keys(dayTagsInPeriod) : []),
    ...(dayVibesInPeriod ? Object.keys(dayVibesInPeriod) : []),
  ]);
  const dailyContextLines =
    allDates.size > 0 && (dayNamesInPeriod || dayTagsInPeriod || dayVibesInPeriod)
      ? Array.from(allDates)
          .sort()
          .map((date) => {
            const parts: string[] = [];
            const name = dayNamesInPeriod?.[date];
            if (name?.name)
              parts.push(
                `${langIsZh ? '当日名' : 'day name'}: ${name.name}${name.isManual ? ` (${langIsZh ? '用户自填' : 'user-set'})` : ''}`
              );
            const tag = dayTagsInPeriod?.[date];
            if (tag) parts.push(`${langIsZh ? '当日标签' : 'day tag'}: ${tag}`);
            const v = dayVibesInPeriod?.[date];
            if (v && (v.energy != null || v.mood != null || v.focus != null)) {
              const vParts: string[] = [];
              if (v.energy != null) vParts.push(`energy: ${v.energy}`);
              if (v.mood != null) vParts.push(`mood: ${v.mood}`);
              if (v.focus != null) vParts.push(`focus: ${v.focus}`);
              parts.push(vParts.join(', '));
            }
            return parts.length ? `[${date}]: ${parts.join('; ')}` : '';
          })
          .filter(Boolean)
      : [];
  const dailyContextBlock =
    dailyContextLines.length > 0
      ? (langIsZh
          ? '本周期每日上下文（可引用以增强叙事连贯性）：\n'
          : 'Daily context for this period (you may cite to strengthen coherence):\n') +
        dailyContextLines.join('\n')
      : '';

  return {
    eventLines,
    journalBlock,
    dailyContextBlock,
    roleBlock,
  };
}
