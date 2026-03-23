const STORAGE_KEY = 'feather_user_gemini_api_key';

/** User-owned Gemini API key — stored only in this browser (localStorage). Never log this value. */
export function getUserGeminiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (localStorage.getItem(STORAGE_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

export function setUserGeminiKey(value: string): void {
  if (typeof window === 'undefined') return;
  const v = value.trim();
  if (v) {
    localStorage.setItem(STORAGE_KEY, v);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function clearUserGeminiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function hasUserGeminiKey(): boolean {
  return getUserGeminiKey().length > 0;
}
