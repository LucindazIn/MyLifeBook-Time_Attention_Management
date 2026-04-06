/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import type { ScheduleEvent } from '@/types';
import { attributeExpandedEventsToMediumTermGoals } from './mediumTermGoalAttribution';

describe('attributeExpandedEventsToMediumTermGoals', () => {
  const parent = 'Learn Piano';

  it('attributes by calendar day within first matching medium window', () => {
    const expanded: ScheduleEvent[] = [
      {
        id: '1',
        title: 'a',
        type: 'todo',
        startTime: new Date('2026-06-10T10:00:00').toISOString(),
        endTime: new Date('2026-06-10T11:00:00').toISOString(),
        longTermGoals: [parent],
      },
      {
        id: '2',
        title: 'b',
        type: 'todo',
        startTime: new Date('2026-07-05T14:00:00').toISOString(),
        endTime: new Date('2026-07-05T15:00:00').toISOString(),
        longTermGoals: [parent],
      },
    ];
    const medium = [
      { id: 'm1', title: 'Phase 1', startAt: '2026-06-01', endAt: '2026-06-30', milestones: [] },
      { id: 'm2', title: 'Phase 2', startAt: '2026-07-01', endAt: '2026-07-31', milestones: [] },
    ];
    const { rows, parentTotalCount, parentTotalDurationMs } = attributeExpandedEventsToMediumTermGoals(
      expanded,
      parent,
      medium
    );
    expect(parentTotalCount).toBe(2);
    expect(parentTotalDurationMs).toBe(3600000 * 2);
    const p1 = rows.find((r) => r.mediumId === 'm1');
    const p2 = rows.find((r) => r.mediumId === 'm2');
    expect(p1?.count).toBe(1);
    expect(p2?.count).toBe(1);
  });

  it('puts events outside all windows in unassigned', () => {
    const expanded: ScheduleEvent[] = [
      {
        id: '1',
        title: 'a',
        type: 'todo',
        startTime: new Date('2026-08-10T10:00:00').toISOString(),
        longTermGoals: [parent],
      },
    ];
    const medium = [
      { id: 'm1', title: 'Phase 1', startAt: '2026-06-01', endAt: '2026-06-30', milestones: [] },
    ];
    const { rows } = attributeExpandedEventsToMediumTermGoals(expanded, parent, medium);
    const u = rows.find((r) => r.mediumId === 'unassigned');
    expect(u?.count).toBe(1);
  });
});
