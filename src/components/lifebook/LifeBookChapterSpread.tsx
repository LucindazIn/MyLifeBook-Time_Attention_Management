import React from 'react';
import type { SavedChapter } from '@/lib/chaptersStorage';
import type { AppLanguage } from '@/types';
import { formatPeriodSubtitle } from '@/lib/dateRange';
import { lifeBookInk, lifeBookInkMuted, lifeBookPageCard, lifeBookReadingPanel } from '@/lib/lifeBookArt';

export interface LifeBookChapterSpreadProps {
  chapter: SavedChapter;
  language: AppLanguage;
}

export const LifeBookChapterSpread: React.FC<LifeBookChapterSpreadProps> = ({ chapter, language }) => {
  const title = chapter.chapterTitles[chapter.selectedTitleIndex] ?? chapter.chapterTitles[0] ?? '';
  const subtitle =
    formatPeriodSubtitle(chapter.periodStart, chapter.periodKey, language === 'zh', chapter.periodEnd) ||
    chapter.periodLabel;

  return (
    <div
      className={`w-full h-full flex flex-col overflow-hidden min-h-[min(100%,24rem)] ${lifeBookPageCard}`}
    >
      <div className={`p-5 md:p-7 overflow-y-auto flex-1 mx-3 my-3 md:mx-5 md:my-4 ${lifeBookReadingPanel}`}>
        <h2 className={`text-xl font-semibold font-serif mb-1 ${lifeBookInk}`}>{title}</h2>
        <p className={`text-sm mb-4 ${lifeBookInkMuted}`}>{subtitle}</p>
        <div className={`text-sm leading-relaxed whitespace-pre-wrap ${lifeBookInk}`}>
          {chapter.narrativeSummary}
        </div>
      </div>
    </div>
  );
};
