import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Edit3, Download, Trash2, Copy, ClipboardPaste } from 'lucide-react';
import type { AppLanguage } from '@/types';
import type { SavedChapter, ChapterDraft } from '@/lib/chaptersStorage';
import { updateChapter, MAX_CHAPTER_SUMMARY_CHARS } from '@/lib/chaptersStorage';
import { parseChapterAiPaste } from '@/lib/parseChapterAiPaste';
import { formatPeriodWeekLabel } from '@/lib/dateRange';
import { cn } from '@/lib/utils';

function isSavedChapter(ch: SavedChapter | ChapterDraft | null): ch is SavedChapter {
  return ch != null && 'id' in ch && typeof (ch as SavedChapter).id === 'string' && (ch as SavedChapter).id !== '';
}

/** Render narrative summary with **bold** and ==highlight== as HTML-like emphasis */
function renderSummaryWithMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|==([^=]+)==/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<React.Fragment key={key++}>{text.slice(lastIndex, match.index)}</React.Fragment>);
    }
    if (match[1] != null) {
      parts.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2] != null) {
      parts.push(<mark key={key++} className="bg-accent/20 rounded px-0.5">{match[2]}</mark>);
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(<React.Fragment key={key++}>{text.slice(lastIndex)}</React.Fragment>);
  }
  return parts.length ? parts : text;
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
  /** Shown directly under the modal title (external AI workflow). */
  chapterWorkflowHint?: string | null;
  onExportPeriodBundle?: () => void;
  onCopyPeriodBundle?: () => void;
  copyFeedback?: string | null;
  chapterOpenMode?: 'view' | 'edit';
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
  chapterOpenMode = 'view',
}) => {
  const isZh = language === 'zh';
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [pasteRaw, setPasteRaw] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteFeedback, setPasteFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (chapter) {
      setEditTitle(chapter.chapterTitles[0] ?? '');
      setEditSummary(chapter.narrativeSummary);
      setIsEditing(chapterOpenMode === 'edit');
    }
  }, [chapter, chapterOpenMode]);

  useEffect(() => {
    if (open) {
      setPasteRaw('');
      setPasteError(null);
      setPasteFeedback(null);
    }
  }, [open]);

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
        setIsEditing(false);
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
      setIsEditing(false);
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
    setIsEditing(true);
    setPasteError(null);
    setPasteFeedback(isZh ? '已填入，可检查后保存' : 'Filled In. Review And Save.');
    window.setTimeout(() => setPasteFeedback(null), 3500);
  };

  if (!open) return null;

  const displayTitle = isEditing ? editTitle : (chapter?.chapterTitles[0] ?? '');
  const displaySummary = isEditing ? editSummary : (chapter?.narrativeSummary ?? '');
  const periodWeekLabel = chapter?.periodStart && chapter?.periodKey != null
    ? formatPeriodWeekLabel(chapter.periodStart, chapter.periodKey, isZh)
    : '';

  const showPeriodExport = !!(onExportPeriodBundle || onCopyPeriodBundle);

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chapter-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      />
      <div
        className="relative w-full max-w-[35.84rem] max-h-[90vh] overflow-y-auto rounded-2xl border shadow-xl flex flex-col"
        style={{
          backgroundColor: 'var(--app-surface)',
          borderColor: 'var(--app-border)',
        }}
      >
        <div className="sticky top-0 flex items-center justify-between gap-4 p-4 border-b shrink-0" style={{ borderColor: 'var(--app-border)' }}>
          <h2 id="chapter-modal-title" className="text-base font-semibold truncate flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
            {((chapter?.chapterTitles?.[0] ?? '').trim() || chapter?.periodLabel) ?? (isZh ? '章节' : 'Chapter')}
          </h2>
          <div className="flex items-center gap-2">
            {periodWeekLabel && (
              <span className="text-xs" style={{ color: 'var(--app-muted)' }}>
                {periodWeekLabel}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-field transition-colors"
              style={{ color: 'var(--app-muted)' }}
              aria-label={isZh ? '关闭' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {chapterWorkflowHint && (
          <div className="px-4 pt-3 pb-0">
            <p className="text-xs leading-relaxed" style={{ color: 'var(--app-muted)' }}>
              {chapterWorkflowHint}
            </p>
          </div>
        )}

        {showPeriodExport && (
          <div className="px-4 pt-3 flex flex-wrap items-center gap-2">
            {onExportPeriodBundle && (
              <button
                type="button"
                onClick={onExportPeriodBundle}
                className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 border border-accent bg-accent/15 text-accent hover:bg-accent/25"
              >
                <Download className="w-3.5 h-3.5" />
                {isZh ? '导出本期数据' : "Export This Period's Data"}
              </button>
            )}
            {onCopyPeriodBundle && (
              <button
                type="button"
                onClick={onCopyPeriodBundle}
                className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 border border-border text-muted-foreground hover:bg-field"
              >
                <Copy className="w-3.5 h-3.5" />
                {isZh ? '复制' : 'Copy'}
              </button>
            )}
            {copyFeedback && (
              <span className="text-xs" style={{ color: 'var(--app-accent)' }}>
                {copyFeedback}
              </span>
            )}
          </div>
        )}

        {chapter && (
          <div
            className="px-4 pt-2 pb-3 space-y-2 border-b"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <textarea
              value={pasteRaw}
              onChange={(e) => {
                setPasteRaw(e.target.value);
                setPasteError(null);
              }}
              rows={1}
              className="w-full text-xs leading-normal rounded-lg border px-3 py-2 bg-field border-border resize-y font-mono min-h-[2.25rem] max-h-[min(40vh,16rem)] overflow-y-auto"
              style={{ color: 'var(--app-text)' }}
              placeholder={
                isZh
                  ? '粘贴外部AI的完整回复，点击「填入章节」自动解析'
                  : 'Paste The Full External AI Reply, Then Tap Fill Chapter To Parse'
              }
              aria-label={isZh ? '粘贴 AI 回复' : 'Paste AI Reply'}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleApplyAiPaste}
                disabled={!pasteRaw.trim()}
                className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 border border-border text-muted-foreground hover:bg-field disabled:opacity-50 disabled:pointer-events-none"
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

        <div className="p-4 overflow-y-auto">
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--app-text)' }}>
              {isZh ? '章节名' : 'Chapter Name'}
            </p>
            <input
              value={displayTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              readOnly={!isEditing}
              className={cn(
                'w-full text-sm rounded-lg border px-3 py-2 bg-field border-border',
                !isEditing && 'cursor-default'
              )}
              style={{ color: 'var(--app-text)' }}
              placeholder={isZh ? '输入章节名' : 'Enter Chapter Name'}
            />
          </div>

          <div className="mt-6">
            <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--app-text)' }}>
              {isZh ? '章节内容' : 'Chapter Content'}
              {isEditing && (
                <span className="ml-2 font-normal">
                  {editSummary.length} / {MAX_CHAPTER_SUMMARY_CHARS}
                  {editSummary.length > MAX_CHAPTER_SUMMARY_CHARS && (
                    <span className="text-amber-600 dark:text-amber-400"> ({isZh ? '超出将截断' : 'Will Be Truncated'})</span>
                  )}
                </span>
              )}
            </p>
            {isEditing ? (
              <textarea
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                rows={10}
                maxLength={MAX_CHAPTER_SUMMARY_CHARS + 500}
                className="w-full text-sm rounded-lg border px-3 py-2 bg-field border-border resize-y"
                style={{ color: 'var(--app-text)' }}
                placeholder={isZh ? '输入章节内容（第一人称叙事）' : 'Enter Chapter Content (First-Person Narrative)'}
              />
            ) : (
              <div className="min-h-[8rem] rounded-lg border px-3 py-2 bg-field border-border" style={{ borderColor: 'var(--app-border)' }}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--app-text)' }}>
                  {displaySummary ? (
                    renderSummaryWithMarkdown(displaySummary)
                  ) : (
                    <span style={{ color: 'var(--app-muted)' }}>{isZh ? '暂无内容，点击编辑填写' : 'No Content Yet. Click Edit to Write.'}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 p-4 border-t shrink-0" style={{ borderColor: 'var(--app-border)' }}>
          {chapter && (
            <>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 border border-border text-muted-foreground hover:bg-field"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {isZh ? '编辑' : 'Edit'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 border border-accent bg-accent/15 text-accent"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isZh ? '保存' : 'Save'}
                </button>
              )}
              {onExportTxt && isSavedChapter(chapter) && (
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 border border-border text-muted-foreground hover:bg-field"
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
                  className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 border border-border text-rose-600 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isZh ? '删除' : 'Delete'}
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center text-xs font-medium rounded-lg px-3 py-2 border border-border text-muted-foreground hover:bg-field ml-auto"
          >
            {isZh ? '关闭' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
