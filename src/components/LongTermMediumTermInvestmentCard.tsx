import React, { useMemo, useState, useCallback } from 'react';
import { Layers } from 'lucide-react';
import { endOfDay, format, parseISO, startOfDay, startOfMonth } from 'date-fns';
import type { AppLanguage, ScheduleEvent } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { getChapterRange, type ChapterPeriodKey } from '@/lib/dateRange';
import { cn } from '@/lib/utils';
import {
  loadLongTermGoalMeta,
  getOrCreateRecord,
  mergeLongTermGoalNames,
} from '@/lib/longTermGoalMetaStorage';
import { attributeExpandedEventsToMediumTermGoals } from '@/lib/mediumTermGoalAttribution';

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

function formatDurationMs(ms: number, isZh: boolean): string {
  if (ms <= 0) return isZh ? '0 分钟' : '0 Min';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return isZh ? `${minutes} 分钟` : `${minutes} Min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (isZh) return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
  return m > 0 ? `${h} H ${m} Min` : `${h} H`;
}

export interface LongTermMediumTermInvestmentCardProps {
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
  collectionStateRevision?: number;
}

export const LongTermMediumTermInvestmentCard: React.FC<LongTermMediumTermInvestmentCardProps> = ({
  events,
  completedInstances,
  language,
  collectionStateRevision = 0,
}) => {
  const isZh = language === 'zh';
  const [range, setRange] = useState<ChapterPeriodKey>('this_week');
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

  const goalNames = useMemo(() => mergeLongTermGoalNames(events), [events, collectionStateRevision]);

  const sections = useMemo(() => {
    const meta = loadLongTermGoalMeta();
    return goalNames.map((name) => {
      const rec = getOrCreateRecord(meta, name);
      const medium = rec.mediumTermGoals ?? [];
      const { rows, parentTotalCount, parentTotalDurationMs } = attributeExpandedEventsToMediumTermGoals(
        expanded,
        name,
        medium
      );
      return { name, medium, rows, parentTotalCount, parentTotalDurationMs };
    });
  }, [goalNames, expanded, collectionStateRevision]);

  const hasAnyMedium = sections.some((s) => s.medium.length > 0);
  const hasLtInPeriod = useMemo(
    () => expanded.some((e) => (e.longTermGoals?.length ?? 0) > 0),
    [expanded]
  );

  return (
    <div className="space-y-4 min-w-0" style={{ color: 'var(--app-text)' }}>
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Layers className="w-4 h-4 shrink-0" style={{ color: 'var(--app-accent)' }} />
        {isZh ? '中短期投入' : 'Short-Term Goal Effort'}
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
                className="rounded-lg border bg-field px-2 py-1 text-foreground tabular-nums max-w-full"
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
                className="rounded-lg border bg-field px-2 py-1 text-foreground tabular-nums max-w-full"
                style={{ borderColor: 'var(--app-border)' }}
              />
            </label>
          </div>
        )}
      </div>

      <p className="text-[10px] leading-snug" style={{ color: 'var(--app-muted)' }}>
        {isZh
          ? '按日程开始日是否落在中短期区间内统计；区间重叠时以列表顺序优先匹配。'
          : 'Counts By Event Start Date In Each Window; First Matching Row Wins If Intervals Overlap.'}
      </p>

      {!hasAnyMedium ? (
        <p className="text-xs py-2" style={{ color: 'var(--app-muted)' }}>
          {isZh ? '请在长期目标中添加中短期目标区间后再查看归因。' : 'Add Short-Term Goal Windows Under Long-Term Goals To See Breakdown.'}
        </p>
      ) : !hasLtInPeriod ? (
        <p className="text-xs py-2" style={{ color: 'var(--app-muted)' }}>
          {isZh ? '该周期内无挂长期目标的日程。' : 'No Events Linked To Long-Term Goals In This Period.'}
        </p>
      ) : (
        <div className="space-y-4 overflow-x-auto">
          {sections.map(({ name, medium, rows, parentTotalCount, parentTotalDurationMs }) => {
            if (medium.length === 0) return null;
            return (
              <div key={name} className="rounded-lg border p-3 min-w-[min(100%,320px)]" style={{ borderColor: 'var(--app-border)' }}>
                <p className="text-xs font-semibold mb-2 truncate" style={{ color: 'var(--app-text)' }}>
                  「{name}」
                </p>
                <p className="text-[10px] mb-2" style={{ color: 'var(--app-muted)' }}>
                  {isZh ? '本周期父目标合计：' : 'Parent In Period: '}
                  <span className="tabular-nums">{parentTotalCount}</span>
                  {isZh ? ' 条 · ' : ' events · '}
                  {formatDurationMs(parentTotalDurationMs, isZh)}
                </p>
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr style={{ color: 'var(--app-muted)' }}>
                      <th className="text-left font-medium py-1 pr-2">{isZh ? '中短期目标' : 'Short-Term Goal'}</th>
                      <th className="text-right font-medium py-1 px-1 tabular-nums">{isZh ? '条数' : 'Count'}</th>
                      <th className="text-right font-medium py-1 pl-1 tabular-nums">{isZh ? '时长' : 'Duration'}</th>
                    </tr>
                  </thead>
                  <tbody style={{ color: 'var(--app-text)' }}>
                    {rows.map((row) => (
                      <tr key={row.mediumId} className="border-t border-border/60">
                        <td className="py-1.5 pr-2 align-top">
                          {row.mediumId === 'unassigned' ? (
                            <span style={{ color: 'var(--app-muted)' }}>
                              {isZh ? '未归入中短期区间' : 'Outside Short-Term Windows'}
                            </span>
                          ) : (
                            <>
                              <span className="block truncate max-w-[12rem]">{row.title}</span>
                              <span className="text-[10px] block mt-0.5" style={{ color: 'var(--app-muted)' }}>
                                {medium.find((m) => m.id === row.mediumId)?.startAt} —{' '}
                                {medium.find((m) => m.id === row.mediumId)?.endAt}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="text-right tabular-nums py-1.5 px-1">{row.count}</td>
                        <td className="text-right tabular-nums py-1.5 pl-1">{formatDurationMs(row.durationMs, isZh)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
