import { format, parseISO } from 'date-fns';
import type { ScheduleEvent } from '@/types';
import type { MediumTermGoal } from '@/lib/longTermGoalMetaStorage';

export type MediumTermAttributionRow = {
  mediumId: string | 'unassigned';
  title: string;
  count: number;
  durationMs: number;
};

function eventDurationMs(e: ScheduleEvent): number {
  if (!e.startTime || !e.endTime) return 0;
  return Math.max(0, new Date(e.endTime).getTime() - new Date(e.startTime).getTime());
}

/**
 * 周期内已展开日程，筛选挂父长期目标的实例，按中短期区间列表顺序匹配首个区间归因；未命中归入 unassigned。
 */
export function attributeExpandedEventsToMediumTermGoals(
  expandedInPeriod: ScheduleEvent[],
  parentGoalName: string,
  mediumTermGoals: MediumTermGoal[]
): {
  rows: MediumTermAttributionRow[];
  parentTotalCount: number;
  parentTotalDurationMs: number;
} {
  const g = parentGoalName.trim();
  if (!g) {
    return { rows: [], parentTotalCount: 0, parentTotalDurationMs: 0 };
  }

  const relevant = expandedInPeriod.filter((e) => e.longTermGoals?.some((x) => x?.trim() === g));

  let parentTotalDurationMs = 0;
  for (const e of relevant) {
    parentTotalDurationMs += eventDurationMs(e);
  }
  const parentTotalCount = relevant.length;

  const byMedium = new Map<string, { count: number; durationMs: number }>();
  let unassignedCount = 0;
  let unassignedDurationMs = 0;

  for (const e of relevant) {
    const dayKey = format(parseISO(e.startTime), 'yyyy-MM-dd');
    let matched: MediumTermGoal | undefined;
    for (const m of mediumTermGoals) {
      if (dayKey >= m.startAt && dayKey <= m.endAt) {
        matched = m;
        break;
      }
    }
    const dur = eventDurationMs(e);
    if (matched) {
      const cur = byMedium.get(matched.id) ?? { count: 0, durationMs: 0 };
      cur.count += 1;
      cur.durationMs += dur;
      byMedium.set(matched.id, cur);
    } else {
      unassignedCount += 1;
      unassignedDurationMs += dur;
    }
  }

  const rows: MediumTermAttributionRow[] = mediumTermGoals.map((m) => {
    const v = byMedium.get(m.id) ?? { count: 0, durationMs: 0 };
    return { mediumId: m.id, title: m.title, count: v.count, durationMs: v.durationMs };
  });

  if (unassignedCount > 0 || unassignedDurationMs > 0) {
    rows.push({
      mediumId: 'unassigned',
      title: '',
      count: unassignedCount,
      durationMs: unassignedDurationMs,
    });
  }

  return { rows, parentTotalCount, parentTotalDurationMs };
}
