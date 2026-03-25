import { MAX_CHAPTER_SUMMARY_CHARS } from '@/lib/chaptersStorage';

/** Align with external export prompt. */
export const CHAPTER_TITLE_MAX_CHARS = 60;

/** Current product tail lines (must match chapterExternalPrompt). */
const TAIL_ZH = '现在可以将上方内容复制回人生之书中保存本章。';
const TAIL_EN = 'You Can Now Copy The Above Into My Life Book To Save This Chapter.';

/** Legacy tails from "Feather Schedule" — keep stripping so old clipboard text still parses. */
const LEGACY_TAIL_ZH = '现在可以将上方内容复制回 Feather Schedule 中保存本章。';
const LEGACY_TAIL_EN = 'You Can Now Copy The Above Into Feather Schedule To Save This Chapter.';

const TRAILING_REMINDER_TAILS = [TAIL_ZH, TAIL_EN, LEGACY_TAIL_ZH, LEGACY_TAIL_EN];

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
  const tails = TRAILING_REMINDER_TAILS;
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

/** Read a JSON string value; `start` is the index of the first character after the opening `"`. */
function readJsonStringValue(s: string, start: number): { value: string; endExclusive: number } | null {
  let i = start;
  let out = '';
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      if (i + 1 >= s.length) return null;
      const n = s[i + 1];
      switch (n) {
        case 'n':
          out += '\n';
          i += 2;
          continue;
        case 'r':
          out += '\r';
          i += 2;
          continue;
        case 't':
          out += '\t';
          i += 2;
          continue;
        case '"':
        case '\\':
        case '/':
          out += n;
          i += 2;
          continue;
        case 'u': {
          if (i + 6 > s.length) return null;
          const hex = s.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
          out += String.fromCodePoint(parseInt(hex, 16));
          i += 6;
          continue;
        }
        default:
          out += n;
          i += 2;
          continue;
      }
    }
    if (c === '"') {
      return { value: out, endExclusive: i + 1 };
    }
    out += c;
    i++;
  }
  return null;
}

/**
 * When `narrativeSummary` contains unescaped `"` inside the value, `JSON.parse` fails.
 * If `narrativeSummary` is the last property, the closing `"` of that value is the last `"` before the final `}`.
 */
function parseLooseChapterFromText(text: string): { chapterTitle: string; narrativeSummary: string } | null {
  const t = text.trimEnd();
  const titleKey = '"chapterTitle"';
  const ti = t.indexOf(titleKey);
  if (ti === -1) return null;
  let p = ti + titleKey.length;
  while (p < t.length && /\s/.test(t[p])) p++;
  if (t[p] !== ':') return null;
  p++;
  while (p < t.length && /\s/.test(t[p])) p++;
  if (t[p] !== '"') return null;
  p++;
  const titleRead = readJsonStringValue(t, p);
  if (!titleRead) return null;

  const nsKey = '"narrativeSummary"';
  const ni = t.indexOf(nsKey);
  if (ni === -1) return null;
  let q = ni + nsKey.length;
  while (q < t.length && /\s/.test(t[q])) q++;
  if (t[q] !== ':') return null;
  q++;
  while (q < t.length && /\s/.test(t[q])) q++;
  if (t[q] !== '"') return null;
  q++;
  const nsValueStart = q;

  const lastBrace = t.lastIndexOf('}');
  if (lastBrace === -1) return null;
  let j = lastBrace - 1;
  while (j >= 0 && /\s/.test(t[j])) j--;
  if (j < 0 || t[j] !== '"') return null;
  const closingQuoteIdx = j;
  if (closingQuoteIdx < nsValueStart) return null;

  return {
    chapterTitle: titleRead.value,
    narrativeSummary: t.slice(nsValueStart, closingQuoteIdx),
  };
}

/**
 * Parse external AI reply: optional code fence, JSON with chapterTitle + narrativeSummary,
 * optional trailing product reminder line(s) (current or legacy).
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
    const loose = parseLooseChapterFromText(text);
    if (!loose) {
      return {
        ok: false,
        error:
          err('parseJson') +
          (isZh ? '（若正文含英文双引号，请写成 \\" 或改用弯引号。）' : ' Use \\" For Double Quotes Inside The Narrative.'),
      };
    }
    const title = loose.chapterTitle.trim();
    const summary = loose.narrativeSummary.trim();
    if (!title || !summary) {
      return { ok: false, error: err('missingFields') };
    }
    return {
      ok: true,
      chapterTitle: truncateTitle(title),
      narrativeSummary: truncateSummary(summary),
    };
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
