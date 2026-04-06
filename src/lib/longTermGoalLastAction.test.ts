/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import type { ScheduleEvent } from '@/types';
import { getLastActionDateForGoal } from './longTermGoalLastAction';

describe('getLastActionDateForGoal', () => {
  it('returns null when no events reference the goal', () => {
    const events: ScheduleEvent[] = [
      {
        id: '1',
        title: 't',
        type: 'todo',
        startTime: new Date('2026-01-10T10:00:00').toISOString(),
        longTermGoals: ['Other'],
      },
    ];
    expect(getLastActionDateForGoal(events, 'Mine', {})).toBeNull();
  });

  it('returns latest start time among matching events', () => {
    const events: ScheduleEvent[] = [
      {
        id: 'a',
        title: 'old',
        type: 'todo',
        startTime: new Date('2026-01-05T10:00:00').toISOString(),
        longTermGoals: ['G'],
      },
      {
        id: 'b',
        title: 'new',
        type: 'todo',
        startTime: new Date('2026-01-15T14:00:00').toISOString(),
        longTermGoals: ['G'],
      },
    ];
    const d = getLastActionDateForGoal(events, 'G', {});
    expect(d?.toISOString()).toBe(new Date('2026-01-15T14:00:00').toISOString());
  });
});
