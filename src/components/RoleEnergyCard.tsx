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
              return (
                <div
                  key={roleId}
                  className="h-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: getRoleColor(roleId) }}
                  title={`${getRoleDisplayName(roleId, isZh ? 'zh' : 'en')} ${pct}%`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {rolePercentages.map(([roleId, pct]) => (
              <span key={roleId} style={{ color: 'var(--app-muted)' }}>
                {getRoleDisplayName(roleId, isZh ? 'zh' : 'en')} {pct}%
              </span>
            ))}
          </div>
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
