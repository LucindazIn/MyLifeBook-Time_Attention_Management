import { endOfDay, parseISO, startOfDay } from 'date-fns';
import type { ScheduleEvent } from '@/types';
import { getChapterRange, type ChapterPeriodKey } from '@/lib/dateRange';
import { expandRecurringEvents } from '@/lib/events';
import { isEventUntagged } from '@/lib/tagCompleteness';

export type TagAnalysisViewMode = 'untagged' | 'all';

export interface TagAnalysisFilterState {
  range: ChapterPeriodKey;
  viewMode: TagAnalysisViewMode;
  customStart?: string;
  customEnd?: string;
}

export function getRangeBoundsFromFilters(filters: TagAnalysisFilterState): { start: Date; end: Date } {
  if (filters.range === 'custom' && filters.customStart && filters.customEnd) {
    const a = startOfDay(parseISO(filters.customStart));
    const b = endOfDay(parseISO(filters.customEnd));
    return a.getTime() <= b.getTime() ? { start: a, end: b } : { start: b, end: a };
  }
  const key = filters.range === 'custom' ? 'this_week' : filters.range;
  return getChapterRange(key);
}

export function getEventsInRange(
  events: ScheduleEvent[],
  filters: TagAnalysisFilterState,
  completedInstances: Record<string, boolean>,
): ScheduleEvent[] {
  const { start, end } = getRangeBoundsFromFilters(filters);
  const expanded = expandRecurringEvents(events, start, end, completedInstances);
  const sorted = [...expanded].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
  );
  if (filters.viewMode === 'all') return sorted;
  return sorted.filter(isEventUntagged);
}

export function getAllEventsInRange(
  events: ScheduleEvent[],
  filters: Pick<TagAnalysisFilterState, 'range' | 'customStart' | 'customEnd'>,
  completedInstances: Record<string, boolean>,
): ScheduleEvent[] {
  return getEventsInRange(events, { ...filters, viewMode: 'all' }, completedInstances);
}

export function countTaggedUntagged(events: ScheduleEvent[]): { tagged: number; untagged: number } {
  let tagged = 0;
  let untagged = 0;
  for (const e of events) {
    if (isEventUntagged(e)) untagged++;
    else tagged++;
  }
  return { tagged, untagged };
}
