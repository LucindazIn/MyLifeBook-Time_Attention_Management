import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';

/** 目标日 YYYY-MM-DD 相对今天的倒数/逾期文案；无日期返回空串 */
export function formatTargetDateCountdown(targetAt: string, isZh: boolean): string {
  const t = targetAt.trim();
  if (!t) return '';
  const target = startOfDay(parseISO(t.length > 10 ? t : `${t}T12:00:00`));
  const today = startOfDay(new Date());
  const diff = differenceInCalendarDays(target, today);
  if (diff > 0) return isZh ? `（倒数 ${diff} 天）` : `(${diff} Days Left)`;
  if (diff === 0) return isZh ? '（D-Day）' : '(D-Day)';
  return isZh ? `（已逾期 ${-diff} 天）` : `(Overdue By ${-diff} Days)`;
}
