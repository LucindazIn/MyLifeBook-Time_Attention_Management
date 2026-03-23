const KEY_LINE1 = 'feather_lifebook_line1';
const KEY_LINE2 = 'feather_lifebook_line2';
const KEY_LINE3 = 'feather_lifebook_line3';

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

export function setLifeBookCoverLine(
  which: 'line1' | 'line2' | 'line3',
  value: string
): void {
  if (typeof window === 'undefined') return;
  const key = which === 'line1' ? KEY_LINE1 : which === 'line2' ? KEY_LINE2 : KEY_LINE3;
  localStorage.setItem(key, value);
}

export const DEFAULT_LINE1_EN = 'Life Book';
export const DEFAULT_LINE1_ZH = '人生之书';
export const DEFAULT_LINE2_EN = 'Book Name';
export const DEFAULT_LINE2_ZH = '书名';
export const DEFAULT_LINE3_EN = 'Time Lapse';
export const DEFAULT_LINE3_ZH = '时间跨度';
