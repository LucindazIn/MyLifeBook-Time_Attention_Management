import { parseISO, startOfDay, endOfDay } from 'date-fns';
import type { ScheduleEvent } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { aggregateByRole, rolePercentagesByCount, type RoleSegment } from '@/lib/roleAggregation';
import { computeDailyEnergySeries } from '@/lib/lifeEnergy';
import { getLifeEnergyOverrideForDate } from '@/lib/lifeEnergyStorage';

export function parseChapterPeriodBounds(periodStart: string, periodEnd: string): { start: Date; end: Date } {
  const a = startOfDay(parseISO(periodStart));
  const b = endOfDay(parseISO(periodEnd));
  return a.getTime() <= b.getTime() ? { start: a, end: b } : { start: b, end: a };
}

/**
 * 仅统计日程上的事件标签：展开实例的 label.text + tags[]（与日历日标签 day tag 无关）。
 * 与 EventVolumeCard 内层逻辑一致，供已展开实例复用。
 */
export function computeEventTagSlicesFromExpanded(
  expanded: ScheduleEvent[]
): { slices: [string, number][]; total: number } {
  const counts: Record<string, number> = {};

  expanded.forEach((e) => {
    const keys = new Set<string>();
    const lt = e.label?.text?.trim();
    if (lt) keys.add(lt);
    e.tags?.forEach((t) => {
      const s = t?.trim();
      if (s) keys.add(s);
    });
    keys.forEach((k) => {
      counts[k] = (counts[k] ?? 0) + 1;
    });
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const sum = entries.reduce((s, [, n]) => s + n, 0);
  return { slices: entries, total: sum };
}

/** 周期内展开日程上的事件标签分布（不含日历日标签）。 */
export function computeEventTagSlicesForRange(
  events: ScheduleEvent[],
  rangeStart: Date,
  rangeEnd: Date,
  completedInstances: Record<string, boolean>
): { slices: [string, number][]; total: number } {
  const expanded = expandRecurringEvents(events, rangeStart, rangeEnd, completedInstances);
  return computeEventTagSlicesFromExpanded(expanded);
}

/** 与 RoleEnergyCard 一致：按事件数占比，分母为周期内全部展开实例数 */
export function computeRoleEnergyPercentagesForRange(
  events: ScheduleEvent[],
  rangeStart: Date,
  rangeEnd: Date,
  completedInstances: Record<string, boolean>
): { segments: RoleSegment[]; percentages: [string, number][]; totalEvents: number } {
  const expanded = expandRecurringEvents(events, rangeStart, rangeEnd, completedInstances);
  const segments = aggregateByRole(expanded);
  const percentages = rolePercentagesByCount(segments, expanded.length);
  return { segments, percentages, totalEvents: expanded.length };
}

/** 与「人生曲线」同一套按自然日存储的覆盖值（global + legacy 回退） */
export function computeDailyEnergyWithStorageOverrides(
  events: ScheduleEvent[],
  rangeStart: Date,
  rangeEnd: Date,
  completedInstances: Record<string, boolean>
): { dateKey: string; energy: number }[] {
  const expanded = expandRecurringEvents(events, rangeStart, rangeEnd, completedInstances);
  const base = computeDailyEnergySeries(expanded, rangeStart, rangeEnd);
  return base.map(({ dateKey, energy }) => ({
    dateKey,
    energy: getLifeEnergyOverrideForDate(dateKey) ?? energy,
  }));
}
