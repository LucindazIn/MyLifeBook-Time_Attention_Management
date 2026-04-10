import type { ChapterPeriodKey } from '@/lib/dateRange';
import { formatPeriodSubtitle } from '@/lib/dateRange';
import {
  getLifeBookCoverLines,
  DEFAULT_LINE1_EN,
  DEFAULT_LINE1_ZH,
  DEFAULT_LINE2_EN,
  DEFAULT_LINE2_ZH,
  DEFAULT_LINE3_EN,
  DEFAULT_LINE3_ZH,
} from '@/lib/lifeBookCoverStorage';

/** 人生之书章节正文结构（与用户编辑、外部粘贴导入同源）。 */
export interface WeeklyChapterOutput {
  chapterTitles: [string, string, string];
  narrativeSummary: string;
  reflectionQuestions: [string, string];
}

export type LifeBookExportLanguage = 'zh' | 'en';

const CHAPTER_SEPARATOR = '\n\n---\n\n';

function resolvedCoverLines(isZh: boolean): string[] {
  const s = getLifeBookCoverLines();
  const d1 = isZh ? DEFAULT_LINE1_ZH : DEFAULT_LINE1_EN;
  const d2 = isZh ? DEFAULT_LINE2_ZH : DEFAULT_LINE2_EN;
  const d3 = isZh ? DEFAULT_LINE3_ZH : DEFAULT_LINE3_EN;
  return [(s.line1.trim() || d1), (s.line2.trim() || d2), (s.line3.trim() || d3)];
}

const STORAGE_KEY = 'feather_chapters';
const MAX_CHAPTERS = 20;
export const MAX_CHAPTER_SUMMARY_CHARS = 2000;
const MAX_SUMMARY_CHARS = MAX_CHAPTER_SUMMARY_CHARS;

export interface SavedChapter extends WeeklyChapterOutput {
  id: string;
  periodKey: ChapterPeriodKey;
  periodLabel: string;
  generatedAt: string; // ISO
  selectedTitleIndex: 0 | 1 | 2;
  /** 该章对应的周期起止日期（ISO 日期 yyyy-MM-dd），用于人生之书按时间筛高光事件 */
  periodStart?: string;
  periodEnd?: string;
}

/** 未保存的章节草稿（无 id），用于「从空白编辑」或生成中/失败时在弹窗内编辑 */
export type ChapterDraft = Omit<SavedChapter, 'id'>;

function notifyChaptersChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('feather-chapters-updated'));
}

function loadRaw(): SavedChapter[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return [];
    const parsed = JSON.parse(s) as SavedChapter[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRaw(list: SavedChapter[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_CHAPTERS)));
  notifyChaptersChanged();
}

/** Raw list for cross-device merge (unsorted). */
export function getChaptersSnapshot(): SavedChapter[] {
  return [...loadRaw()];
}

export type GetChaptersOptions = { order?: 'asc' | 'desc' };

/** @param order `desc` = newest first (default, e.g. 时间聚合). `asc` = oldest first (人生之书). */
export function getChapters(options?: GetChaptersOptions): SavedChapter[] {
  const list = loadRaw();
  const order = options?.order ?? 'desc';
  const cmp = (a: SavedChapter, b: SavedChapter) =>
    (a.generatedAt || '').localeCompare(b.generatedAt || '');
  return list.sort((a, b) => (order === 'asc' ? cmp(a, b) : cmp(b, a)));
}

function truncateSummary(text: string): string {
  if (typeof text !== 'string') return '';
  if (text.length <= MAX_SUMMARY_CHARS) return text;
  return text.slice(0, MAX_SUMMARY_CHARS);
}

function samePeriod(
  a: { periodKey: string; periodStart?: string; periodEnd?: string },
  b: { periodKey: string; periodStart?: string; periodEnd?: string }
): boolean {
  if (a.periodKey !== b.periodKey) return false;
  if (a.periodStart !== b.periodStart) return false;
  if (a.periodKey === 'custom') return a.periodEnd === b.periodEnd;
  return true;
}

/**
 * Union local + remote: newer `generatedAt` wins per id; then one chapter per period (newest first); cap MAX_CHAPTERS.
 */
export function mergeChapterListsForSync(local: SavedChapter[], remote: SavedChapter[]): SavedChapter[] {
  const byId = new Map<string, SavedChapter>();
  for (const c of [...remote, ...local]) {
    const prev = byId.get(c.id);
    if (!prev || (c.generatedAt || '').localeCompare(prev.generatedAt || '') > 0) {
      byId.set(c.id, c);
    }
  }
  const merged = [...byId.values()];
  merged.sort((a, b) => (b.generatedAt || '').localeCompare(a.generatedAt || ''));
  const out: SavedChapter[] = [];
  for (const c of merged) {
    if (out.some((o) => samePeriod(o, c))) continue;
    out.push(c);
  }
  return out.slice(0, MAX_CHAPTERS);
}

/** Replace local storage after merge (notifies listeners). */
export function persistChaptersList(list: SavedChapter[]): void {
  saveRaw(list);
}

export function saveChapter(entry: Omit<SavedChapter, 'id'>): SavedChapter {
  const list = loadRaw();
  const id = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const saved: SavedChapter = {
    ...entry,
    id,
    narrativeSummary: truncateSummary(entry.narrativeSummary),
  };
  const withoutSamePeriod = list.filter((c) => !samePeriod(entry, c));
  withoutSamePeriod.unshift(saved);
  saveRaw(withoutSamePeriod);
  return saved;
}

export function deleteChapter(id: string): boolean {
  const list = loadRaw();
  const filtered = list.filter((c) => c.id !== id);
  if (filtered.length === list.length) return false;
  saveRaw(filtered);
  return true;
}

export function updateChapter(
  id: string,
  patch: Partial<Pick<SavedChapter, 'chapterTitles' | 'narrativeSummary' | 'reflectionQuestions' | 'selectedTitleIndex' | 'periodStart' | 'periodEnd'>>
): SavedChapter | null {
  const list = loadRaw();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const next = { ...list[idx], ...patch };
  if (typeof next.narrativeSummary === 'string') {
    next.narrativeSummary = truncateSummary(next.narrativeSummary);
  }
  list[idx] = next;
  saveRaw(list);
  return list[idx];
}

export function getChapterById(id: string): SavedChapter | null {
  return loadRaw().find((c) => c.id === id) ?? null;
}

/** Strip Markdown-style bold (**) and highlight (==) from text for plain-text export */
export function stripSummaryMarkdown(text: string): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .trim();
}

function chapterSubtitle(ch: SavedChapter, isZh: boolean): string {
  return formatPeriodSubtitle(ch.periodStart, ch.periodKey, isZh, ch.periodEnd) || ch.periodLabel;
}

function chapterPlainBlock(ch: SavedChapter, isZh: boolean, stripMarkdown: boolean): string {
  const title = ch.chapterTitles[ch.selectedTitleIndex] ?? ch.chapterTitles[0] ?? '';
  const sub = chapterSubtitle(ch, isZh);
  const summary = stripMarkdown ? stripSummaryMarkdown(ch.narrativeSummary) : ch.narrativeSummary;
  const lines = [title, sub, '', summary, '', ...ch.reflectionQuestions];
  return lines.join('\n');
}

export interface BuildLifeBookTextOptions {
  language?: LifeBookExportLanguage;
  includeCoverLines?: boolean;
  stripMarkdown?: boolean;
}

/** Full Life Book as plain text (order matches `chapters` array, e.g. from getChapters()). */
export function buildLifeBookPlainText(
  chapters: SavedChapter[],
  opts: BuildLifeBookTextOptions = {}
): string {
  const language = opts.language ?? 'en';
  const includeCover = opts.includeCoverLines !== false;
  const stripMd = opts.stripMarkdown !== false;
  const isZh = language === 'zh';
  const bookTitle = isZh ? '人生之书' : 'Life Book';
  const exportedLabel = isZh ? '导出日期' : 'Exported';
  const dateStr = new Date().toISOString().slice(0, 10);
  const parts: string[] = [`${bookTitle}`, `${exportedLabel}: ${dateStr}`];

  if (includeCover) {
    parts.push('', ...resolvedCoverLines(isZh));
  }

  if (chapters.length === 0) {
    return parts.join('\n');
  }

  parts.push('');
  const blocks = chapters.map((ch) => chapterPlainBlock(ch, isZh, stripMd));
  parts.push(blocks.join(CHAPTER_SEPARATOR));
  return parts.join('\n');
}

function triggerTextDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download full Life Book as UTF-8 .txt */
export function exportLifeBookToTxt(chapters: SavedChapter[], opts: BuildLifeBookTextOptions = {}): void {
  const content = buildLifeBookPlainText(chapters, opts);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `life_book_${dateStr}.txt`;
  triggerTextDownload(content, filename, 'text/plain;charset=utf-8');
}

function escapeMdHeadingFragment(s: string): string {
  return s.replace(/\r?\n/g, ' ').trim();
}

/** Full Life Book as Markdown (narrative keeps ** / == as in storage). */
export function buildLifeBookMarkdown(
  chapters: SavedChapter[],
  opts: Pick<BuildLifeBookTextOptions, 'language' | 'includeCoverLines'> = {}
): string {
  const language = opts.language ?? 'en';
  const includeCover = opts.includeCoverLines !== false;
  const isZh = language === 'zh';
  const bookTitle = isZh ? '人生之书' : 'Life Book';
  const exportedLabel = isZh ? '导出日期' : 'Exported';
  const dateStr = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`# ${bookTitle}`, '', `*${exportedLabel}: ${dateStr}*`];

  if (includeCover) {
    const [l1, l2, l3] = resolvedCoverLines(isZh);
    lines.push('', l1, '', `## ${escapeMdHeadingFragment(l2)}`, '', `*${l3}*`);
  }

  if (chapters.length === 0) {
    return lines.join('\n');
  }

  for (const ch of chapters) {
    const title = ch.chapterTitles[ch.selectedTitleIndex] ?? ch.chapterTitles[0] ?? '';
    const sub = chapterSubtitle(ch, isZh);
    lines.push('', '---', '', `## ${escapeMdHeadingFragment(title)}`, '', `*${sub}*`, '', ch.narrativeSummary, '');
    for (const q of ch.reflectionQuestions) {
      lines.push(`- ${q}`);
    }
  }

  return lines.join('\n');
}

export function exportLifeBookToMd(
  chapters: SavedChapter[],
  opts: Pick<BuildLifeBookTextOptions, 'language' | 'includeCoverLines'> = {}
): void {
  const content = buildLifeBookMarkdown(chapters, opts);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `life_book_${dateStr}.md`;
  triggerTextDownload(content, filename, 'text/markdown;charset=utf-8');
}

/** Approximate narrative character count for stats (raw summary length). */
export function countLifeBookNarrativeChars(chapters: SavedChapter[]): number {
  return chapters.reduce((n, ch) => n + (typeof ch.narrativeSummary === 'string' ? ch.narrativeSummary.length : 0), 0);
}

/** Build plain-text content for a chapter and trigger download as TXT */
export function exportChapterToTxt(chapter: SavedChapter, stripMarkdown = true): void {
  const title = chapter.chapterTitles[chapter.selectedTitleIndex] ?? chapter.chapterTitles[0] ?? '';
  const summary = stripMarkdown
    ? stripSummaryMarkdown(chapter.narrativeSummary)
    : chapter.narrativeSummary;
  const lines = [title, '', summary, '', ...chapter.reflectionQuestions];
  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeLabel = (chapter.periodLabel || 'chapter').replace(/[/\\?%*:|"<>]/g, '_').slice(0, 80);
  const dateStr = chapter.generatedAt ? new Date(chapter.generatedAt).toISOString().slice(0, 10) : '';
  const filename = `chapter_${safeLabel}_${dateStr}.txt`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
