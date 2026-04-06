import React from 'react';
import type { SavedChapter } from '@/lib/chaptersStorage';
import { formatPeriodTOCSuffix } from '@/lib/dateRange';
import type { AppLanguage } from '@/types';
import { lifeBookInk, lifeBookInkMuted, lifeBookPageCard, lifeBookReadingPanel } from '@/lib/lifeBookArt';

export interface LifeBookTOCProps {
  chapters: SavedChapter[];
  language: AppLanguage;
  onGoToPage: (pageIndex: number) => void;
}

export const LifeBookTOC: React.FC<LifeBookTOCProps> = ({ chapters, language, onGoToPage }) => {
  const isZh = language === 'zh';

  return (
    <div className={`w-full h-full overflow-y-auto min-h-[min(100%,24rem)] p-4 md:p-5 ${lifeBookPageCard}`}>
      <div className={`h-full overflow-y-auto px-4 py-6 md:px-6 ${lifeBookReadingPanel}`}>
        <h2 className={`text-xl font-semibold font-serif mb-6 ${lifeBookInk}`}>
          {isZh ? '目录' : 'Table of Contents'}
        </h2>
        {chapters.length === 0 ? (
          <p className={`text-sm ${lifeBookInkMuted}`}>
            {isZh ? '暂无章节，去时间聚合页生成' : 'No chapters yet. Generate one in Time Synthesis'}
          </p>
        ) : (
          <ul className="space-y-2">
            {chapters.map((ch, i) => {
              const title =
                (ch.chapterTitles[ch.selectedTitleIndex] ?? ch.chapterTitles[0] ?? '').trim() || ch.periodLabel;
              const suffix = formatPeriodTOCSuffix(ch.periodStart, ch.periodKey, isZh, ch.periodEnd);
              const label = suffix ? `${title}${suffix}` : title;
              const pageIndex = 2 + i;
              return (
                <li key={ch.id}>
                  <button
                    type="button"
                    onClick={() => onGoToPage(pageIndex)}
                    className={`text-left w-full py-2 px-3 rounded-lg transition-colors hover:bg-field ${lifeBookInk}`}
                  >
                    <span className="font-medium">{label}</span>
                    <span className={`text-sm ml-2 ${lifeBookInkMuted}`}>
                      {isZh ? `第 ${pageIndex} 页` : `p.${pageIndex}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
