/** Lets non-React code (e.g. App handlers) open the Tier B "user key required" modal. Registered by GeminiUserKeyProvider. */

type Opener = () => void;
let opener: Opener | null = null;

export function registerGeminiKeyRequiredModalOpener(fn: Opener | null): void {
  opener = fn;
}

export function requestOpenGeminiKeyRequiredModal(): void {
  opener?.();
}
