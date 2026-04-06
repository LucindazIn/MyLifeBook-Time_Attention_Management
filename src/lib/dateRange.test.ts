/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  formatPeriodSubtitle,
  formatPeriodWeekLabel,
  weekPeriodLabelAnchorDate,
} from './dateRange';

describe('week period labels (majority month via Thursday)', () => {
  it('attributes cross-month Mon–Sun week to the month containing Thursday (April)', () => {
    const start = '2025-03-31';
    const end = '2025-04-06';
    const thu = weekPeriodLabelAnchorDate('this_week', start, end)!;
    expect(thu.getFullYear()).toBe(2025);
    expect(thu.getMonth()).toBe(3);
    expect(thu.getDate()).toBe(3);
    expect(formatPeriodSubtitle(start, 'this_week', true, end)).toBe('2025年4月第1周');
    expect(formatPeriodWeekLabel(start, 'this_week', true, end)).toBe('4月第1周');
  });

  it('falls back to periodStart-only slice when periodEnd is missing (legacy / old snapshots)', () => {
    expect(formatPeriodSubtitle('2025-03-31', 'this_week', true)).toBe('2025年3月第5周');
    expect(formatPeriodWeekLabel('2025-03-31', 'this_week', true)).toBe('3月第5周');
  });

  it('keeps a fully in-month week in that month', () => {
    const start = '2025-04-07';
    const end = '2025-04-13';
    expect(formatPeriodSubtitle(start, 'last_week', true, end)).toBe('2025年4月第2周');
  });

  it('this_month is unchanged', () => {
    expect(formatPeriodSubtitle('2025-04-01', 'this_month', true)).toBe('2025年4月');
  });
});
