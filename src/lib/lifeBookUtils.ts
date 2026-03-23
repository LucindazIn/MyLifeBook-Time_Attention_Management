import { startOfDay, endOfDay, parseISO } from 'date-fns';
import type { SavedChapter } from '@/lib/chaptersStorage';
import type { ScheduleEvent } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { getChapterRange } from '@/lib/dateRange';

/**
 * 获取某章日期范围内的所有高光事件（用于人生之书章节右页）。
 * 若章节有 periodStart/periodEnd 则按该区间筛；否则用 getChapterRange(periodKey) 作为 fallback。
 */
export function getHighlightEventsForChapter(
  chapter: SavedChapter,
  events: ScheduleEvent[],
  completedInstances: Record<string, boolean>
): ScheduleEvent[] {
  let start: Date;
  let end: Date;

  if (chapter.periodStart && chapter.periodEnd) {
    start = startOfDay(parseISO(chapter.periodStart));
    end = endOfDay(parseISO(chapter.periodEnd));
  } else {
    const range = getChapterRange(chapter.periodKey);
    start = range.start;
    end = range.end;
  }

  const expanded = expandRecurringEvents(events, start, end, completedInstances);
  return expanded.filter((e) => e.highlight === true);
}
