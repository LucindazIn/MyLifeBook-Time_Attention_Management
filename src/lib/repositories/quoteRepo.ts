import { getJSON, setJSON } from '@/lib/storage/localStorage';

export interface DailyQuote {
  text: string;
  author?: string;
  updatedAt: string; // ISO
}

const PREFIX = 'feather:dailyQuote:v1:';

function keyFor(dateKey: string) {
  return `${PREFIX}${dateKey}`;
}

export function getQuote(dateKey: string): DailyQuote | null {
  return getJSON<DailyQuote>(keyFor(dateKey));
}

export function setQuote(dateKey: string, quote: Omit<DailyQuote, 'updatedAt'> & Partial<Pick<DailyQuote, 'updatedAt'>>): DailyQuote {
  const normalized: DailyQuote = {
    text: quote.text,
    author: quote.author,
    updatedAt: quote.updatedAt || new Date().toISOString(),
  };
  setJSON(keyFor(dateKey), normalized);
  return normalized;
}

