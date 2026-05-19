import type { ScheduleEvent } from '@/types';

export type RoleSegment = {
  roleId: string;
  count: number;
  durationMs: number;
};

/**
 * 按 role 聚合事件：事件数 + 总时长（毫秒）。
 * 无 role 的归为 ''，由调用方决定是否显示。
 */
export function aggregateByRole(events: ScheduleEvent[]): RoleSegment[] {
  const map = new Map<string, { count: number; durationMs: number }>();

  for (const e of events) {
    const roleId = e.role ?? '';
    const cur = map.get(roleId) ?? { count: 0, durationMs: 0 };
    cur.count += 1;
    if (e.startTime && e.endTime) {
      cur.durationMs += new Date(e.endTime).getTime() - new Date(e.startTime).getTime();
    }
    map.set(roleId, cur);
  }

  return Array.from(map.entries())
    .map(([roleId, v]) => ({ roleId, count: v.count, durationMs: v.durationMs }))
    .filter((s) => s.roleId !== '') // 人生曲线只展示有身份的事件
    .sort((a, b) => b.count - a.count);
}

/**
 * 计算各 role 占比（按事件数）。
 * 返回 [roleId, percentage 0-100][]，总和为 100（或 0）。
 */
export function rolePercentagesByCount(segments: RoleSegment[], totalCount: number): [string, number][] {
  if (totalCount <= 0) return [];
  return segments.map((s) => [s.roleId, Math.round((s.count / totalCount) * 100)] as [string, number]);
}

/**
 * 对比当前周期与上一周期各 role 占比变化（按事件数）。
 * 返回 Map<roleId, deltaPercentage>，如 +10、-5。
 */
export function roleTrendByCount(
  currentSegments: RoleSegment[],
  previousSegments: RoleSegment[],
  currentTotal: number,
  previousTotal: number
): Map<string, number> {
  const currentPct = new Map<string, number>();
  if (currentTotal > 0) {
    currentSegments.forEach((s) => currentPct.set(s.roleId, (s.count / currentTotal) * 100));
  }
  const previousPct = new Map<string, number>();
  if (previousTotal > 0) {
    previousSegments.forEach((s) => previousPct.set(s.roleId, (s.count / previousTotal) * 100));
  }
  const allRoles = new Set([...currentPct.keys(), ...previousPct.keys()]);
  const trend = new Map<string, number>();
  allRoles.forEach((roleId) => {
    const cur = currentPct.get(roleId) ?? 0;
    const prev = previousPct.get(roleId) ?? 0;
    const delta = Math.round(cur - prev);
    if (delta !== 0) trend.set(roleId, delta);
  });
  return trend;
}
