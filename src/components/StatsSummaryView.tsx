import React, { useMemo } from 'react';
import { startOfWeek, endOfWeek, subDays } from 'date-fns';
import { BarChart3, Tag } from 'lucide-react';
import { ScheduleEvent, AppLanguage } from '@/types';
import { expandRecurringEvents } from '@/lib/events';

interface StatsSummaryViewProps {
  events: ScheduleEvent[];
  dayTags: Record<string, string>;
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
}

export const StatsSummaryView: React.FC<StatsSummaryViewProps> = ({
  events,
  dayTags,
  completedInstances,
  language,
}) => {
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

  const uniqueLongTermGoals = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => e.longTermGoals?.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [events]);

  const tagCounts = useMemo((): [string, number][] => {
    const counts: Record<string, number> = {};
    (Object.values(dayTags) as string[]).forEach((tag) => {
      counts[tag] = (counts[tag] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [dayTags]);

  const daysWithRecords = useMemo(
    () => new Set(Object.keys(dayTags)).size,
    [dayTags]
  );

  const isZh = language === 'zh';

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
        <BarChart3 className="w-4 h-4" style={{ color: 'var(--app-accent)' }} />
        {isZh ? '概览' : 'Overview'}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-xl p-3 border min-h-[60px] flex flex-col justify-center"
          style={{
            background: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
            color: 'var(--app-text)',
          }}
        >
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--app-accent)' }}>
            {weekEvents.length}
          </span>
          <span className="text-xs mt-0.5" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '本周事件' : 'This Week'}
          </span>
        </div>
        <div
          className="rounded-xl p-3 border min-h-[60px] flex flex-col justify-center"
          style={{
            background: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
            color: 'var(--app-text)',
          }}
        >
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--app-accent)' }}>
            {uniqueLongTermGoals.length}
          </span>
          <span className="text-xs mt-0.5" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '长期目标' : 'Long-Term Goals'}
          </span>
        </div>
        <div
          className="rounded-xl p-3 border min-h-[60px] flex flex-col justify-center"
          style={{
            background: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
            color: 'var(--app-text)',
          }}
        >
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--app-accent)' }}>
            {daysWithRecords}
          </span>
          <span className="text-xs mt-0.5" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '有记录的天数' : 'Days With Tags'}
          </span>
        </div>
        <div
          className="rounded-xl p-3 border min-h-[60px] flex flex-col justify-center"
          style={{
            background: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
            color: 'var(--app-text)',
          }}
        >
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--app-accent)' }}>
            {tagCounts.length}
          </span>
          <span className="text-xs mt-0.5" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '使用中的标签' : 'Tags Used'}
          </span>
        </div>
      </div>

      {tagCounts.length > 0 && (
        <>
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
            <Tag className="w-4 h-4" style={{ color: 'var(--app-accent)' }} />
            {isZh ? '标签排行' : 'Top Tags'}
          </h3>
          <div className="space-y-2">
            {tagCounts.map(([tag, count]) => {
              const first = tagCounts[0];
              const max = first != null ? first[1] : 1;
              const pct = max ? (count / max) * 100 : 0;
              return (
                <div key={tag} className="flex items-center gap-2">
                  <span className="text-sm truncate flex-1 min-w-0" style={{ color: 'var(--app-text)' }}>
                    {tag}
                  </span>
                  <span className="text-xs tabular-nums flex-shrink-0" style={{ color: 'var(--app-muted)' }}>
                    {count}
                  </span>
                  <div
                    className="h-1.5 flex-1 max-w-[80px] rounded-full overflow-hidden"
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
        </>
      )}
    </div>
  );
};
