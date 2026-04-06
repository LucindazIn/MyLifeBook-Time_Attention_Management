/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { startOfDay, endOfDay } from 'date-fns';
import { buildLongTermGoalAlignmentBlock } from './longTermGoalChapterContext';
import { saveLongTermGoalMeta } from './longTermGoalMetaStorage';

beforeEach(() => {
  localStorage.clear();
});

describe('buildLongTermGoalAlignmentBlock', () => {
  it('returns empty string when no goals anywhere', () => {
    const text = buildLongTermGoalAlignmentBlock([], {}, startOfDay(new Date()), endOfDay(new Date()), 'zh');
    expect(text).toBe('');
  });

  it('includes goal line when meta exists', () => {
    saveLongTermGoalMeta({
      Test: {
        status: 'sprout',
        lastAlignedAt: new Date().toISOString(),
        mediumTermGoals: [
          {
            id: 'mt1',
            title: 'Phase 1',
            startAt: '2026-01-01',
            endAt: '2026-12-31',
            milestones: [{ id: 'm1', at: '2026-01-01', text: 'Step' }],
          },
        ],
      },
    });
    const text = buildLongTermGoalAlignmentBlock([], {}, startOfDay(new Date()), endOfDay(new Date()), 'zh');
    expect(text).toContain('Test');
    expect(text).toContain('里程碑');
    expect(text).toContain('Phase 1');
    expect(text).toContain('上次行动：暂无');
  });
});
