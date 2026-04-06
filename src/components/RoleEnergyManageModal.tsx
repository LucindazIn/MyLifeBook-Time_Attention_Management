import React, { useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import type { AppLanguage, ScheduleEvent } from '@/types';
import { PRESET_ROLES, getPresetRole, getRoleColor, getRoleDisplayName } from '@/lib/constants/roles';
import {
  collectRoleIdsFromEvents,
  countDistinctLongTermGoalsForRole,
  countEventsWithRole,
} from '@/lib/eventAnalyticsHelpers';
import {
  buildAnalyticsCsv,
  buildAnalyticsMarkdownTable,
  copyAnalyticsText,
  scheduleEventsToExportRows,
} from '@/lib/analyticsExport';
import { loadHiddenPresetRoleIds } from '@/lib/roleManagementStorage';
import { AnalyticsManageModalShell, AnalyticsExportFormatButtons } from '@/components/AnalyticsManageModalShell';

function listManageableRoleIds(events: ScheduleEvent[], hidden: Set<string>): string[] {
  const fromEvents = collectRoleIdsFromEvents(events);
  const set = new Set<string>();
  PRESET_ROLES.forEach((r) => {
    if (!hidden.has(r.id)) set.add(r.id);
  });
  fromEvents.forEach((id) => set.add(id));
  const presetOrdered = PRESET_ROLES.map((r) => r.id).filter((id) => set.has(id));
  const rest = [...set].filter((id) => !PRESET_ROLES.some((r) => r.id === id)).sort((a, b) => a.localeCompare(b));
  return [...presetOrdered, ...rest];
}

function toCustomRoleId(displayName: string): string {
  const t = displayName.trim();
  if (!t) return '';
  return `custom:${t}`;
}

export interface RoleEnergyManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: ScheduleEvent[];
  language: AppLanguage;
  collectionStateRevision: number;
  onMigrateRole: (oldId: string, newId: string) => void | Promise<void>;
  onClearRole: (roleId: string) => void | Promise<void>;
}

export const RoleEnergyManageModal: React.FC<RoleEnergyManageModalProps> = ({
  isOpen,
  onClose,
  events,
  language,
  collectionStateRevision,
  onMigrateRole,
  onClearRole,
}) => {
  const isZh = language === 'zh';
  const hidden = useMemo(() => new Set(loadHiddenPresetRoleIds()), [collectionStateRevision, isOpen]);
  const roleIds = useMemo(() => listManageableRoleIds(events, hidden), [events, hidden]);

  const [renameFor, setRenameFor] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [mergePending, setMergePending] = useState<{ oldId: string; newId: string } | null>(null);
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
    const newId = toCustomRoleId(renameDraft);
    if (!newId || newId === 'custom:') {
      alert(isZh ? '请输入有效名称' : 'Enter A Valid Name');
      return;
    }
    if (newId === renameFor) {
      setRenameFor(null);
      setRenameDraft('');
      return;
    }
    if (events.some((e) => e.role === newId)) {
      setMergePending({ oldId: renameFor, newId });
      return;
    }
    setActionBusy(true);
    try {
      await onMigrateRole(renameFor, newId);
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
      await onMigrateRole(mergePending.oldId, mergePending.newId);
      setMergePending(null);
      setRenameFor(null);
      setRenameDraft('');
    } finally {
      setMergeBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleteBusy(true);
    try {
      await onClearRole(confirmDeleteId);
      setConfirmDeleteId(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <AnalyticsManageModalShell
        isOpen={isOpen}
        onClose={onClose}
        title={isZh ? '角色能量 · 管理' : 'Role Balance · Manage'}
        language={language}
        showHeaderDivider={false}
      >
        <div
          className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-2 border-b pb-4"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <span className="min-w-0 text-[11px] leading-snug" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '导出各角色相关日程' : 'Export Schedules Related To Roles'}
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
          {roleIds.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
              {isZh ? '暂无角色可管理' : 'No Roles To Manage'}
            </p>
          ) : (
            roleIds.map((roleId) => {
              const name = getRoleDisplayName(roleId, isZh ? 'zh' : 'en');
              const nBase = countEventsWithRole(events, roleId);
              const nLt = countDistinctLongTermGoalsForRole(events, roleId);
              const isRenaming = renameFor === roleId;
              return (
                <li
                  key={roleId}
                  className="rounded-xl border p-3 space-y-2"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex items-start gap-2">
                      <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: getRoleColor(roleId) }} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium" style={{ color: 'var(--app-text)' }}>
                          {name}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--app-muted)' }}>
                          {isZh
                            ? `涉及 ${nBase} 条日程，${nLt} 个长期目标`
                            : `Covers ${nBase} Base Event(s), ${nLt} Long-Term Goal(s)`}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end shrink-0">
                      <button
                        type="button"
                        className="text-[11px] font-medium rounded-lg px-2 py-1 border border-border hover:bg-accent/10"
                        style={{ color: 'var(--app-accent)' }}
                        onClick={() => {
                          setRenameFor(roleId);
                          setRenameDraft(
                            roleId.startsWith('custom:')
                              ? roleId.slice(7).trim()
                              : (isZh ? getPresetRole(roleId)?.nameZh : getPresetRole(roleId)?.nameEn) ?? ''
                          );
                        }}
                      >
                        {isZh ? '重命名' : 'Rename'}
                      </button>
                      <button
                        type="button"
                        className="text-[11px] font-medium rounded-lg px-2 py-1 border border-border hover:bg-rose-500/10"
                        style={{ color: 'var(--app-muted)' }}
                        onClick={() => setConfirmDeleteId(roleId)}
                      >
                        {isZh ? '删除' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  {isRenaming && (
                    <div className="flex flex-col gap-2 pt-1 border-t" style={{ borderColor: 'var(--app-border)' }}>
                      <label className="text-[11px]" style={{ color: 'var(--app-muted)' }}>
                        {isZh ? '新名称（将保存为自定义身份）' : 'New Name (Saved As Custom Role)'}
                      </label>
                      <input
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        className="text-sm rounded-lg border bg-field px-2 py-1.5 w-full"
                        style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                        placeholder={isZh ? '输入名称' : 'Name'}
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
                  ? `已有身份「${mergePending.newId}」，是否合并？合并后所有「${mergePending.oldId}」日程将改为该身份。`
                  : `The Role "${mergePending.newId}" Already Exists. Merge All Events From "${mergePending.oldId}" Into It?`}
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

      {confirmDeleteId != null && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[201] flex items-center justify-center p-4"
            style={{ background: 'color-mix(in srgb, var(--app-bg, #000) 55%, transparent)' }}
            role="dialog"
            aria-modal="true"
            onClick={() => !deleteBusy && setConfirmDeleteId(null)}
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
                    ? `是否确定要删除身份「${getRoleDisplayName(confirmDeleteId, isZh ? 'zh' : 'en')}」？`
                    : `Are You Sure You Want To Delete Role "${getRoleDisplayName(confirmDeleteId, isZh ? 'zh' : 'en')}"?`}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--app-muted)' }}>
                  {isZh
                    ? '日程事件将保留，仅从相关日程中清除该角色。预设角色删除后不会再出现在新建日程的选择列表中。'
                    : 'Events Stay On Your Schedule; Only The Role Field Will Be Cleared. Deleted Preset Roles No Longer Appear When Creating Events.'}
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="text-xs font-medium rounded-lg px-3 py-2 border border-border hover:bg-accent/10 min-w-[4rem]"
                  style={{ color: 'var(--app-muted)' }}
                  onClick={() => setConfirmDeleteId(null)}
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
