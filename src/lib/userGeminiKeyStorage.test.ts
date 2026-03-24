/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUserGeminiKey,
  setUserGeminiKey,
  clearUserGeminiKey,
  hasUserGeminiKey,
} from './userGeminiKeyStorage';

const KEY = 'feather_user_gemini_api_key';

beforeEach(() => {
  localStorage.clear();
});

describe('userGeminiKeyStorage', () => {
  it('round-trip set/get', () => {
    setUserGeminiKey('  sk-test  ');
    expect(localStorage.getItem(KEY)).toBe('sk-test');
    expect(getUserGeminiKey()).toBe('sk-test');
    expect(hasUserGeminiKey()).toBe(true);
  });

  it('clear removes key', () => {
    setUserGeminiKey('abc');
    clearUserGeminiKey();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(hasUserGeminiKey()).toBe(false);
  });

  it('set empty string clears', () => {
    setUserGeminiKey('x');
    setUserGeminiKey('   ');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
