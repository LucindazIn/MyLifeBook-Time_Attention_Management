import React, { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { ScheduleEvent, AppLanguage } from '@/types';
import { mergeLongTermGoalNames } from '@/lib/longTermGoalMetaStorage';

interface StatsSummaryViewProps {
  events: ScheduleEvent[];
  dayTags: Record<string, string>;
  language: AppLanguage;
}

export const StatsSummaryView: React.FC<StatsSummaryViewProps> = ({
  events,
  dayTags,
  language,
}) => {
  const longTermGoalCount = useMemo(() => mergeLongTermGoalNames(events).length, [events]);

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
            {events.length}
          </span>
          <span className="text-xs mt-0.5" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '历史事件' : 'Historical Events'}
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
            {longTermGoalCount}
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
