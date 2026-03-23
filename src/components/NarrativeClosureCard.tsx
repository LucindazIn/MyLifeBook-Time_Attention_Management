import React, { useState, useEffect } from 'react';
import { Target, RotateCcw } from 'lucide-react';
import type { AppLanguage } from '@/types';
import { getNextMonthFocus, setNextMonthFocus as saveNextMonthFocus } from '@/lib/nextMonthFocusStorage';
import { format, addMonths, startOfMonth } from 'date-fns';

export interface NarrativeClosureCardProps {
  language: AppLanguage;
}

export const CHAPTER_CARD_ID = 'chapter-narrative-card';

export const NarrativeClosureCard: React.FC<NarrativeClosureCardProps> = ({ language }) => {
  const [nextMonthFocus, setNextMonthFocusState] = useState('');
  const [savedFocus, setSavedFocus] = useState('');
  const isZh = language === 'zh';

  useEffect(() => {
    setSavedFocus(getNextMonthFocus());
    setNextMonthFocusState(getNextMonthFocus());
  }, []);

  const scrollToChapter = () => {
    document.getElementById(CHAPTER_CARD_ID)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveFocus = () => {
    saveNextMonthFocus(nextMonthFocus);
    setSavedFocus(nextMonthFocus);
  };

  const nextMonthLabel = (() => {
    const next = startOfMonth(addMonths(new Date(), 1));
    return format(next, isZh ? 'M月' : 'MMM');
  })();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
        <RotateCcw className="w-4 h-4" style={{ color: 'var(--app-accent)' }} />
        {isZh ? '叙事闭环' : 'Narrative loop'}
      </h3>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={scrollToChapter}
          className="text-xs font-medium rounded-lg px-3 py-2 border border-accent bg-accent/15 text-accent hover:bg-accent/25"
        >
          {isZh ? '本周回顾' : 'This week review'}
        </button>
        <button
          type="button"
          onClick={scrollToChapter}
          className="text-xs font-medium rounded-lg px-3 py-2 border border-accent bg-accent/15 text-accent hover:bg-accent/25"
        >
          {isZh ? '本月总结' : 'This month summary'}
        </button>
      </div>
      <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
        {isZh ? '点击后在下方「章节叙事」中选择周期并生成' : 'Select period in Chapter narrative below and generate'}
      </p>

      <div className="space-y-2">
        <h4 className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
          <Target className="w-3.5 h-3.5" style={{ color: 'var(--app-accent)' }} />
          {isZh ? `下月重点（${nextMonthLabel}）` : `Next month focus (${nextMonthLabel})`}
        </h4>
        <textarea
          value={nextMonthFocus}
          onChange={(e) => setNextMonthFocusState(e.target.value)}
          placeholder={isZh ? '写一句下月想聚焦的事…' : 'One thing to focus on next month…'}
          rows={2}
          className="w-full text-sm rounded-lg border px-3 py-2 bg-field border-border resize-none"
          style={{ color: 'var(--app-text)' }}
        />
        <button
          type="button"
          onClick={handleSaveFocus}
          className="text-xs font-medium rounded-lg px-2.5 py-1.5 border border-border text-muted-foreground hover:bg-field"
        >
          {isZh ? '保存' : 'Save'}
        </button>
        {savedFocus && (
          <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '已保存' : 'Saved'}
          </p>
        )}
      </div>
    </div>
  );
};
