import type { ScheduleEvent } from '@/types';
import { expandRecurringEvents } from '@/lib/events';

/**
 * 最近一次有日程挂到该长期目标的开始时间（含重复展开，截至当前时刻）。
 */
export function getLastActionDateForGoal(
  events: ScheduleEvent[],
  goalName: string,
  completedInstances: Record<string, boolean>
): Date | null {
  const g = goalName.trim();
  if (!g) return null;
  const endRange = new Date();
  const startRange = new Date(0);
  const expanded = expandRecurringEvents(events, startRange, endRange, completedInstances);
  let best: Date | null = null;
  for (const e of expanded) {
    if (!e.longTermGoals?.some((x) => x?.trim() === g)) continue;
    const t = new Date(e.startTime);
    if (t > endRange) continue;
    if (!best || t > best) best = t;
  }
  return best;
}
