/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { ScheduleEvent } from '@/types';
import {
  loadLongTermGoalMeta,
  saveLongTermGoalMeta,
  migrateGoalRename,
  mergeLongTermGoalNames,
  pickUniqueNewVisionTitle,
  applyDisplayOrderToSortedNames,
  saveLongTermGoalDisplayOrder,
  DEFAULT_GOAL_TITLE_ZH,
  LONG_TERM_GOALS_TAGS_KEY,
} from './longTermGoalMetaStorage';

beforeEach(() => {
  localStorage.clear();
});

describe('longTermGoalMetaStorage', () => {
  it('migrateGoalRename moves meta key and updates tag pool', () => {
    saveLongTermGoalMeta({
      Old: { status: 'sprout', lastAlignedAt: new Date().toISOString(), mediumTermGoals: [] },
    });
    localStorage.setItem(LONG_TERM_GOALS_TAGS_KEY, JSON.stringify(['Old', 'Other']));

    const next = migrateGoalRename(loadLongTermGoalMeta(), 'Old', 'New');
    expect(next.Old).toBeUndefined();
    expect(next.New?.status).toBe('sprout');
    const tags = JSON.parse(localStorage.getItem(LONG_TERM_GOALS_TAGS_KEY) || '[]') as string[];
    expect(tags).toContain('New');
    expect(tags).not.toContain('Old');
  });

  it('mergeLongTermGoalNames unions events, meta keys, and tag pool', () => {
    const ev: ScheduleEvent[] = [
      {
        id: '1',
        title: 't',
        type: 'todo',
        startTime: new Date().toISOString(),
        longTermGoals: ['From Event'],
      },
    ];
    saveLongTermGoalMeta({
      'Meta Only': { status: 'completed', lastAlignedAt: new Date().toISOString(), mediumTermGoals: [] },
    });
    localStorage.setItem(LONG_TERM_GOALS_TAGS_KEY, JSON.stringify(['Pooled']));

    const names = mergeLongTermGoalNames(ev);
    expect(names.sort()).toEqual(['From Event', 'Meta Only', 'Pooled'].sort());
  });

  it('pickUniqueNewVisionTitle uses default when unused', () => {
    expect(pickUniqueNewVisionTitle([], true)).toBe(DEFAULT_GOAL_TITLE_ZH);
  });

  it('pickUniqueNewVisionTitle uses dot plus letters when default name already taken', () => {
    const rec = { status: 'sprout' as const, lastAlignedAt: new Date().toISOString(), mediumTermGoals: [] };
    saveLongTermGoalMeta({ [DEFAULT_GOAL_TITLE_ZH]: rec });
    expect(pickUniqueNewVisionTitle([], true)).toMatch(/^我想要·[a-z]{4}$/);
    saveLongTermGoalMeta({
      [DEFAULT_GOAL_TITLE_ZH]: rec,
      我想要·zzzz: rec,
    });
    expect(pickUniqueNewVisionTitle([], true)).toMatch(/^我想要·[a-z]{4}$/);
  });

  it('applyDisplayOrderToSortedNames respects priority then leftovers', () => {
    const sorted = ['a', 'b', 'c'];
    expect(applyDisplayOrderToSortedNames(sorted, ['c', 'a'])).toEqual(['c', 'a', 'b']);
  });
});

describe('mergeLongTermGoalNames with display order', () => {
  it('prepended order surfaces first in merge', () => {
    const rec = { status: 'sprout' as const, lastAlignedAt: new Date().toISOString(), mediumTermGoals: [] };
    const second = '我想要·aaaab';
    saveLongTermGoalMeta({
      [DEFAULT_GOAL_TITLE_ZH]: rec,
      [second]: rec,
    });
    saveLongTermGoalDisplayOrder([second, DEFAULT_GOAL_TITLE_ZH]);
    const names = mergeLongTermGoalNames([]);
    expect(names[0]).toBe(second);
    expect(names[1]).toBe(DEFAULT_GOAL_TITLE_ZH);
  });
});
