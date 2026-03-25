import { format } from 'date-fns';
import type { TimeDisplayFormat } from '@/types';

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
