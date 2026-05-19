import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format, differenceInCalendarDays } from 'date-fns';
import { Target, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import type { ScheduleEvent, AppLanguage, TimeDisplayFormat } from '@/types';
import {
  loadLongTermGoalMeta,
  getOrCreateRecord,
  mergeLongTermGoalNames,
  setGoalStatus,
  cycleGoalStatus,
  ensureMetaForGoals,
  appendGoalTagPool,
  pickUniqueNewVisionTitle,
  prependLongTermGoalDisplayOrder,
  saveLongTermGoalDisplayOrder,
  type LongTermGoalMetaMap,
} from '@/lib/longTermGoalMetaStorage';
import { getLastActionDateForGoal } from '@/lib/longTermGoalLastAction';
import { formatTargetDateCountdown } from '@/lib/targetDateCountdown';
import { cn } from '@/lib/utils';
import { LongTermGoalsManageModal } from '@/components/LongTermGoalsManageModal';
import { AnalyticsManageModalShell } from '@/components/AnalyticsManageModalShell';
import { LongTermMediumTermInvestmentCard } from '@/components/LongTermMediumTermInvestmentCard';
import { LongTermGoalsGanttContent } from '@/components/LongTermGoalsGanttContent';

export interface LongTermGoalsCardProps {
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
  timeDisplay: TimeDisplayFormat;
  onRenameLongTermGoal: (oldName: string, newName: string) => void | Promise<void>;
  onDeleteLongTermGoal: (goalName: string) => void | Promise<void>;
  collectionStateRevision?: number;
}

const STATUS_EMOJI = {
  sprout: '🌱',
  in_progress: '🚀',
  deviated: '🌫️',
  completed: '✨',
} as const;

const STALE_DAYS = 30;

const STALE_POPUP_ZH = '这个愿望，很久没去照料了。它还在你心里发光吗？';
const STALE_POPUP_EN = 'This Wish Has Been Quiet For A While. Does It Still Shine In You?';

/** 展开区：为首个中短期卡片留出上内边距，避免父级 overflow-hidden 裁切圆角。 */
function MediumTermExpandedSection({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="space-y-2 border-t px-2.5 pb-3 pl-[2.75rem] pt-2"
      style={{ borderColor: 'var(--app-border)', background: 'color-mix(in srgb, var(--app-field) 40%, transparent)' }}
    >
      {children}
    </div>
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
  const [manageOpen, setManageOpen] = useState(false);
  const [investmentOpen, setInvestmentOpen] = useState(false);
  const [ganttOpen, setGanttOpen] = useState(false);
  const [scrollToGoalName, setScrollToGoalName] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [orderTick, setOrderTick] = useState(0);

  const goalNames = useMemo(
    () => mergeLongTermGoalNames(events),
    [events, metaMap, orderTick, collectionStateRevision]
  );

  useEffect(() => {
    setMetaMap(loadLongTermGoalMeta());
  }, [events, collectionStateRevision]);

  const handleCycleStatus = (goalName: string) => {
    setMetaMap((prev) => {
      const cur = getOrCreateRecord(prev, goalName);
      const nextStatus = cycleGoalStatus(cur.status);
      return setGoalStatus(prev, goalName, nextStatus);
    });
  };

  const handleAddGoal = () => {
    const title = pickUniqueNewVisionTitle(events, isZh);
    const map = loadLongTermGoalMeta();
    const next = ensureMetaForGoals(map, [title]);
    appendGoalTagPool(title);
    prependLongTermGoalDisplayOrder(title);
    setMetaMap(next);
    setScrollToGoalName(title);
    setOrderTick((t) => t + 1);
    setNewGlowIds((prev) => new Set(prev).add(title));
    window.setTimeout(() => {
      setNewGlowIds((prev) => {
        const n = new Set(prev);
        n.delete(title);
        return n;
      });
    }, 2800);
  };

  const handleReorderGoals = useCallback((ordered: string[]) => {
    saveLongTermGoalDisplayOrder(ordered);
    setOrderTick((t) => t + 1);
  }, []);

  const openManage = useCallback((goalName: string | null) => {
    setScrollToGoalName(goalName);
    setManageOpen(true);
  }, []);

  const toggleExpanded = (goal: string) => {
    setExpanded((prev) => ({ ...prev, [goal]: !prev[goal] }));
  };

  const summaryLine = (
    rec: ReturnType<typeof getOrCreateRecord>,
    lastAction: Date | null,
    days: number | null,
    isStale: boolean
  ) => {
    const parts: React.ReactNode[] = [];
    parts.push(
      <span key="la">
        {isZh ? '上次行动：' : 'Last Action: '}
        {lastAction ? format(lastAction, 'yyyy.MM.dd') : isZh ? '暂无' : 'None Yet'}
      </span>
    );
    if (rec.targetAt?.trim()) {
      parts.push(
        <span key="tc" className="tabular-nums shrink-0" style={{ color: 'var(--app-accent)' }}>
          {isZh ? ' · ' : ' · '}
          {formatTargetDateCountdown(rec.targetAt, isZh)}
        </span>
      );
    }
    if (lastAction != null && days != null) {
      parts.push(
        <span key="days" className="tabular-nums">
          {isStale ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setStaleOpen(true);
              }}
              className="underline-offset-2 hover:underline ml-0.5"
              style={{ color: 'var(--app-muted)', opacity: 0.55 }}
              aria-label={isZh ? '已久无相关日程，点击查看' : 'Long Since Last Action; Tap For A Gentle Note'}
            >
              {isZh ? `（${days} 天前）` : ` (${days} Day${days === 1 ? '' : 's'} Ago)`}
            </button>
          ) : (
            <span className="opacity-90 ml-0.5">
              {isZh ? `（${days} 天前）` : ` (${days} Day${days === 1 ? '' : 's'} Ago)`}
            </span>
          )}
        </span>
      );
    }
    return <span className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">{parts}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold flex items-center gap-2 min-w-0" style={{ color: 'var(--app-text)' }}>
          <Target className="w-4 h-4 shrink-0" style={{ color: 'var(--app-accent)' }} />
          {isZh ? '长期目标' : 'Long-Term Goals'}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setGanttOpen(true)}
            className="text-[11px] font-medium rounded-lg px-2 py-1 border border-border hover:bg-accent/10 transition-colors"
            style={{ color: 'var(--app-accent)' }}
          >
            {isZh ? '甘特图' : 'Gantt Chart'}
          </button>
          <button
            type="button"
            onClick={() => setInvestmentOpen(true)}
            className="text-[11px] font-medium rounded-lg px-2 py-1 border border-border hover:bg-accent/10 transition-colors"
            style={{ color: 'var(--app-accent)' }}
          >
            {isZh ? '投入分析' : 'Investment Analysis'}
          </button>
          <button
            type="button"
            onClick={() => openManage(null)}
            className="text-[11px] font-medium rounded-lg px-2 py-1 border border-border hover:bg-accent/10 transition-colors"
            style={{ color: 'var(--app-accent)' }}
          >
            {isZh ? '管理' : 'Manage'}
          </button>
        </div>
      </div>

      <AnalyticsManageModalShell
        isOpen={investmentOpen}
        onClose={() => setInvestmentOpen(false)}
        title={isZh ? '投入分析' : 'Investment Analysis'}
        scopeLine={
          isZh
            ? '按日程开始日是否落在中短期区间内统计；区间重叠时以列表顺序优先匹配。'
            : 'Counts By Event Start Date In Each Window; First Matching Row Wins If Intervals Overlap.'
        }
        language={language}
        panelMaxWidthClass="max-w-2xl"
      >
        <LongTermMediumTermInvestmentCard
          events={events}
          completedInstances={completedInstances}
          language={language}
          collectionStateRevision={collectionStateRevision}
          omitHeader
        />
      </AnalyticsManageModalShell>

      <AnalyticsManageModalShell
        isOpen={ganttOpen}
        onClose={() => setGanttOpen(false)}
        title={isZh ? '甘特图' : 'Gantt Chart'}
        scopeLine={
          isZh
            ? '横条为中短期区间，菱形为里程碑；悬停或聚焦可查看所属母目标。'
            : 'Bars Are Short-Term Windows; Diamonds Are Milestones. Hover Or Focus To See The Vision.'
        }
        language={language}
        panelMaxWidthClass="max-w-2xl"
      >
        <LongTermGoalsGanttContent
          events={events}
          language={language}
          collectionStateRevision={collectionStateRevision}
        />
      </AnalyticsManageModalShell>

      <LongTermGoalsManageModal
        isOpen={manageOpen}
        onClose={() => {
          setManageOpen(false);
          setScrollToGoalName(null);
        }}
        language={language}
        goalNames={goalNames}
        metaMap={metaMap}
        setMetaMap={setMetaMap}
        onRenameLongTermGoal={onRenameLongTermGoal}
        onDeleteLongTermGoal={onDeleteLongTermGoal}
        onAddGoal={handleAddGoal}
        onReorderGoals={handleReorderGoals}
        scrollToGoalName={scrollToGoalName}
      />

      {goalNames.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--app-muted)' }}>
          {isZh ? '点右上角「管理」添加新愿景，或在日程里关联长期目标。' : 'Tap "Manage" To Add A Vision, Or Link Goals When Adding Events.'}
        </p>
      ) : (
        <ul className="space-y-2">
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
              const isEx = !!expanded[goal];

              return (
                <motion.li
                  key={goal}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{
                    opacity: 1,
                    boxShadow: showGlow
                      ? '0 0 0 1px color-mix(in srgb, var(--app-accent) 35%, transparent), 0 0 24px color-mix(in srgb, var(--app-accent) 25%, transparent)'
                      : 'none',
                  }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                >
                  <div className="flex items-start gap-1.5 p-2.5">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(goal)}
                      className="shrink-0 mt-0.5 p-0.5 rounded hover:bg-field"
                      aria-expanded={isEx}
                      aria-label={isZh ? '展开或折叠详情' : 'Expand Or Collapse Details'}
                    >
                      <ChevronDown
                        className={cn('w-4 h-4 transition-transform', isEx && 'rotate-180')}
                        style={{ color: 'var(--app-muted)' }}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCycleStatus(goal);
                      }}
                      className="shrink-0 text-base leading-none mt-0.5 opacity-90 hover:opacity-100 transition-opacity"
                      style={{ filter: 'saturate(0.85)' }}
                      title={isZh ? '切换状态' : 'Cycle Status'}
                      aria-label={isZh ? '切换状态' : 'Cycle Status'}
                    >
                      {STATUS_EMOJI[rec.status]}
                    </button>
                    <div className="min-w-0 flex-1 space-y-1">
                      <button
                        type="button"
                        onClick={() => openManage(goal)}
                        className="w-full text-left text-xs font-semibold truncate hover:underline underline-offset-2"
                        style={{ color: 'var(--app-text)' }}
                      >
                        {goal}
                      </button>
                      <div className="text-[10px] leading-snug" style={{ color: 'var(--app-muted)' }}>
                        {summaryLine(rec, lastAction, days, isStale)}
                      </div>
                    </div>
                  </div>

                  {isEx && (
                    <MediumTermExpandedSection>
                      {(rec.mediumTermGoals ?? []).length === 0 ? (
                        <p className="text-[10px]" style={{ color: 'var(--app-muted)' }}>
                          {isZh ? '暂无' : 'None'}
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {(rec.mediumTermGoals ?? []).map((m) => (
                            <li
                              key={m.id}
                              className="text-[10px] rounded-lg border px-2 py-1.5 space-y-1"
                              style={{ borderColor: 'var(--app-border)' }}
                            >
                              <div className="font-medium" style={{ color: 'var(--app-text)' }}>
                                {m.title}
                              </div>
                              <div style={{ color: 'var(--app-muted)' }}>
                                {m.startAt} — {m.endAt}
                              </div>
                              {(m.milestones ?? []).length > 0 && (
                                <ul className="list-none space-y-0.5 pl-1 border-l border-dashed ml-0.5" style={{ borderColor: 'var(--app-border)' }}>
                                  {(m.milestones ?? []).map((ms) => (
                                    <li key={ms.id} style={{ color: 'var(--app-muted)' }}>
                                      [{ms.at}] {ms.text}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </MediumTermExpandedSection>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
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
