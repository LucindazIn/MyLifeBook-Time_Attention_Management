import React from 'react';
import { ScheduleEvent, AppLanguage, TimeDisplayFormat } from '@/types';
import { StatsSummaryView } from '@/components/StatsSummaryView';
import { LongTermGoalsCard } from '@/components/LongTermGoalsCard';
import { RoleBalanceCard } from '@/components/RoleBalanceCard';
import { ChapterNarrativeCard } from '@/components/ChapterNarrativeCard';
import { TagAnalysisSection } from '@/components/TagAnalysisSection';
import { CHAPTER_CARD_ID } from '@/lib/chapterCardIds';
import { PRESET_ROLES } from '@/lib/constants/roles';
import type { TagAnalysisFilterState } from '@/lib/tagAnalysisQuery';
export interface CollectionViewProps {
  events: ScheduleEvent[];
  dayTags: Record<string, string>;
  dayNames?: Record<string, { name: string; isManual: boolean; language?: AppLanguage }>;
  dayVibes?: Record<string, { energy?: number; mood?: number; focus?: number }>;
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
  timeDisplay: TimeDisplayFormat;
  journalEntries: Record<string, string>;
  onRenameLongTermGoal: (oldName: string, newName: string) => void | Promise<void>;
  onDeleteLongTermGoal: (goalName: string) => void | Promise<void>;
  onMigrateEventRole: (oldId: string, newId: string) => void | Promise<void>;
  onClearEventRole: (roleId: string) => void | Promise<void>;
  onMigrateEventTag: (oldTag: string, newTag: string) => void | Promise<void>;
  onClearEventTag: (tag: string) => void | Promise<void>;
  onOpenBatchEditor: () => void;
  onOpenGoalLinking: () => void;
  chartFilters: Pick<TagAnalysisFilterState, 'range' | 'customStart' | 'customEnd'>;
  onChartFiltersChange: (next: Pick<TagAnalysisFilterState, 'range' | 'customStart' | 'customEnd'>) => void;
  /** Logged-in user: chapter list syncs to Supabase for cross-device consistency. */
  userId?: string | null;
  /** Increments when synced local state (长期目标 / 曲线等) updates — refreshes cards that read localStorage. */
  collectionStateRevision?: number;
}

const cardShell =
  'rounded-2xl p-6 border bg-surface';

const cardStyle = {
  borderColor: 'var(--app-border)',
  boxShadow: 'var(--app-card-shadow)',
} as const;

export const CollectionView: React.FC<CollectionViewProps> = ({
  events,
  dayTags,
  dayNames = {},
  dayVibes = {},
  completedInstances,
  language,
  timeDisplay,
  journalEntries,
  onRenameLongTermGoal,
  onDeleteLongTermGoal,
  onMigrateEventRole,
  onClearEventRole,
  onMigrateEventTag,
  onClearEventTag,
  onOpenBatchEditor,
  onOpenGoalLinking,
  chartFilters,
  onChartFiltersChange,
  userId = null,
  collectionStateRevision = 0,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8 max-w-6xl mx-auto px-4">
      {/* Left: 概览 + 章节叙事 + 角色能量 + 事件标签 */}
      <div className="md:col-span-2 space-y-6 min-w-0">
        <div className={cardShell} style={cardStyle}>
          <StatsSummaryView
            events={events}
            dayTags={dayTags}
            language={language}
          />
        </div>
        <div id={CHAPTER_CARD_ID} className={`${cardShell} scroll-mt-4`} style={cardStyle}>
          <ChapterNarrativeCard
            events={events}
            journalEntries={journalEntries}
            completedInstances={completedInstances}
            language={language}
            roleTags={PRESET_ROLES.map((r) => r.id)}
            dayNames={dayNames}
            dayTags={dayTags}
            dayVibes={dayVibes}
            userId={userId}
          />
        </div>
        <div className={cardShell} style={cardStyle}>
          <TagAnalysisSection
            events={events}
            completedInstances={completedInstances}
            language={language}
            collectionStateRevision={collectionStateRevision}
            chartFilters={chartFilters}
            onChartFiltersChange={onChartFiltersChange}
            onOpenBatchEditor={onOpenBatchEditor}
            onMigrateEventRole={onMigrateEventRole}
            onClearEventRole={onClearEventRole}
            onMigrateEventTag={onMigrateEventTag}
            onClearEventTag={onClearEventTag}
          />
        </div>
      </div>

      {/* Right: 人生曲线 + 长期目标（中短期投入见长期目标内「投入分析」） */}
      <div className="md:col-span-3 space-y-6 min-w-0">
        <div className={cardShell} style={cardStyle}>
          <RoleBalanceCard
            events={events}
            completedInstances={completedInstances}
            language={language}
            collectionStateRevision={collectionStateRevision}
          />
        </div>
        <div className={cardShell} style={cardStyle}>
          <LongTermGoalsCard
            events={events}
            completedInstances={completedInstances}
            language={language}
            timeDisplay={timeDisplay}
            onRenameLongTermGoal={onRenameLongTermGoal}
            onDeleteLongTermGoal={onDeleteLongTermGoal}
            onOpenGoalLinking={onOpenGoalLinking}
            collectionStateRevision={collectionStateRevision}
          />
        </div>
      </div>
    </div>
  );
};
