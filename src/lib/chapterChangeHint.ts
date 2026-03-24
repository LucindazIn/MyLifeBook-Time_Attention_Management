import type { ScheduleEvent } from '@/types';
import {
  aggregateByRole,
  roleTrendByCount,
} from '@/lib/roleAggregation';

export function getChapterChangeHint(
  currentEvents: ScheduleEvent[],
  previousEvents: ScheduleEvent[],
  language: 'zh' | 'en',
  getRoleDisplayName: (roleId: string, lang: 'zh' | 'en') => string
): string {
  const currentSegments = aggregateByRole(currentEvents);
  const previousSegments = aggregateByRole(previousEvents);
  const currentTotal = currentEvents.length;
  const previousTotal = previousEvents.length;

  const trend = roleTrendByCount(
    currentSegments,
    previousSegments,
    currentTotal,
    previousTotal
  );

  const highlightCurrent = currentEvents.filter((e) => e.highlight).length;
  const highlightPrev = previousEvents.filter((e) => e.highlight).length;
  const starredCurrent = currentEvents.filter((e) => e.starred).length;
  const starredPrev = previousEvents.filter((e) => e.starred).length;
  const highlightDelta = highlightCurrent - highlightPrev;
  const starredDelta = starredCurrent - starredPrev;

  const parts: string[] = [];

  if (trend.size > 0) {
    const sorted = [...trend.entries()].sort(
      (a, b) => Math.abs(b[1]) - Math.abs(a[1])
    );
    const top = sorted.slice(0, 2);
    const roleParts = top.map(([roleId, delta]) => {
      const name = getRoleDisplayName(roleId, language);
      const sign = delta > 0 ? '+' : '';
      return `${name} ${sign}${delta}%`;
    });
    if (language === 'zh') {
      parts.push(`与上一周期相比：${roleParts.join('、')}`);
    } else {
      parts.push(`Vs previous period: ${roleParts.join(', ')}`);
    }
  }

  if (highlightDelta !== 0 || starredDelta !== 0) {
    const hintParts: string[] = [];
    if (highlightDelta !== 0) {
      if (language === 'zh') {
        hintParts.push(
          `高光事件 ${highlightDelta > 0 ? '+' : ''}${highlightDelta}`
        );
      } else {
        hintParts.push(
          `highlights ${highlightDelta > 0 ? '+' : ''}${highlightDelta}`
        );
      }
    }
    if (starredDelta !== 0) {
      if (language === 'zh') {
        hintParts.push(`星标 ${starredDelta > 0 ? '+' : ''}${starredDelta}`);
      } else {
        hintParts.push(`starred ${starredDelta > 0 ? '+' : ''}${starredDelta}`);
      }
    }
    if (hintParts.length) {
      parts.push(
        language === 'zh'
          ? hintParts.join('，')
          : hintParts.join(', ')
      );
    }
  }

  if (parts.length === 0) return '';
  return language === 'zh' ? parts.join('；') : parts.join('; ');
}
