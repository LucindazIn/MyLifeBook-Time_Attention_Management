import { format } from 'date-fns';
import type { AppLanguage, TimeDisplayFormat } from '@/types';

/** 单行：搜索、建议弹窗、长期目标列表等 */
export function formatEventClockLine(date: Date, timeDisplay: TimeDisplayFormat): string {
  return format(date, timeDisplay === '24h' ? 'HH:mm' : 'h:mm a');
}

export interface TimelineClockParts {
  line1: string;
  /** 仅 12 小时制：第二行 AM/PM */
  line2?: string;
}

/** 日视图 Timeline 左侧：24h 一行；12h 两行（时分 + AM/PM） */
export function formatEventClockForTimeline(date: Date, timeDisplay: TimeDisplayFormat): TimelineClockParts {
  if (timeDisplay === '24h') {
    return { line1: format(date, 'HH:mm') };
  }
  return {
    line1: format(date, 'h:mm'),
    line2: format(date, 'a'),
  };
}

/**
 * Duration for display after event title: ≥1h uses h; under 1h uses min.
 * Examples: (2h), (45min), (1h 30min).
 */
export function formatEventDurationAfterTitle(start: Date, end: Date, language: AppLanguage): string {
  const ms = end.getTime() - start.getTime();
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const isZh = language === 'zh';
  const L = isZh ? '（' : '(';
  const R = isZh ? '）' : ')';
  if (totalMin === 0) {
    return `${L}0min${R}`;
  }
  if (totalMin < 60) {
    return `${L}${totalMin}min${R}`;
  }
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) {
    return `${L}${h}h${R}`;
  }
  return `${L}${h}h ${m}min${R}`;
}
