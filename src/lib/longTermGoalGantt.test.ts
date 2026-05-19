import { describe, it, expect } from 'vitest';
import { addDays, parseISO, subYears } from 'date-fns';
import {
  layoutBarInWindow,
  milestonePctOnBar,
  rowOverlapsWindow,
  flattenMediumTermRows,
  countCalendarDays,
  pickAxisTickStep,
  buildGanttAxisTicks,
  shiftViewWindow,
  computeVisibleDayCount,
  computePanBounds,
  resolveViewWindow,
  clampPpd,
  PPD_MIN,
  PPD_MAX,
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

  it('countCalendarDays is inclusive', () => {
    expect(countCalendarDays(windowStart, windowStart)).toBe(1);
    expect(countCalendarDays(windowStart, addDays(windowStart, 6))).toBe(7);
  });

  it('pickAxisTickStep decreases as ppd increases', () => {
    const coarse = pickAxisTickStep(30, 6);
    const fine = pickAxisTickStep(30, 40);
    expect(fine).toBeLessThanOrEqual(coarse);
    expect(fine).toBe(1);
  });

  it('buildGanttAxisTicks includes endpoints', () => {
    const ticks = buildGanttAxisTicks(windowStart, windowEnd, 32, false);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0].pct).toBe(0);
    expect(ticks[ticks.length - 1].pct).toBe(100);
  });

  it('shiftViewWindow moves by delta', () => {
    const bounds = computePanBounds([]);
    const vs = parseISO('2026-05-10');
    const ve = parseISO('2026-05-16');
    const next = shiftViewWindow(vs, ve, 7, bounds);
    expect(next.viewStart.getTime()).toBeGreaterThan(vs.getTime());
  });

  it('resolveViewWindow respects pan offset', () => {
    const bounds = computePanBounds([]);
    const anchor = parseISO('2026-05-01');
    const a = resolveViewWindow(anchor, 0, 7, bounds);
    const b = resolveViewWindow(anchor, 7, 7, bounds);
    expect(b.viewStart.getTime()).toBeGreaterThan(a.viewStart.getTime());
  });

  it('computeVisibleDayCount scales with ppd', () => {
    const wide = computeVisibleDayCount(400, 8);
    const narrow = computeVisibleDayCount(400, 32);
    expect(wide).toBeGreaterThan(narrow);
  });

  it('clampPpd respects bounds', () => {
    expect(clampPpd(1)).toBe(PPD_MIN);
    expect(clampPpd(100)).toBe(PPD_MAX);
  });

  it('computePanBounds extends at least two years back', () => {
    const bounds = computePanBounds([]);
    expect(bounds.minStart.getTime()).toBeLessThanOrEqual(subYears(new Date(), 2).getTime());
  });
});
