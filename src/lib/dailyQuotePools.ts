import type { AppLanguage } from '@/types';
import pools from '@/lib/dailyQuotePools.json';

type Row = { en: string; zh: string; authorEn: string; authorZh: string };

export function pickRandomDailyQuote(language: AppLanguage): { text: string; author: string } {
  const list = (pools as { quotes: Row[] }).quotes;
  if (!list?.length) {
    return language === 'zh'
      ? { text: '千里之行，始于足下。', author: '老子' }
      : { text: 'A journey of a thousand miles begins with a single step.', author: 'Lao Tzu' };
  }
  const q = list[Math.floor(Math.random() * list.length)]!;
  return language === 'zh'
    ? { text: q.zh, author: q.authorZh }
    : { text: q.en, author: q.authorEn };
}
