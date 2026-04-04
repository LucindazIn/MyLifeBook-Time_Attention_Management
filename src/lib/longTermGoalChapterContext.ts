import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import type { ScheduleEvent } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import {
  loadLongTermGoalMeta,
  getOrCreateRecord,
  mergeLongTermGoalNames,
  type GoalStatus,
} from '@/lib/longTermGoalMetaStorage';

function statusLabel(status: GoalStatus, langIsZh: boolean): string {
  if (langIsZh) {
    switch (status) {
      case 'sprout':
        return '萌芽';
      case 'in_progress':
        return '推进中';
      case 'deviated':
        return '迷雾/偏离';
      case 'completed':
        return '已完成';
      default:
        return status;
    }
  }
  switch (status) {
    case 'sprout':
      return 'Sprout';
    case 'in_progress':
      return 'In Progress';
    case 'deviated':
      return 'Deviated';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
}

/**
 * Plain-text block for chapter export: alignment, milestones, and period touchpoints per goal.
 */
export function buildLongTermGoalAlignmentBlock(
  events: ScheduleEvent[],
  completedInstances: Record<string, boolean>,
  periodStart: Date,
  periodEnd: Date,
  language: string
): string {
  const langIsZh = language === 'zh';
  const meta = loadLongTermGoalMeta();
  const names = mergeLongTermGoalNames(events);
  if (names.length === 0) return '';

  const expanded = expandRecurringEvents(events, periodStart, periodEnd, completedInstances);
  const today = new Date();

  const lines: string[] = [];
  lines.push(
    langIsZh
      ? '=== 长期目标跟进（系统汇总，可融入叙事；勿照搬句式）==='
      : '=== Long-Term Goal Alignment (System Summary; Weave Naturally; Do Not Copy Phrases) ==='
  );

  for (const name of names) {
    const rec = getOrCreateRecord(meta, name);
    const aligned = parseISO(rec.lastAlignedAt);
    const daysSince = Math.max(0, differenceInCalendarDays(today, aligned));
    const inPeriod = expanded.filter((e) => e.longTermGoals?.includes(name));
    let lastInPeriod = '';
    if (inPeriod.length > 0) {
      const last = inPeriod.reduce((a, b) =>
        new Date(a.startTime) > new Date(b.startTime) ? a : b
      );
      lastInPeriod = format(new Date(last.startTime), 'yyyy-MM-dd');
    }

    const mile = rec.milestones
      .map((m) => `[${m.at}] ${m.text}`)
      .join(langIsZh ? '；' : '; ');

    if (langIsZh) {
      lines.push(
        `- 「${name}」｜状态：${statusLabel(rec.status, true)}｜上次对齐：${format(aligned, 'yyyy.MM.dd')}（${daysSince} 天前）`
      );
      if (inPeriod.length > 0) {
        lines.push(`  本周期相关日程：${inPeriod.length} 次；最近一条：${lastInPeriod}`);
      } else {
        lines.push(`  本周期相关日程：无`);
      }
      if (mile) lines.push(`  里程碑：${mile}`);
    } else {
      lines.push(
        `- "${name}" | Status: ${statusLabel(rec.status, false)} | Last aligned: ${format(aligned, 'yyyy.MM.dd')} (${daysSince} day(s) ago)`
      );
      if (inPeriod.length > 0) {
        lines.push(`  Events this period: ${inPeriod.length}; latest: ${lastInPeriod}`);
      } else {
        lines.push(`  Events this period: none`);
      }
      if (mile) lines.push(`  Milestones: ${mile}`);
    }
  }

  return lines.join('\n');
}
