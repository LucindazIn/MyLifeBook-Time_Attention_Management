import { notifyCollectionStateChanged } from '@/lib/collectionStateNotify';

const KEY_LINE1 = 'feather_lifebook_line1';
const KEY_LINE2 = 'feather_lifebook_line2';
const KEY_LINE3 = 'feather_lifebook_line3';
const KEY_COVER_AT = 'feather_lifebook_cover_updated_at';

export function getLifeBookCoverLines(): { line1: string; line2: string; line3: string } {
  if (typeof window === 'undefined') {
    return { line1: '', line2: '', line3: '' };
  }
  return {
    line1: localStorage.getItem(KEY_LINE1) ?? '',
    line2: localStorage.getItem(KEY_LINE2) ?? '',
    line3: localStorage.getItem(KEY_LINE3) ?? '',
  };
}

export function getLifeBookCoverUpdatedAt(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(KEY_COVER_AT);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

function touchLifeBookCoverUpdatedAt(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_COVER_AT, String(Date.now()));
}

export function setLifeBookCoverLine(
  which: 'line1' | 'line2' | 'line3',
  value: string,
  opts?: { fromSync?: boolean }
): void {
  if (typeof window === 'undefined') return;
  const key = which === 'line1' ? KEY_LINE1 : which === 'line2' ? KEY_LINE2 : KEY_LINE3;
  localStorage.setItem(key, value);
  if (!opts?.fromSync) {
    touchLifeBookCoverUpdatedAt();
    notifyCollectionStateChanged('user');
  }
}

export const DEFAULT_LINE1_EN = 'Life Book';
export const DEFAULT_LINE1_ZH = '人生之书';
export const DEFAULT_LINE2_EN = 'Book Name';
export const DEFAULT_LINE2_ZH = '书名';
export const DEFAULT_LINE3_EN = 'Time Lapse';
export const DEFAULT_LINE3_ZH = '时间跨度';

/** Batch-apply from remote sync (no per-line notifications). */
export function applyLifeBookCoverFromSync(cover: {
  line1: string;
  line2: string;
  line3: string;
  updatedAt: number;
}): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_LINE1, cover.line1);
  localStorage.setItem(KEY_LINE2, cover.line2);
  localStorage.setItem(KEY_LINE3, cover.line3);
  localStorage.setItem(KEY_COVER_AT, String(cover.updatedAt || 0));
}
