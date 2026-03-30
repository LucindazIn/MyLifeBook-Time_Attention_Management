import React, { useMemo, useState, useCallback } from 'react';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  parseISO,
  format,
} from 'date-fns';
import { Zap } from 'lucide-react';
import type { ScheduleEvent, AppLanguage } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { aggregateByRole, rolePercentagesByCount } from '@/lib/roleAggregation';
import { getRoleColor, getRoleDisplayName } from '@/lib/constants/roles';
import { cn } from '@/lib/utils';

const ROLE_BALANCE_THRESHOLD_PCT = 78;

type RangeKey = 'week' | 'month' | 'custom';

export interface RoleEnergyCardProps {
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
}

export const RoleEnergyCard: React.FC<RoleEnergyCardProps> = ({
  events,
  completedInstances,
  language,
}) => {
  const isZh = language === 'zh';
  const [range, setRange] = useState<RangeKey>('week');
  const [customStart, setCustomStart] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const onCustomStartChange = useCallback(
    (value: string) => {
      if (!value) return;
      setCustomStart(value);
      if (value > customEnd) setCustomEnd(value);
    },
    [customEnd]
  );

  const onCustomEndChange = useCallback(
    (value: string) => {
      if (!value) return;
      setCustomEnd(value);
      if (value < customStart) setCustomStart(value);
    },
    [customStart]
  );

  const { currentStart, currentEnd } = useMemo(() => {
    const now = new Date();
    if (range === 'week') {
      return {
        currentStart: startOfWeek(now, { weekStartsOn: 1 }),
        currentEnd: endOfWeek(now, { weekStartsOn: 1 }),
      };
    }
    if (range === 'month') {
      return {
        currentStart: startOfMonth(now),
        currentEnd: endOfMonth(now),
      };
    }
    const a = startOfDay(parseISO(customStart));
    const b = endOfDay(parseISO(customEnd));
    const s = a.getTime() <= b.getTime() ? a : b;
    const e = a.getTime() <= b.getTime() ? b : a;
    return { currentStart: s, currentEnd: e };
  }, [range, customStart, customEnd]);

  const rangeEvents = useMemo(
    () => expandRecurringEvents(events, currentStart, currentEnd, completedInstances),
    [events, currentStart, currentEnd, completedInstances]
  );

  const roleSegments = useMemo(() => aggregateByRole(rangeEvents), [rangeEvents]);
  const rolePercentages = useMemo(
    () => rolePercentagesByCount(roleSegments, rangeEvents.length),
    [roleSegments, rangeEvents.length]
  );
  const dominantRolePct = rolePercentages.length ? Math.max(...rolePercentages.map(([, p]) => p)) : 0;
  const showBalanceReminder = dominantRolePct >= ROLE_BALANCE_THRESHOLD_PCT;

  const roleCountById = useMemo(() => {
    const m = new Map<string, number>();
    roleSegments.forEach((s) => m.set(s.roleId, s.count));
    return m;
  }, [roleSegments]);
  const totalRangeEvents = rangeEvents.length;

  const rangeLabels: Record<RangeKey, string> = isZh
    ? { week: '本周', month: '本月', custom: '自定义' }
    : { week: 'This Week', month: 'This Month', custom: 'Custom' };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
        <Zap className="w-4 h-4" style={{ color: 'var(--app-accent)' }} />
        {isZh ? '角色能量' : 'Role Balance'}
      </h3>

      <div className="flex flex-wrap items-center gap-2">
        {(['week', 'month', 'custom'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRange(key)}
            className={cn(
              'px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors text-foreground',
              range === key ? 'border-accent bg-accent/15' : 'border-border bg-transparent hover:bg-field'
            )}
          >
            {rangeLabels[key]}
          </button>
        ))}
      </div>

      {range === 'custom' && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0">
            <label className="block text-[10px] font-medium mb-0.5" style={{ color: 'var(--app-muted)' }}>
              {isZh ? '开始' : 'Start'}
            </label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => onCustomStartChange(e.target.value)}
              className="rounded-md border border-border bg-field px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-[10px] font-medium mb-0.5" style={{ color: 'var(--app-muted)' }}>
              {isZh ? '结束' : 'End'}
            </label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => onCustomEndChange(e.target.value)}
              className="rounded-md border border-border bg-field px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
        </div>
      )}

      {rolePercentages.length > 0 ? (
        <>
          <div
            className="h-3 w-full rounded-full overflow-hidden flex"
            style={{ background: 'var(--app-border)' }}
          >
            {rolePercentages.map(([roleId, pct]) => {
              if (pct <= 0) return null;
              const n = roleCountById.get(roleId) ?? 0;
              const name = getRoleDisplayName(roleId, isZh ? 'zh' : 'en');
              const titleStr = isZh
                ? `${name}：${pct}%（${n}/${totalRangeEvents}）`
                : `${name}: ${pct}% (${n}/${totalRangeEvents})`;
              return (
                <div
                  key={roleId}
                  className="h-full min-w-px shrink-0 transition-all"
                  style={{ width: `${pct}%`, backgroundColor: getRoleColor(roleId) }}
                  title={titleStr}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs">
            {rolePercentages.map(([roleId]) => (
              <span
                key={roleId}
                className="inline-flex min-w-0 items-center gap-1.5"
                style={{ color: 'var(--app-text)' }}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: getRoleColor(roleId) }} aria-hidden />
                <span className="truncate">{getRoleDisplayName(roleId, isZh ? 'zh' : 'en')}</span>
              </span>
            ))}
          </div>
          <p className="text-[10px] leading-snug" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '悬停色条查看比例与条数' : 'Hover The Bar For Proportion And Counts'}
          </p>
          {showBalanceReminder && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--app-field)', color: 'var(--app-muted)' }}>
              {isZh
                ? '当前所选时间范围内某一角色占比偏高，不妨留一点时间给其他身份，例如静修者。'
                : 'One role dominates this period—consider making room for others, e.g. rest or reflection.'}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
          {isZh ? '为事件设置身份后，将在此显示各角色占比' : 'Set Roles On Events To See Balance Here'}
        </p>
      )}
    </div>
  );
};
