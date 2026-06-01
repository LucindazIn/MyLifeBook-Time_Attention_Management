import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppLanguage, EventType, ScheduleEvent } from '@/types';
import { PRESET_ROLES, getRoleDisplayName } from '@/lib/constants/roles';
import { loadRoleCatalog } from '@/lib/roleManagementStorage';
import {
  PRESET_EVENT_LABELS_EN,
  PRESET_EVENT_LABELS_ZH,
  loadSavedCustomEventTags,
} from '@/lib/customEventTagsStorage';
import { getEventPersistId, isEventUntagged } from '@/lib/tagCompleteness';
import type { TagAnalysisFilterState } from '@/lib/tagAnalysisQuery';
import { smartMatchTags } from '@/lib/smartEventMatcher';

export interface TagDraft {
  roleId: string;
  eventTag: string;
  type: EventType | '';
}

interface TagBatchEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: ScheduleEvent[];
  allEvents: ScheduleEvent[];
  filters: TagAnalysisFilterState;
  language: AppLanguage;
  onFiltersChange: (filters: TagAnalysisFilterState) => void;
  onSave: (updates: Map<string, TagDraft>) => Promise<void>;
  isSaving?: boolean;
}

function buildDraftFromEvent(event: ScheduleEvent): TagDraft {
  return {
    roleId: event.role?.trim() || '',
    eventTag: event.label?.text?.trim() || event.tags?.[0]?.trim() || '',
    type: event.type || '',
  };
}

function areTagDraftsEqual(a?: TagDraft, b?: TagDraft): boolean {
  if (!a || !b) return false;
  return a.roleId === b.roleId && a.eventTag === b.eventTag && a.type === b.type;
}

function getEventTypeLabel(type: EventType, isZh: boolean): string {
  const map: Record<EventType, { zh: string; en: string }> = {
    meeting: { zh: '会议', en: 'Meeting' },
    todo: { zh: '待办', en: 'To-Do' },
    reminder: { zh: '提醒', en: 'Reminder' },
  };
  return isZh ? map[type].zh : map[type].en;
}

export const TagBatchEditorDrawer: React.FC<TagBatchEditorDrawerProps> = ({
  isOpen,
  onClose,
  events,
  allEvents,
  filters,
  language,
  onFiltersChange,
  onSave,
  isSaving,
}) => {
  const isZh = language === 'zh';

  const listEvents = useMemo(
    () => {
      const sorted = [...events].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      );
      return filters.viewMode === 'all' ? sorted : sorted.filter(isEventUntagged);
    },
    [events, filters.viewMode],
  );

  const [drafts, setDrafts] = useState<Map<string, TagDraft>>(new Map());
  const [initialDrafts, setInitialDrafts] = useState<Map<string, TagDraft>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchRole, setBatchRole] = useState('');
  const [batchTag, setBatchTag] = useState('');
  const [batchType, setBatchType] = useState<EventType | ''>('');

  const roleOptions = useMemo(() => {
    const catalog = typeof window !== 'undefined' ? loadRoleCatalog() : {};
    const ids = new Set<string>(PRESET_ROLES.map((r) => r.id));
    Object.keys(catalog).forEach((id) => ids.add(id));
    allEvents.forEach((e) => {
      if (e.role?.trim()) ids.add(e.role.trim());
    });
    return [...ids].sort((a, b) =>
      getRoleDisplayName(a, isZh ? 'zh' : 'en').localeCompare(getRoleDisplayName(b, isZh ? 'zh' : 'en')),
    );
  }, [allEvents, isZh]);

  const eventTagOptions = useMemo(() => {
    const presets = isZh ? PRESET_EVENT_LABELS_ZH : PRESET_EVENT_LABELS_EN;
    const custom = loadSavedCustomEventTags();
    const s = new Set<string>([...presets, ...custom]);
    allEvents.forEach((e) => {
      const lt = e.label?.text?.trim();
      if (lt) s.add(lt);
      e.tags?.forEach((t) => {
        const x = t?.trim();
        if (x) s.add(x);
      });
    });
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [allEvents, isZh]);

  const typeOptions: EventType[] = ['meeting', 'todo', 'reminder'];

  useEffect(() => {
    if (!isOpen) return;
    const next = new Map<string, TagDraft>();
    for (const e of listEvents) {
      const pid = getEventPersistId(e);
      if (!next.has(pid)) {
        const base = allEvents.find((ev) => ev.id === pid) || e;
        next.set(pid, buildDraftFromEvent(base));
      }
    }
    setDrafts(next);
    setInitialDrafts(next);
    setSelected(new Set());
    setBatchRole('');
    setBatchTag('');
    setBatchType('');
  }, [isOpen, listEvents, allEvents]);

  const uniqueListItems = useMemo(() => {
    const seen = new Set<string>();
    const items: { event: ScheduleEvent; persistId: string }[] = [];
    for (const e of listEvents) {
      const pid = getEventPersistId(e);
      if (seen.has(pid)) continue;
      seen.add(pid);
      items.push({ event: e, persistId: pid });
    }
    return items;
  }, [listEvents]);

  const uniqueIds = uniqueListItems.map((i) => i.persistId);

  const changedDrafts = useMemo(() => {
    const changed = new Map<string, TagDraft>();
    for (const [persistId, draft] of drafts.entries()) {
      if (!areTagDraftsEqual(draft, initialDrafts.get(persistId))) {
        changed.set(persistId, draft);
      }
    }
    return changed;
  }, [drafts, initialDrafts]);

  const toggleSelect = (persistId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(persistId)) next.delete(persistId);
      else next.add(persistId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === uniqueIds.length) setSelected(new Set());
    else setSelected(new Set(uniqueIds));
  };

  const updateDraft = (persistId: string, patch: Partial<TagDraft>) => {
    setDrafts((prev) => {
      const next = new Map<string, TagDraft>(prev);
      const current = next.get(persistId) || { roleId: '', eventTag: '', type: '' };
      next.set(persistId, { ...current, ...patch });
      return next;
    });
  };

  const applyBatch = () => {
    if (selected.size === 0) return;
    setDrafts((prev) => {
      const next = new Map<string, TagDraft>(prev);
      for (const pid of selected) {
        const current = next.get(pid) || { roleId: '', eventTag: '', type: '' };
        next.set(pid, {
          roleId: batchRole || current.roleId,
          eventTag: batchTag || current.eventTag,
          type: batchType || current.type,
        });
      }
      return next;
    });
  };

  const handleSmartMatch = () => {
    let count = 0;
    setDrafts((prev) => {
      const next = new Map<string, TagDraft>(prev);
      for (const { event, persistId } of uniqueListItems) {
        const current = next.get(persistId) || { roleId: '', eventTag: '', type: '' };
        const base = allEvents.find((ev) => ev.id === persistId) || event;
        const match = smartMatchTags(base, roleOptions, eventTagOptions);
        if (!match) continue;
        const updated: TagDraft = {
          roleId: current.roleId || match.roleId || '',
          eventTag: current.eventTag || match.eventTag || '',
          type: current.type || match.type || '',
        };
        if (!areTagDraftsEqual(current, updated)) {
          next.set(persistId, updated);
          count += 1;
        }
      }
      return next;
    });
    window.setTimeout(() => {
      alert(
        count > 0
          ? (isZh ? `已智能匹配 ${count} 条，请确认后保存。` : `Smart Matched ${count} Items. Review And Save.`)
          : (isZh ? '没有找到足够确定的智能匹配。' : 'No Confident Smart Matches Found.')
      );
    }, 0);
  };

  const handleSave = async () => {
    await onSave(changedDrafts);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className="fixed inset-y-0 right-0 z-[70] w-full max-w-md bg-surface border-l border-border flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-serif font-bold text-foreground">
                {isZh ? '批量补标' : 'Batch Tag'}
              </h2>
              <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-field text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 border-b border-border bg-field/30">
              <p className="text-xs text-muted-foreground">
                {isZh ? '显示历史全部日程，按时间倒序排列。' : 'Showing All Historical Events, Newest First.'}
              </p>
              <button
                type="button"
                onClick={handleSmartMatch}
                disabled={isSaving || uniqueListItems.length === 0}
                className="rounded-full border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-45 disabled:pointer-events-none"
              >
                {isZh ? '智能匹配' : 'Smart Match'}
              </button>
              <div className="flex gap-4 text-xs text-foreground">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={filters.viewMode === 'untagged'}
                    onChange={() => onFiltersChange({ ...filters, viewMode: 'untagged' })}
                    className="accent-[var(--app-accent)]"
                  />
                  {isZh ? '仅未标注' : 'Untagged only'}
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={filters.viewMode === 'all'}
                    onChange={() => onFiltersChange({ ...filters, viewMode: 'all' })}
                    className="accent-[var(--app-accent)]"
                  />
                  {isZh ? '全部' : 'All'}
                </label>
              </div>
            </div>

            {uniqueListItems.length > 0 && (
              <div className="px-4 py-2 flex items-center justify-between border-b border-border text-xs text-muted-foreground">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.size === uniqueIds.length && uniqueIds.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded accent-[var(--app-accent)]"
                  />
                  {isZh ? '全选本页' : 'Select page'}
                </label>
                <span>
                  {isZh
                    ? `已选 ${selected.size}/${uniqueIds.length} · 已改 ${changedDrafts.size}`
                    : `${selected.size}/${uniqueIds.length} selected · ${changedDrafts.size} changed`}
                </span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {uniqueListItems.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <p>
                    {filters.viewMode === 'untagged'
                      ? isZh
                        ? '该时段已全部标注'
                        : 'All events in this range are tagged'
                      : isZh
                        ? '该时段没有日程'
                        : 'No events in this range'}
                  </p>
                  {filters.viewMode === 'untagged' && (
                    <button
                      type="button"
                      onClick={() => onFiltersChange({ ...filters, viewMode: 'all' })}
                      className="mt-3 text-accent hover:underline text-xs"
                    >
                      {isZh ? '查看全部' : 'Show all'}
                    </button>
                  )}
                </div>
              ) : (
                uniqueListItems.map(({ event, persistId }) => {
                  const draft = drafts.get(persistId) || { roleId: '', eventTag: '', type: '' };
                  const start = new Date(event.startTime);
                  const dateStr = isZh
                    ? format(start, 'M月d日 HH:mm', { locale: zhCN })
                    : format(start, 'MMM d, HH:mm');

                  return (
                    <div
                      key={persistId}
                      className="flex items-start gap-2 p-3 rounded-xl bg-field/50 border border-border"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(persistId)}
                        onChange={() => toggleSelect(persistId)}
                        className="mt-2 rounded accent-[var(--app-accent)] shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground">
                            {dateStr}
                            {changedDrafts.has(persistId) && (
                              <span className="ml-1 text-accent">{isZh ? '已修改' : 'Changed'}</span>
                            )}
                          </p>
                          <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <select
                            value={draft.roleId}
                            onChange={(e) => updateDraft(persistId, { roleId: e.target.value })}
                            className="w-full rounded-lg border border-border bg-field px-2 py-1.5 text-xs text-foreground"
                          >
                            <option value="">{isZh ? '选择 Role' : 'Select role'}</option>
                            {roleOptions.map((id) => (
                              <option key={id} value={id}>
                                {getRoleDisplayName(id, isZh ? 'zh' : 'en')}
                              </option>
                            ))}
                          </select>
                          <select
                            value={draft.eventTag}
                            onChange={(e) => updateDraft(persistId, { eventTag: e.target.value })}
                            className="w-full rounded-lg border border-border bg-field px-2 py-1.5 text-xs text-foreground"
                          >
                            <option value="">{isZh ? '选择标签' : 'Select tag'}</option>
                            {eventTagOptions.map((tag) => (
                              <option key={tag} value={tag}>
                                {tag}
                              </option>
                            ))}
                          </select>
                          <select
                            value={draft.type}
                            onChange={(e) =>
                              updateDraft(persistId, { type: (e.target.value || '') as EventType | '' })
                            }
                            className="w-full rounded-lg border border-border bg-field px-2 py-1.5 text-xs text-foreground"
                          >
                            <option value="">{isZh ? '选择类型' : 'Select type'}</option>
                            {typeOptions.map((t) => (
                              <option key={t} value={t}>
                                {getEventTypeLabel(t, isZh)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-border bg-field/30 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={batchRole}
                  onChange={(e) => setBatchRole(e.target.value)}
                  className="rounded-lg border border-border bg-field px-2 py-2 text-xs text-foreground"
                >
                  <option value="">{isZh ? '批量 Role' : 'Batch role'}</option>
                  {roleOptions.map((id) => (
                    <option key={id} value={id}>
                      {getRoleDisplayName(id, isZh ? 'zh' : 'en')}
                    </option>
                  ))}
                </select>
                <select
                  value={batchTag}
                  onChange={(e) => setBatchTag(e.target.value)}
                  className="rounded-lg border border-border bg-field px-2 py-2 text-xs text-foreground"
                >
                  <option value="">{isZh ? '批量标签' : 'Batch tag'}</option>
                  {eventTagOptions.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
                <select
                  value={batchType}
                  onChange={(e) => setBatchType((e.target.value || '') as EventType | '')}
                  className="rounded-lg border border-border bg-field px-2 py-2 text-xs text-foreground"
                >
                  <option value="">{isZh ? '批量类型' : 'Batch type'}</option>
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>
                      {getEventTypeLabel(t, isZh)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyBatch}
                  disabled={selected.size === 0}
                  className="flex-1 rounded-xl text-xs"
                >
                  {isZh ? '应用到选中' : 'Apply to selected'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || changedDrafts.size === 0}
                  className="flex-1 rounded-xl text-xs"
                >
                  {isZh ? `保存 ${changedDrafts.size || ''}` : `Save ${changedDrafts.size || ''}`}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
