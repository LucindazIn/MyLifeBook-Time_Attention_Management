import { describe, it, expect, vi } from 'vitest';
import {
  registerGeminiKeyRequiredModalOpener,
  requestOpenGeminiKeyRequiredModal,
} from './geminiKeyModalBridge';

describe('geminiKeyModalBridge', () => {
  it('calls registered opener', () => {
    const fn = vi.fn();
    registerGeminiKeyRequiredModalOpener(fn);
    requestOpenGeminiKeyRequiredModal();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('no-op when unregistered', () => {
    registerGeminiKeyRequiredModalOpener(null);
    expect(() => requestOpenGeminiKeyRequiredModal()).not.toThrow();
  });
});
