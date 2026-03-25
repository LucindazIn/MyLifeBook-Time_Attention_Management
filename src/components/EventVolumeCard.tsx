import React, { useMemo, useState } from 'react';
import { BarChart3, Tag } from 'lucide-react';
import type { ScheduleEvent, AppLanguage } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { getChapterRange, type ChapterPeriodKey } from '@/lib/dateRange';
import { cn } from '@/lib/utils';

const RANGE_OPTIONS: ChapterPeriodKey[] = ['this_week', 'this_month'];

export interface EventVolumeCardProps {
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
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

export const EventVolumeCard: React.FC<EventVolumeCardProps> = ({
  events,
  completedInstances,
  language,
}) => {
  const [range, setRange] = useState<ChapterPeriodKey>('this_week');
  const isZh = language === 'zh';

  const { start, end } = useMemo(() => getChapterRange(range), [range]);
  const expanded = useMemo(
    () => expandRecurringEvents(events, start, end, completedInstances),
    [events, start, end, completedInstances]
  );

  const tagCounts = useMemo((): [string, number][] => {
    const counts: Record<string, number> = {};
    expanded.forEach((e) => {
      e.tags?.forEach((t) => {
        if (t) counts[t] = (counts[t] ?? 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [expanded]);

  const maxCount = tagCounts[0]?.[1] ?? 1;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
        <BarChart3 className="w-4 h-4" style={{ color: 'var(--app-accent)' }} />
        {isZh ? '事件平衡' : 'Event Balance'}
      </h3>
      <div className="flex gap-2">
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
      {tagCounts.length === 0 ? (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--app-muted)' }}>
          {isZh ? '该周期内无带标签的事件' : 'No Tagged Events In This Period'}
        </p>
      ) : (
        <div className="space-y-2">
          {tagCounts.map(([tag, count]) => {
            const pct = maxCount ? (count / maxCount) * 100 : 0;
            return (
              <div key={tag} className="flex items-center gap-2">
                <span className="text-sm truncate flex-1 min-w-0" style={{ color: 'var(--app-text)' }}>
                  {tag}
                </span>
                <span className="text-xs tabular-nums flex-shrink-0 w-8 text-right" style={{ color: 'var(--app-muted)' }}>
                  {count}
                </span>
                <div
                  className="h-1.5 flex-1 max-w-[100px] rounded-full overflow-hidden"
                  style={{ background: 'var(--app-border)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: 'var(--app-accent)' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
