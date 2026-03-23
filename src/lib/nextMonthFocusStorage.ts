import { format, addMonths, startOfMonth } from 'date-fns';

const PREFIX = 'feather_next_month_focus_';

function keyForNextMonth(): string {
  const next = startOfMonth(addMonths(new Date(), 1));
  return PREFIX + format(next, 'yyyy-MM');
}

export function getNextMonthFocus(): string {
  try {
    return localStorage.getItem(keyForNextMonth()) ?? '';
  } catch {
    return '';
  }
}

export function setNextMonthFocus(text: string): void {
  try {
    localStorage.setItem(keyForNextMonth(), text);
  } catch {
    // ignore
  }
}
