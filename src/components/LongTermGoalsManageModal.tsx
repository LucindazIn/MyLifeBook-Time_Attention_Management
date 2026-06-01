import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  type DragEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { motion } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import type { AppLanguage } from '@/types';
import {
  loadLongTermGoalMeta,
  getOrCreateRecord,
  addMilestone,
  removeMilestone,
  updateMilestone,
  setGoalStatus,
  migrateGoalRename,
  cycleGoalStatus,
  removeGoalFromMetaAndPool,
  setGoalTargetAt,
  setMediumTermGoals,
  DEFAULT_GOAL_TITLE_ZH,
  DEFAULT_GOAL_TITLE_EN,
  type LongTermGoalMetaMap,
  type MediumTermGoal,
} from '@/lib/longTermGoalMetaStorage';
import { GripVertical } from 'lucide-react';
import { AnalyticsManageModalShell } from '@/components/AnalyticsManageModalShell';

const STATUS_EMOJI = {
  sprout: '🌱',
  in_progress: '🚀',
  deviated: '🌫️',
  completed: '✨',
} as const;

function isDefaultVisionTitle(s: string) {
  return s === DEFAULT_GOAL_TITLE_ZH || s === DEFAULT_GOAL_TITLE_EN;
}

function GoalTitleEditor({
  initial,
  isZh,
  onCommit,
  onRemoveIfStillPlaceholder,
  autoFocus,
}: {
  initial: string;
  isZh: boolean;
  onCommit: (next: string) => void;
  onRemoveIfStillPlaceholder?: () => void;
  autoFocus?: boolean;
}) {
  const [val, setVal] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setVal(initial), [initial]);
  useEffect(() => {
    if (!autoFocus) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [autoFocus]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        const t = val.trim();
        if (isDefaultVisionTitle(initial) && !t) {
          onRemoveIfStillPlaceholder?.();
          return;
        }
        if (!t) {
          setVal(initial);
          return;
        }
        if (t !== initial) onCommit(t);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className="w-full min-w-0 rounded-lg border bg-field px-2 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-accent/25"
      style={{ color: 'var(--app-text)', borderColor: 'var(--app-border)' }}
      aria-label={isZh ? '编辑目标名称' : 'Edit Goal Name'}
    />
  );
}

const MILESTONE_AUTOSAVE_MS = 400;

function MilestoneInlineFields({
  goalName,
  mediumTermId,
  ms,
  setMetaMap,
  isZh,
  reduceMotion,
  showRipple,
}: {
  goalName: string;
  mediumTermId: string;
  ms: { id: string; at: string; text: string };
  setMetaMap: React.Dispatch<React.SetStateAction<LongTermGoalMetaMap>>;
  isZh: boolean;
  reduceMotion: boolean | null;
  showRipple: boolean;
}) {
  const [at, setAt] = useState(ms.at);
  const [text, setText] = useState(ms.text);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const atRef = useRef(at);
  const textRef = useRef(text);
  atRef.current = at;
  textRef.current = text;

  useEffect(() => {
    setAt(ms.at);
    setText(ms.text);
  }, [ms.id, ms.at, ms.text]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const persistIfValid = useCallback(() => {
    const a = atRef.current.trim();
    const t = textRef.current.trim();
    if (!a || !t) return;
    setMetaMap((prev) => {
      const r = getOrCreateRecord(prev, goalName);
      const medium = r.mediumTermGoals?.find((x) => x.id === mediumTermId);
      const cur = medium?.milestones?.find((x) => x.id === ms.id);
      if (cur && cur.at === a && cur.text === t) return prev;
      return updateMilestone(prev, goalName, mediumTermId, ms.id, { at: a, text: t });
    });
  }, [goalName, mediumTermId, ms.id, setMetaMap]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      persistIfValid();
    }, MILESTONE_AUTOSAVE_MS);
  }, [persistIfValid]);

  const handleBlur = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const a = atRef.current.trim();
    const t = textRef.current.trim();
    if (!a || !t) {
      setAt(ms.at);
      setText(ms.text);
      return;
    }
    persistIfValid();
  }, [ms.at, ms.text, persistIfValid]);

  return (
    <div className="relative flex flex-wrap items-start gap-2 flex-1 min-w-0">
      {showRipple && !reduceMotion && (
        <motion.span
          className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 -translate-x-0.5 rounded-full z-[1]"
          style={{
            width: 8,
            height: 8,
            background: 'color-mix(in srgb, var(--app-accent) 45%, transparent)',
          }}
          initial={{ scale: 1, opacity: 0.9 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
        />
      )}
      <input
        type="date"
        className="text-[10px] rounded border bg-transparent px-1 py-0.5 max-w-[9rem] shrink-0 relative z-[1]"
        style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
        value={at}
        onChange={(e) => {
          setAt(e.target.value);
          scheduleSave();
        }}
        onBlur={handleBlur}
        aria-label={isZh ? '里程碑日期' : 'Milestone Date'}
      />
      <input
        type="text"
        className="text-[11px] flex-1 min-w-[6rem] rounded border bg-transparent px-2 py-0.5 relative z-[1]"
        style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          scheduleSave();
        }}
        onBlur={handleBlur}
        placeholder={isZh ? '里程碑描述' : 'Milestone Note'}
      />
    </div>
  );
}

export interface LongTermGoalsManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: AppLanguage;
  goalNames: string[];
  metaMap: LongTermGoalMetaMap;
  setMetaMap: React.Dispatch<React.SetStateAction<LongTermGoalMetaMap>>;
  onRenameLongTermGoal: (oldName: string, newName: string) => void | Promise<void>;
  onDeleteLongTermGoal: (goalName: string) => void | Promise<void>;
  onAddGoal: () => void;
  /** 管理页内拖动排序后的完整顺序（持久化优先级） */
  onReorderGoals: (orderedNames: string[]) => void;
  /** 打开时滚动到该目标块 */
  scrollToGoalName?: string | null;
}

export const LongTermGoalsManageModal: React.FC<LongTermGoalsManageModalProps> = ({
  isOpen,
  onClose,
  language,
  goalNames,
  metaMap,
  setMetaMap,
  onRenameLongTermGoal,
  onDeleteLongTermGoal,
  onAddGoal,
  onReorderGoals,
  scrollToGoalName,
}) => {
  const isZh = language === 'zh';
  const reduceMotion = useReducedMotion();
  const [milestoneDraft, setMilestoneDraft] = useState<Record<string, { at: string; text: string }>>({});
  const [rippleId, setRippleId] = useState<string | null>(null);
  const [confirmDeleteGoal, setConfirmDeleteGoal] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const scrolledForRef = useRef<string | null>(null);
  const reorderAnchorRef = useRef<HTMLButtonElement>(null);
  const reorderPanelRef = useRef<HTMLDivElement>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderPopoverStyle, setReorderPopoverStyle] = useState<React.CSSProperties>({});
  const [reorderDraggingIndex, setReorderDraggingIndex] = useState<number | null>(null);

  const scopeLine = isZh
    ? '与日程通过同名长期目标标签关联；修改将自动保存。点状态图标切换阶段；点「调整顺序」在浮层列表中拖动标题以设置优先级（由上至下）。新愿景会出现在列表顶部。主卡片可展开查看中短期与里程碑。删除目标仅从日程移除该标签，不删原日程。'
    : 'Linked To Events By Matching Long-Term Goal Names; Changes Save Automatically. Tap The Status Icon To Cycle Status; Tap "Reorder" And Drag Titles In The Panel To Set Priority (Top First). New Visions Appear At The Top Of This List. Expand Rows On The Card For Short-Term Goals. Deleting A Goal Removes Only That Tag From Events, Not The Events Themselves.';

  const handleCycleStatus = (goalName: string) => {
    setMetaMap((prev) => {
      const cur = getOrCreateRecord(prev, goalName);
      const nextStatus = cycleGoalStatus(cur.status);
      return setGoalStatus(prev, goalName, nextStatus);
    });
  };

  const handleRename = async (oldName: string, newName: string) => {
    if (oldName === newName) return;
    await onRenameLongTermGoal(oldName, newName);
    setMetaMap(migrateGoalRename(loadLongTermGoalMeta(), oldName, newName.trim()));
  };

  const handleRemovePlaceholderVision = (goalName: string) => {
    setMetaMap(removeGoalFromMetaAndPool(goalName));
  };

  const closeDeleteConfirm = () => {
    setConfirmDeleteGoal(null);
    setDeleteBusy(false);
  };

  const handleConfirmDeleteGoal = async () => {
    const name = confirmDeleteGoal?.trim();
    if (!name) return;
    setDeleteBusy(true);
    try {
      await onDeleteLongTermGoal(name);
      setMetaMap(removeGoalFromMetaAndPool(name));
      closeDeleteConfirm();
    } catch {
      /* App surfaces error */
    } finally {
      setDeleteBusy(false);
    }
  };

  const milestoneKey = (goalName: string, mediumId: string) => `${goalName}::${mediumId}`;

  const handleAddMilestone = (goalName: string, mediumId: string) => {
    const key = milestoneKey(goalName, mediumId);
    const draft = milestoneDraft[key] ?? {
      at: format(new Date(), 'yyyy-MM-dd'),
      text: '',
    };
    if (!draft.text.trim()) return;
    setMetaMap((prev) => {
      const next = addMilestone(prev, goalName, mediumId, draft.at, draft.text);
      const nid = next[goalName]?.mediumTermGoals?.find((x) => x.id === mediumId)?.milestones.slice(-1)[0]?.id;
      if (nid) {
        setRippleId(nid);
        window.setTimeout(() => setRippleId(null), 900);
      }
      return next;
    });
    setMilestoneDraft((prev) => ({
      ...prev,
      [key]: { at: format(new Date(), 'yyyy-MM-dd'), text: '' },
    }));
  };

  useEffect(() => {
    if (!isOpen) {
      scrolledForRef.current = null;
      return;
    }
    if (!scrollToGoalName) return;
    if (scrolledForRef.current === scrollToGoalName) return;
    scrolledForRef.current = scrollToGoalName;
    const id = `lt-manage-goal-${encodeURIComponent(scrollToGoalName)}`;
    const run = () => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [isOpen, scrollToGoalName, goalNames]);

  useEffect(() => {
    if (!isOpen) setReorderOpen(false);
  }, [isOpen]);

  const updateReorderPopoverPosition = useCallback(() => {
    const anchor = reorderAnchorRef.current;
    if (!anchor || !reorderOpen) return;
    const ar = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 12;
    let safeBottom = 0;
    try {
      const sb = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)');
      const n = parseFloat(sb);
      if (Number.isFinite(n)) safeBottom = n;
    } catch {
      /* ignore */
    }
    const bottomPad = pad + safeBottom;
    const panelW = Math.min(320, vw - pad * 2);
    let left = ar.left;
    if (left + panelW > vw - pad) left = vw - pad - panelW;
    if (left < pad) left = pad;

    const maxPanelH = Math.min(384, Math.floor(vh * 0.5));
    const spaceBelow = vh - ar.bottom - 8 - bottomPad;
    const spaceAbove = ar.top - pad - 8;

    let top: number;
    let maxH: number;

    if (spaceBelow >= 140 || spaceBelow >= spaceAbove) {
      top = ar.bottom + 8;
      maxH = Math.min(maxPanelH, Math.max(120, spaceBelow));
    } else {
      maxH = Math.min(maxPanelH, Math.max(120, spaceAbove));
      top = ar.top - 8 - maxH;
      if (top < pad) {
        top = pad;
        maxH = Math.min(maxH, Math.max(100, ar.top - pad - 8));
      }
    }

    if (top + maxH > vh - bottomPad) {
      maxH = Math.max(100, vh - bottomPad - top);
    }

    setReorderPopoverStyle({
      position: 'fixed',
      left,
      top,
      width: panelW,
      maxHeight: maxH,
      zIndex: 211,
    });
  }, [reorderOpen]);

  useLayoutEffect(() => {
    if (!reorderOpen) return;
    const run = () => {
      requestAnimationFrame(() => {
        updateReorderPopoverPosition();
        requestAnimationFrame(() => updateReorderPopoverPosition());
      });
    };
    run();
    window.addEventListener('resize', updateReorderPopoverPosition);
    window.addEventListener('scroll', updateReorderPopoverPosition, true);
    return () => {
      window.removeEventListener('resize', updateReorderPopoverPosition);
      window.removeEventListener('scroll', updateReorderPopoverPosition, true);
    };
  }, [reorderOpen, goalNames.length, updateReorderPopoverPosition]);

  useEffect(() => {
    if (!reorderOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReorderOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [reorderOpen]);

  useEffect(() => {
    if (!reorderOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (reorderAnchorRef.current?.contains(t)) return;
      if (reorderPanelRef.current?.contains(t)) return;
      setReorderOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [reorderOpen]);

  const reorderGoalNames = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= goalNames.length || to >= goalNames.length) return;
    const next = [...goalNames];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onReorderGoals(next);
  };

  const onReorderDragStart = (index: number) => (e: DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setReorderDraggingIndex(index);
  };

  const onReorderDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onReorderDrop = (toIndex: number) => (e: DragEvent) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData('text/plain'));
    setReorderDraggingIndex(null);
    if (Number.isNaN(from)) return;
    reorderGoalNames(from, toIndex);
  };

  const onReorderDragEnd = () => setReorderDraggingIndex(null);

  const onMediumTitleChange = useCallback(
    (goal: string, mid: string, title: string) => {
      setMetaMap((prev) => {
        const rec = getOrCreateRecord(prev, goal);
        const list = (rec.mediumTermGoals ?? []).map((row) => (row.id === mid ? { ...row, title } : row));
        return setMediumTermGoals(prev, goal, list);
      });
    },
    [setMetaMap]
  );

  return (
    <>
      <AnalyticsManageModalShell
        isOpen={isOpen}
        onClose={onClose}
        title={isZh ? '长期目标 · 管理' : 'Long-Term Goals · Manage'}
        scopeLine={scopeLine}
        language={language}
        panelMaxWidthClass="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-stretch">
            <button
              type="button"
              onClick={onAddGoal}
              className="text-xs font-medium rounded-lg px-3 py-2 border border-dashed transition-colors hover:bg-accent/10 min-w-0 flex-1 sm:flex-none"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)' }}
            >
              {isZh ? '+ 新愿景' : '+ New Vision'}
            </button>
            <button
              ref={reorderAnchorRef}
              type="button"
              disabled={goalNames.length < 2}
              onClick={() => {
                if (goalNames.length < 2) return;
                setReorderOpen((o) => !o);
              }}
              className="text-xs font-medium rounded-lg px-3 py-2 border transition-colors hover:bg-accent/10 min-w-0 flex-1 sm:flex-none disabled:opacity-45 disabled:pointer-events-none"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
              aria-expanded={reorderOpen}
              aria-haspopup="dialog"
              title={
                goalNames.length < 2
                  ? isZh
                    ? '至少两个长期目标时才可调整顺序'
                    : 'Reorder Is Available When There Are At Least Two Goals'
                  : undefined
              }
            >
              {isZh ? '调整顺序' : 'Reorder'}
            </button>
          </div>

          <ul className="space-y-6 pb-2">
            {goalNames.map((goal) => {
              const rec = getOrCreateRecord(metaMap, goal);
              return (
                <li
                  key={goal}
                  id={`lt-manage-goal-${encodeURIComponent(goal)}`}
                  className="rounded-xl border p-4 space-y-3"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleCycleStatus(goal)}
                        className="shrink-0 text-lg leading-none mt-0.5 opacity-90 hover:opacity-100 transition-opacity"
                        style={{ filter: 'saturate(0.85)' }}
                        title={isZh ? '切换状态' : 'Cycle Status'}
                        aria-label={isZh ? '切换状态' : 'Cycle Status'}
                      >
                        {STATUS_EMOJI[rec.status]}
                      </button>
                      <div className="min-w-0 flex-1">
                        <GoalTitleEditor
                          initial={goal}
                          isZh={isZh}
                          onCommit={(next) => void handleRename(goal, next)}
                          onRemoveIfStillPlaceholder={
                            isDefaultVisionTitle(goal) ? () => handleRemovePlaceholderVision(goal) : undefined
                          }
                          autoFocus={scrollToGoalName === goal}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteGoal(goal)}
                      className="text-[11px] font-medium rounded-lg px-2 py-1 border shrink-0 hover:bg-rose-500/10"
                      style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
                    >
                      {isZh ? '删除' : 'Delete'}
                    </button>
                  </div>

                  <p className="text-[11px] leading-snug flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: 'var(--app-muted)' }}>
                    <span className="shrink-0">{isZh ? '目标时间：' : 'Target Date: '}</span>
                    <input
                      type="date"
                      className="text-[10px] rounded border bg-transparent px-1 py-0.5 max-w-[9.5rem]"
                      style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
                      value={rec.targetAt ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMetaMap((prev) => setGoalTargetAt(prev, goal, v || undefined));
                      }}
                      aria-label={isZh ? '目标时间' : 'Target Date'}
                    />
                  </p>

                  <div className="relative pl-3 border-l border-dashed ml-1 space-y-2" style={{ borderColor: 'var(--app-border)' }}>
                    <p className="text-[11px] font-medium" style={{ color: 'var(--app-muted)' }}>
                      {isZh ? '中短期目标' : 'Short-Term Goals'}
                    </p>
                    {(rec.mediumTermGoals ?? []).map((m) => (
                      <div
                        key={m.id}
                        className="rounded-lg border border-dashed p-2 space-y-2"
                        style={{ borderColor: 'var(--app-border)' }}
                      >
                        <div className="flex flex-wrap items-end gap-2">
                          <input
                            type="text"
                            className="text-[11px] flex-1 min-w-[5rem] rounded border bg-transparent px-2 py-0.5"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                            value={m.title}
                            onChange={(e) => onMediumTitleChange(goal, m.id, e.target.value)}
                            placeholder={isZh ? '标题' : 'Title'}
                          />
                          <input
                            type="date"
                            className="text-[10px] rounded border bg-transparent px-1 py-0.5"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
                            value={m.startAt}
                            onChange={(e) => {
                              const startAt = e.target.value;
                              setMetaMap((prev) => {
                                const r = getOrCreateRecord(prev, goal);
                                const list = (r.mediumTermGoals ?? []).map((row) => {
                                  if (row.id !== m.id) return row;
                                  let endAt = row.endAt;
                                  if (startAt > endAt) endAt = startAt;
                                  return { ...row, startAt, endAt };
                                });
                                return setMediumTermGoals(prev, goal, list);
                              });
                            }}
                            aria-label={isZh ? '开始' : 'Start'}
                          />
                          <span className="text-[10px] pb-0.5" style={{ color: 'var(--app-muted)' }}>
                            —
                          </span>
                          <input
                            type="date"
                            className="text-[10px] rounded border bg-transparent px-1 py-0.5"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
                            value={m.endAt}
                            min={m.startAt}
                            onChange={(e) => {
                              const endAt = e.target.value;
                              setMetaMap((prev) => {
                                const r = getOrCreateRecord(prev, goal);
                                const list = (r.mediumTermGoals ?? []).map((row) =>
                                  row.id === m.id ? { ...row, endAt } : row
                                );
                                return setMediumTermGoals(prev, goal, list);
                              });
                            }}
                            aria-label={isZh ? '结束' : 'End'}
                          />
                          <button
                            type="button"
                            className="text-[10px] px-1.5 py-0.5 rounded border shrink-0"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
                            onClick={() => {
                              setMetaMap((prev) => {
                                const r = getOrCreateRecord(prev, goal);
                                const list = (r.mediumTermGoals ?? []).filter((row) => row.id !== m.id);
                                return setMediumTermGoals(prev, goal, list);
                              });
                            }}
                            aria-label={isZh ? '删除此中短期目标' : 'Remove Short-Term Goal'}
                          >
                            ×
                          </button>
                        </div>
                        <p className="text-[10px] font-medium pl-0.5" style={{ color: 'var(--app-muted)' }}>
                          {isZh ? '里程碑' : 'Milestones'}
                        </p>
                        {(m.milestones ?? []).map((ms) => (
                          <div
                            key={ms.id}
                            className="relative flex flex-wrap items-start gap-2 text-[11px] leading-snug pl-1"
                            style={{ color: 'var(--app-muted)' }}
                          >
                            <MilestoneInlineFields
                              goalName={goal}
                              mediumTermId={m.id}
                              ms={ms}
                              setMetaMap={setMetaMap}
                              isZh={isZh}
                              reduceMotion={reduceMotion}
                              showRipple={rippleId === ms.id}
                            />
                            <button
                              type="button"
                              className="shrink-0 ml-auto text-[10px] px-1 rounded opacity-70 hover:opacity-100 self-start"
                              style={{ color: 'var(--app-muted)' }}
                              onClick={() =>
                                setMetaMap((prev) => removeMilestone(prev, goal, m.id, ms.id))
                              }
                              aria-label={isZh ? '删除里程碑' : 'Remove Milestone'}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <div className="flex flex-wrap items-end gap-2 pt-0.5">
                          <input
                            type="date"
                            className="text-[10px] rounded border bg-transparent px-1 py-0.5 max-w-[9rem]"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
                            value={
                              milestoneDraft[milestoneKey(goal, m.id)]?.at ?? format(new Date(), 'yyyy-MM-dd')
                            }
                            onChange={(e) =>
                              setMilestoneDraft((prev) => ({
                                ...prev,
                                [milestoneKey(goal, m.id)]: {
                                  at: e.target.value,
                                  text: prev[milestoneKey(goal, m.id)]?.text ?? '',
                                },
                              }))
                            }
                          />
                          <input
                            type="text"
                            placeholder={isZh ? '里程碑描述' : 'Milestone Note'}
                            className="text-[11px] flex-1 min-w-[6rem] rounded border bg-transparent px-2 py-0.5"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                            value={milestoneDraft[milestoneKey(goal, m.id)]?.text ?? ''}
                            onChange={(e) =>
                              setMilestoneDraft((prev) => ({
                                ...prev,
                                [milestoneKey(goal, m.id)]: {
                                  at:
                                    prev[milestoneKey(goal, m.id)]?.at ?? format(new Date(), 'yyyy-MM-dd'),
                                  text: e.target.value,
                                },
                              }))
                            }
                          />
                          <button
                            type="button"
                            onClick={() => handleAddMilestone(goal, m.id)}
                            className="text-[11px] font-medium rounded-md px-2 py-0.5 border transition-colors hover:bg-accent/10"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)' }}
                          >
                            {isZh ? '+ 里程碑' : '+ Milestone'}
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-[11px] font-medium rounded-md px-2 py-0.5 border transition-colors hover:bg-accent/10"
                      style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)' }}
                      onClick={() => {
                        const day = format(new Date(), 'yyyy-MM-dd');
                        const next: MediumTermGoal = {
                          id: uuidv4(),
                          title: isZh ? '中短期目标' : 'Short Term Goal',
                          startAt: day,
                          endAt: day,
                          milestones: [],
                        };
                        setMetaMap((prev) => {
                          const r = getOrCreateRecord(prev, goal);
                          return setMediumTermGoals(prev, goal, [...(r.mediumTermGoals ?? []), next]);
                        });
                      }}
                    >
                      {isZh ? '+ 添加中短期目标' : '+ Add Short-Term Goal'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </AnalyticsManageModalShell>

      {reorderOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[210]"
              style={{ background: 'transparent' }}
              aria-hidden
              onClick={() => setReorderOpen(false)}
            />
            <div
              ref={reorderPanelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="lt-reorder-panel-title"
              className="fixed flex flex-col rounded-lg border overflow-hidden"
              style={{
                ...reorderPopoverStyle,
                background: 'var(--app-surface)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text)',
                boxShadow: 'var(--app-card-shadow)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                id="lt-reorder-panel-title"
                className="shrink-0 px-3 py-2.5 border-b text-xs font-semibold"
                style={{ borderColor: 'var(--app-border)' }}
              >
                {isZh ? '拖动排序（松手保存）' : 'Drag To Reorder (Release To Save)'}
              </div>
              {goalNames.length === 0 ? (
                <p className="px-3 py-4 text-xs text-center shrink-0" style={{ color: 'var(--app-muted)' }}>
                  {isZh ? '暂无长期目标' : 'No Long-Term Goals Yet'}
                </p>
              ) : (
                <ul
                  data-reorder-scroll
                  className="overflow-y-auto overscroll-contain flex-1 min-h-0 py-1"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-y',
                  }}
                >
                  {goalNames.map((goal, index) => (
                    <li
                      key={goal}
                      onDragOver={onReorderDragOver}
                      onDrop={onReorderDrop(index)}
                      className="flex items-center gap-2 px-2 py-2 border-b last:border-b-0"
                      style={{
                        borderColor: 'var(--app-border)',
                        opacity: reorderDraggingIndex === index ? 0.65 : 1,
                      }}
                    >
                      <button
                        type="button"
                        draggable
                        onDragStart={onReorderDragStart(index)}
                        onDragEnd={onReorderDragEnd}
                        className="shrink-0 p-1 rounded cursor-grab active:cursor-grabbing hover:bg-field touch-none"
                        style={{ color: 'var(--app-muted)' }}
                        aria-label={isZh ? '拖动排序' : 'Drag To Reorder'}
                      >
                        <GripVertical className="w-4 h-4" />
                      </button>
                      <span
                        className="min-w-0 flex-1 text-xs font-medium text-left truncate"
                        style={{ color: 'var(--app-text)' }}
                        title={goal}
                      >
                        {goal}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>,
          document.body
        )}

      {confirmDeleteGoal != null && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[201] flex items-center justify-center p-4"
            style={{ background: 'color-mix(in srgb, var(--app-bg, #000) 55%, transparent)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-lt-goal-manage-title"
            onClick={() => !deleteBusy && closeDeleteConfirm()}
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
              <div id="delete-lt-goal-manage-title" className="space-y-2 mb-5">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--app-text)' }}>
                  {isZh
                    ? `是否确定要删除「${confirmDeleteGoal}」？`
                    : `Are You Sure You Want To Delete "${confirmDeleteGoal}"?`}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--app-muted)' }}>
                  {isZh
                    ? '日程事件将保留，仅从相关日程中清除该长期目标标签。'
                    : 'Events Will Stay On Your Schedule; Only This Long-Term Goal Tag Will Be Removed From Them.'}
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="text-xs font-medium rounded-lg px-3 py-2 border border-border hover:bg-accent/10 min-w-[4rem]"
                  style={{ color: 'var(--app-muted)' }}
                  onClick={closeDeleteConfirm}
                  disabled={deleteBusy}
                >
                  {isZh ? '否' : 'No'}
                </button>
                <button
                  type="button"
                  className="text-xs font-medium rounded-lg px-3 py-2 border transition-colors hover:bg-accent/10 min-w-[4rem]"
                  style={{ borderColor: 'var(--app-accent)', color: 'var(--app-accent)' }}
                  onClick={() => void handleConfirmDeleteGoal()}
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
