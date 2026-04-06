import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, differenceInCalendarDays } from 'date-fns';
import { Target, Trash2 } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import type { ScheduleEvent, AppLanguage, TimeDisplayFormat } from '@/types';
import {
  loadLongTermGoalMeta,
  getOrCreateRecord,
  mergeLongTermGoalNames,
  addMilestone,
  setGoalStatus,
  migrateGoalRename,
  cycleGoalStatus,
  appendGoalTagPool,
  ensureMetaForGoals,
  removeGoalFromMetaAndPool,
  setGoalTargetAt,
  DEFAULT_GOAL_TITLE_ZH,
  DEFAULT_GOAL_TITLE_EN,
  type GoalStatus,
  type LongTermGoalMetaMap,
} from '@/lib/longTermGoalMetaStorage';
import { getLastActionDateForGoal } from '@/lib/longTermGoalLastAction';
import { cn } from '@/lib/utils';

export interface LongTermGoalsCardProps {
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
  timeDisplay: TimeDisplayFormat;
  onRenameLongTermGoal: (oldName: string, newName: string) => void | Promise<void>;
  onDeleteLongTermGoal: (goalName: string) => void | Promise<void>;
  collectionStateRevision?: number;
}

const STATUS_EMOJI: Record<GoalStatus, string> = {
  sprout: '🌱',
  in_progress: '🚀',
  deviated: '🌫️',
  completed: '✨',
};

const STALE_DAYS = 30;

const STALE_POPUP_ZH =
  '这个愿望，很久没去照料了。它还在你心里发光吗？';
const STALE_POPUP_EN =
  'This Wish Has Been Quiet For A While. Does It Still Shine In You?';

function isDefaultVisionTitle(s: string) {
  return s === DEFAULT_GOAL_TITLE_ZH || s === DEFAULT_GOAL_TITLE_EN;
}

function GoalTitleEditor({
  initial,
  isZh,
  onCommit,
  onRemoveIfStillPlaceholder,
}: {
  initial: string;
  isZh: boolean;
  onCommit: (next: string) => void;
  onRemoveIfStillPlaceholder?: () => void;
}) {
  const [val, setVal] = useState(initial);
  useEffect(() => setVal(initial), [initial]);

  return (
    <input
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        const t = val.trim();
        if (isDefaultVisionTitle(initial) && (!t || isDefaultVisionTitle(t))) {
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
      className="w-full min-w-0 bg-transparent border-none outline-none text-xs font-semibold p-0 focus:ring-0"
      style={{ color: 'var(--app-text)' }}
      aria-label={isZh ? '编辑目标名称' : 'Edit Goal Name'}
    />
  );
}

export const LongTermGoalsCard: React.FC<LongTermGoalsCardProps> = ({
  events,
  completedInstances,
  timeDisplay: _timeDisplay,
  language,
  onRenameLongTermGoal,
  onDeleteLongTermGoal,
  collectionStateRevision = 0,
}) => {
  void _timeDisplay;
  const isZh = language === 'zh';
  const reduceMotion = useReducedMotion();

  const [metaMap, setMetaMap] = useState<LongTermGoalMetaMap>(() => loadLongTermGoalMeta());
  const [newGlowIds, setNewGlowIds] = useState<Set<string>>(() => new Set());
  const [staleOpen, setStaleOpen] = useState(false);
  const [rippleId, setRippleId] = useState<string | null>(null);
  const [milestoneDraft, setMilestoneDraft] = useState<Record<string, { at: string; text: string }>>({});

  const [confirmDeleteGoal, setConfirmDeleteGoal] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  /** Title-bar「删除」：高亮各行废纸篓并显示说明 */
  const [trashDeleteHint, setTrashDeleteHint] = useState(false);

  const goalNames = useMemo(() => mergeLongTermGoalNames(events), [events, metaMap]);

  useEffect(() => {
    setMetaMap(loadLongTermGoalMeta());
  }, [events, collectionStateRevision]);

  useEffect(() => {
    if (!trashDeleteHint) return;
    const t = window.setTimeout(() => setTrashDeleteHint(false), 14000);
    return () => window.clearTimeout(t);
  }, [trashDeleteHint]);

  useEffect(() => {
    if (goalNames.length === 0) setTrashDeleteHint(false);
  }, [goalNames.length]);

  const handleCycleStatus = (goalName: string) => {
    const cur = getOrCreateRecord(metaMap, goalName);
    const nextStatus = cycleGoalStatus(cur.status);
    const next = setGoalStatus(metaMap, goalName, nextStatus);
    setMetaMap(next);
  };

  const handleRename = async (oldName: string, newName: string) => {
    if (oldName === newName) return;
    await onRenameLongTermGoal(oldName, newName);
    setMetaMap(migrateGoalRename(loadLongTermGoalMeta(), oldName, newName.trim()));
  };

  const handleRemovePlaceholderVision = (goalName: string) => {
    setMetaMap(removeGoalFromMetaAndPool(goalName));
  };

  const handleAddGoal = () => {
    const title = isZh ? DEFAULT_GOAL_TITLE_ZH : DEFAULT_GOAL_TITLE_EN;
    const map = loadLongTermGoalMeta();
    const next = ensureMetaForGoals(map, [title]);
    appendGoalTagPool(title);
    setMetaMap(next);
    setNewGlowIds((prev) => new Set(prev).add(title));
    window.setTimeout(() => {
      setNewGlowIds((prev) => {
        const n = new Set(prev);
        n.delete(title);
        return n;
      });
    }, 2800);
  };

  const closeDeleteConfirm = () => {
    setConfirmDeleteGoal(null);
    setDeleteBusy(false);
  };

  const openDeleteConfirmForGoal = (goal: string) => {
    setTrashDeleteHint(false);
    setConfirmDeleteGoal(goal);
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
      /* Error surfaced by App; keep modal open */
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleAddMilestone = (goalName: string) => {
    const draft = milestoneDraft[goalName] ?? {
      at: format(new Date(), 'yyyy-MM-dd'),
      text: '',
    };
    if (!draft.text.trim()) return;
    const next = addMilestone(metaMap, goalName, draft.at, draft.text);
    setMetaMap(next);
    const id = next[goalName]?.milestones.slice(-1)[0]?.id;
    if (id) {
      setRippleId(id);
      window.setTimeout(() => setRippleId(null), 900);
    }
    setMilestoneDraft((prev) => ({ ...prev, [goalName]: { at: format(new Date(), 'yyyy-MM-dd'), text: '' } }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
          <Target className="w-4 h-4 shrink-0" style={{ color: 'var(--app-accent)' }} />
          {isZh ? '长期目标' : 'Long-Term Goals'}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleAddGoal}
            className="text-xs font-medium rounded-lg px-2 py-1 border border-dashed transition-colors hover:bg-accent/10"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
          >
            {isZh ? '+ 新愿景' : '+ New Vision'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (goalNames.length === 0) return;
              setTrashDeleteHint((v) => !v);
            }}
            disabled={goalNames.length === 0}
            className="text-xs font-medium rounded-lg px-2 py-1 border transition-colors hover:bg-accent/10 disabled:opacity-40 disabled:pointer-events-none"
            style={{
              borderColor: trashDeleteHint ? 'var(--app-accent)' : 'var(--app-border)',
              color: trashDeleteHint ? 'var(--app-accent)' : 'var(--app-muted)',
            }}
            title={isZh ? '提示：点左侧废纸篓删除' : 'Show Trash Icons To Delete'}
            aria-label={isZh ? '删除提示' : 'Delete Hint'}
          >
            {isZh ? '删除' : 'Delete'}
          </button>
        </div>
      </div>

      {trashDeleteHint && goalNames.length > 0 && (
        <p className="text-[11px] leading-snug rounded-lg px-2.5 py-2 border" style={{ color: 'var(--app-muted)', borderColor: 'var(--app-border)', background: 'color-mix(in srgb, var(--app-accent) 6%, transparent)' }}>
          {isZh
            ? '请点每条目前的废纸篓图标删除该目标。日程不会删除，仅从对应日程中去掉该长期目标。'
            : 'Tap The Trash Icon Next To A Goal To Remove It. Events Are Not Deleted; Only This Long-Term Goal Tag Is Removed From Them.'}
        </p>
      )}

      {goalNames.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--app-muted)' }}>
          {isZh ? '点「新愿景」开始，或在日程里关联长期目标。' : 'Tap "New Vision" To Begin, Or Link Goals When Adding Events.'}
        </p>
      ) : (
        <ul className="space-y-5">
          <AnimatePresence initial={false}>
            {goalNames.map((goal) => {
              const rec = getOrCreateRecord(metaMap, goal);
              const lastAction = getLastActionDateForGoal(events, goal, completedInstances);
              const days =
                lastAction != null
                  ? Math.max(0, differenceInCalendarDays(new Date(), lastAction))
                  : null;
              const isStale = lastAction != null && days != null && days > STALE_DAYS;
              const showGlow = newGlowIds.has(goal);

              return (
                <motion.li
                  key={goal}
                  layout
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    boxShadow: showGlow
                      ? '0 0 0 1px color-mix(in srgb, var(--app-accent) 35%, transparent), 0 0 24px color-mix(in srgb, var(--app-accent) 25%, transparent)'
                      : 'none',
                  }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="rounded-xl pl-1 -ml-1"
                  style={{ color: 'var(--app-text)' }}
                >
                  <div className="flex items-start gap-1.5">
                    <button
                      type="button"
                      onClick={() => openDeleteConfirmForGoal(goal)}
                      className={cn(
                        'shrink-0 p-0.5 rounded-md mt-0.5 transition-colors',
                        !trashDeleteHint && 'opacity-55 hover:opacity-100 hover:bg-accent/10'
                      )}
                      style={
                        trashDeleteHint
                          ? {
                              color: 'var(--app-muted)',
                              opacity: 1,
                              boxShadow: '0 0 0 1px color-mix(in srgb, var(--app-accent) 50%, transparent)',
                              background: 'color-mix(in srgb, var(--app-accent) 14%, transparent)',
                            }
                          : { color: 'var(--app-muted)' }
                      }
                      title={isZh ? '删除此目标' : 'Delete This Goal'}
                      aria-label={isZh ? `删除「${goal}」` : `Delete ${goal}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCycleStatus(goal)}
                      className="shrink-0 text-base leading-none mt-0.5 opacity-90 hover:opacity-100 transition-opacity"
                      style={{ filter: 'saturate(0.85)' }}
                      title={isZh ? '切换状态' : 'Cycle Status'}
                      aria-label={isZh ? '切换状态' : 'Cycle Status'}
                    >
                      {STATUS_EMOJI[rec.status]}
                    </button>
                    <div className="min-w-0 flex-1 space-y-1">
                      <GoalTitleEditor
                        initial={goal}
                        isZh={isZh}
                        onCommit={(next) => void handleRename(goal, next)}
                        onRemoveIfStillPlaceholder={
                          isDefaultVisionTitle(goal)
                            ? () => handleRemovePlaceholderVision(goal)
                            : undefined
                        }
                      />
                      <p className="text-[11px] leading-snug flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: 'var(--app-muted)' }}>
                        <span className="shrink-0">{isZh ? '目标时间：' : 'Target Date: '}</span>
                        <input
                          type="date"
                          className="text-[10px] rounded border bg-transparent px-1 py-0.5 max-w-[9.5rem]"
                          style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
                          value={rec.targetAt ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMetaMap(setGoalTargetAt(metaMap, goal, v || undefined));
                          }}
                          aria-label={isZh ? '目标时间' : 'Target Date'}
                        />
                      </p>
                      <p className="text-[11px] leading-snug flex flex-wrap items-baseline gap-x-1" style={{ color: 'var(--app-muted)' }}>
                        <span>
                          {isZh ? '上次行动：' : 'Last action: '}
                          {lastAction
                            ? format(lastAction, 'yyyy.MM.dd')
                            : isZh
                              ? '暂无'
                              : 'None yet'}
                        </span>
                        {lastAction != null && days != null ? (
                          isStale ? (
                            <button
                              type="button"
                              onClick={() => setStaleOpen(true)}
                              className="tabular-nums underline-offset-2 hover:underline"
                              style={{ color: 'var(--app-muted)', opacity: 0.55 }}
                              aria-label={
                                isZh ? '已久无相关日程，点击查看' : 'Long Since Last Action; Tap For A Gentle Note'
                              }
                            >
                              {isZh ? `（${days} 天前）` : `(${days} Day${days === 1 ? '' : 's'} Ago)`}
                            </button>
                          ) : (
                            <span className="tabular-nums" style={{ opacity: 0.92 }}>
                              {isZh ? `（${days} 天前）` : `(${days} Day${days === 1 ? '' : 's'} Ago)`}
                            </span>
                          )
                        ) : null}
                      </p>

                      <div className="relative pl-3 border-l border-dashed ml-1 mt-2 space-y-2" style={{ borderColor: 'var(--app-border)' }}>
                        {rec.milestones.map((m) => (
                          <div key={m.id} className="relative text-[11px] leading-snug pr-2" style={{ color: 'var(--app-muted)' }}>
                            {rippleId === m.id && !reduceMotion && (
                              <motion.span
                                className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 rounded-full"
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
                            <span className="relative z-[1]">
                              [{m.at}] — {m.text}
                            </span>
                          </div>
                        ))}
                        <div className="flex flex-wrap items-end gap-2 pt-0.5">
                          <input
                            type="date"
                            className="text-[10px] rounded border bg-transparent px-1 py-0.5 max-w-[9rem]"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
                            value={milestoneDraft[goal]?.at ?? format(new Date(), 'yyyy-MM-dd')}
                            onChange={(e) =>
                              setMilestoneDraft((prev) => ({
                                ...prev,
                                [goal]: { ...prev[goal], at: e.target.value, text: prev[goal]?.text ?? '' },
                              }))
                            }
                          />
                          <input
                            type="text"
                            placeholder={isZh ? '里程碑描述' : 'Milestone Note'}
                            className="text-[11px] flex-1 min-w-[6rem] rounded border bg-transparent px-2 py-0.5"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                            value={milestoneDraft[goal]?.text ?? ''}
                            onChange={(e) =>
                              setMilestoneDraft((prev) => ({
                                ...prev,
                                [goal]: {
                                  at: prev[goal]?.at ?? format(new Date(), 'yyyy-MM-dd'),
                                  text: e.target.value,
                                },
                              }))
                            }
                          />
                          <button
                            type="button"
                            onClick={() => handleAddMilestone(goal)}
                            className="text-[11px] font-medium rounded-md px-2 py-0.5 border transition-colors hover:bg-accent/10"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-accent)' }}
                          >
                            {isZh ? '+ 添加里程碑' : '+ Add Milestone'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {confirmDeleteGoal != null &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[201] flex items-center justify-center p-4"
            style={{ background: 'color-mix(in srgb, var(--app-bg, #000) 55%, transparent)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-lt-goal-dialog-title"
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
              <div id="delete-lt-goal-dialog-title" className="space-y-2 mb-5">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--app-text)' }}>
                  {isZh
                    ? `是否确定要删除「${confirmDeleteGoal}」？`
                    : `Are You Sure You Want To Delete "${confirmDeleteGoal}"?`}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--app-muted)' }}>
                  {isZh
                    ? '日程事件将保留，仅从相关日程中清除该长期目标标签。'
                    : 'Events Will Stay On Your Schedule; Only This Goal Tag Will Be Removed From Them.'}
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

      {staleOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'color-mix(in srgb, var(--app-bg, #000) 55%, transparent)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="stale-goal-dialog"
            onClick={() => setStaleOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-sm rounded-2xl border p-5 shadow-lg"
              style={{
                background: 'var(--app-surface)',
                borderColor: 'var(--app-border)',
                color: 'var(--app-text)',
                boxShadow: 'var(--app-card-shadow)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p id="stale-goal-dialog" className="text-sm leading-relaxed">
                {isZh ? STALE_POPUP_ZH : STALE_POPUP_EN}
              </p>
              <button
                type="button"
                className="mt-4 w-full text-xs font-medium rounded-lg py-2 border border-border hover:bg-accent/10"
                style={{ color: 'var(--app-accent)' }}
                onClick={() => setStaleOpen(false)}
              >
                {isZh ? '好的' : 'Okay'}
              </button>
            </motion.div>
          </div>,
          document.body
        )}
    </div>
  );
};
