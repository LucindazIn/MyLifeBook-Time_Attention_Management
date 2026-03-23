import type { ScheduleEvent } from '@/types';

export type GoalSegment = {
  goalId: string;
  count: number;
  durationMs: number;
};

/** 按长期目标聚合：一个事件可贡献到多个目标。 */
export function aggregateByGoal(events: ScheduleEvent[]): GoalSegment[] {
  const map = new Map<string, { count: number; durationMs: number }>();
  for (const e of events) {
    const goals = e.longTermGoals?.filter(Boolean) ?? [];
    const durationMs = e.startTime && e.endTime
      ? new Date(e.endTime).getTime() - new Date(e.startTime).getTime()
      : 0;
    for (const goalId of goals) {
      const cur = map.get(goalId) ?? { count: 0, durationMs: 0 };
      cur.count += 1;
      cur.durationMs += durationMs;
      map.set(goalId, cur);
    }
  }
  return Array.from(map.entries())
    .map(([goalId, v]) => ({ goalId, count: v.count, durationMs: v.durationMs }))
    .sort((a, b) => b.count - a.count);
}

export function goalPercentagesByCount(segments: GoalSegment[], totalCount: number): [string, number][] {
  if (totalCount <= 0) return [];
  return segments.map((s) => [s.goalId, Math.round((s.count / totalCount) * 100)] as [string, number]);
}

export function goalTrendByCount(
  currentSegments: GoalSegment[],
  previousSegments: GoalSegment[],
  currentTotal: number,
  previousTotal: number
): Map<string, number> {
  const currentPct = new Map<string, number>();
  if (currentTotal > 0) {
    currentSegments.forEach((s) => currentPct.set(s.goalId, (s.count / currentTotal) * 100));
  }
  const previousPct = new Map<string, number>();
  if (previousTotal > 0) {
    previousSegments.forEach((s) => previousPct.set(s.goalId, (s.count / previousTotal) * 100));
  }
  const all = new Set([...currentPct.keys(), ...previousPct.keys()]);
  const trend = new Map<string, number>();
  all.forEach((id) => {
    const cur = currentPct.get(id) ?? 0;
    const prev = previousPct.get(id) ?? 0;
    const delta = Math.round(cur - prev);
    if (delta !== 0) trend.set(id, delta);
  });
  return trend;
}
