import type { ChapterPeriodKey } from '@/lib/dateRange';

const RANGE_LABELS: Record<ChapterPeriodKey, { zh: string; en: string }> = {
  this_week: { zh: '本周', en: 'This Week' },
  last_week: { zh: '上周', en: 'Last Week' },
  this_month: { zh: '本月', en: 'This Month' },
  custom: { zh: '自定义', en: 'Custom' },
};

/** Analytics card period selector label (zh / Title Case en). */
export function getAnalyticsRangeLabel(period: ChapterPeriodKey, isZh: boolean): string {
  const entry = RANGE_LABELS[period];
  return isZh ? entry.zh : entry.en;
}
