import {
  addDays,
  endOfDay,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
  subYears,
} from 'date-fns';
import type { GoalMilestone, MediumTermGoal } from '@/lib/longTermGoalMetaStorage';

export const PPD_MIN = 4;
export const PPD_MAX = 48;
export const MIN_LABEL_PX = 56;
export const PAN_BOUNDS_PADDING_DAYS = 14;

export interface GanttAxisTick {
  at: Date;
  label: string;
  pct: number;
}

export interface PanBounds {
  minStart: Date;
  maxEnd: Date;
}

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
  return format(new Date(), 'yyyy-MM-dd');
}

export function countCalendarDays(windowStart: Date, windowEnd: Date): number {
  const ws = startOfDay(windowStart).getTime();
  const we = startOfDay(windowEnd).getTime();
  if (we < ws) return 0;
  return Math.floor((we - ws) / (24 * 60 * 60 * 1000)) + 1;
}

export function clampPpd(raw: number): number {
  return Math.max(PPD_MIN, Math.min(PPD_MAX, raw));
}

export function computeDefaultPpd(trackWidthPx: number, anchorDayCount: number): number {
  const w = Math.max(trackWidthPx, 200);
  const days = Math.max(anchorDayCount, 1);
  return clampPpd(Math.floor(w / days));
}

export function computeVisibleDayCount(trackWidthPx: number, ppd: number): number {
  const w = Math.max(trackWidthPx, 1);
  return Math.max(1, Math.floor(w / Math.max(ppd, 1)));
}

/** At least two years back from today; extends further with data span. */
export function computePanBounds(rows: GanttRow[]): PanBounds {
  const today = startOfDay(new Date());
  let minStart = subYears(today, 2);
  let maxEnd = addDays(today, PAN_BOUNDS_PADDING_DAYS);

  if (rows.length === 0) return { minStart, maxEnd };

  let min = rows[0].medium.startAt;
  let max = rows[0].medium.endAt;
  for (const r of rows) {
    if (r.medium.startAt < min) min = r.medium.startAt;
    if (r.medium.endAt > max) max = r.medium.endAt;
    for (const ms of r.medium.milestones ?? []) {
      if (ms.at < min) min = ms.at;
      if (ms.at > max) max = ms.at;
    }
  }
  const dataMin = addDays(startOfDay(parseGoalDate(min)), -PAN_BOUNDS_PADDING_DAYS);
  const dataMax = endOfDay(addDays(parseGoalDate(max), PAN_BOUNDS_PADDING_DAYS));
  if (dataMin.getTime() < minStart.getTime()) minStart = dataMin;
  if (dataMax.getTime() > maxEnd.getTime()) maxEnd = dataMax;
  return { minStart, maxEnd };
}

export function resolveViewWindow(
  anchorStart: Date,
  panOffsetDays: number,
  visibleDayCount: number,
  bounds: PanBounds
): { viewStart: Date; viewEnd: Date } {
  let viewStart = addDays(startOfDay(anchorStart), panOffsetDays);
  let viewEnd = addDays(viewStart, Math.max(visibleDayCount, 1) - 1);

  const minStart = startOfDay(bounds.minStart);
  const maxEnd = startOfDay(bounds.maxEnd);

  if (viewEnd.getTime() < minStart.getTime()) {
    viewEnd = minStart;
    viewStart = addDays(viewEnd, -(Math.max(visibleDayCount, 1) - 1));
  }
  if (viewStart.getTime() > maxEnd.getTime()) {
    viewStart = maxEnd;
    viewEnd = addDays(viewStart, Math.max(visibleDayCount, 1) - 1);
  }
  if (viewStart.getTime() < minStart.getTime()) viewStart = minStart;
  if (viewEnd.getTime() > maxEnd.getTime()) viewEnd = maxEnd;
  if (viewEnd.getTime() < viewStart.getTime()) viewEnd = viewStart;

  return { viewStart, viewEnd };
}

export function shiftViewWindow(
  viewStart: Date,
  viewEnd: Date,
  deltaDays: number,
  bounds: PanBounds
): { viewStart: Date; viewEnd: Date } {
  const span = countCalendarDays(viewStart, viewEnd);
  let newStart = addDays(startOfDay(viewStart), deltaDays);
  let newEnd = addDays(newStart, span - 1);

  const minStart = startOfDay(bounds.minStart);
  const maxEnd = startOfDay(bounds.maxEnd);

  if (newStart.getTime() < minStart.getTime()) {
    newStart = minStart;
    newEnd = addDays(newStart, span - 1);
  }
  if (newEnd.getTime() > maxEnd.getTime()) {
    newEnd = maxEnd;
    newStart = addDays(newEnd, -(span - 1));
  }
  if (newStart.getTime() < minStart.getTime()) newStart = minStart;

  return { viewStart: newStart, viewEnd: newEnd };
}

export function getCurrentWeekAnchor(): { anchorStart: Date; anchorEnd: Date } {
  const anchorStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  return { anchorStart, anchorEnd: addDays(anchorStart, 6) };
}

export function panOffsetForViewStart(anchorStart: Date, viewStart: Date): number {
  const a = startOfDay(anchorStart).getTime();
  const v = startOfDay(viewStart).getTime();
  return Math.round((v - a) / (24 * 60 * 60 * 1000));
}

function roundToFriendlyDayStep(raw: number): number {
  if (raw <= 1) return 1;
  const candidates = [1, 2, 3, 5, 7, 14, 21, 28, 30, 60, 90];
  let best = 1;
  for (const c of candidates) {
    if (c <= raw) best = c;
    else break;
  }
  return best;
}

export function pickAxisTickStep(visibleDayCount: number, ppd: number): number {
  const raw = Math.max(1, Math.round(MIN_LABEL_PX / Math.max(ppd, 1)));
  return Math.min(roundToFriendlyDayStep(raw), Math.max(visibleDayCount, 1));
}

export function buildGanttAxisTicks(
  viewStart: Date,
  viewEnd: Date,
  ppd: number,
  isZh: boolean
): GanttAxisTick[] {
  const dayCount = countCalendarDays(viewStart, viewEnd);
  if (dayCount <= 0) return [];

  const step = pickAxisTickStep(dayCount, ppd);
  const fmt = isZh ? 'M/d' : 'MMM d';
  const ticks: GanttAxisTick[] = [];

  const pushTick = (d: Date) => {
    const pct = datePctInWindow(viewStart, viewEnd, format(d, 'yyyy-MM-dd'));
    if (pct == null) return;
    ticks.push({ at: d, label: format(d, fmt), pct });
  };

  pushTick(viewStart);
  let cur = addDays(startOfDay(viewStart), step);
  const end = startOfDay(viewEnd);
  while (cur.getTime() < end.getTime()) {
    pushTick(cur);
    cur = addDays(cur, step);
  }
  if (ticks.length === 0 || startOfDay(ticks[ticks.length - 1].at).getTime() !== end.getTime()) {
    pushTick(viewEnd);
  }

  const seen = new Set<number>();
  const deduped = ticks.filter((t) => {
    const k = startOfDay(t.at).getTime();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (deduped.length > 0) {
    deduped[0] = { ...deduped[0], pct: 0 };
    deduped[deduped.length - 1] = { ...deduped[deduped.length - 1], pct: 100 };
  }
  return deduped;
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
