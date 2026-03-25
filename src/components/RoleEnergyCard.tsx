import React, { useMemo } from 'react';
import { startOfWeek, endOfWeek, subDays } from 'date-fns';
import { Zap } from 'lucide-react';
import type { ScheduleEvent, AppLanguage } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { aggregateByRole, rolePercentagesByCount } from '@/lib/roleAggregation';
import { getRoleColor, getRoleDisplayName } from '@/lib/constants/roles';

const ROLE_BALANCE_THRESHOLD_PCT = 78;

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
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const rangeStart = subDays(new Date(), 90);

  const expandedRecent = useMemo(
    () => expandRecurringEvents(events, rangeStart, new Date(), completedInstances),
    [events, completedInstances]
  );

  const weekEvents = useMemo(
    () => expandedRecent.filter((e) => {
      const d = new Date(e.startTime);
      return d >= weekStart && d <= weekEnd;
    }),
    [expandedRecent, weekStart, weekEnd]
  );

  const roleSegments = useMemo(() => aggregateByRole(weekEvents), [weekEvents]);
  const rolePercentages = useMemo(
    () => rolePercentagesByCount(roleSegments, weekEvents.length),
    [roleSegments, weekEvents.length]
  );
  const dominantRolePct = rolePercentages.length ? Math.max(...rolePercentages.map(([, p]) => p)) : 0;
  const showBalanceReminder = dominantRolePct >= ROLE_BALANCE_THRESHOLD_PCT;

  const roleCountById = useMemo(() => {
    const m = new Map<string, number>();
    roleSegments.forEach((s) => m.set(s.roleId, s.count));
    return m;
  }, [roleSegments]);
  const totalWeekEvents = weekEvents.length;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
        <Zap className="w-4 h-4" style={{ color: 'var(--app-accent)' }} />
        {isZh ? '角色能量' : 'Role Balance'}
      </h3>
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
                ? `${name}：${pct}%（${n}/${totalWeekEvents}）`
                : `${name}: ${pct}% (${n}/${totalWeekEvents})`;
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
            {isZh ? '悬停色条查看比例与条数' : 'Hover Bar For Proportion And Counts'}
          </p>
          {showBalanceReminder && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--app-field)', color: 'var(--app-muted)' }}>
              {isZh
                ? '本周某一角色占比偏高，不妨留一点时间给其他身份，例如静修者。'
                : 'One role dominates this week—consider making room for others, e.g. rest or reflection.'}
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
