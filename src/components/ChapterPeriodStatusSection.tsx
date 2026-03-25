import React, { useMemo, useRef, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Zap, Tag, TrendingUp } from 'lucide-react';
import type { AppLanguage, ScheduleEvent } from '@/types';
import {
  computeEventTagSlicesForRange,
  computeRoleEnergyPercentagesForRange,
  computeDailyEnergyWithStorageOverrides,
  parseChapterPeriodBounds,
} from '@/lib/chapterPeriodStats';
import { getRoleColor, getRoleDisplayName } from '@/lib/constants/roles';

const SLICE_COLORS = [
  'var(--app-accent)',
  'hsl(200 60% 48%)',
  'hsl(340 55% 52%)',
  'hsl(145 45% 42%)',
  'hsl(35 70% 48%)',
  'hsl(280 45% 52%)',
  'hsl(20 60% 50%)',
  'hsl(175 50% 42%)',
];

function sliceColor(i: number): string {
  return SLICE_COLORS[i % SLICE_COLORS.length];
}

const CHART_HEIGHT = 120;
const CHART_TOP_PAD = 16;
const PADDING = { top: 6, right: 6, bottom: 20, left: 28 };
const POINT_R = 3;

export interface ChapterPeriodStatusSectionProps {
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  periodStart: string;
  periodEnd: string;
  language: AppLanguage;
  /** 嵌入侧栏时去掉顶部分割线与过大上边距 */
  embedded?: boolean;
}

type DailyEnergyPoint = { dateKey: string; energy: number; dayIndex: number };

function PeriodLifeEnergyReadOnly({ dailyEnergy, isZh }: { dailyEnergy: DailyEnergyPoint[]; isZh: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const dayCount = dailyEnergy.length;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(240, el.clientWidth || 320)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const scaleX = dayCount <= 1 ? 0 : (width - PADDING.left - PADDING.right) / (dayCount - 1);
  const scaleY = innerH / 100;

  const innerW = Math.max(1, width - PADDING.left - PADDING.right);

  const energyPath = useMemo(() => {
    if (dailyEnergy.length === 0) return '';
    if (dailyEnergy.length === 1) {
      const p = dailyEnergy[0];
      const x = PADDING.left + p.dayIndex * scaleX;
      const y = PADDING.top + (100 - p.energy) * scaleY;
      const x2 = PADDING.left + innerW;
      return `M ${x},${y} L ${x2},${y}`;
    }
    const pts = dailyEnergy.map((p) => {
      const x = PADDING.left + p.dayIndex * scaleX;
      const y = PADDING.top + (100 - p.energy) * scaleY;
      return `${x},${y}`;
    });
    return `M ${pts.join(' L ')}`;
  }, [dailyEnergy, scaleX, scaleY, innerW]);

  const dayKeys = dailyEnergy.map((d) => d.dateKey);
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

  const dailyWithIndex = useMemo(
    () => dailyEnergy.map((p, dayIndex) => ({ ...p, dayIndex })),
    [dailyEnergy]
  );

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <svg
        width={width}
        height={CHART_HEIGHT + CHART_TOP_PAD}
        className="overflow-visible max-w-full"
        style={{ minWidth: Math.min(width, Math.max(260, dayCount * 8)) }}
      >
        <g transform={`translate(0, ${CHART_TOP_PAD})`}>
          {[0, 50, 100].map((v) => (
            <text
              key={v}
              x={PADDING.left - 4}
              y={PADDING.top + (100 - v) * scaleY}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-[9px] fill-[var(--app-muted)]"
            >
              {v}
            </text>
          ))}
          {xLabels.map(({ dayIndex, label }) => (
            <text
              key={dayIndex}
              x={PADDING.left + dayIndex * scaleX}
              y={CHART_HEIGHT - 4}
              textAnchor="middle"
              className="text-[9px] fill-[var(--app-muted)]"
            >
              {label}
            </text>
          ))}
          <path
            d={energyPath}
            fill="none"
            stroke="var(--app-accent)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {dailyWithIndex.map((p) => {
            const x = PADDING.left + p.dayIndex * scaleX;
            const y = PADDING.top + (100 - p.energy) * scaleY;
            return (
              <circle key={p.dateKey} cx={x} cy={y} r={POINT_R} fill="var(--app-accent)" stroke="var(--app-surface)" strokeWidth={1} />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export const ChapterPeriodStatusSection: React.FC<ChapterPeriodStatusSectionProps> = ({
  events,
  completedInstances,
  periodStart,
  periodEnd,
  language,
  embedded = false,
}) => {
  const isZh = language === 'zh';
  const { start, end } = useMemo(() => parseChapterPeriodBounds(periodStart, periodEnd), [periodStart, periodEnd]);

  const roleData = useMemo(
    () => computeRoleEnergyPercentagesForRange(events, start, end, completedInstances),
    [events, start, end, completedInstances]
  );

  const roleCountById = useMemo(() => {
    const m = new Map<string, number>();
    roleData.segments.forEach((s) => m.set(s.roleId, s.count));
    return m;
  }, [roleData.segments]);

  const tagData = useMemo(
    () => computeEventTagSlicesForRange(events, start, end, completedInstances),
    [events, start, end, completedInstances]
  );

  const lifeSeries = useMemo(
    () => computeDailyEnergyWithStorageOverrides(events, start, end, completedInstances),
    [events, start, end, completedInstances]
  );

  const lifeDaily = useMemo(
    () => lifeSeries.map((p, dayIndex) => ({ ...p, dayIndex })),
    [lifeSeries]
  );

  return (
    <div
      className={embedded ? 'space-y-5' : 'mt-6 pt-6 border-t space-y-6'}
      style={embedded ? undefined : { borderColor: 'var(--app-border)' }}
    >
      <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--app-muted)' }}>
        {isZh ? '本期状态数据' : 'Period Stats'}
      </h3>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
          <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-accent)' }} />
          {isZh ? '角色能量' : 'Role Balance'}
        </h4>
        {roleData.percentages.length > 0 ? (
          <>
            <div className="h-2.5 w-full rounded-full overflow-hidden flex" style={{ background: 'var(--app-border)' }}>
              {roleData.percentages.map(([roleId, pct]) => {
                if (pct <= 0) return null;
                const n = roleCountById.get(roleId) ?? 0;
                const name = getRoleDisplayName(roleId, isZh ? 'zh' : 'en');
                const titleStr = isZh
                  ? `${name}：${pct}%（${n}/${roleData.totalEvents}）`
                  : `${name}: ${pct}% (${n}/${roleData.totalEvents})`;
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
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
              {roleData.percentages.map(([roleId]) => (
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
          </>
        ) : (
          <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '本周期内无带角色的事件' : 'No Role-Tagged Events In This Period'}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
          <Tag className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-accent)' }} />
          {isZh ? '事件标签分析' : 'Event Tag Analysis'}
        </h4>
        {tagData.total === 0 ? (
          <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '本周期内无日程事件标签' : 'No Event Tags In This Period'}
          </p>
        ) : (
          <div className="space-y-2">
            <div className="h-2.5 w-full rounded-full overflow-hidden flex" style={{ background: 'var(--app-border)' }}>
              {tagData.slices.map(([tag, count], i) => {
                const pct = (count / tagData.total) * 100;
                if (pct <= 0) return null;
                const titleStr = isZh
                  ? `${tag}：${count}（${pct.toFixed(1)}%）`
                  : `${tag}: ${count} (${pct.toFixed(1)}%)`;
                return (
                  <div
                    key={tag}
                    className="h-full min-w-px shrink-0 transition-all"
                    style={{ width: `${pct}%`, backgroundColor: sliceColor(i) }}
                    title={titleStr}
                  />
                );
              })}
            </div>
            <p className="text-[10px] leading-snug" style={{ color: 'var(--app-muted)' }}>
              {isZh
                ? `${tagData.total}条标签记录，悬停色块查看各标签数量`
                : `${tagData.total} Tag Entries, Hover Segments For Counts By Tag`}
            </p>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
          <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-accent)' }} />
          {isZh ? '人生曲线' : 'Life Curve'}
        </h4>
        {lifeDaily.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '无日期范围' : 'No Date Range'}
          </p>
        ) : (
          <PeriodLifeEnergyReadOnly dailyEnergy={lifeDaily} isZh={isZh} />
        )}
      </section>
    </div>
  );
};
