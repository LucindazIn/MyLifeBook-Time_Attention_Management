import React from 'react';
import type { AppLanguage } from '@/types';
import { lifeBookInkMuted, lifeBookPageCard, lifeBookReadingPanel } from '@/lib/lifeBookArt';

export interface LifeBookBackCoverProps {
  language: AppLanguage;
}

export const LifeBookBackCover: React.FC<LifeBookBackCoverProps> = ({ language }) => {
  const isZh = language === 'zh';
  const title = isZh ? '人生之书' : 'Life Book';

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center px-6 py-10 min-h-[min(100%,24rem)] ${lifeBookPageCard}`}
    >
      <p
        className={`text-sm uppercase tracking-widest px-6 py-3 font-serif ${lifeBookInkMuted} ${lifeBookReadingPanel}`}
      >
        {title}
      </p>
    </div>
  );
};
