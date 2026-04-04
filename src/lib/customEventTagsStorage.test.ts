/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  CUSTOM_EVENT_TAGS_KEY,
  touchCustomEventLabel,
  syncAndPruneCustomEventTags,
  isPresetEventLabel,
} from './customEventTagsStorage';

const LAST_USED_KEY = 'feather_custom_event_tag_last_used';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('customEventTagsStorage', () => {
  it('never removes preset labels by time', () => {
    localStorage.setItem(CUSTOM_EVENT_TAGS_KEY, JSON.stringify(['深度工作']));
    localStorage.setItem(LAST_USED_KEY, JSON.stringify({ 深度工作: Date.now() - 10 * 24 * 60 * 60 * 1000 }));

    const { tags } = syncAndPruneCustomEventTags();
    expect(tags).toContain('深度工作');
  });

  it('removes custom tag after 2 days without touch', () => {
    const old = Date.now() - 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem(CUSTOM_EVENT_TAGS_KEY, JSON.stringify(['My Tag']));
    localStorage.setItem(LAST_USED_KEY, JSON.stringify({ 'My Tag': old }));

    const { tags, changed } = syncAndPruneCustomEventTags();
    expect(changed).toBe(true);
    expect(tags).not.toContain('My Tag');
  });

  it('touchCustomEventLabel updates last used for custom only', () => {
    expect(isPresetEventLabel('阅读')).toBe(true);
    touchCustomEventLabel('阅读');
    expect(JSON.parse(localStorage.getItem(LAST_USED_KEY) || '{}')).toEqual({});

    touchCustomEventLabel('Only Mine');
    const m = JSON.parse(localStorage.getItem(LAST_USED_KEY) || '{}') as Record<string, number>;
    expect(m['Only Mine']).toBe(Date.now());
  });
});
