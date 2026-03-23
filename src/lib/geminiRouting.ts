/**
 * Pure helpers for Gemini routing (Tier A vs B). Used by gemini.ts and unit tests.
 */

export type GeminiCallTier = 'free_tier' | 'user_tier';

export function canUseFreeTierGemini(input: {
  hasUserKey: boolean;
  useProxy: boolean;
  hasDeveloperKey: boolean;
}): boolean {
  return input.hasUserKey || input.useProxy || input.hasDeveloperKey;
}

/** Tier B always requires a user key in the browser (no developer proxy for user-tier calls). */
export function tierBRequiresUserKey(): boolean {
  return true;
}
