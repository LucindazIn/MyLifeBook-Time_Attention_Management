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
  LONG_TERM_GOALS_TAGS_KEY,
} from './longTermGoalMetaStorage';

beforeEach(() => {
  localStorage.clear();
});

describe('longTermGoalMetaStorage', () => {
  it('migrateGoalRename moves meta key and updates tag pool', () => {
    saveLongTermGoalMeta({
      Old: { status: 'sprout', lastAlignedAt: new Date().toISOString(), milestones: [] },
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
      'Meta Only': { status: 'completed', lastAlignedAt: new Date().toISOString(), milestones: [] },
    });
    localStorage.setItem(LONG_TERM_GOALS_TAGS_KEY, JSON.stringify(['Pooled']));

    const names = mergeLongTermGoalNames(ev);
    expect(names.sort()).toEqual(['From Event', 'Meta Only', 'Pooled'].sort());
  });
});
