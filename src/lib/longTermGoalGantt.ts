import { endOfDay, parseISO, startOfDay } from 'date-fns';
import type { GoalMilestone, MediumTermGoal } from '@/lib/longTermGoalMetaStorage';

export interface GanttRow {
  id: string;
  visionName: string;
  medium: MediumTermGoal;
  inProgress: boolean;
}

export function parseGoalDate(ymd: string): Date {
  return parseISO(`${ymd.trim()}T12:00:00`);
}

function formatTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function flattenMediumTermRows(
  goalNames: string[],
  meta: Record<string, { mediumTermGoals?: MediumTermGoal[] }>
): GanttRow[] {
  const today = formatTodayYmd();
  const rows: GanttRow[] = [];
  for (const visionName of goalNames) {
    const medium = meta[visionName]?.mediumTermGoals ?? [];
    for (const m of medium) {
      if (!m.startAt?.trim() || !m.endAt?.trim()) continue;
      const startAt = m.startAt.trim();
      const endAt = m.endAt.trim();
      rows.push({
        id: m.id,
        visionName,
        medium: { ...m, startAt, endAt },
        inProgress: startAt <= today && today <= endAt,
      });
    }
  }
  return rows.sort((a, b) => a.medium.startAt.localeCompare(b.medium.startAt));
}

export interface BarLayout {
  leftPct: number;
  widthPct: number;
  visible: boolean;
}

/** Map [windowStart, windowEnd] to bar segment for [startAt, endAt] (inclusive calendar days). */
export function layoutBarInWindow(
  windowStart: Date,
  windowEnd: Date,
  startAt: string,
  endAt: string
): BarLayout {
  const ws = startOfDay(windowStart).getTime();
  const we = endOfDay(windowEnd).getTime();
  const span = we - ws;
  if (span <= 0) return { leftPct: 0, widthPct: 0, visible: false };

  const s = startOfDay(parseGoalDate(startAt)).getTime();
  const e = endOfDay(parseGoalDate(endAt)).getTime();
  const barStart = Math.max(s, ws);
  const barEnd = Math.min(e, we);
  if (barEnd < barStart) return { leftPct: 0, widthPct: 0, visible: false };

  const leftPct = ((barStart - ws) / span) * 100;
  const widthPct = ((barEnd - barStart) / span) * 100;
  return {
    leftPct: clampPct(leftPct),
    widthPct: clampPct(Math.max(widthPct, 0.4)),
    visible: widthPct > 0,
  };
}

export function datePctInWindow(windowStart: Date, windowEnd: Date, ymd: string): number | null {
  const ws = startOfDay(windowStart).getTime();
  const we = endOfDay(windowEnd).getTime();
  const span = we - ws;
  if (span <= 0) return null;
  const t = startOfDay(parseGoalDate(ymd)).getTime();
  if (t < ws || t > we) return null;
  return clampPct(((t - ws) / span) * 100);
}

export function milestonePctOnBar(
  barStartAt: string,
  barEndAt: string,
  milestoneAt: string
): { pctOnBar: number; outsideBar: boolean } {
  const bs = startOfDay(parseGoalDate(barStartAt)).getTime();
  const be = endOfDay(parseGoalDate(barEndAt)).getTime();
  const span = be - bs;
  if (span <= 0) return { pctOnBar: 0, outsideBar: true };
  const t = startOfDay(parseGoalDate(milestoneAt)).getTime();
  if (t < bs) return { pctOnBar: 0, outsideBar: true };
  if (t > be) return { pctOnBar: 100, outsideBar: true };
  return { pctOnBar: clampPct(((t - bs) / span) * 100), outsideBar: false };
}

export function todayPctInWindow(windowStart: Date, windowEnd: Date): number | null {
  return datePctInWindow(windowStart, windowEnd, formatTodayYmd());
}

export function rowOverlapsWindow(
  windowStart: Date,
  windowEnd: Date,
  startAt: string,
  endAt: string
): boolean {
  return layoutBarInWindow(windowStart, windowEnd, startAt, endAt).visible;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function formatMilestonePreview(milestones: GoalMilestone[], max = 3, isZh = true): string {
  const sorted = [...milestones].sort((a, b) => a.at.localeCompare(b.at));
  const head = sorted.slice(0, max);
  const rest = sorted.length - head.length;
  const lines = head.map((m) => `${m.at} ${m.text}`);
  if (rest > 0) lines.push(isZh ? `等 ${rest} 项` : `+${rest} More`);
  return lines.join('\n');
}
