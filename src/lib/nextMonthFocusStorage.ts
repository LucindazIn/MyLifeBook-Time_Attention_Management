import { format, addMonths, startOfMonth } from 'date-fns';
import { notifyCollectionStateChanged } from '@/lib/collectionStateNotify';

const PREFIX = 'feather_next_month_focus_';

export const NEXT_MONTH_FOCUS_STORAGE_PREFIX = PREFIX;

function keyForNextMonth(): string {
  const next = startOfMonth(addMonths(new Date(), 1));
  return PREFIX + format(next, 'yyyy-MM');
}

function parseStored(raw: string | null): { text: string; updatedAt: number } {
  if (!raw) return { text: '', updatedAt: 0 };
  try {
    if (raw.trim().startsWith('{')) {
      const o = JSON.parse(raw) as { text?: string; updatedAt?: number; v?: number };
      return {
        text: typeof o.text === 'string' ? o.text : '',
        updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : 0,
      };
    }
  } catch {
    /* legacy */
  }
  return { text: raw, updatedAt: 0 };
}

function serialize(text: string, updatedAt: number): string {
  return JSON.stringify({ v: 1, text, updatedAt });
}

export function getNextMonthFocus(): string {
  try {
    return parseStored(localStorage.getItem(keyForNextMonth())).text;
  } catch {
    return '';
  }
}

export function setNextMonthFocus(text: string, opts?: { fromSync?: boolean }): void {
  try {
    const now = Date.now();
    localStorage.setItem(keyForNextMonth(), serialize(text, now));
  } catch {
    // ignore
  }
  if (!opts?.fromSync) notifyCollectionStateChanged('user');
}

export function dumpNextMonthFocusStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof localStorage === 'undefined') return out;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) {
      const v = localStorage.getItem(k);
      if (v != null) out[k] = v;
    }
  }
  return out;
}

export function applyNextMonthFocusStorageDump(entries: Record<string, string>): void {
  if (typeof localStorage === 'undefined') return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) toRemove.push(k);
  }
  for (const k of toRemove) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(entries)) {
    if (k.startsWith(PREFIX)) localStorage.setItem(k, v);
  }
}
