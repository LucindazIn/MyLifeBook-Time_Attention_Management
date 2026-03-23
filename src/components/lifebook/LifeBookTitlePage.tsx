import React, { useMemo } from 'react';
import type { AppLanguage } from '@/types';

const APHORISMS_ZH = [
  '你的每一天都在书写这一页。',
  '在停顿中寻找回响。',
  '时间会筛选出真正重要的事。',
  '生活不在别处，在此刻。',
];

const APHORISMS_EN = [
  'Every day you write this page.',
  'Find the echo in the pause.',
  'Time sifts what truly matters.',
  'Life is not elsewhere; it is here.',
];

export interface LifeBookTitlePageProps {
  language: AppLanguage;
}

export const LifeBookTitlePage: React.FC<LifeBookTitlePageProps> = ({ language }) => {
  const isZh = language === 'zh';
  const pool = isZh ? APHORISMS_ZH : APHORISMS_EN;
  const aphorism = useMemo(() => pool[Math.floor(Math.random() * pool.length)], [isZh]);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center px-8 py-12 rounded-xl"
      style={{
        background: 'var(--app-surface)',
        borderColor: 'var(--app-border)',
        boxShadow: 'var(--app-card-shadow)',
      }}
    >
      <p className="text-xl md:text-2xl font-serif text-foreground/90 text-center max-w-md leading-relaxed">
        {aphorism}
      </p>
    </div>
  );
};
