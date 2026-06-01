import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import type { ScheduleEvent } from '@/types';
import { expandRecurringEvents } from '@/lib/events';

export type GoalLinkingRange = 'week' | 'month' | 'year' | 'custom';

export interface GoalLinkingFilterState {
  range: GoalLinkingRange;
  customStart?: string;
  customEnd?: string;
}

export function getGoalLinkingRangeBounds(
  range: GoalLinkingRange,
  anchorDate: Date,
  customStart?: string,
  customEnd?: string,
): { start: Date; end: Date } {
  switch (range) {
    case 'week':
      return { start: startOfWeek(anchorDate, { weekStartsOn: 1 }), end: endOfWeek(anchorDate, { weekStartsOn: 1 }) };
    case 'month':
      return { start: startOfMonth(anchorDate), end: endOfMonth(anchorDate) };
    case 'year':
      return { start: startOfYear(anchorDate), end: endOfYear(anchorDate) };
    case 'custom':
      return {
        start: customStart ? startOfDay(new Date(customStart)) : startOfMonth(anchorDate),
        end: customEnd ? endOfDay(new Date(customEnd)) : endOfMonth(anchorDate),
      };
  }
}

export function isTaskUnlinkedToMediumTermGoal(
  event: ScheduleEvent,
  validMediumTermGoalIds?: ReadonlySet<string>,
): boolean {
  if (event.type !== 'todo') return false;
  if (!event.mediumTermGoalId) return true;
  return validMediumTermGoalIds != null && !validMediumTermGoalIds.has(event.mediumTermGoalId);
}

export function getUnlinkedMediumTermGoalTasksInRange(
  events: ScheduleEvent[],
  anchorDate: Date,
  filters: GoalLinkingFilterState,
  completedInstances: Record<string, boolean>,
  validMediumTermGoalIds?: ReadonlySet<string>,
): ScheduleEvent[] {
  const { start, end } = getGoalLinkingRangeBounds(
    filters.range,
    anchorDate,
    filters.customStart,
    filters.customEnd,
  );
  return expandRecurringEvents(events, start, end, completedInstances)
    .filter((event) => isTaskUnlinkedToMediumTermGoal(event, validMediumTermGoalIds))
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
}
