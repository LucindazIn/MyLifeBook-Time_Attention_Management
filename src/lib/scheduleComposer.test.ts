import { describe, it, expect } from 'vitest';
import {
  composeRandomDaySchedule,
  createRng,
  nextEventSlot,
  shuffleInPlace,
  type CatalogActivity,
} from './scheduleComposer';

const base = (overrides: Partial<CatalogActivity>): CatalogActivity => ({
  title: 'T',
  description: 'D',
  intensity: 'low',
  mode_tags: ['both'],
  type: 'todo',
  default_duration_minutes: 30,
  locale: 'en',
  ...overrides,
});

describe('nextEventSlot', () => {
  it('keeps morning events before noon when they fit', () => {
    expect(nextEventSlot(9 * 60, 60)).toEqual([9 * 60, 10 * 60]);
  });

  it('pushes across lunch when event would span 12:00', () => {
    const [s, e] = nextEventSlot(11 * 60 + 30, 60);
    expect(s).toBe(13 * 60);
    expect(e).toBe(14 * 60);
  });

  it('moves cursor out of lunch window', () => {
    const [s, e] = nextEventSlot(12 * 60 + 15, 30);
    expect(s).toBe(13 * 60);
    expect(e).toBe(13 * 60 + 30);
  });
});

describe('composeRandomDaySchedule', () => {
  const catalog: CatalogActivity[] = [
    base({ title: 'H1', intensity: 'high', mode_tags: ['productive'], default_duration_minutes: 20 }),
    base({ title: 'H2', intensity: 'high', mode_tags: ['productive'], default_duration_minutes: 20 }),
    base({ title: 'H3', intensity: 'high', mode_tags: ['productive'], default_duration_minutes: 20 }),
    base({ title: 'H4', intensity: 'high', mode_tags: ['productive'], default_duration_minutes: 20 }),
    base({ title: 'H5', intensity: 'high', mode_tags: ['productive'], default_duration_minutes: 20 }),
    base({ title: 'L1', intensity: 'low', mode_tags: ['productive'], default_duration_minutes: 15 }),
    base({ title: 'L2', intensity: 'low', mode_tags: ['productive'], default_duration_minutes: 15 }),
  ];

  it('returns 5 events for productive with 4 high and 1 low composition', () => {
    const out = composeRandomDaySchedule(catalog, 'productive', 'en', 'test-seed-a');
    expect(out).toHaveLength(5);
    const highs = out.filter((e) => e.title.startsWith('H')).length;
    const lows = out.filter((e) => e.title.startsWith('L')).length;
    expect(highs).toBe(4);
    expect(lows).toBe(1);
  });

  it('is deterministic for the same seed', () => {
    const a = composeRandomDaySchedule(catalog, 'productive', 'en', 'fixed-seed');
    const b = composeRandomDaySchedule(catalog, 'productive', 'en', 'fixed-seed');
    expect(a.map((e) => e.title)).toEqual(b.map((e) => e.title));
    expect(a.map((e) => e.startTime)).toEqual(b.map((e) => e.startTime));
  });

  it('usually differs when seed changes', () => {
    const a = composeRandomDaySchedule(catalog, 'productive', 'en', 'seed-one-aaaaaaaa');
    const b = composeRandomDaySchedule(catalog, 'productive', 'en', 'seed-two-bbbbbbbb');
    const sameOrder = a.map((e) => e.title).join('|') === b.map((e) => e.title).join('|');
    const sameTimes = a.map((e) => e.startTime).join('|') === b.map((e) => e.startTime).join('|');
    expect(sameOrder && sameTimes).toBe(false);
  });

  it('returns empty when no items match locale/mode', () => {
    const zhOnly = [base({ title: 'Z', locale: 'zh', mode_tags: ['productive'] })];
    expect(composeRandomDaySchedule(zhOnly, 'productive', 'en', 'x')).toEqual([]);
  });

  it('keeps generated times within 07:00-22:00 window', () => {
    const out = composeRandomDaySchedule(catalog, 'productive', 'en', 'window-seed');
    const toMin = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };
    for (const e of out) {
      expect(toMin(e.startTime)).toBeGreaterThanOrEqual(7 * 60);
      expect(toMin(e.endTime)).toBeLessThanOrEqual(22 * 60);
    }
  });

  it('guarantees at least one morning and one afternoon event', () => {
    const out = composeRandomDaySchedule(catalog, 'productive', 'en', 'segment-seed');
    const toMin = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };
    const hasMorning = out.some((e) => {
      const s = toMin(e.startTime);
      return s >= 7 * 60 && s < 12 * 60;
    });
    const hasAfternoon = out.some((e) => {
      const s = toMin(e.startTime);
      return s >= 12 * 60 && s < 18 * 60;
    });
    expect(hasMorning).toBe(true);
    expect(hasAfternoon).toBe(true);
  });
});

describe('createRng / shuffleInPlace', () => {
  it('shuffles deterministically', () => {
    const rng = createRng('abc');
    const a = [1, 2, 3, 4, 5];
    shuffleInPlace(a, rng);
    const rng2 = createRng('abc');
    const b = [1, 2, 3, 4, 5];
    shuffleInPlace(b, rng2);
    expect(a).toEqual(b);
  });
});
