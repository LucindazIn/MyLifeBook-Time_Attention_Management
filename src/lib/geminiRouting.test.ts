import { describe, it, expect } from 'vitest';
import { canUseFreeTierGemini, tierBRequiresUserKey } from './geminiRouting';

describe('canUseFreeTierGemini', () => {
  it('returns true when user key present', () => {
    expect(
      canUseFreeTierGemini({ hasUserKey: true, useProxy: false, hasDeveloperKey: false })
    ).toBe(true);
  });

  it('returns true when proxy configured', () => {
    expect(
      canUseFreeTierGemini({ hasUserKey: false, useProxy: true, hasDeveloperKey: false })
    ).toBe(true);
  });

  it('returns true when developer key present', () => {
    expect(
      canUseFreeTierGemini({ hasUserKey: false, useProxy: false, hasDeveloperKey: true })
    ).toBe(true);
  });

  it('returns false when no route', () => {
    expect(
      canUseFreeTierGemini({ hasUserKey: false, useProxy: false, hasDeveloperKey: false })
    ).toBe(false);
  });
});

describe('tierBRequiresUserKey', () => {
  it('is always true by policy', () => {
    expect(tierBRequiresUserKey()).toBe(true);
  });
});
