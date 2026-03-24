import React, { useMemo, useState, useRef, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, subDays, addDays, differenceInCalendarDays } from 'date-fns';
import { TrendingUp, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import type { ScheduleEvent, AppLanguage } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { getRoleColor, getRoleDisplayName, PRESET_ROLES } from '@/lib/constants/roles';
import {
  aggregateByRole,
  rolePercentagesByCount,
} from '@/lib/roleAggregation';
import {
  aggregateByGoal,
  goalPercentagesByCount,
} from '@/lib/goalAggregation';
import { computeDailyEnergySeries } from '@/lib/lifeEnergy';
import { getLifeEnergyForDay, setLifeEnergyForDay } from '@/lib/lifeEnergyStorage';
import { cn } from '@/lib/utils';

export type RangeKey = 'month' | 'quarter' | 'full';

export interface RoleBalanceCardProps {
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
}

function getRangeDates(
  range: RangeKey,
  now: Date,
  earliestEventDate: Date | null
): { currentStart: Date; currentEnd: Date; previousStart: Date; previousEnd: Date } {
  switch (range) {
    case 'month': {
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const prevMonthEnd = subDays(monthStart, 1);
      return {
        currentStart: monthStart,
        currentEnd: monthEnd,
        previousStart: startOfMonth(prevMonthEnd),
        previousEnd: endOfMonth(prevMonthEnd),
      };
    }
    case 'quarter': {
      const quarterEnd = now;
      const quarterStart = subDays(now, 90);
      const prevQuarterEnd = subDays(quarterStart, 1);
      return {
        currentStart: quarterStart,
        currentEnd: quarterEnd,
        previousStart: subDays(prevQuarterEnd, 90),
        previousEnd: prevQuarterEnd,
      };
    }
    case 'full': {
      const fullEnd = now;
      const fullStart = earliestEventDate ?? subDays(now, 365);
      const len = differenceInCalendarDays(fullEnd, fullStart) + 1;
      const prevEnd = subDays(fullStart, 1);
      const prevStart = subDays(prevEnd, len - 1);
      return {
        currentStart: fullStart,
        currentEnd: fullEnd,
        previousStart: prevStart,
        previousEnd: prevEnd,
      };
    }
  }
}

const GOAL_PALETTE = PRESET_ROLES.map((r) => r.color);

const CHART_HEIGHT = 140;
const PADDING = { top: 8, right: 8, bottom: 24, left: 32 };
const POINT_R = 5;
const POINT_HIT_R = 14;

type PointData = { dateKey: string; energy: number; dayIndex: number };

export const RoleBalanceCard: React.FC<RoleBalanceCardProps> = ({
  events,
  completedInstances,
  language,
}) => {
  const [range, setRange] = useState<RangeKey>('month');
  const [energyOverrides, setEnergyOverrides] = useState<Record<string, number>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isZh = language === 'zh';

  const now = useMemo(() => new Date(), []);
  const earliestEventDate = useMemo(() => {
    const withRoleOrGoal = events.filter(
      (e) => (e.role != null && e.role !== '') || ((e.longTermGoals?.length ?? 0) > 0)
    );
    if (!withRoleOrGoal.length) return null;
    const t = Math.min(...withRoleOrGoal.map((e) => new Date(e.startTime).getTime()));
    return new Date(t);
  }, [events]);

  const { currentStart, currentEnd, previousStart, previousEnd } = useMemo(
    () => getRangeDates(range, now, earliestEventDate),
    [range, now, earliestEventDate]
  );

  const expandedCurrent = useMemo(
    () => expandRecurringEvents(events, currentStart, currentEnd, completedInstances),
    [events, currentStart, currentEnd, completedInstances]
  );

  const dayCount = differenceInCalendarDays(currentEnd, currentStart) + 1;
  const dayKeys = useMemo(() => {
    const keys: string[] = [];
    let d = new Date(currentStart.getTime());
    const endTime = currentEnd.getTime();
    while (d.getTime() <= endTime) {
      keys.push(format(d, 'yyyy-MM-dd'));
      d = addDays(d, 1);
    }
    return keys;
  }, [currentStart, currentEnd]);

  const rangeKeyForStorage = range === 'full' ? 'full' : range;

  const dailyEnergyComputed = useMemo(
    () => computeDailyEnergySeries(expandedCurrent, currentStart, currentEnd),
    [expandedCurrent, currentStart, currentEnd]
  );

  const dailyEnergyWithOverrides = useMemo((): PointData[] => {
    return dailyEnergyComputed.map(({ dateKey, energy }, dayIndex) => ({
      dateKey,
      dayIndex,
      energy: energyOverrides[dateKey] ?? getLifeEnergyForDay(rangeKeyForStorage, dateKey) ?? energy,
    }));
  }, [dailyEnergyComputed, energyOverrides, rangeKeyForStorage]);

  const rolePercentagesByDay = useMemo(() => {
    return dayKeys.map((dateKey) => {
      const dayEvents = expandedCurrent.filter(
        (e) => format(new Date(e.startTime), 'yyyy-MM-dd') === dateKey
      );
      const segs = aggregateByRole(dayEvents);
      const total = segs.reduce((a, s) => a + s.count, 0) || 1;
      return rolePercentagesByCount(segs, total);
    });
  }, [dayKeys, expandedCurrent]);

  const goalPercentagesByDay = useMemo(() => {
    return dayKeys.map((dateKey) => {
      const dayEvents = expandedCurrent.filter(
        (e) => format(new Date(e.startTime), 'yyyy-MM-dd') === dateKey
      );
      const segs = aggregateByGoal(dayEvents);
      const total = segs.reduce((a, s) => a + s.count, 0) || 1;
      return goalPercentagesByCount(segs, total);
    });
  }, [dayKeys, expandedCurrent]);

  const allRoleIds = useMemo(() => {
    const set = new Set<string>();
    rolePercentagesByDay.forEach((row) => row.forEach(([id]) => set.add(id)));
    return Array.from(set).sort();
  }, [rolePercentagesByDay]);

  const allGoalIds = useMemo(() => {
    const set = new Set<string>();
    goalPercentagesByDay.forEach((row) => row.forEach(([id]) => set.add(id)));
    return Array.from(set).sort();
  }, [goalPercentagesByDay]);

  const handleEnergyDrag = useCallback(
    (dateKey: string, newEnergy: number) => {
      const clamped = Math.min(100, Math.max(0, Math.round(newEnergy)));
      setLifeEnergyForDay(rangeKeyForStorage, dateKey, clamped);
      setEnergyOverrides((prev) => ({ ...prev, [dateKey]: clamped }));
    },
    [rangeKeyForStorage]
  );

  const handleExportPng = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: null,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `人生曲线_${range === 'month' ? '本月' : range === 'quarter' ? '近3个月' : '全时间段'}_${format(now, 'yyyy-MM')}.png`;
      a.click();
    } catch {
      // ignore
    }
  }, [range, now]);

  const rangeLabels: Record<RangeKey, string> = isZh
    ? { month: '本月', quarter: '近3个月', full: '全时间段' }
    : { month: 'This Month', quarter: 'Last 3 Months', full: 'All Time' };

  const segmentLabel = (id: string, _pct: number) =>
    getRoleDisplayName(id, isZh ? 'zh' : 'en');
  const segmentColor = (id: string, index: number) => getRoleColor(id);
  const goalColor = (id: string, index: number) =>
    GOAL_PALETTE[index % GOAL_PALETTE.length];

  return (
    <div ref={cardRef} className="space-y-4" style={{ color: 'var(--app-text)' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
          <TrendingUp className="w-4 h-4" style={{ color: 'var(--app-accent)' }} />
          {isZh ? '人生曲线' : 'Life Curve'}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPng}
            className="text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors flex items-center gap-1.5"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
            title={isZh ? '导出 PNG' : 'Export PNG'}
          >
            <Download className="w-3.5 h-3.5" />
            {isZh ? '导出 PNG' : 'Export PNG'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['month', 'quarter', 'full'] as const).map((r) => (
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
            {rangeLabels[r]}
          </button>
        ))}
      </div>

      {expandedCurrent.length === 0 && (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--app-muted)' }}>
          {isZh ? '选定范围内暂无事件' : 'No Events In Selected Range'}
        </p>
      )}

      {expandedCurrent.length > 0 && (
        <>
          {/* 生命能量（按角色分类） */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold" style={{ color: 'var(--app-text)' }}>
              {isZh ? '生命能量（按角色分类）' : 'Life Energy (By Role)'}
            </h4>
            <StackedAreaChart
              dayCount={dayCount}
              dayKeys={dayKeys}
              percentagesByDay={rolePercentagesByDay}
              segmentOrder={allRoleIds}
              segmentColor={segmentColor}
              segmentLabel={segmentLabel}
              dailyEnergy={dailyEnergyWithOverrides}
              rangeKey={rangeKeyForStorage}
              dragging={dragging}
              setDragging={setDragging}
              onEnergyDrag={handleEnergyDrag}
              isZh={isZh}
            />
            {allRoleIds.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {allRoleIds.map((id, i) => (
                  <div key={id} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: segmentColor(id, i) }}
                    />
                    <span style={{ color: 'var(--app-text)' }}>{segmentLabel(id, 0)}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: 'var(--app-accent)' }} />
                  <span style={{ color: 'var(--app-muted)' }}>{isZh ? '生命能量' : 'Life Energy'}</span>
                </div>
              </div>
            )}
          </section>

          {/* 生命能量（按目标分类） */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold" style={{ color: 'var(--app-text)' }}>
              {isZh ? '生命能量（按目标分类）' : 'Life Energy (By Goal)'}
            </h4>
            <StackedAreaChart
              dayCount={dayCount}
              dayKeys={dayKeys}
              percentagesByDay={goalPercentagesByDay}
              segmentOrder={allGoalIds}
              segmentColor={goalColor}
              segmentLabel={(id) => id}
              dailyEnergy={dailyEnergyWithOverrides}
              rangeKey={rangeKeyForStorage}
              dragging={dragging}
              setDragging={setDragging}
              onEnergyDrag={handleEnergyDrag}
              isZh={isZh}
            />
            {allGoalIds.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {allGoalIds.map((id, i) => (
                  <div key={id} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: goalColor(id, i) }}
                    />
                    <span style={{ color: 'var(--app-text)' }}>{id}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: 'var(--app-accent)' }} />
                  <span style={{ color: 'var(--app-muted)' }}>{isZh ? '生命能量' : 'Life Energy'}</span>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

interface StackedAreaChartProps {
  dayCount: number;
  dayKeys: string[];
  percentagesByDay: [string, number][][];
  segmentOrder: string[];
  segmentColor: (id: string, index: number) => string;
  segmentLabel: (id: string, pct: number) => string;
  dailyEnergy: PointData[];
  rangeKey: string;
  dragging: string | null;
  setDragging: (d: string | null) => void;
  onEnergyDrag: (dateKey: string, energy: number) => void;
  isZh: boolean;
}

function StackedAreaChart({
  dayCount,
  dayKeys,
  percentagesByDay,
  segmentOrder,
  segmentColor,
  dailyEnergy,
  dragging,
  setDragging,
  onEnergyDrag,
  isZh,
}: StackedAreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 400));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const innerW = width - PADDING.left - PADDING.right;
  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const scaleX = dayCount <= 1 ? 0 : innerW / (dayCount - 1);
  const scaleY = innerH / 100;

  const cumulativeByDay = useMemo(() => {
    return percentagesByDay.map((row) => {
      const cum: number[] = [];
      let c = 0;
      for (const id of segmentOrder) {
        const pct = row.find(([k]) => k === id)?.[1] ?? 0;
        c += pct;
        cum.push(c);
      }
      return cum;
    });
  }, [percentagesByDay, segmentOrder]);

  const energyPath = useMemo(() => {
    if (dailyEnergy.length === 0) return '';
    const pts = dailyEnergy.map((p) => {
      const x = PADDING.left + p.dayIndex * scaleX;
      const y = PADDING.top + (100 - p.energy) * scaleY;
      return `${x},${y}`;
    });
    return `M ${pts.join(' L ')}`;
  }, [dailyEnergy, scaleX, scaleY]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, dateKey: string) => {
      e.preventDefault();
      setDragging(dateKey);
    },
    [setDragging]
  );

  React.useEffect(() => {
    if (!dragging) return;
    const point = dailyEnergy.find((p) => p.dateKey === dragging);
    if (!point) return;

    const onMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const chartTop = rect.top + PADDING.top;
      const relativeY = e.clientY - chartTop;
      const energy = 100 * (1 - relativeY / innerH);
      const clamped = Math.min(100, Math.max(0, energy));
      onEnergyDrag(dragging, clamped);
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, innerH, onEnergyDrag]);

  const xLabels = useMemo(() => {
    const step = dayCount <= 7 ? 1 : dayCount <= 31 ? Math.ceil(dayCount / 7) : Math.ceil(dayCount / 5);
    const out: { dayIndex: number; label: string }[] = [];
    for (let i = 0; i < dayKeys.length; i += step) {
      out.push({ dayIndex: i, label: format(new Date(dayKeys[i]), isZh ? 'M/d' : 'MMM d') });
    }
    if (dayKeys.length > 0 && out[out.length - 1]?.dayIndex !== dayKeys.length - 1) {
      out.push({ dayIndex: dayKeys.length - 1, label: format(new Date(dayKeys[dayKeys.length - 1]), isZh ? 'M/d' : 'MMM d') });
    }
    return out;
  }, [dayKeys, dayCount, isZh]);

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <svg
        width={width}
        height={CHART_HEIGHT}
        className="overflow-visible"
        style={{ minWidth: Math.max(320, dayCount * 12) }}
      >
        <defs>
          <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--app-accent)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--app-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Y axis labels */}
        {[0, 50, 100].map((v) => (
          <text
            key={v}
            x={PADDING.left - 6}
            y={PADDING.top + (100 - v) * scaleY}
            textAnchor="end"
            dominantBaseline="middle"
            className="text-[10px] fill-[var(--app-muted)]"
          >
            {v}
          </text>
        ))}
        {/* X axis labels */}
        {xLabels.map(({ dayIndex, label }) => (
          <text
            key={dayIndex}
            x={PADDING.left + dayIndex * scaleX}
            y={CHART_HEIGHT - 6}
            textAnchor="middle"
            className="text-[10px] fill-[var(--app-muted)]"
          >
            {label}
          </text>
        ))}
        {/* Stacked area — pointer-events: none 以便点击到前景能量点 */}
        <g style={{ pointerEvents: 'none' }}>
          {segmentOrder.map((id, segIndex) => {
            const pathD = cumulativeByDay
              .map((cum, dayIndex) => {
                const x = PADDING.left + dayIndex * scaleX;
                const top = PADDING.top + (100 - (cum[segIndex] ?? 0)) * scaleY;
                const bottom = PADDING.top + (100 - (cum[segIndex - 1] ?? 0)) * scaleY;
                return { x, top, bottom };
              })
              .filter((_, i) => i < cumulativeByDay.length);
            if (pathD.length === 0) return null;
            const topPoints = pathD.map((p) => `${p.x},${p.top}`).join(' L ');
            const bottomPoints = pathD.map((p) => `${p.x},${p.bottom}`).reverse().join(' L ');
            const d = `M ${pathD[0].x},${pathD[0].bottom} L ${topPoints} L ${pathD[pathD.length - 1].x},${pathD[pathD.length - 1].bottom} L ${bottomPoints} Z`;
            return (
              <path
                key={id}
                d={d}
                fill={segmentColor(id, segIndex)}
                fillOpacity={0.7}
                stroke="none"
              />
            );
          })}
          {/* Energy line */}
          <path
            d={energyPath}
            fill="none"
            stroke="var(--app-accent)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        {/* Draggable points：大 hit 区域 + 小可见圆点 */}
        {dailyEnergy.map((p) => {
          const x = PADDING.left + p.dayIndex * scaleX;
          const y = PADDING.top + (100 - p.energy) * scaleY;
          return (
            <g key={p.dateKey}>
              <circle
                cx={x}
                cy={y}
                r={POINT_HIT_R}
                fill="transparent"
                className="cursor-grab active:cursor-grabbing"
                style={{ touchAction: 'none' }}
                onMouseDown={(e) => handleMouseDown(e, p.dateKey)}
                aria-label={`${p.dateKey} ${Math.round(p.energy)}`}
              />
              <circle
                cx={x}
                cy={y}
                r={POINT_R}
                fill="var(--app-accent)"
                stroke="var(--app-surface)"
                strokeWidth={2}
                style={{ pointerEvents: 'none' }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
