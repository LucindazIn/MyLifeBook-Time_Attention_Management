import React from 'react';
import { RefreshCw } from 'lucide-react';
import { ScheduleEvent, AppLanguage, TimeDisplayFormat } from '@/types';
import { StatsSummaryView } from '@/components/StatsSummaryView';
import { LongTermGoalsCard } from '@/components/LongTermGoalsCard';
import { RoleEnergyCard } from '@/components/RoleEnergyCard';
import { RoleBalanceCard } from '@/components/RoleBalanceCard';
import { ChapterNarrativeCard } from '@/components/ChapterNarrativeCard';
import { CHAPTER_CARD_ID } from '@/components/NarrativeClosureCard';
import { PRESET_ROLES } from '@/lib/constants/roles';
import { cn } from '@/lib/utils';

export interface CollectionViewProps {
  events: ScheduleEvent[];
  dayTags: Record<string, string>;
  dayNames?: Record<string, { name: string; isManual: boolean; language?: AppLanguage }>;
  dayVibes?: Record<string, { energy?: number; mood?: number; focus?: number }>;
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
  timeDisplay: TimeDisplayFormat;
  journalEntries: Record<string, string>;
  /** Called when the user taps the manual sync button (cross-device refresh) */
  onRefresh?: () => void;
  isSyncing?: boolean;
}

export const CollectionView: React.FC<CollectionViewProps> = ({
  events,
  dayTags,
  dayNames = {},
  dayVibes = {},
  completedInstances,
  language,
  timeDisplay,
  journalEntries,
  onRefresh,
  isSyncing = false,
}) => {
  const isZh = language === 'zh';
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8 max-w-6xl mx-auto px-4">
      {/* Left column: 概览 + 长期目标 + 角色能量 + 事件标签分析 */}
      <div className="md:col-span-2 space-y-6">
        <div
          className="rounded-2xl p-6 border bg-surface"
          style={{ borderColor: 'var(--app-border)', boxShadow: 'var(--app-card-shadow)' }}
        >
          {onRefresh && (
            <div className="flex justify-end mb-3">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isSyncing}
                title={isZh ? '从云端同步最新数据' : 'Sync Latest Data From Cloud'}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-field text-muted-foreground hover:text-accent hover:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
                {isZh ? '同步数据' : 'Sync Data'}
              </button>
            </div>
          )}
          <StatsSummaryView
            events={events}
            dayTags={dayTags}
            completedInstances={completedInstances}
            language={language}
          />
        </div>
        <div
          className="rounded-2xl p-6 border bg-surface"
          style={{ borderColor: 'var(--app-border)', boxShadow: 'var(--app-card-shadow)' }}
        >
          <LongTermGoalsCard
            events={events}
            completedInstances={completedInstances}
            language={language}
            timeDisplay={timeDisplay}
          />
        </div>
        <div
          className="rounded-2xl p-6 border bg-surface"
          style={{ borderColor: 'var(--app-border)', boxShadow: 'var(--app-card-shadow)' }}
        >
          <RoleEnergyCard
            events={events}
            completedInstances={completedInstances}
            language={language}
          />
        </div>
      </div>

      {/* Right column: 人生曲线 + 章节叙事 */}
      <div className="md:col-span-3 space-y-6">
        <div
          className="rounded-2xl p-6 border bg-surface"
          style={{ borderColor: 'var(--app-border)', boxShadow: 'var(--app-card-shadow)' }}
        >
          <RoleBalanceCard
            events={events}
            completedInstances={completedInstances}
            language={language}
          />
        </div>
        <div
          id={CHAPTER_CARD_ID}
          className="rounded-2xl p-6 border bg-surface scroll-mt-4"
          style={{ borderColor: 'var(--app-border)', boxShadow: 'var(--app-card-shadow)' }}
        >
          <ChapterNarrativeCard
            events={events}
            journalEntries={journalEntries}
            completedInstances={completedInstances}
            language={language}
            roleTags={PRESET_ROLES.map((r) => r.id)}
            dayNames={dayNames}
            dayTags={dayTags}
            dayVibes={dayVibes}
          />
        </div>
      </div>
    </div>
  );
};
