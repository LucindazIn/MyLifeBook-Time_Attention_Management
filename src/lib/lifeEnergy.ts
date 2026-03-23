import { format, addDays, differenceInCalendarDays } from 'date-fns';
import type { ScheduleEvent } from '@/types';

/** 单日能量：完成 30% + 高光/星标 40% + 连续性 30%（有事件=1，无=0）。 */
function energyForDay(dayEvents: ScheduleEvent[]): number {
  const total = dayEvents.length;
  if (total === 0) return 0;
  const completion = dayEvents.filter((e) => e.completed).length / total;
  const weightedSum = dayEvents.reduce((acc, e) => (e.starred || e.highlight ? acc + 2 : acc + 1), 0);
  const highlightStar = Math.min(1, weightedSum / (total * 2));
  const continuity = 1;
  const raw = 0.3 * completion + 0.4 * highlightStar + 0.3 * continuity;
  return Math.round(Math.min(100, Math.max(0, raw * 100)));
}

/**
 * 默认生命能量 0–100：完成密度 30% + 高光/星标 40% + 时间分布连续性 30%。
 */
export function computeLifeEnergy(
  events: ScheduleEvent[],
  rangeStart: Date,
  rangeEnd: Date
): number {
  const total = events.length;
  if (total === 0) return 0;
  const completion = events.filter((e) => e.completed).length / total;
  const weightedSum = events.reduce((acc, e) => (e.starred || e.highlight ? acc + 2 : acc + 1), 0);
  const highlightStar = Math.min(1, weightedSum / (total * 2));
  const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart) + 1);
  const daySet = new Set<string>();
  events.forEach((e) => daySet.add(format(new Date(e.startTime), 'yyyy-MM-dd')));
  const continuity = daySet.size / totalDays;
  const raw = 0.3 * completion + 0.4 * highlightStar + 0.3 * continuity;
  return Math.round(Math.min(100, Math.max(0, raw * 100)));
}

/** 按日能量序列，用于曲线图。无事件日为 0。 */
export function computeDailyEnergySeries(
  events: ScheduleEvent[],
  rangeStart: Date,
  rangeEnd: Date
): { dateKey: string; energy: number }[] {
  const byDay = new Map<string, ScheduleEvent[]>();
  events.forEach((e) => {
    const key = format(new Date(e.startTime), 'yyyy-MM-dd');
    const list = byDay.get(key) ?? [];
    list.push(e);
    byDay.set(key, list);
  });
  const out: { dateKey: string; energy: number }[] = [];
  let d = new Date(rangeStart.getTime());
  const endTime = rangeEnd.getTime();
  while (d.getTime() <= endTime) {
    const dateKey = format(d, 'yyyy-MM-dd');
    out.push({ dateKey, energy: energyForDay(byDay.get(dateKey) ?? []) });
    d = addDays(d, 1);
  }
  return out;
}
