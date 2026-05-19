import { describe, it, expect } from 'vitest';
import { getAnalyticsRangeLabel } from '@/lib/analyticsRangeLabel';

describe('getAnalyticsRangeLabel', () => {
  it('returns zh labels when isZh', () => {
    expect(getAnalyticsRangeLabel('this_week', true)).toBe('本周');
    expect(getAnalyticsRangeLabel('custom', true)).toBe('自定义');
  });

  it('returns Title Case en labels when not zh', () => {
    expect(getAnalyticsRangeLabel('this_week', false)).toBe('This Week');
    expect(getAnalyticsRangeLabel('last_week', false)).toBe('Last Week');
  });
});
