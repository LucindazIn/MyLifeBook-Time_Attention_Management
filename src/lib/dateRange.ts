import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
  format,
  addDays,
} from 'date-fns';

export type ChapterPeriodKey = 'this_week' | 'last_week' | 'this_month' | 'custom';

export function getChapterRange(
  period: ChapterPeriodKey,
  customStart?: Date,
  customEnd?: Date
): { start: Date; end: Date } {
  if (period === 'custom' && customStart && customEnd) {
    return { start: new Date(customStart.getTime()), end: new Date(customEnd.getTime()) };
  }
  const now = new Date();
  switch (period) {
    case 'this_week': {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      return { start, end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
    case 'last_week': {
      const end = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const start = startOfWeek(end, { weekStartsOn: 1 });
      return { start, end };
    }
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'custom':
    default: {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      return { start, end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
  }
}

/** 用于变化提示：上一周期起止。custom 时返回空区间（同一天），不参与对比。 */
export function getPreviousChapterRange(
  period: ChapterPeriodKey,
  customStart?: Date,
  customEnd?: Date
): { start: Date; end: Date } {
  if (period === 'custom' && customStart && customEnd) {
    const days = Math.ceil((customEnd.getTime() - customStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const prevEnd = addDays(customStart, -1);
    const prevStart = addDays(prevEnd, -days + 1);
    return { start: prevStart, end: prevEnd };
  }
  const now = new Date();
  switch (period) {
    case 'this_week': {
      const prevEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      return { start: startOfWeek(prevEnd, { weekStartsOn: 1 }), end: prevEnd };
    }
    case 'last_week': {
      const prevEnd = endOfWeek(subWeeks(now, 2), { weekStartsOn: 1 });
      return { start: startOfWeek(prevEnd, { weekStartsOn: 1 }), end: prevEnd };
    }
    case 'this_month': {
      const prevEnd = subMonths(endOfMonth(now), 1);
      return { start: startOfMonth(prevEnd), end: prevEnd };
    }
    case 'custom':
    default:
      return { start: now, end: now };
  }
}

/** 根据起止日期生成周期展示文案（用于 custom 或任意区间） */
export function formatChapterPeriodLabel(start: Date, end: Date, isZh: boolean): string {
  if (isZh) {
    return `${format(start, 'yyyy-MM-dd')} 至 ${format(end, 'yyyy-MM-dd')}`;
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
}

/** 周期在弹窗右侧的展示：x月第x周 或 本月时仅 x月；英文 Week x, Month */
export function formatPeriodWeekLabel(
  periodStart: string | undefined,
  periodKey: ChapterPeriodKey,
  isZh: boolean
): string {
  if (!periodStart) return '';
  const d = new Date(periodStart + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekNo = Math.ceil(day / 7);
  if (periodKey === 'this_month') {
    return isZh ? `${month}月` : format(d, 'MMMM');
  }
  return isZh ? `${month}月第${weekNo}周` : `Week ${weekNo}, ${format(d, 'MMMM')}`;
}

/** 人生之书目录用周期后缀：（x年x月x周）或（x年x月） */
export function formatPeriodTOCSuffix(
  periodStart: string | undefined,
  periodKey: ChapterPeriodKey,
  isZh: boolean
): string {
  if (!periodStart) return '';
  const d = new Date(periodStart + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekNo = Math.ceil(day / 7);
  if (periodKey === 'this_month') {
    return isZh ? `（${year}年${month}月）` : `(${format(d, 'MMMM yyyy')})`;
  }
  return isZh ? `（${year}年${month}月第${weekNo}周）` : `(Week ${weekNo}, ${format(d, 'MMMM yyyy')})`;
}

/** 人生之书章节页副标题：x年x月第x周 或 x年x月（无括号） */
export function formatPeriodSubtitle(
  periodStart: string | undefined,
  periodKey: ChapterPeriodKey,
  isZh: boolean
): string {
  if (!periodStart) return '';
  const d = new Date(periodStart + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekNo = Math.ceil(day / 7);
  if (periodKey === 'this_month') {
    return isZh ? `${year}年${month}月` : format(d, 'MMMM yyyy');
  }
  return isZh ? `${year}年${month}月第${weekNo}周` : `Week ${weekNo}, ${format(d, 'MMMM yyyy')}`;
}

/** 区间内所有 dateKey（yyyy-MM-dd），用于筛 journal */
export function dateKeysBetween(start: Date, end: Date): string[] {
  const keys: string[] = [];
  let cur = new Date(start.getTime());
  const endTime = end.getTime();
  while (cur.getTime() <= endTime) {
    keys.push(format(cur, 'yyyy-MM-dd'));
    cur = addDays(cur, 1);
  }
  return keys;
}
