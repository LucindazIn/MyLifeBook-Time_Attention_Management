import React from 'react';
import type { AppLanguage } from '@/types';
import { lifeBookInkMuted, lifeBookPageCard, lifeBookReadingPanel } from '@/lib/lifeBookArt';

export interface LifeBookEndPageProps {
  language: AppLanguage;
}

export const LifeBookEndPage: React.FC<LifeBookEndPageProps> = ({ language }) => {
  const isZh = language === 'zh';
  const text = isZh ? '— 未完待续 —' : '— To Be Continued —';

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center px-6 py-10 min-h-[min(100%,20rem)] ${lifeBookPageCard}`}
    >
      <p className={`text-lg font-serif px-6 py-3 ${lifeBookInkMuted} ${lifeBookReadingPanel}`}>{text}</p>
    </div>
  );
};
