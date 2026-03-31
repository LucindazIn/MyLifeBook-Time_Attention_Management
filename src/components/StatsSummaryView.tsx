import React, { useMemo } from 'react';
import { startOfWeek, endOfWeek, subDays } from 'date-fns';
import { BarChart3 } from 'lucide-react';
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

  const daysWithRecords = useMemo(
    () => new Set(Object.keys(dayTags)).size,
    [dayTags]
  );

  const uniqueTagsInUse = useMemo(() => {
    const set = new Set<string>();
    (Object.values(dayTags) as string[]).forEach((t) => t && set.add(t));
    events.forEach((e) => {
      if (e.label?.text) set.add(e.label.text);
      if (e.role) set.add(e.role);
    });
    return set.size;
  }, [events, dayTags]);

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
            {uniqueTagsInUse}
          </span>
          <span className="text-xs mt-0.5" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '使用中的标签' : 'Tags Used'}
          </span>
        </div>
      </div>

    </div>
  );
};
