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
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8 max-w-6xl mx-auto px-4">
      {/* Left column: 概览 + 长期目标 + 角色能量 + 事件标签分析 */}
      <div className="md:col-span-2 space-y-6">
        <div
          className="rounded-2xl p-6 border bg-surface"
          style={{ borderColor: 'var(--app-border)', boxShadow: 'var(--app-card-shadow)' }}
        >
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
        <div
          className="rounded-2xl p-6 border bg-surface"
          style={{ borderColor: 'var(--app-border)', boxShadow: 'var(--app-card-shadow)' }}
        >
          <EventVolumeCard
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
