import { format, differenceInCalendarDays } from 'date-fns';
import type { ScheduleEvent } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import {
  loadLongTermGoalMeta,
  getOrCreateRecord,
  mergeLongTermGoalNames,
  type GoalStatus,
} from '@/lib/longTermGoalMetaStorage';
import { getLastActionDateForGoal } from '@/lib/longTermGoalLastAction';

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
    const lastAction = getLastActionDateForGoal(events, name, completedInstances);
    const daysSince = lastAction
      ? Math.max(0, differenceInCalendarDays(today, lastAction))
      : null;
    const inPeriod = expanded.filter((e) => e.longTermGoals?.includes(name));
    let lastInPeriod = '';
    if (inPeriod.length > 0) {
      const last = inPeriod.reduce((a, b) =>
        new Date(a.startTime) > new Date(b.startTime) ? a : b
      );
      lastInPeriod = format(new Date(last.startTime), 'yyyy-MM-dd');
    }

    const milestoneLines: string[] = [];
    for (const mt of rec.mediumTermGoals ?? []) {
      const inner = (mt.milestones ?? [])
        .map((m) => `[${m.at}] ${m.text}`)
        .join(langIsZh ? '；' : '; ');
      if (inner) {
        milestoneLines.push(
          langIsZh ? `中短期「${mt.title}」里程碑：${inner}` : `Short-Term "${mt.title}" Milestones: ${inner}`
        );
      }
    }
    const targetSuffixZh = rec.targetAt?.trim() ? `｜目标时间：${rec.targetAt.trim()}` : '';
    const targetSuffixEn = rec.targetAt?.trim() ? ` | Target Date: ${rec.targetAt.trim()}` : '';
    const actionLineZh = lastAction
      ? `上次行动：${format(lastAction, 'yyyy.MM.dd')}（${daysSince} 天前）`
      : '上次行动：暂无';
    const actionLineEn = lastAction
      ? `Last action: ${format(lastAction, 'yyyy.MM.dd')} (${daysSince} day(s) ago)`
      : 'Last action: None yet';

    if (langIsZh) {
      lines.push(
        `- 「${name}」｜状态：${statusLabel(rec.status, true)}${targetSuffixZh}｜${actionLineZh}`
      );
      if (inPeriod.length > 0) {
        lines.push(`  本周期相关日程：${inPeriod.length} 次；最近一条：${lastInPeriod}`);
      } else {
        lines.push(`  本周期相关日程：无`);
      }
      if (milestoneLines.length > 0) {
        for (const line of milestoneLines) {
          lines.push(`  ${line}`);
        }
      }
    } else {
      lines.push(
        `- "${name}" | Status: ${statusLabel(rec.status, false)}${targetSuffixEn} | ${actionLineEn}`
      );
      if (inPeriod.length > 0) {
        lines.push(`  Events this period: ${inPeriod.length}; latest: ${lastInPeriod}`);
      } else {
        lines.push(`  Events this period: none`);
      }
      if (milestoneLines.length > 0) {
        for (const line of milestoneLines) {
          lines.push(`  ${line}`);
        }
      }
    }
  }

  return lines.join('\n');
}
