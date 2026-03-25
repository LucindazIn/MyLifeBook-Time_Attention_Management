import { describe, it, expect } from 'vitest';
import { parseChapterAiPaste } from '@/lib/parseChapterAiPaste';

describe('parseChapterAiPaste', () => {
  it('parses strict JSON', () => {
    const raw = '{"chapterTitle":"Hello","narrativeSummary":"Line one\\nLine two"}';
    const r = parseChapterAiPaste(raw, true);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chapterTitle).toBe('Hello');
    expect(r.narrativeSummary).toContain('Line one');
  });

  it('recovers when narrativeSummary contains unescaped double quotes (last field)', () => {
    const broken = '{"chapterTitle":"T","narrativeSummary":"say "hello" here"}';
    const r = parseChapterAiPaste(broken, true);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chapterTitle).toBe('T');
    expect(r.narrativeSummary).toBe('say "hello" here');
  });

  it('parses user-style paste with Chinese body and quoted phrase', () => {
    const json =
      '{"chapterTitle": "在阅读与省思里的一周", "narrativeSummary": "那样，"哈哈哈哈"，这大概就是阅读最直白的快乐。\n\n结尾。"}';
    const r = parseChapterAiPaste(json, true);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chapterTitle).toBe('在阅读与省思里的一周');
    expect(r.narrativeSummary).toContain('哈哈哈哈');
    expect(r.narrativeSummary).toContain('结尾。');
  });
});
