import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import {
  layoutBarInWindow,
  milestonePctOnBar,
  rowOverlapsWindow,
  flattenMediumTermRows,
} from './longTermGoalGantt';

describe('longTermGoalGantt', () => {
  const windowStart = parseISO('2026-05-01T00:00:00');
  const windowEnd = parseISO('2026-05-31T23:59:59');

  it('layoutBarInWindow clips to window', () => {
    const bar = layoutBarInWindow(windowStart, windowEnd, '2026-04-15', '2026-05-20');
    expect(bar.visible).toBe(true);
    expect(bar.leftPct).toBeGreaterThanOrEqual(0);
    expect(bar.leftPct + bar.widthPct).toBeLessThanOrEqual(100.1);
  });

  it('rowOverlapsWindow is false when outside', () => {
    expect(rowOverlapsWindow(windowStart, windowEnd, '2026-06-01', '2026-06-30')).toBe(false);
  });

  it('milestonePctOnBar marks outside range', () => {
    const inside = milestonePctOnBar('2026-05-01', '2026-05-31', '2026-05-15');
    expect(inside.outsideBar).toBe(false);
    const outside = milestonePctOnBar('2026-05-01', '2026-05-31', '2026-06-01');
    expect(outside.outsideBar).toBe(true);
  });

  it('flattenMediumTermRows skips empty dates', () => {
    const rows = flattenMediumTermRows(['A'], {
      A: {
        mediumTermGoals: [
          { id: '1', title: 'X', startAt: '', endAt: '2026-05-10', milestones: [] },
          { id: '2', title: 'Y', startAt: '2026-05-01', endAt: '2026-05-10', milestones: [] },
        ],
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].visionName).toBe('A');
  });
});
