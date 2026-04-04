import React, { useMemo, useState, useCallback } from 'react';
import { PieChart } from 'lucide-react';
import type { AppLanguage, ScheduleEvent } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { getChapterRange, type ChapterPeriodKey } from '@/lib/dateRange';
import { endOfDay, format, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { computeEventTagSlicesFromExpanded } from '@/lib/chapterPeriodStats';
import { PIE_CX, PIE_CY, PIE_R_HOLE, PIE_R_OUTER, pieSectorPath } from '@/lib/pieChartSvg';

const RANGE_OPTIONS: ChapterPeriodKey[] = ['this_week', 'this_month', 'custom'];

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

function getSliceColor(i: number): string {
  return SLICE_COLORS[i % SLICE_COLORS.length];
}

function getRangeLabel(period: ChapterPeriodKey, isZh: boolean): string {
  const labels: Record<ChapterPeriodKey, string> = {
    this_week: isZh ? '本周' : 'This Week',
    last_week: isZh ? '上周' : 'Last Week',
    this_month: isZh ? '本月' : 'This Month',
    custom: isZh ? '自定义' : 'Custom',
  };
  return labels[period];
}

export interface EventVolumeCardProps {
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
}

/** 统计周期内展开日程上的事件标签：label.text + tags[]（不含日历日标签）。 */
export const EventVolumeCard: React.FC<EventVolumeCardProps> = ({
  events,
  completedInstances,
  language,
}) => {
  const [range, setRange] = useState<ChapterPeriodKey>('this_week');
  const [customStart, setCustomStart] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const isZh = language === 'zh';

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

  const { slices, total } = useMemo(() => computeEventTagSlicesFromExpanded(expanded), [expanded]);

  const hoveredInfo = useMemo(() => {
    if (!hoveredTag || total === 0) return null;
    const pair = slices.find(([t]) => t === hoveredTag);
    if (!pair) return null;
    const [, count] = pair;
    const pct = (count / total) * 100;
    return { tag: hoveredTag, count, pct };
  }, [hoveredTag, slices, total]);

  const paths = useMemo(() => {
    if (total === 0) return [];
    let acc = 0;
    return slices.map(([tag, count], i) => {
      const startAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
      acc += count;
      const endAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
      const d = pieSectorPath(PIE_CX, PIE_CY, PIE_R_OUTER, startAngle, endAngle);
      return { tag, count, d, color: getSliceColor(i) };
    });
  }, [slices, total]);

  return (
    <div
      className="space-y-4 rounded-xl p-1"
      style={{ color: 'var(--app-text)', backgroundColor: 'var(--app-surface)' }}
    >
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
        <PieChart className="w-4 h-4 shrink-0" style={{ color: 'var(--app-accent)' }} />
        {isZh ? '事件标签分析' : 'Event Tag Analysis'}
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
          {isZh ? '该周期内无日程事件标签' : 'No Event Tags In This Period'}
        </p>
      ) : (
        <>
          <div className="relative mx-auto w-full max-w-[220px] aspect-square min-h-[160px]">
            <svg
              viewBox="0 0 100 100"
              className="h-full w-full overflow-visible"
              role="img"
              aria-label={isZh ? '标签分布饼图' : 'Tag distribution pie chart'}
            >
              {paths.map(({ tag, d, color }) => (
                <path
                  key={tag}
                  d={d}
                  fill={color}
                  stroke="var(--app-surface)"
                  strokeWidth={0.75}
                  className="cursor-pointer transition-opacity outline-none"
                  style={{ opacity: hoveredTag && hoveredTag !== tag ? 0.45 : 1 }}
                  onMouseEnter={() => setHoveredTag(tag)}
                  onMouseLeave={() => setHoveredTag(null)}
                  onFocus={() => setHoveredTag(tag)}
                  onBlur={() => setHoveredTag(null)}
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
                onMouseEnter={() => setHoveredTag(null)}
              />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[26%] text-center">
              <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: 'var(--app-text)' }}>
                {total}
              </span>
              <span className="mt-1 text-[10px] leading-tight" style={{ color: 'var(--app-muted)' }}>
                {isZh ? '条标签记录' : 'tag entries'}
              </span>
            </div>
          </div>

          {/* 固定高度，避免悬停时插入块导致上方/图例跳动；内容仅在区内切换 */}
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
                  {hoveredInfo.tag}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  · {hoveredInfo.count} {isZh ? '条' : 'entries'} · {hoveredInfo.pct.toFixed(1)}%
                </span>
              </>
            ) : (
              <span className="text-[11px] leading-snug" style={{ color: 'var(--app-muted)' }}>
                {isZh ? '悬停扇区查看数量与占比' : 'Hover A Slice For Details'}
              </span>
            )}
          </div>

          <ul className="space-y-1.5 text-xs" style={{ color: 'var(--app-muted)' }}>
            {slices.map(([tag, count], i) => {
              const pct = (count / total) * 100;
              return (
                <li key={tag} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: getSliceColor(i) }}
                      aria-hidden
                    />
                    <span className="truncate" style={{ color: 'var(--app-text)' }}>
                      {tag}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {count} ({pct.toFixed(1)}%)
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};
