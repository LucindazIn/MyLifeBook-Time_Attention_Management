import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Target } from 'lucide-react';
import type { ScheduleEvent, AppLanguage, TimeDisplayFormat } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { LongTermGoalDetailModal } from '@/components/LongTermGoalDetailModal';

export interface LongTermGoalsCardProps {
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
  timeDisplay: TimeDisplayFormat;
}

/** Build a one-line month-grouped summary for a goal's events. */
function buildMonthlySummary(
  goal: string,
  events: ScheduleEvent[],
  completedInstances: Record<string, boolean>,
  isZh: boolean,
): string {
  const withGoal = events.filter((e) => e.longTermGoals?.includes(goal));
  if (withGoal.length === 0) return isZh ? '暂无相关事件' : 'No related events';

  const firstDateStr = withGoal.reduce((acc, e) => {
    const d = format(new Date(e.startTime), 'yyyy-MM-dd');
    return !acc || d < acc ? d : acc;
  }, '');

  const startDate = new Date(firstDateStr + 'T00:00:00');
  const endDate = new Date();
  const expanded = expandRecurringEvents(events, startDate, endDate, completedInstances);
  const filtered = expanded.filter((e) => e.longTermGoals?.includes(goal));

  // Group by month → set of day numbers
  const byMonth = new Map<string, Set<number>>();
  filtered.forEach((e) => {
    const d = new Date(e.startTime);
    const monthKey = format(d, 'yyyy-MM');
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, new Set());
    byMonth.get(monthKey)!.add(d.getDate());
  });

  const parts: string[] = [];
  Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([monthKey, days]) => {
      const d = new Date(monthKey + '-01');
      const monthLabel = isZh
        ? format(d, 'M月')
        : format(d, 'MMM');
      const dayList = Array.from(days).sort((a, b) => a - b);
      const count = filtered.filter((e) => format(new Date(e.startTime), 'yyyy-MM') === monthKey).length;
      const dayStr = isZh
        ? dayList.join('、') + '日'
        : dayList.map((n) => `${n}`).join(', ');
      parts.push(isZh
        ? `${monthLabel} ${count}次（${dayStr}）`
        : `${monthLabel} · ${count}× (${dayStr})`);
    });

  return parts.join(isZh ? '；' : ' · ');
}

export const LongTermGoalsCard: React.FC<LongTermGoalsCardProps> = ({
  events,
  completedInstances,
  language,
  timeDisplay,
}) => {
  const [goalModal, setGoalModal] = useState<string | null>(null);
  const isZh = language === 'zh';

  const uniqueLongTermGoals = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => e.longTermGoals?.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [events]);

  const summaries = useMemo(() => {
    return Object.fromEntries(
      uniqueLongTermGoals.map((g) => [
        g,
        buildMonthlySummary(g, events, completedInstances, isZh),
      ]),
    );
  }, [uniqueLongTermGoals, events, completedInstances, isZh]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
        <Target className="w-4 h-4" style={{ color: 'var(--app-accent)' }} />
        {isZh ? '长期目标' : 'Long-Term Goals'}
      </h3>

      {uniqueLongTermGoals.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--app-muted)' }}>
          {isZh ? '暂无长期目标，在添加日程时可设置长期目标' : 'No Long-Term Goals Yet. Set Them When Adding Events.'}
        </p>
      ) : (
        <div className="space-y-3">
          {uniqueLongTermGoals.map((goal) => (
            <div key={goal} className="space-y-0.5">
              {/* Goal name — clickable to open detail modal */}
              <button
                type="button"
                onClick={() => setGoalModal(goal)}
                className="text-xs font-semibold text-left hover:underline transition-colors"
                style={{ color: 'var(--app-text)' }}
              >
                {goal}
              </button>
              {/* Month summary */}
              <p className="text-[11px] leading-snug" style={{ color: 'var(--app-muted)' }}>
                {summaries[goal]}
              </p>
            </div>
          ))}
        </div>
      )}

      {goalModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <LongTermGoalDetailModal
            goal={goalModal}
            events={events}
            completedInstances={completedInstances}
            language={language}
            timeDisplay={timeDisplay}
            onClose={() => setGoalModal(null)}
          />,
          document.body,
        )}
    </div>
  );
};
