import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppLanguage, ScheduleEvent } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { aggregateByRole } from '@/lib/roleAggregation';
import { computeEventTagSlicesFromExpanded } from '@/lib/chapterPeriodStats';
import { getRoleColor, getRoleDisplayName } from '@/lib/constants/roles';
import { getChapterRange, type ChapterPeriodKey } from '@/lib/dateRange';
import { getAnalyticsRangeLabel } from '@/lib/analyticsRangeLabel';
import { PIE_CX, PIE_CY, PIE_R_HOLE, PIE_R_OUTER, pieSectorPath } from '@/lib/pieChartSvg';
import {
  countTaggedUntagged,
  getAllEventsInRange,
  getRangeBoundsFromFilters,
  type TagAnalysisFilterState,
} from '@/lib/tagAnalysisQuery';
import { RoleEnergyManageModal } from '@/components/RoleEnergyManageModal';
import { EventTagManageModal } from '@/components/EventTagManageModal';

const RANGE_OPTIONS: ChapterPeriodKey[] = ['this_week', 'this_month', 'custom'];
const SLICE_COLORS = [
  'var(--app-accent)',
  'hsl(200 60% 48%)',
  'hsl(340 55% 52%)',
  'hsl(145 45% 42%)',
  'hsl(35 70% 48%)',
  'hsl(280 45% 52%)',
];

function getTagSliceColor(i: number): string {
  return SLICE_COLORS[i % SLICE_COLORS.length];
}

export interface TagAnalysisSectionProps {
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
  collectionStateRevision?: number;
  chartFilters: Pick<TagAnalysisFilterState, 'range' | 'customStart' | 'customEnd'>;
  onChartFiltersChange: (next: Pick<TagAnalysisFilterState, 'range' | 'customStart' | 'customEnd'>) => void;
  onOpenBatchEditor: () => void;
  onMigrateEventRole: (oldId: string, newId: string) => void | Promise<void>;
  onClearEventRole: (roleId: string) => void | Promise<void>;
  onMigrateEventTag: (oldTag: string, newTag: string) => void | Promise<void>;
  onClearEventTag: (tag: string) => void | Promise<void>;
}

function MiniPie({
  paths,
  centerLabel,
  centerSub,
  ariaLabel,
}: {
  paths: { key: string; d: string; color: string }[];
  centerLabel: string;
  centerSub: string;
  ariaLabel: string;
}) {
  return (
    <div className="relative mx-auto w-full max-w-[168px] shrink-0 aspect-square min-h-[128px]">
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" role="img" aria-label={ariaLabel}>
        {paths.map(({ key, d, color }) => (
          <path key={key} d={d} fill={color} stroke="var(--app-surface)" strokeWidth={0.75} />
        ))}
        <circle cx={PIE_CX} cy={PIE_CY} r={PIE_R_HOLE} fill="var(--app-surface)" stroke="var(--app-border)" strokeWidth={0.5} />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[26%] text-center">
        <span className="text-xl font-bold tabular-nums leading-none" style={{ color: 'var(--app-text)' }}>
          {centerLabel}
        </span>
        <span className="mt-1 text-[10px] leading-tight" style={{ color: 'var(--app-muted)' }}>
          {centerSub}
        </span>
      </div>
    </div>
  );
}

export const TagAnalysisSection: React.FC<TagAnalysisSectionProps> = ({
  events,
  completedInstances,
  language,
  collectionStateRevision = 0,
  chartFilters,
  onChartFiltersChange,
  onOpenBatchEditor,
  onMigrateEventRole,
  onClearEventRole,
  onMigrateEventTag,
  onClearEventTag,
}) => {
  const isZh = language === 'zh';
  const [roleManageOpen, setRoleManageOpen] = useState(false);
  const [tagManageOpen, setTagManageOpen] = useState(false);
  const [customStart, setCustomStart] = useState(
    () => chartFilters.customStart || format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  );
  const [customEnd, setCustomEnd] = useState(
    () => chartFilters.customEnd || format(new Date(), 'yyyy-MM-dd'),
  );

  useEffect(() => {
    if (chartFilters.customStart) setCustomStart(chartFilters.customStart);
    if (chartFilters.customEnd) setCustomEnd(chartFilters.customEnd);
  }, [chartFilters.customStart, chartFilters.customEnd]);

  const filtersForQuery: TagAnalysisFilterState = {
    range: chartFilters.range,
    customStart,
    customEnd,
    viewMode: 'all',
  };

  const { start, end } = useMemo(() => getRangeBoundsFromFilters(filtersForQuery), [filtersForQuery]);

  const expanded = useMemo(
    () => expandRecurringEvents(events, start, end, completedInstances),
    [events, start, end, completedInstances],
  );

  const rangeEvents = useMemo(
    () => getAllEventsInRange(events, filtersForQuery, completedInstances),
    [events, filtersForQuery, completedInstances],
  );

  const { tagged, untagged } = useMemo(() => countTaggedUntagged(rangeEvents), [rangeEvents]);

  const roleSegments = useMemo(() => aggregateByRole(expanded), [expanded]);
  const roleSlices = useMemo(
    () => roleSegments.map((s) => [s.roleId, s.count] as [string, number]),
    [roleSegments],
  );
  const roleTotal = useMemo(() => roleSlices.reduce((a, [, c]) => a + c, 0), [roleSlices]);

  const { slices: tagSlices, total: tagTotal } = useMemo(
    () => computeEventTagSlicesFromExpanded(expanded),
    [expanded],
  );

  const rolePaths = useMemo(() => {
    if (roleTotal === 0) return [];
    let acc = 0;
    return roleSlices.map(([roleId, count]) => {
      const startAngle = (acc / roleTotal) * 2 * Math.PI - Math.PI / 2;
      acc += count;
      const endAngle = (acc / roleTotal) * 2 * Math.PI - Math.PI / 2;
      return {
        key: roleId,
        d: pieSectorPath(PIE_CX, PIE_CY, PIE_R_OUTER, startAngle, endAngle),
        color: getRoleColor(roleId),
      };
    });
  }, [roleSlices, roleTotal]);

  const tagPaths = useMemo(() => {
    if (tagTotal === 0) return [];
    let acc = 0;
    return tagSlices.map(([tag, count], i) => {
      const startAngle = (acc / tagTotal) * 2 * Math.PI - Math.PI / 2;
      acc += count;
      const endAngle = (acc / tagTotal) * 2 * Math.PI - Math.PI / 2;
      return {
        key: tag,
        d: pieSectorPath(PIE_CX, PIE_CY, PIE_R_OUTER, startAngle, endAngle),
        color: getTagSliceColor(i),
      };
    });
  }, [tagSlices, tagTotal]);

  const setRange = (r: ChapterPeriodKey) => {
    onChartFiltersChange({ range: r, customStart, customEnd });
  };

  const onCustomStartChange = useCallback(
    (value: string) => {
      if (!value) return;
      setCustomStart(value);
      if (value > customEnd) setCustomEnd(value);
      onChartFiltersChange({ range: 'custom', customStart: value, customEnd: value > customEnd ? value : customEnd });
    },
    [customEnd, onChartFiltersChange],
  );

  const onCustomEndChange = useCallback(
    (value: string) => {
      if (!value) return;
      setCustomEnd(value);
      if (value < customStart) setCustomStart(value);
      onChartFiltersChange({ range: 'custom', customStart: value < customStart ? value : customStart, customEnd: value });
    },
    [customStart, onChartFiltersChange],
  );

  return (
    <div className="space-y-5" style={{ color: 'var(--app-text)' }}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold flex items-center gap-2 min-w-0">
          <Tags className="w-4 h-4 shrink-0" style={{ color: 'var(--app-accent)' }} />
          {isZh ? '标签分析' : 'Tag Analysis'}
        </h2>
        <button
          type="button"
          onClick={onOpenBatchEditor}
          className="text-[11px] font-medium shrink-0 rounded-lg px-2.5 py-1 border border-border hover:bg-accent/10 transition-colors"
          style={{ color: 'var(--app-accent)' }}
        >
          {isZh ? '批量补标' : 'Batch Tag'}
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                'text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors',
                chartFilters.range === r
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border text-muted-foreground hover:bg-field',
              )}
            >
              {getAnalyticsRangeLabel(r, isZh)}
            </button>
          ))}
        </div>
        {chartFilters.range === 'custom' && (
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
            <span aria-hidden>—</span>
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

      <section className="space-y-3 pt-1 border-t border-border/60">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">{isZh ? 'Role 分布' : 'Role Distribution'}</h3>
          <button
            type="button"
            onClick={() => setRoleManageOpen(true)}
            className="text-[10px] font-medium rounded-md px-2 py-0.5 border border-border hover:bg-accent/10"
            style={{ color: 'var(--app-accent)' }}
          >
            {isZh ? '管理' : 'Manage'}
          </button>
        </div>
        {roleTotal === 0 ? (
          <p className="text-xs py-3 text-center text-muted-foreground">
            {isZh ? '该周期内无身份日程' : 'No Events With Roles In This Period'}
          </p>
        ) : (
          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            <MiniPie
              paths={rolePaths}
              centerLabel={String(roleTotal)}
              centerSub={isZh ? '条身份日程' : 'role events'}
              ariaLabel={isZh ? '角色分布饼图' : 'Role distribution pie chart'}
            />
            <ul className="flex-1 space-y-1 text-xs text-muted-foreground min-w-0">
              {roleSlices.slice(0, 6).map(([roleId, count]) => (
                <li key={roleId} className="flex justify-between gap-2">
                  <span className="truncate text-foreground">{getRoleDisplayName(roleId, isZh ? 'zh' : 'en')}</span>
                  <span className="tabular-nums shrink-0">
                    {count} ({((count / roleTotal) * 100).toFixed(0)}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3 pt-1 border-t border-border/60">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {isZh ? '事件标签分布' : 'Event Tag Distribution'}
          </h3>
          <button
            type="button"
            onClick={() => setTagManageOpen(true)}
            className="text-[10px] font-medium rounded-md px-2 py-0.5 border border-border hover:bg-accent/10"
            style={{ color: 'var(--app-accent)' }}
          >
            {isZh ? '管理' : 'Manage'}
          </button>
        </div>
        {tagTotal === 0 ? (
          <p className="text-xs py-3 text-center text-muted-foreground">
            {isZh ? '该周期内无日程事件标签' : 'No Event Tags In This Period'}
          </p>
        ) : (
          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            <MiniPie
              paths={tagPaths}
              centerLabel={String(tagTotal)}
              centerSub={isZh ? '条标签记录' : 'tag entries'}
              ariaLabel={isZh ? '标签分布饼图' : 'Tag distribution pie chart'}
            />
            <ul className="flex-1 space-y-1 text-xs text-muted-foreground min-w-0">
              {tagSlices.slice(0, 6).map(([tag, count], i) => (
                <li key={tag} className="flex justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: getTagSliceColor(i) }} />
                    <span className="truncate text-foreground">{tag}</span>
                  </span>
                  <span className="tabular-nums shrink-0">
                    {count} ({((count / tagTotal) * 100).toFixed(0)}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="text-[11px] text-center pt-2 border-t border-border/60 text-muted-foreground">
        {isZh ? `未标注 ${untagged} · 已标注 ${tagged}` : `${untagged} untagged · ${tagged} tagged`}
      </p>

      <RoleEnergyManageModal
        isOpen={roleManageOpen}
        onClose={() => setRoleManageOpen(false)}
        events={events}
        language={language}
        collectionStateRevision={collectionStateRevision}
        onMigrateRole={onMigrateEventRole}
        onClearRole={onClearEventRole}
      />
      <EventTagManageModal
        isOpen={tagManageOpen}
        onClose={() => setTagManageOpen(false)}
        events={events}
        language={language}
        onMigrateTag={onMigrateEventTag}
        onClearTag={onClearEventTag}
      />
    </div>
  );
};
