import { getJSON, remove, setJSON, keys } from '@/lib/storage/localStorage';

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

export function clearQuote(dateKey: string): void {
  remove(keyFor(dateKey));
}

export function listAllQuotes(): Record<string, DailyQuote> {
  const out: Record<string, DailyQuote> = {};
  for (const k of keys()) {
    if (!k.startsWith(PREFIX)) continue;
    const dateKey = k.slice(PREFIX.length);
    const q = getJSON<DailyQuote>(k);
    if (q?.text) out[dateKey] = q;
  }
  return out;
}

