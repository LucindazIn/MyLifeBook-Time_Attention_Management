import React, { useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import type { AppLanguage, ScheduleEvent } from '@/types';
import {
  collectAllEventLabelTags,
  countDistinctLongTermGoalsForTag,
  countEventsWithTag,
  eventTouchesTag,
} from '@/lib/eventAnalyticsHelpers';
import {
  buildAnalyticsCsv,
  buildAnalyticsMarkdownTable,
  copyAnalyticsText,
  scheduleEventsToExportRows,
} from '@/lib/analyticsExport';
import { isPresetEventLabel } from '@/lib/customEventTagsStorage';
import { AnalyticsManageModalShell, AnalyticsExportFormatButtons } from '@/components/AnalyticsManageModalShell';

export interface EventTagManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: ScheduleEvent[];
  language: AppLanguage;
  onMigrateTag: (oldTag: string, newTag: string) => void | Promise<void>;
  onClearTag: (tag: string) => void | Promise<void>;
}

export const EventTagManageModal: React.FC<EventTagManageModalProps> = ({
  isOpen,
  onClose,
  events,
  language,
  onMigrateTag,
  onClearTag,
}) => {
  const isZh = language === 'zh';
  const tags = useMemo(() => collectAllEventLabelTags(events), [events]);

  const [renameFor, setRenameFor] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteTag, setConfirmDeleteTag] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [mergePending, setMergePending] = useState<{ oldTag: string; newTag: string } | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const runExportAll = useCallback(
    (format: 'csv' | 'md' | 'copy') => {
      const rows = scheduleEventsToExportRows(events);
      if (format === 'csv') {
        const blob = new Blob([buildAnalyticsCsv(rows)], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'schedule-events-all.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        return;
      }
      if (format === 'md') {
        const md = buildAnalyticsMarkdownTable(rows, isZh);
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'schedule-events-all.md';
        a.click();
        URL.revokeObjectURL(a.href);
        return;
      }
      void copyAnalyticsText(buildAnalyticsCsv(rows));
    },
    [events, isZh]
  );

  const submitRename = async () => {
    if (!renameFor) return;
    const newTag = renameDraft.trim();
    if (!newTag) {
      alert(isZh ? '请输入有效标签' : 'Enter A Valid Tag');
      return;
    }
    if (newTag === renameFor) {
      setRenameFor(null);
      setRenameDraft('');
      return;
    }
    const conflictElsewhere = events.some(
      (e) => eventTouchesTag(e, newTag) && !eventTouchesTag(e, renameFor)
    );
    if (conflictElsewhere && newTag !== renameFor) {
      setMergePending({ oldTag: renameFor, newTag });
      return;
    }
    setActionBusy(true);
    try {
      await onMigrateTag(renameFor, newTag);
      setRenameFor(null);
      setRenameDraft('');
    } finally {
      setActionBusy(false);
    }
  };

  const confirmMerge = async () => {
    if (!mergePending) return;
    setMergeBusy(true);
    try {
      await onMigrateTag(mergePending.oldTag, mergePending.newTag);
      setMergePending(null);
      setRenameFor(null);
      setRenameDraft('');
    } finally {
      setMergeBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteTag) return;
    setDeleteBusy(true);
    try {
      await onClearTag(confirmDeleteTag);
      setConfirmDeleteTag(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <AnalyticsManageModalShell
        isOpen={isOpen}
        onClose={onClose}
        title={isZh ? '事件标签分析 · 管理' : 'Event Tag Analysis · Manage'}
        language={language}
        showHeaderDivider={false}
      >
        <div
          className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-2 border-b pb-4"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <span className="min-w-0 text-[11px] leading-snug" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '导出各事件标签相关日程' : 'Export Schedules Related To Event Tags'}
          </span>
          <AnalyticsExportFormatButtons
            language={language}
            disabled={events.length === 0}
            showBuiltinTimePrefix={false}
            onCsv={() => runExportAll('csv')}
            onMarkdown={() => runExportAll('md')}
            onCopy={() => runExportAll('copy')}
          />
        </div>
        <ul className="space-y-3">
          {tags.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
              {isZh ? '暂无标签可管理' : 'No Tags To Manage'}
            </p>
          ) : (
            tags.map((tag) => {
              const nBase = countEventsWithTag(events, tag);
              const nLt = countDistinctLongTermGoalsForTag(events, tag);
              const isRenaming = renameFor === tag;
              const preset = isPresetEventLabel(tag);
              return (
                <li
                  key={tag}
                  className="rounded-xl border p-3 space-y-2"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium break-words" style={{ color: 'var(--app-text)' }}>
                        {tag}
                      </div>
                      {preset && (
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--app-muted)' }}>
                          {isZh ? '系统预设快捷标签' : 'Preset Quick Label'}
                        </div>
                      )}
                      <div className="text-[11px] mt-1" style={{ color: 'var(--app-muted)' }}>
                        {isZh
                          ? `涉及 ${nBase} 条日程，${nLt} 个长期目标`
                          : `Covers ${nBase} Base Event(s), ${nLt} Long-Term Goal(s)`}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end shrink-0">
                      <button
                        type="button"
                        className="text-[11px] font-medium rounded-lg px-2 py-1 border border-border hover:bg-accent/10"
                        style={{ color: 'var(--app-accent)' }}
                        onClick={() => {
                          setRenameFor(tag);
                          setRenameDraft(tag);
                        }}
                      >
                        {isZh ? '重命名' : 'Rename'}
                      </button>
                      <button
                        type="button"
                        className="text-[11px] font-medium rounded-lg px-2 py-1 border border-border hover:bg-rose-500/10"
                        style={{ color: 'var(--app-muted)' }}
                        onClick={() => setConfirmDeleteTag(tag)}
                      >
                        {isZh ? '删除' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  {isRenaming && (
                    <div className="flex flex-col gap-2 pt-1 border-t" style={{ borderColor: 'var(--app-border)' }}>
                      <label className="text-[11px]" style={{ color: 'var(--app-muted)' }}>
                        {isZh ? '新标签' : 'New Tag'}
                      </label>
                      <input
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        className="text-sm rounded-lg border bg-field px-2 py-1.5 w-full"
                        style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                        placeholder={isZh ? '输入新标签' : 'New Tag'}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          className="text-[11px] rounded-lg px-2 py-1 border border-border"
                          onClick={() => {
                            setRenameFor(null);
                            setRenameDraft('');
                          }}
                          disabled={actionBusy}
                        >
                          {isZh ? '取消' : 'Cancel'}
                        </button>
                        <button
                          type="button"
                          className="text-[11px] rounded-lg px-2 py-1 border"
                          style={{ borderColor: 'var(--app-accent)', color: 'var(--app-accent)' }}
                          onClick={() => void submitRename()}
                          disabled={actionBusy}
                        >
                          {isZh ? '确认' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </AnalyticsManageModalShell>

      {mergePending != null && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[201] flex items-center justify-center p-4"
            style={{ background: 'color-mix(in srgb, var(--app-bg, #000) 55%, transparent)' }}
            role="dialog"
            aria-modal="true"
            onClick={() => !mergeBusy && setMergePending(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-sm w-full rounded-2xl border p-5 shadow-lg"
              style={{
                background: 'var(--app-surface)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text)',
                boxShadow: 'var(--app-card-shadow)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--app-text)' }}>
                {isZh
                  ? `已有标签「${mergePending.newTag}」，是否合并？合并后所有「${mergePending.oldTag}」将改为「${mergePending.newTag}」。`
                  : `The Tag "${mergePending.newTag}" Already Exists. Merge All "${mergePending.oldTag}" Into It?`}
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="text-xs font-medium rounded-lg px-3 py-2 border border-border hover:bg-accent/10 min-w-[4rem]"
                  style={{ color: 'var(--app-muted)' }}
                  onClick={() => setMergePending(null)}
                  disabled={mergeBusy}
                >
                  {isZh ? '否' : 'No'}
                </button>
                <button
                  type="button"
                  className="text-xs font-medium rounded-lg px-3 py-2 border transition-colors hover:bg-accent/10 min-w-[4rem]"
                  style={{ borderColor: 'var(--app-accent)', color: 'var(--app-accent)' }}
                  onClick={() => void confirmMerge()}
                  disabled={mergeBusy}
                >
                  {isZh ? '是' : 'Yes'}
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

      {confirmDeleteTag != null && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[201] flex items-center justify-center p-4"
            style={{ background: 'color-mix(in srgb, var(--app-bg, #000) 55%, transparent)' }}
            role="dialog"
            aria-modal="true"
            onClick={() => !deleteBusy && setConfirmDeleteTag(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-sm w-full rounded-2xl border p-5 shadow-lg"
              style={{
                background: 'var(--app-surface)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text)',
                boxShadow: 'var(--app-card-shadow)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-2 mb-5">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--app-text)' }}>
                  {isZh
                    ? `是否确定要从日程中移除标签「${confirmDeleteTag}」？`
                    : `Remove Tag "${confirmDeleteTag}" From All Events?`}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--app-muted)' }}>
                  {isZh
                    ? '日程事件将保留，仅从标签与标签文案中清除该字符串。'
                    : 'Events Stay On Your Schedule; Only This Tag String Will Be Removed.'}
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="text-xs font-medium rounded-lg px-3 py-2 border border-border hover:bg-accent/10 min-w-[4rem]"
                  style={{ color: 'var(--app-muted)' }}
                  onClick={() => setConfirmDeleteTag(null)}
                  disabled={deleteBusy}
                >
                  {isZh ? '否' : 'No'}
                </button>
                <button
                  type="button"
                  className="text-xs font-medium rounded-lg px-3 py-2 border transition-colors hover:bg-accent/10 min-w-[4rem]"
                  style={{ borderColor: 'var(--app-accent)', color: 'var(--app-accent)' }}
                  onClick={() => void confirmDelete()}
                  disabled={deleteBusy}
                >
                  {isZh ? '是' : 'Yes'}
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
    </>
  );
};
