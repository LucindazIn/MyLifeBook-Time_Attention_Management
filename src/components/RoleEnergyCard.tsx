import React, { useMemo, useState, useCallback } from 'react';
import { PieChart } from 'lucide-react';
import { endOfDay, format, parseISO, startOfDay, startOfMonth } from 'date-fns';
import type { ScheduleEvent, AppLanguage } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { aggregateByRole } from '@/lib/roleAggregation';
import { getRoleColor, getRoleDisplayName } from '@/lib/constants/roles';
import { getChapterRange, type ChapterPeriodKey } from '@/lib/dateRange';
import { cn } from '@/lib/utils';
import { PIE_CX, PIE_CY, PIE_R_HOLE, PIE_R_OUTER, pieSectorPath } from '@/lib/pieChartSvg';

const ROLE_BALANCE_THRESHOLD_PCT = 78;

const RANGE_OPTIONS: ChapterPeriodKey[] = ['this_week', 'this_month', 'custom'];

function getRangeLabel(period: ChapterPeriodKey, isZh: boolean): string {
  const labels: Record<ChapterPeriodKey, string> = {
    this_week: isZh ? '本周' : 'This Week',
    last_week: isZh ? '上周' : 'Last Week',
    this_month: isZh ? '本月' : 'This Month',
    custom: isZh ? '自定义' : 'Custom',
  };
  return labels[period];
}

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
  const [range, setRange] = useState<ChapterPeriodKey>('this_week');
  const [customStart, setCustomStart] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [hoveredRoleId, setHoveredRoleId] = useState<string | null>(null);

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

  const { start, end } = useMemo(() => {
    if (range === 'custom') {
      const a = startOfDay(parseISO(customStart));
      const b = endOfDay(parseISO(customEnd));
      const s = a.getTime() <= b.getTime() ? a : b;
      const e = a.getTime() <= b.getTime() ? b : a;
      return { start: s, end: e };
    }
    return getChapterRange(range);
  }, [range, customStart, customEnd]);

  const expanded = useMemo(
    () => expandRecurringEvents(events, start, end, completedInstances),
    [events, start, end, completedInstances]
  );

  const roleSegments = useMemo(() => aggregateByRole(expanded), [expanded]);
  const slices = useMemo(() => roleSegments.map((s) => [s.roleId, s.count] as [string, number]), [roleSegments]);
  const total = useMemo(() => slices.reduce((acc, [, c]) => acc + c, 0), [slices]);

  const totalAllEvents = expanded.length;
  const dominantRolePct = useMemo(() => {
    if (totalAllEvents <= 0 || roleSegments.length === 0) return 0;
    return Math.max(...roleSegments.map((s) => Math.round((s.count / totalAllEvents) * 100)));
  }, [roleSegments, totalAllEvents]);
  const showBalanceReminder = dominantRolePct >= ROLE_BALANCE_THRESHOLD_PCT;

  const hoveredInfo = useMemo(() => {
    if (!hoveredRoleId || total === 0) return null;
    const pair = slices.find(([id]) => id === hoveredRoleId);
    if (!pair) return null;
    const [, count] = pair;
    const pct = (count / total) * 100;
    const name = getRoleDisplayName(hoveredRoleId, isZh ? 'zh' : 'en');
    return { roleId: hoveredRoleId, name, count, pct };
  }, [hoveredRoleId, slices, total, isZh]);

  const paths = useMemo(() => {
    if (total === 0) return [];
    let acc = 0;
    return slices.map(([roleId, count]) => {
      const startAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
      acc += count;
      const endAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
      const d = pieSectorPath(PIE_CX, PIE_CY, PIE_R_OUTER, startAngle, endAngle);
      return { roleId, count, d, color: getRoleColor(roleId) };
    });
  }, [slices, total]);

  return (
    <div className="space-y-4 rounded-xl p-1" style={{ color: 'var(--app-text)', backgroundColor: 'var(--app-surface)' }}>
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
        <PieChart className="w-4 h-4 shrink-0" style={{ color: 'var(--app-accent)' }} />
        {isZh ? '角色能量' : 'Role Balance'}
      </h3>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                'text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors',
                range === r
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border text-muted-foreground hover:bg-field'
              )}
            >
              {getRangeLabel(r, isZh)}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--app-muted)' }}>
            <label className="flex items-center gap-1.5 shrink-0">
              <span className="whitespace-nowrap">{isZh ? '起' : 'From'}</span>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => onCustomStartChange(e.target.value)}
                className="rounded-lg border bg-field px-2 py-1 text-foreground tabular-nums"
                style={{ borderColor: 'var(--app-border)' }}
              />
            </label>
            <span aria-hidden className="text-muted-foreground">
              —
            </span>
            <label className="flex items-center gap-1.5 shrink-0">
              <span className="whitespace-nowrap">{isZh ? '止' : 'To'}</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                onChange={(e) => onCustomEndChange(e.target.value)}
                className="rounded-lg border bg-field px-2 py-1 text-foreground tabular-nums"
                style={{ borderColor: 'var(--app-border)' }}
              />
            </label>
          </div>
        )}
      </div>

      {total === 0 ? (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--app-muted)' }}>
          {isZh ? '该周期内无身份日程，设置身份后将显示角色分布' : 'No Events With Roles In This Period'}
        </p>
      ) : (
        <>
          <div className="relative mx-auto w-full max-w-[220px] aspect-square min-h-[160px]">
            <svg
              viewBox="0 0 100 100"
              className="h-full w-full overflow-visible"
              role="img"
              aria-label={isZh ? '角色能量饼图' : 'Role balance pie chart'}
            >
              {paths.map(({ roleId, d, color }) => (
                <path
                  key={roleId}
                  d={d}
                  fill={color}
                  stroke="var(--app-surface)"
                  strokeWidth={0.75}
                  className="cursor-pointer transition-opacity outline-none"
                  style={{ opacity: hoveredRoleId && hoveredRoleId !== roleId ? 0.45 : 1 }}
                  onMouseEnter={() => setHoveredRoleId(roleId)}
                  onMouseLeave={() => setHoveredRoleId(null)}
                  onFocus={() => setHoveredRoleId(roleId)}
                  onBlur={() => setHoveredRoleId(null)}
                  tabIndex={0}
                />
              ))}
              <circle
                cx={PIE_CX}
                cy={PIE_CY}
                r={PIE_R_HOLE}
                fill="var(--app-surface)"
                stroke="var(--app-border)"
                strokeWidth={0.5}
                onMouseEnter={() => setHoveredRoleId(null)}
              />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[26%] text-center">
              <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: 'var(--app-text)' }}>
                {total}
              </span>
              <span className="mt-1 text-[10px] leading-tight" style={{ color: 'var(--app-muted)' }}>
                {isZh ? '条身份日程' : 'role events'}
              </span>
            </div>
          </div>

          <div
            className={cn(
              'flex min-h-[3.25rem] items-center justify-center rounded-xl border px-3 py-2 text-center text-sm transition-[border-color,background-color]',
              hoveredInfo ? 'border-border bg-field/80' : 'border-transparent bg-transparent'
            )}
            aria-live="polite"
          >
            {hoveredInfo ? (
              <>
                <span className="font-medium" style={{ color: 'var(--app-text)' }}>
                  {hoveredInfo.name}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  · {hoveredInfo.count} {isZh ? '条' : 'events'} · {hoveredInfo.pct.toFixed(1)}%
                </span>
              </>
            ) : (
              <span className="text-[11px] leading-snug" style={{ color: 'var(--app-muted)' }}>
                {isZh ? '悬停扇区查看角色与占比' : 'Hover A Slice For Details'}
              </span>
            )}
          </div>

          <ul className="space-y-1.5 text-xs" style={{ color: 'var(--app-muted)' }}>
            {slices.map(([roleId, count]) => {
              const pct = (count / total) * 100;
              const name = getRoleDisplayName(roleId, isZh ? 'zh' : 'en');
              return (
                <li key={roleId} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: getRoleColor(roleId) }}
                      aria-hidden
                    />
                    <span className="truncate" style={{ color: 'var(--app-text)' }}>
                      {name}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {count} ({pct.toFixed(1)}%)
                  </span>
                </li>
              );
            })}
          </ul>

          {showBalanceReminder && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--app-field)', color: 'var(--app-muted)' }}>
              {isZh
                ? '当前所选时间范围内某一角色占比偏高，不妨留一点时间给其他身份，例如静修者。'
                : 'One Role Dominates This Period—Consider Making Room For Others, E.g. Rest Or Reflection.'}
            </p>
          )}
        </>
      )}
    </div>
  );
};
