/** Thrown when Tier B AI is invoked without a saved user Gemini API key. */
export class UserGeminiKeyMissing extends Error {
  readonly code = 'USER_GEMINI_KEY_MISSING' as const;

  constructor(message = 'User Gemini API key is required') {
    super(message);
    this.name = 'UserGeminiKeyMissing';
    Object.setPrototypeOf(this, UserGeminiKeyMissing.prototype);
  }
}

export function isUserGeminiKeyMissing(e: unknown): e is UserGeminiKeyMissing {
  return e instanceof UserGeminiKeyMissing || (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'USER_GEMINI_KEY_MISSING');
}
