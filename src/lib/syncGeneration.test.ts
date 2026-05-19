import { describe, it, expect } from 'vitest';
import { createSyncGenerationGuard } from '@/lib/syncGeneration';

describe('createSyncGenerationGuard', () => {
  it('marks earlier runs stale after a newer sync starts', () => {
    const guard = createSyncGenerationGuard();
    const first = guard.begin();
    expect(guard.isCurrent(first)).toBe(true);

    const second = guard.begin();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it('only the latest run should clear syncing flag', () => {
    const guard = createSyncGenerationGuard();
    const first = guard.begin();
    const second = guard.begin();
    expect(guard.shouldFinalize(first)).toBe(false);
    expect(guard.shouldFinalize(second)).toBe(true);
  });
});
