import React from 'react';
import { ScheduleEvent, AppLanguage, TimeDisplayFormat } from '@/types';
import { StatsSummaryView } from '@/components/StatsSummaryView';
import { LongTermGoalsCard } from '@/components/LongTermGoalsCard';
import { RoleEnergyCard } from '@/components/RoleEnergyCard';
import { EventVolumeCard } from '@/components/EventVolumeCard';
import { RoleBalanceCard } from '@/components/RoleBalanceCard';
import { ChapterNarrativeCard } from '@/components/ChapterNarrativeCard';
import { CHAPTER_CARD_ID } from '@/components/NarrativeClosureCard';
import { PRESET_ROLES } from '@/lib/constants/roles';
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
  userId = null,
  collectionStateRevision = 0,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8 max-w-6xl mx-auto px-4">
      {/* Left: 概览 + 章节叙事 */}
      <div className="md:col-span-2 space-y-6">
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
      </div>

      {/* Right: 人生曲线 + 长期目标 + 角色能量 / 事件标签（并排） */}
      <div className="md:col-span-3 space-y-6">
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
            collectionStateRevision={collectionStateRevision}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-6">
          <div className={cardShell} style={cardStyle}>
            <RoleEnergyCard
              events={events}
              completedInstances={completedInstances}
              language={language}
            />
          </div>
          <div className={cardShell} style={cardStyle}>
            <EventVolumeCard
              events={events}
              completedInstances={completedInstances}
              language={language}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
