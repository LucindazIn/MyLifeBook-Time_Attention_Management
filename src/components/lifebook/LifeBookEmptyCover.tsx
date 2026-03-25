import React, { useState, useEffect } from 'react';
import type { AppLanguage } from '@/types';
import {
  getLifeBookCoverLines,
  setLifeBookCoverLine,
  DEFAULT_LINE1_EN,
  DEFAULT_LINE1_ZH,
  DEFAULT_LINE2_EN,
  DEFAULT_LINE2_ZH,
  DEFAULT_LINE3_EN,
  DEFAULT_LINE3_ZH,
} from '@/lib/lifeBookCoverStorage';
import { lifeBookInk, lifeBookInkMuted, lifeBookPageCard, lifeBookReadingPanel } from '@/lib/lifeBookArt';

/**
 * Single book-cover style empty state when user has no chapters yet.
 * Three editable lines (same as LifeBookCover) plus hint below.
 */
export interface LifeBookEmptyCoverProps {
  language?: AppLanguage;
}

const inputClass =
  'w-full max-w-md bg-transparent border-0 border-b border-border/40 hover:border-border/70 focus:border-accent focus:outline-none focus:ring-0 text-center py-1 transition-colors placeholder:text-muted-foreground';

export const LifeBookEmptyCover: React.FC<LifeBookEmptyCoverProps> = ({ language = 'en' }) => {
  const isZh = language === 'zh';
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [line3, setLine3] = useState('');

  useEffect(() => {
    const stored = getLifeBookCoverLines();
    setLine1(stored.line1);
    setLine2(stored.line2);
    setLine3(stored.line3);
  }, []);

  const default1 = isZh ? DEFAULT_LINE1_ZH : DEFAULT_LINE1_EN;
  const default2 = isZh ? DEFAULT_LINE2_ZH : DEFAULT_LINE2_EN;
  const default3 = isZh ? DEFAULT_LINE3_ZH : DEFAULT_LINE3_EN;

  const handleBlur = (
    which: 'line1' | 'line2' | 'line3',
    value: string,
    setter: (v: string) => void
  ) => {
    const v = value.trim();
    setLifeBookCoverLine(which, v);
    setter(v);
  };

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center px-6 py-10 text-center max-w-lg mx-auto min-h-[min(100%,28rem)] max-md:min-h-[min(100%,33.6rem)] ${lifeBookPageCard}`}
    >
      <div className={`w-full max-w-md space-y-4 mb-6 px-5 py-7 ${lifeBookReadingPanel}`}>
        <input
          type="text"
          className={`${inputClass} text-sm uppercase tracking-[0.25em] ${lifeBookInkMuted}`}
          placeholder={default1}
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          onBlur={() => handleBlur('line1', line1, setLine1)}
          aria-label={default1}
        />
        <input
          type="text"
          className={`${inputClass} text-2xl md:text-3xl font-serif font-semibold ${lifeBookInk}`}
          placeholder={default2}
          value={line2}
          onChange={(e) => setLine2(e.target.value)}
          onBlur={() => handleBlur('line2', line2, setLine2)}
          aria-label={default2}
        />
        <input
          type="text"
          className={`${inputClass} text-base ${lifeBookInkMuted}`}
          placeholder={default3}
          value={line3}
          onChange={(e) => setLine3(e.target.value)}
          onBlur={() => handleBlur('line3', line3, setLine3)}
          aria-label={default3}
        />
      </div>
      <p className={`font-serif text-base md:text-lg italic mb-3 max-w-md px-4 ${lifeBookInkMuted}`}>
        {isZh ? '（等待被书写的故事）' : '(stories waiting to be discovered)'}
      </p>
      <p className={`text-xs max-w-xs px-2 ${lifeBookInkMuted}`}>
        {isZh
          ? '在时间聚合页生成一章，开始书写你的故事。'
          : 'Generate a chapter in Time Synthesis to start writing your story.'}
      </p>
    </div>
  );
};
