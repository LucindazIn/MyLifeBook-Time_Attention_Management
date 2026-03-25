import React, { useMemo, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { X, Download } from 'lucide-react';
import type { ScheduleEvent, AppLanguage } from '@/types';
import { expandRecurringEvents } from '@/lib/events';

export interface LongTermGoalDetailModalProps {
  goal: string;
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
  onClose: () => void;
}

export const LongTermGoalDetailModal: React.FC<LongTermGoalDetailModalProps> = ({
  goal,
  events,
  completedInstances,
  language,
  onClose,
}) => {
  const isZh = language === 'zh';

  const { firstDay, endDay, byDate, allDates, maxCount } = useMemo(() => {
    const withGoal = events.filter((e) => e.longTermGoals?.includes(goal));
    if (withGoal.length === 0) {
      return { firstDay: null as string | null, endDay: format(new Date(), 'yyyy-MM-dd'), byDate: [] as [string, ScheduleEvent[]][], allDates: [] as string[], maxCount: 1 };
    }
    const first = withGoal.reduce((acc, e) => {
      const d = format(new Date(e.startTime), 'yyyy-MM-dd');
      return acc ? (d < acc ? d : acc) : d;
    }, '');
    const end = format(new Date(), 'yyyy-MM-dd');
    const startDate = new Date(first + 'T00:00:00');
    const endDate = new Date(end + 'T23:59:59');
    const expanded = expandRecurringEvents(events, startDate, endDate, completedInstances);
    const filtered = expanded.filter((e) => e.longTermGoals?.includes(goal));
    const map = new Map<string, ScheduleEvent[]>();
    filtered.forEach((e) => {
      const key = format(new Date(e.startTime), 'yyyy-MM-dd');
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    });
    const entries = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    const max = entries.length ? Math.max(...entries.map(([, list]) => list.length)) : 1;
    const dates: string[] = [];
    let cur = new Date(first + 'T00:00:00');
    const endTime = endDate.getTime();
    while (cur.getTime() <= endTime) {
      dates.push(format(cur, 'yyyy-MM-dd'));
      cur = addDays(cur, 1);
    }
    return { firstDay: first, endDay: end, byDate: entries, allDates: dates, maxCount: max };
  }, [goal, events, completedInstances]);

  const hasData = firstDay != null && allDates.length > 0;

  const handleExportTxt = useCallback(() => {
    const lines: string[] = [goal, ''];
    byDate.forEach(([dateKey, list]) => {
      const dayLabel = format(new Date(dateKey + 'T00:00:00'), isZh ? 'M月d日 EEE' : 'MMM d, EEE');
      lines.push(`${dayLabel} (${list.length})`);
      list.forEach((e) => {
        lines.push(`  ${format(new Date(e.startTime), 'HH:mm')} ${e.title}`);
      });
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${goal.replace(/[/\\?%*:|"<>]/g, '_')}_events.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [goal, byDate, isZh]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={goal}
    >
      <div
        className="rounded-2xl border bg-surface shadow-xl max-h-[85vh] w-full max-w-[35.84rem] flex flex-col"
        style={{ borderColor: 'var(--app-border)', boxShadow: 'var(--app-card-shadow)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--app-border)' }}>
          <h3 className="text-base font-semibold truncate pr-4" style={{ color: 'var(--app-text)' }}>
            {goal}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-field transition-colors"
            style={{ color: 'var(--app-muted)' }}
            aria-label={isZh ? '关闭' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {!hasData ? (
            <p className="text-xs py-4" style={{ color: 'var(--app-muted)' }}>
              {isZh ? '暂无相关事件' : 'No related events'}
            </p>
          ) : (
            <>
              <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
                {isZh ? '全时段每日相关事件数' : 'Events per day (full period)'}
              </p>
              <div className="overflow-x-auto">
                <div className="flex items-end gap-0.5 h-24 min-w-max" style={{ minWidth: 'min-content' }}>
                  {allDates.map((dateKey) => {
                    const list = byDate.find(([d]) => d === dateKey)?.[1] ?? [];
                    const count = list.length;
                    const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    const dayLabel = format(new Date(dateKey + 'T00:00:00'), isZh ? 'M月d日 EEE' : 'MMM d, EEE');
                    const tooltip = isZh
                      ? `${dayLabel} · ${count} 个事件`
                      : `${dayLabel} · ${count} event${count !== 1 ? 's' : ''}`;
                    return (
                      <div
                        key={dateKey}
                        className="flex-shrink-0 flex flex-col items-center gap-0.5 min-w-[8px] w-2"
                        title={tooltip}
                      >
                        <div
                          className="w-full rounded-t transition-all min-h-[2px]"
                          style={{
                            height: `${Math.max(height, count > 0 ? 8 : 0)}%`,
                            background: count > 0 ? 'var(--app-accent)' : 'var(--app-border)',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-between text-[10px]" style={{ color: 'var(--app-muted)' }}>
                <span>{firstDay ? format(new Date(firstDay + 'T00:00:00'), isZh ? 'M/d' : 'MMM d') : ''}</span>
                <span>{format(new Date(endDay + 'T00:00:00'), isZh ? 'M/d' : 'MMM d')}</span>
              </div>
              {byDate.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold" style={{ color: 'var(--app-text)' }}>
                      {isZh ? '按日事件' : 'Events by day'}
                    </h4>
                    <button
                      type="button"
                      onClick={handleExportTxt}
                      className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors border-border text-muted-foreground hover:bg-field hover:text-foreground"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {isZh ? '导出 TXT' : 'Export TXT'}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {byDate.map(([dateKey, list]) => (
                      <div
                        key={dateKey}
                        className="rounded-lg border p-2"
                        style={{
                          background: 'var(--app-surface)',
                          borderColor: 'var(--app-border)',
                        }}
                      >
                        <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--app-muted)' }}>
                          {format(new Date(dateKey + 'T00:00:00'), isZh ? 'M月d日 EEE' : 'MMM d, EEE')} · {list.length}
                        </p>
                        <ul className="space-y-1">
                          {list.slice(0, 5).map((e) => (
                            <li key={e.id} className="text-sm truncate" style={{ color: 'var(--app-text)' }}>
                              {e.title}
                              <span className="text-[11px] ml-1" style={{ color: 'var(--app-muted)' }}>
                                {format(new Date(e.startTime), 'HH:mm')}
                              </span>
                            </li>
                          ))}
                          {list.length > 5 && (
                            <li className="text-xs" style={{ color: 'var(--app-muted)' }}>
                              +{list.length - 5} …
                            </li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
