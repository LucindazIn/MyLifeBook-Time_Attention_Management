import { MAX_CHAPTER_SUMMARY_CHARS } from '@/lib/chaptersStorage';

/** Align with external export prompt. */
export const CHAPTER_TITLE_MAX_CHARS = 60;

const TAIL_ZH = '现在可以将上方内容复制回 Feather Schedule 中保存本章。';
const TAIL_EN = 'You Can Now Copy The Above Into Feather Schedule To Save This Chapter.';

export type ParseChapterAiPasteResult =
  | { ok: true; chapterTitle: string; narrativeSummary: string }
  | { ok: false; error: string };

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, '');
}

/** Remove optional ```json ... ``` or ``` ... ``` wrapper. */
function stripMarkdownCodeFence(s: string): string {
  let t = s.trim();
  if (!t.startsWith('```')) return t;
  const firstNl = t.indexOf('\n');
  if (firstNl === -1) return t;
  const inner = t.slice(firstNl + 1);
  const lastFence = inner.lastIndexOf('```');
  if (lastFence === -1) return t;
  return inner.slice(0, lastFence).trim();
}

function stripTrailingReminders(s: string): string {
  let t = s.trimEnd();
  const tails = [TAIL_ZH, TAIL_EN];
  let changed = true;
  while (changed) {
    changed = false;
    for (const tail of tails) {
      if (t.endsWith(tail)) {
        t = t.slice(0, -tail.length).trimEnd();
        changed = true;
      }
    }
  }
  return t.trim();
}

/**
 * Extract first top-level JSON object using brace depth outside of strings
 * (handles `"text": "}"` and newlines inside strings).
 */
function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function truncateTitle(t: string): string {
  if (t.length <= CHAPTER_TITLE_MAX_CHARS) return t;
  return t.slice(0, CHAPTER_TITLE_MAX_CHARS);
}

function truncateSummary(t: string): string {
  if (t.length <= MAX_CHAPTER_SUMMARY_CHARS) return t;
  return t.slice(0, MAX_CHAPTER_SUMMARY_CHARS);
}

/**
 * Parse external AI reply: optional code fence, JSON with chapterTitle + narrativeSummary,
 * optional trailing Feather Schedule reminder line(s).
 */
export function parseChapterAiPaste(raw: string, isZh: boolean): ParseChapterAiPasteResult {
  const err = (key: 'noJson' | 'parseJson' | 'missingFields' | 'badTypes'): string => {
    const m: Record<typeof key, { zh: string; en: string }> = {
      noJson: { zh: '未找到 JSON。请粘贴包含 { … } 的完整回复。', en: 'No JSON Found. Paste The Full Reply Including Braces.' },
      parseJson: { zh: 'JSON 无法解析。请检查引号与逗号是否完整。', en: 'Invalid JSON. Check Quotes And Commas.' },
      missingFields: {
        zh: 'JSON 中缺少 chapterTitle 或 narrativeSummary。',
        en: 'Missing chapterTitle Or narrativeSummary In JSON.',
      },
      badTypes: { zh: 'chapterTitle 与 narrativeSummary 须为文本。', en: 'chapterTitle And narrativeSummary Must Be Text.' },
    };
    return isZh ? m[key].zh : m[key].en;
  };

  let text = stripBom(raw.trim());
  text = stripMarkdownCodeFence(text);
  text = stripTrailingReminders(text);

  const jsonStr = extractFirstJsonObject(text);
  if (!jsonStr) return { ok: false, error: err('noJson') };

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { ok: false, error: err('parseJson') };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: err('missingFields') };
  }

  const o = parsed as Record<string, unknown>;

  if (typeof o.narrativeSummary !== 'string') {
    return { ok: false, error: err('badTypes') };
  }

  const titleDirect = typeof o.chapterTitle === 'string' ? o.chapterTitle.trim() : '';
  const titleFromList =
    !titleDirect &&
    Array.isArray(o.chapterTitles) &&
    o.chapterTitles.length > 0 &&
    typeof o.chapterTitles[0] === 'string'
      ? o.chapterTitles[0].trim()
      : '';
  const title = titleDirect || titleFromList;
  const summary = o.narrativeSummary.trim();

  if (!title || !summary) {
    return { ok: false, error: err('missingFields') };
  }

  return {
    ok: true,
    chapterTitle: truncateTitle(title),
    narrativeSummary: truncateSummary(summary),
  };
}
