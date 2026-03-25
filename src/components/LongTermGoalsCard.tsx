import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Target } from 'lucide-react';
import type { ScheduleEvent, AppLanguage, TimeDisplayFormat } from '@/types';
import { LongTermGoalDetailModal } from '@/components/LongTermGoalDetailModal';

export interface LongTermGoalsCardProps {
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
  timeDisplay: TimeDisplayFormat;
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
        <>
          <div className="flex flex-wrap gap-2">
            {uniqueLongTermGoals.map((goal) => (
              <button
                key={goal}
                type="button"
                onClick={() => setGoalModal(goal)}
                className="text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors hover:bg-accent/15 border-border text-muted-foreground hover:border-accent hover:text-accent"
              >
                {goal}
              </button>
            ))}
          </div>
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
              document.body
            )}
        </>
      )}
    </div>
  );
};
