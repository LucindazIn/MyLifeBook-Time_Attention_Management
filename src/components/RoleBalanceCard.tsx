import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  subDays,
  addDays,
  differenceInCalendarDays,
  startOfDay,
  endOfDay,
  parseISO,
} from 'date-fns';
import { TrendingUp } from 'lucide-react';
import type { ScheduleEvent, AppLanguage } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { computeDailyEnergySeries } from '@/lib/lifeEnergy';
import {
  LIFE_ENERGY_GLOBAL_RANGE_KEY,
  getLifeEnergyOverrideForDate,
  setLifeEnergyForDay,
} from '@/lib/lifeEnergyStorage';
import { cn } from '@/lib/utils';

export type RangeKey = 'month' | 'quarter' | 'custom';

export interface RoleBalanceCardProps {
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
  /** When localStorage-backed curve data syncs from another device, force recomputation. */
  collectionStateRevision?: number;
}

function getRangeDates(
  range: Exclude<RangeKey, 'custom'>,
  now: Date
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
  }
}

const CHART_HEIGHT = 140;
/** Extra SVG height so value badges above top points are not clipped */
const CHART_TOP_PAD = 24;
const PADDING = { top: 8, right: 8, bottom: 24, left: 32 };
const POINT_R = 5;
const POINT_HIT_R = 14;
const BADGE_H = 30;
const BADGE_GAP = 6;

type PointData = { dateKey: string; energy: number; dayIndex: number };

export const RoleBalanceCard: React.FC<RoleBalanceCardProps> = ({
  events,
  completedInstances,
  language,
  collectionStateRevision = 0,
}) => {
  const [range, setRange] = useState<RangeKey>('month');
  const [customStart, setCustomStart] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [energyOverrides, setEnergyOverrides] = useState<Record<string, number>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const isZh = language === 'zh';

  const now = useMemo(() => new Date(), []);

  const { currentStart, currentEnd } = useMemo(() => {
    if (range === 'custom') {
      const a = startOfDay(parseISO(customStart));
      const b = endOfDay(parseISO(customEnd));
      const s = a.getTime() <= b.getTime() ? a : b;
      const e = a.getTime() <= b.getTime() ? b : a;
      return { currentStart: s, currentEnd: e };
    }
    return getRangeDates(range, now);
  }, [range, customStart, customEnd, now]);

  const onCustomStartChange = useCallback((value: string) => {
    if (!value) return;
    setCustomStart(value);
    if (value > customEnd) setCustomEnd(value);
  }, [customEnd]);

  const onCustomEndChange = useCallback((value: string) => {
    if (!value) return;
    setCustomEnd(value);
    if (value < customStart) setCustomStart(value);
  }, [customStart]);

  useEffect(() => {
    setEnergyOverrides({});
  }, [range, customStart, customEnd]);

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

  const dailyEnergyComputed = useMemo(
    () => computeDailyEnergySeries(expandedCurrent, currentStart, currentEnd),
    [expandedCurrent, currentStart, currentEnd]
  );

  const dailyEnergyWithOverrides = useMemo((): PointData[] => {
    return dailyEnergyComputed.map(({ dateKey, energy }, dayIndex) => ({
      dateKey,
      dayIndex,
      energy: energyOverrides[dateKey] ?? getLifeEnergyOverrideForDate(dateKey) ?? energy,
    }));
  }, [dailyEnergyComputed, energyOverrides, collectionStateRevision]);

  const handleEnergyDrag = useCallback((dateKey: string, newEnergy: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(newEnergy)));
    setLifeEnergyForDay(LIFE_ENERGY_GLOBAL_RANGE_KEY, dateKey, clamped);
    setEnergyOverrides((prev) => ({ ...prev, [dateKey]: clamped }));
  }, []);

  const rangeLabels: Record<RangeKey, string> = isZh
    ? { month: '本月', quarter: '近3个月', custom: '自定义' }
    : { month: 'This Month', quarter: 'Last 3 Months', custom: 'Custom' };

  return (
    <div
      className="space-y-4 rounded-xl p-1"
      style={{ color: 'var(--app-text)', backgroundColor: 'var(--app-surface)' }}
    >
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
        <TrendingUp className="w-4 h-4" style={{ color: 'var(--app-accent)' }} />
        {isZh ? '人生曲线' : 'Life Curve'}
      </h3>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {(['month', 'quarter', 'custom'] as const).map((r) => (
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

      {expandedCurrent.length === 0 && (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--app-muted)' }}>
          {isZh ? '选定范围内暂无事件' : 'No Events In Selected Range'}
        </p>
      )}

      {dayCount > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-xs font-semibold" style={{ color: 'var(--app-text)' }}>
              {isZh ? '生命能量' : 'Life Energy'}
            </h4>
            <span className="text-xs flex items-center gap-1.5 shrink-0" style={{ color: 'var(--app-muted)' }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: 'var(--app-accent)' }} />
              {isZh ? '可拖动折线点调整；点击数据点查看数值' : 'Drag Points To Adjust; Tap A Point To See Values'}
            </span>
          </div>
          <EnergyLineChart
            dayCount={dayCount}
            dayKeys={dayKeys}
            dailyEnergy={dailyEnergyWithOverrides}
            dragging={dragging}
            setDragging={setDragging}
            onEnergyDrag={handleEnergyDrag}
            isZh={isZh}
          />
        </section>
      )}
    </div>
  );
};

interface EnergyLineChartProps {
  dayCount: number;
  dayKeys: string[];
  dailyEnergy: PointData[];
  dragging: string | null;
  setDragging: (d: string | null) => void;
  onEnergyDrag: (dateKey: string, energy: number) => void;
  isZh: boolean;
}

function EnergyLineChart({
  dayCount,
  dayKeys,
  dailyEnergy,
  dragging,
  setDragging,
  onEnergyDrag,
  isZh,
}: EnergyLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverClearTimerRef = useRef<number | null>(null);
  const [width, setWidth] = useState(400);
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);
  /** Tap-to-pin badge on touch devices (hover unreliable). */
  const [pinnedDateKey, setPinnedDateKey] = useState<string | null>(null);
  const dragDidMoveRef = useRef(false);

  const scheduleHoverClear = useCallback(() => {
    if (hoverClearTimerRef.current != null) {
      window.clearTimeout(hoverClearTimerRef.current);
    }
    hoverClearTimerRef.current = window.setTimeout(() => {
      hoverClearTimerRef.current = null;
      setHoveredDateKey(null);
    }, 120);
  }, []);

  React.useEffect(() => {
    return () => {
      if (hoverClearTimerRef.current != null) window.clearTimeout(hoverClearTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 400));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const scaleX = dayCount <= 1 ? 0 : (width - PADDING.left - PADDING.right) / (dayCount - 1);
  const scaleY = innerH / 100;

  const energyPath = useMemo(() => {
    if (dailyEnergy.length === 0) return '';
    const pts = dailyEnergy.map((p) => {
      const x = PADDING.left + p.dayIndex * scaleX;
      const y = PADDING.top + (100 - p.energy) * scaleY;
      return `${x},${y}`;
    });
    return `M ${pts.join(' L ')}`;
  }, [dailyEnergy, scaleX, scaleY]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, dateKey: string) => {
      e.preventDefault();
      e.stopPropagation();
      dragDidMoveRef.current = false;
      if (hoverClearTimerRef.current != null) {
        window.clearTimeout(hoverClearTimerRef.current);
        hoverClearTimerRef.current = null;
      }
      setHoveredDateKey(dateKey);
      setDragging(dateKey);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [setDragging]
  );

  React.useEffect(() => {
    if (!dragging) return;
    const point = dailyEnergy.find((p) => p.dateKey === dragging);
    if (!point) return;

    const onMove = (e: PointerEvent) => {
      dragDidMoveRef.current = true;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const chartTop = rect.top + PADDING.top + CHART_TOP_PAD;
      const relativeY = e.clientY - chartTop;
      const energy = 100 * (1 - relativeY / innerH);
      const clamped = Math.min(100, Math.max(0, energy));
      onEnergyDrag(dragging, clamped);
    };
    const onUp = () => {
      setDragging(null);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
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
        height={CHART_HEIGHT + CHART_TOP_PAD}
        className="overflow-visible"
        style={{ minWidth: Math.max(320, dayCount * 12) }}
      >
        <g transform={`translate(0, ${CHART_TOP_PAD})`}>
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
          <g style={{ pointerEvents: 'none' }}>
            <path
              d={energyPath}
              fill="none"
              stroke="var(--app-accent)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
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
                  className="cursor-grab active:cursor-grabbing touch-none"
                  style={{ touchAction: 'none' }}
                  onPointerDown={(e) => handlePointerDown(e, p.dateKey)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (dragDidMoveRef.current) return;
                    setPinnedDateKey((prev) => (prev === p.dateKey ? null : p.dateKey));
                  }}
                  onMouseEnter={() => {
                    if (hoverClearTimerRef.current != null) {
                      window.clearTimeout(hoverClearTimerRef.current);
                      hoverClearTimerRef.current = null;
                    }
                    setHoveredDateKey(p.dateKey);
                  }}
                  onMouseLeave={() => {
                    if (dragging === p.dateKey) return;
                    scheduleHoverClear();
                  }}
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
          {dailyEnergy.map((p) => {
            const x = PADDING.left + p.dayIndex * scaleX;
            const y = PADDING.top + (100 - p.energy) * scaleY;
            const showBadge =
              hoveredDateKey === p.dateKey || dragging === p.dateKey || pinnedDateKey === p.dateKey;
            if (!showBadge) return null;
            const bw = 52;
            const bx = x - bw / 2;
            const by = y - POINT_R - BADGE_GAP - BADGE_H;
            const dateShort = format(new Date(p.dateKey + 'T12:00:00'), isZh ? 'M/d' : 'MMM d');
            return (
              <g key={`badge-${p.dateKey}`} style={{ pointerEvents: 'none' }}>
                <rect
                  x={bx}
                  y={by}
                  width={bw}
                  height={BADGE_H}
                  rx={6}
                  fill="var(--app-surface)"
                  stroke="var(--app-border)"
                  strokeWidth={1}
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}
                />
                <text
                  x={x}
                  y={by + 14}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[11px] font-semibold"
                  fill="var(--app-text)"
                >
                  {Math.round(p.energy)}
                </text>
                <text
                  x={x}
                  y={by + 24}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[9px]"
                  fill="var(--app-muted)"
                >
                  {dateShort}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
