import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Save, Download, Trash2, Copy, ClipboardPaste, X } from 'lucide-react';
import type { AppLanguage, ScheduleEvent } from '@/types';
import { ChapterPeriodStatusSection } from '@/components/ChapterPeriodStatusSection';
import type { SavedChapter, ChapterDraft } from '@/lib/chaptersStorage';
import { updateChapter, MAX_CHAPTER_SUMMARY_CHARS } from '@/lib/chaptersStorage';
import { parseChapterAiPaste } from '@/lib/parseChapterAiPaste';
import { formatChapterModalPeriodBracket } from '@/lib/dateRange';
import { cn } from '@/lib/utils';

/** 弹窗内可选操作：默认中性，悬停/按下强调色 */
const MODAL_CHOICE_BTN =
  'inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 border border-border bg-transparent text-muted-foreground transition-colors hover:border-accent hover:text-accent hover:bg-accent/10 active:bg-accent/20 active:border-accent active:text-accent';

const MODAL_DELETE_BTN =
  'inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 border border-border bg-transparent text-rose-600 dark:text-rose-400 transition-colors hover:border-rose-500 hover:bg-rose-500/10 active:bg-rose-500/20 active:border-rose-500';

/**
 * 左侧 JSON 与「粘贴 AI 回复」同高：固定可视高度（与 rows=2 量级一致），长内容在框内滚动。
 * 粘贴框可 resize-y 略拉高；JSON 仅滚动不拉伸。
 */
const MODAL_LEFT_SCROLL_BOX =
  'w-full min-w-0 text-xs leading-normal font-mono rounded-lg border border-border px-3 py-2 bg-field h-28 max-h-28 overflow-y-auto shrink-0 box-border';

function isSavedChapter(ch: SavedChapter | ChapterDraft | null): ch is SavedChapter {
  return ch != null && 'id' in ch && typeof (ch as SavedChapter).id === 'string' && (ch as SavedChapter).id !== '';
}

export interface ChapterViewModalProps {
  open: boolean;
  onClose: () => void;
  chapter: SavedChapter | ChapterDraft | null;
  onSave?: (updated: SavedChapter) => void;
  onSaveNew?: (draft: ChapterDraft) => void;
  onDelete?: (chapterId: string) => void;
  language: AppLanguage;
  onExportTxt?: (chapter: SavedChapter) => void;
  /** External AI workflow line; top of left column above export/copy buttons. */
  chapterWorkflowHint?: string | null;
  onExportPeriodBundle?: () => void;
  onCopyPeriodBundle?: () => void;
  copyFeedback?: string | null;
  /** 与章节周期对齐的合集数据，用于「本期状态数据」板块 */
  periodStats?: {
    events: ScheduleEvent[];
    completedInstances: Record<string, boolean>;
  } | null;
  /** 本期导出 JSON（无标题；与「粘贴 AI 回复」同高框内滚动） */
  periodExportJson?: string | null;
}

export const ChapterViewModal: React.FC<ChapterViewModalProps> = ({
  open,
  onClose,
  chapter,
  onSave,
  onSaveNew,
  onDelete,
  language,
  onExportTxt,
  chapterWorkflowHint,
  onExportPeriodBundle,
  onCopyPeriodBundle,
  copyFeedback,
  periodStats = null,
  periodExportJson = null,
}) => {
  const isZh = language === 'zh';
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [baselineTitle, setBaselineTitle] = useState('');
  const [baselineSummary, setBaselineSummary] = useState('');
  const [pasteRaw, setPasteRaw] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteFeedback, setPasteFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (open && chapter) {
      const t = chapter.chapterTitles[0] ?? '';
      const s = chapter.narrativeSummary;
      setEditTitle(t);
      setEditSummary(s);
      setBaselineTitle(t);
      setBaselineSummary(s);
      setPasteRaw('');
      setPasteError(null);
      setPasteFeedback(null);
    }
  }, [open, chapter]);

  const isDirty = editTitle !== baselineTitle || editSummary !== baselineSummary;

  const tryClose = useCallback(() => {
    if (isDirty) {
      const ok = window.confirm(
        isZh ? '有未保存的修改，确定放弃并关闭？' : 'You Have Unsaved Changes. Discard And Close?'
      );
      if (!ok) return;
    }
    onClose();
  }, [isDirty, isZh, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tryClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, tryClose]);

  const handleSave = () => {
    if (!chapter) return;
    const titles: [string, string, string] = [editTitle, editTitle, editTitle];
    const questions: [string, string] = ['', ''];
    if (isSavedChapter(chapter)) {
      const updated = updateChapter(chapter.id, {
        chapterTitles: titles,
        narrativeSummary: editSummary,
        reflectionQuestions: questions,
        selectedTitleIndex: 0,
      });
      if (updated) {
        onSave?.(updated);
        setBaselineTitle(editTitle);
        setBaselineSummary(editSummary);
        onClose();
      }
    } else {
      const draft: ChapterDraft = {
        periodKey: chapter.periodKey,
        periodLabel: chapter.periodLabel,
        periodStart: chapter.periodStart,
        periodEnd: chapter.periodEnd,
        generatedAt: chapter.generatedAt,
        selectedTitleIndex: 0,
        chapterTitles: titles,
        narrativeSummary: editSummary,
        reflectionQuestions: questions,
      };
      onSaveNew?.(draft);
      setBaselineTitle(editTitle);
      setBaselineSummary(editSummary);
      onClose();
    }
  };

  const handleExport = () => {
    if (chapter && isSavedChapter(chapter)) onExportTxt?.(chapter);
  };

  const handleApplyAiPaste = () => {
    const r = parseChapterAiPaste(pasteRaw, isZh);
    if (r.ok === false) {
      setPasteError(r.error);
      setPasteFeedback(null);
      return;
    }
    setEditTitle(r.chapterTitle);
    setEditSummary(r.narrativeSummary);
    setPasteError(null);
    setPasteFeedback(isZh ? '已填入，可检查后保存' : 'Filled In. Review And Save.');
    window.setTimeout(() => setPasteFeedback(null), 3500);
  };

  if (!open) return null;

  const periodBracket =
    chapter?.periodStart && chapter?.periodKey != null
      ? formatChapterModalPeriodBracket(chapter.periodStart, chapter.periodEnd, chapter.periodKey, isZh)
      : '';

  const showPeriodExport = !!(onExportPeriodBundle || onCopyPeriodBundle);

  const summaryCharCount = editSummary.length;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chapter-modal-title"
    >
      <div className="absolute inset-0 bg-black/50" onClick={tryClose} role="presentation" />
      <div
        className="relative w-full max-w-[min(72rem,98vw)] max-h-[min(92vh,880px)] min-h-0 flex flex-col rounded-2xl border shadow-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--app-surface)',
          borderColor: 'var(--app-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b shrink-0" style={{ borderColor: 'var(--app-border)' }}>
          <h2
            id="chapter-modal-title"
            className="text-base font-semibold min-w-0 flex-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5"
            style={{ color: 'var(--app-text)' }}
          >
            <span>{chapter?.periodLabel ?? (isZh ? '章节' : 'Chapter')}</span>
            {periodBracket ? (
              <span className="text-sm font-normal" style={{ color: 'var(--app-muted)' }}>
                {periodBracket}
              </span>
            ) : null}
          </h2>
          <button
            type="button"
            onClick={tryClose}
            className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-field"
            style={{ color: 'var(--app-muted)' }}
            aria-label={isZh ? '关闭' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="flex flex-col lg:flex-row min-h-0">
          {/* 左：工作流说明 + 导出/复制 + 粘贴 + 本期状态 */}
          <aside
            className="w-full lg:w-[min(42%,26rem)] lg:max-w-md shrink-0 border-b lg:border-b-0 lg:border-r"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <div className="p-4 space-y-4 flex flex-col min-h-0">
              {(chapterWorkflowHint || showPeriodExport) && (
                <div className="space-y-2 shrink-0">
                  {chapterWorkflowHint && (
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--app-muted)' }}>
                      {chapterWorkflowHint}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {showPeriodExport && onExportPeriodBundle && (
                      <button type="button" onClick={onExportPeriodBundle} className={MODAL_CHOICE_BTN}>
                        <Download className="w-3.5 h-3.5" />
                        {isZh ? '导出本期数据' : "Export This Period's Data"}
                      </button>
                    )}
                    {showPeriodExport && onCopyPeriodBundle && (
                      <button type="button" onClick={onCopyPeriodBundle} className={MODAL_CHOICE_BTN}>
                        <Copy className="w-3.5 h-3.5" />
                        {isZh ? '复制本期数据' : "Copy This Period's Data"}
                      </button>
                    )}
                    {copyFeedback && (
                      <span className="text-xs w-full sm:w-auto" style={{ color: 'var(--app-accent)' }}>
                        {copyFeedback}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {periodExportJson != null && periodExportJson !== '' && (
                <pre
                  className={cn(MODAL_LEFT_SCROLL_BOX, 'whitespace-pre-wrap break-words')}
                  style={{ color: 'var(--app-text)' }}
                >
                  {periodExportJson}
                </pre>
              )}

              {chapter && (
                <div className="space-y-2 shrink-0">
                  <p className="text-xs font-bold" style={{ color: 'var(--app-text)' }}>
                    {isZh ? '粘贴 AI 回复' : 'Paste AI Reply'}
                  </p>
                  <textarea
                    value={pasteRaw}
                    onChange={(e) => {
                      setPasteRaw(e.target.value);
                      setPasteError(null);
                    }}
                    className={cn(MODAL_LEFT_SCROLL_BOX, 'resize-y max-h-[min(40vh,18rem)]')}
                    style={{ color: 'var(--app-text)' }}
                    placeholder={
                      isZh
                        ? '粘贴外部 AI 的完整回复，再点「填入章节」'
                        : 'Paste Full External AI Reply, Then Tap Fill Chapter'
                    }
                    aria-label={isZh ? '粘贴 AI 回复' : 'Paste AI Reply'}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleApplyAiPaste}
                      disabled={!pasteRaw.trim()}
                      className={cn(MODAL_CHOICE_BTN, 'disabled:opacity-50 disabled:pointer-events-none')}
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      {isZh ? '填入章节' : 'Fill Chapter'}
                    </button>
                    {pasteError && (
                      <span className="text-xs text-rose-600 dark:text-rose-400">{pasteError}</span>
                    )}
                    {pasteFeedback && (
                      <span className="text-xs" style={{ color: 'var(--app-accent)' }}>
                        {pasteFeedback}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {chapter?.periodStart && chapter?.periodEnd && periodStats && (
                <div className="pt-1">
                  <ChapterPeriodStatusSection
                    events={periodStats.events}
                    completedInstances={periodStats.completedInstances}
                    periodStart={chapter.periodStart}
                    periodEnd={chapter.periodEnd}
                    language={language}
                    embedded
                  />
                </div>
              )}
            </div>
          </aside>

          {/* 右：章节名 + 章节内容 + 字数 */}
          <div className="flex-1 min-w-0 flex flex-col p-4 lg:pl-6 gap-6 pb-8">
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--app-text)' }}>
                {isZh ? '章节名' : 'Chapter Name'}
              </p>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-sm rounded-lg border px-3 py-2 bg-field border-border"
                style={{ color: 'var(--app-text)' }}
                placeholder={isZh ? '输入章节名' : 'Enter Chapter Name'}
              />
            </div>

            <div className="flex flex-col flex-1 min-h-0">
              <p className="text-xs font-bold mb-1.5 shrink-0" style={{ color: 'var(--app-text)' }}>
                {isZh ? '章节内容' : 'Chapter Content'}
                <span className="ml-2 font-normal tabular-nums" style={{ color: 'var(--app-muted)' }}>
                  {summaryCharCount} / {MAX_CHAPTER_SUMMARY_CHARS}
                </span>
                {editSummary.length > MAX_CHAPTER_SUMMARY_CHARS && (
                  <span className="text-amber-600 dark:text-amber-400"> ({isZh ? '超出将截断' : 'Will Be Truncated'})</span>
                )}
              </p>
              <textarea
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                rows={16}
                maxLength={MAX_CHAPTER_SUMMARY_CHARS + 500}
                className="w-full min-h-[min(48vh,380px)] text-sm rounded-lg border px-3 py-2 bg-field border-border resize-y"
                style={{ color: 'var(--app-text)' }}
                placeholder={isZh ? '输入章节内容（第一人称叙事）' : 'Enter Chapter Content (First-Person Narrative)'}
              />
            </div>
          </div>
        </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 p-4 border-t shrink-0" style={{ borderColor: 'var(--app-border)' }}>
          {chapter && (
            <>
              {isDirty && (
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 border border-accent bg-accent/15 text-accent transition-colors hover:bg-accent/25"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isZh ? '保存' : 'Save'}
                </button>
              )}
              {onExportTxt && isSavedChapter(chapter) && (
                <button
                  type="button"
                  onClick={handleExport}
                  className={MODAL_CHOICE_BTN}
                >
                  <Download className="w-3.5 h-3.5" />
                  {isZh ? '导出 TXT' : 'Export TXT'}
                </button>
              )}
              {onDelete && isSavedChapter(chapter) && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(isZh ? '确定删除该章节？人生之书将不再显示本章。' : 'Delete this chapter? It will no longer appear in Life Book.')) {
                      onDelete(chapter.id);
                      onClose();
                    }
                  }}
                  className={MODAL_DELETE_BTN}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isZh ? '删除' : 'Delete'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
