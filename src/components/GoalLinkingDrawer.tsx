import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Target, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AppLanguage, ScheduleEvent } from '@/types';
import type { LongTermGoalMetaMap } from '@/lib/longTermGoalMetaStorage';
import { getUnlinkedMediumTermGoalTasksInRange, type GoalLinkingFilterState } from '@/lib/goalLinkingQuery';
import { cn } from '@/lib/utils';
import { smartMatchGoal } from '@/lib/smartEventMatcher';

export interface MediumTermGoalLinkDraft {
  goalName: string;
  mediumTermGoalId: string;
}

interface GoalLinkingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: ScheduleEvent[];
  allEvents: ScheduleEvent[];
  goalNames: string[];
  metaMap: LongTermGoalMetaMap;
  anchorDate: Date;
  filters: GoalLinkingFilterState;
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
  onFiltersChange: (filters: GoalLinkingFilterState) => void;
  onSave: (links: Map<string, MediumTermGoalLinkDraft>) => Promise<void>;
  isSaving?: boolean;
}

function getEventPersistId(event: ScheduleEvent): string {
  return event.baseEventId || event.id;
}

export const GoalLinkingDrawer: React.FC<GoalLinkingDrawerProps> = ({
  isOpen,
  onClose,
  events,
  allEvents,
  goalNames,
  metaMap,
  anchorDate,
  filters,
  completedInstances,
  language,
  onFiltersChange,
  onSave,
  isSaving,
}) => {
  const [drafts, setDrafts] = useState<Map<string, MediumTermGoalLinkDraft>>(new Map());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const validMediumTermGoalIds = useMemo(() => {
    const ids = new Set<string>();
    for (const goalName of goalNames) {
      for (const medium of metaMap[goalName]?.mediumTermGoals ?? []) {
        ids.add(medium.id);
      }
    }
    return ids;
  }, [goalNames, metaMap]);

  const unlinkedTasks = useMemo(
    () => getUnlinkedMediumTermGoalTasksInRange(events, anchorDate, filters, completedInstances, validMediumTermGoalIds),
    [events, anchorDate, filters, completedInstances, validMediumTermGoalIds],
  );

  const uniqueTasks = useMemo(() => {
    const seen = new Set<string>();
    const items: { event: ScheduleEvent; persistId: string }[] = [];
    for (const event of unlinkedTasks) {
      const persistId = getEventPersistId(event);
      if (seen.has(persistId)) continue;
      seen.add(persistId);
      const base = allEvents.find(e => e.id === persistId) || event;
      items.push({ event: base, persistId });
    }
    return items;
  }, [allEvents, unlinkedTasks]);

  const optionTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const goalName of goalNames) {
      for (const medium of metaMap[goalName]?.mediumTermGoals ?? []) {
        map.set(medium.id, `${goalName} / ${medium.title}`);
      }
    }
    return map;
  }, [goalNames, metaMap]);

  const goalsWithMedium = useMemo(
    () => goalNames
      .map(goalName => ({ goalName, mediumTermGoals: metaMap[goalName]?.mediumTermGoals ?? [] }))
      .filter(group => group.mediumTermGoals.length > 0),
    [goalNames, metaMap],
  );

  useEffect(() => {
    if (!isOpen) return;
    setDrafts(new Map());
    setDraggingId(null);
    setSelectedTaskId(null);
  }, [isOpen]);

  const t = {
    title: language === 'zh' ? '目标整理' : 'Goal Linking',
    week: language === 'zh' ? '本周' : 'This week',
    month: language === 'zh' ? '本月' : 'This month',
    year: language === 'zh' ? '本年' : 'This year',
    custom: language === 'zh' ? '自定义' : 'Custom',
    to: language === 'zh' ? '止' : 'To',
    queue: language === 'zh' ? '未链接 Task' : 'Unlinked Tasks',
    goals: language === 'zh' ? '中短期目标' : 'Medium-Term Goals',
    dropHint: language === 'zh' ? '拖到这里链接' : 'Drop here to link',
    tapHint: language === 'zh' ? '或先选择左侧 Task，再点此关联' : 'Or select a task, then tap here',
    linkedTo: language === 'zh' ? '将链接到' : 'Will link to',
    selected: language === 'zh' ? '已选中' : 'Selected',
    linkSelected: language === 'zh' ? '关联已选 Task' : 'Link Selected Task',
    emptyTasks: language === 'zh' ? '这个时段没有未链接中短期目标的 task' : 'No tasks need goal linking in this range',
    emptyGoals: language === 'zh' ? '请先在时间聚合里为长期目标创建中短期目标' : 'Create medium-term goals in Time Synthesis first',
    save: language === 'zh' ? '保存链接' : 'Save links',
    cancel: language === 'zh' ? '取消' : 'Cancel',
    pending: (n: number) => language === 'zh' ? `待保存 ${n}` : `${n} pending`,
    smartMatch: language === 'zh' ? '智能匹配' : 'Smart Match',
    smartMatched: (n: number) => language === 'zh' ? `已智能匹配 ${n} 条，请确认后保存。` : `Smart Matched ${n} Tasks. Review And Save.`,
    smartNone: language === 'zh' ? '没有找到足够确定的智能匹配。' : 'No Confident Smart Matches Found.',
  };

  const handleDrop = (goalName: string, mediumTermGoalId: string) => {
    if (!draggingId) return;
    linkTaskToGoal(draggingId, goalName, mediumTermGoalId);
    setDraggingId(null);
  };

  const linkTaskToGoal = (persistId: string, goalName: string, mediumTermGoalId: string) => {
    setDrafts(prev => {
      const next = new Map(prev);
      next.set(persistId, { goalName, mediumTermGoalId });
      return next;
    });
    setSelectedTaskId(null);
  };

  const handleSmartMatch = () => {
    let count = 0;
    setDrafts(prev => {
      const next = new Map(prev);
      for (const { event, persistId } of uniqueTasks) {
        if (next.has(persistId)) continue;
        const match = smartMatchGoal(event, goalNames, metaMap);
        if (!match) continue;
        next.set(persistId, { goalName: match.goalName, mediumTermGoalId: match.mediumTermGoalId });
        count += 1;
      }
      return next;
    });
    window.setTimeout(() => {
      alert(count > 0 ? t.smartMatched(count) : t.smartNone);
    }, 0);
  };

  const handleSave = async () => {
    await onSave(drafts);
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
            className="fixed inset-0 bg-black/25 backdrop-blur-sm z-[60]"
            onClick={() => {
              if (!isSaving) onClose();
            }}
          />
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className="fixed inset-y-0 right-0 z-[70] w-full max-w-3xl bg-background shadow-2xl border-l border-border flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-serif font-bold text-foreground">{t.title}</h2>
                {drafts.size > 0 && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                    {t.pending(drafts.size)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="p-2 rounded-full hover:bg-field text-muted-foreground disabled:opacity-40 disabled:pointer-events-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 border-b border-border bg-surface/50">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSmartMatch}
                  disabled={isSaving || uniqueTasks.length === 0 || goalsWithMedium.length === 0}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors bg-accent/15 border-accent/40 text-accent disabled:opacity-45 disabled:pointer-events-none"
                >
                  {t.smartMatch}
                </button>
                {(['week', 'month', 'year'] as const).map(range => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => onFiltersChange({ range })}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      filters.range === range
                        ? 'bg-accent/15 border-accent/40 text-accent'
                        : 'bg-field border-border text-muted-foreground hover:bg-surface',
                    )}
                  >
                    {range === 'week' ? t.week : range === 'month' ? t.month : t.year}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, range: 'custom' })}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    filters.range === 'custom'
                      ? 'bg-accent/15 border-accent/40 text-accent'
                      : 'bg-field border-border text-muted-foreground hover:bg-surface',
                  )}
                >
                  {t.custom}
                </button>
              </div>

              {filters.range === 'custom' && (
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={filters.customStart || ''}
                    onChange={e => onFiltersChange({ ...filters, customStart: e.target.value, range: 'custom' })}
                    className="flex-1 rounded-xl border border-border bg-field px-2 py-1.5 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">{t.to}</span>
                  <input
                    type="date"
                    value={filters.customEnd || ''}
                    onChange={e => onFiltersChange({ ...filters, customEnd: e.target.value, range: 'custom' })}
                    className="flex-1 rounded-xl border border-border bg-field px-2 py-1.5 text-xs"
                  />
                </div>
              )}
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 md:grid-cols-[minmax(240px,0.9fr)_minmax(320px,1.1fr)]">
              <section className="min-h-0 rounded-2xl border border-border bg-surface/70 p-3">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.queue}</h3>
                <div className="space-y-2 overflow-y-auto pr-1 max-h-full">
                  {uniqueTasks.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">{t.emptyTasks}</p>
                  ) : (
                    uniqueTasks.map(({ event, persistId }) => {
                      const target = drafts.get(persistId);
                      return (
                        <button
                          type="button"
                          key={persistId}
                          draggable
                          aria-pressed={selectedTaskId === persistId}
                          onClick={() => setSelectedTaskId(current => current === persistId ? null : persistId)}
                          onDragStart={() => setDraggingId(persistId)}
                          onDragEnd={() => setDraggingId(null)}
                          className={cn(
                            'w-full cursor-grab rounded-xl border bg-background p-3 text-left shadow-sm transition-colors active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-accent/30',
                            target ? 'border-accent/40 bg-accent/10' : 'border-border hover:border-accent/30',
                            selectedTaskId === persistId && 'border-accent bg-accent/15',
                          )}
                        >
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(event.startTime), language === 'zh' ? 'M月d日 HH:mm' : 'MMM d, HH:mm', language === 'zh' ? { locale: zhCN } : undefined)}
                            {selectedTaskId === persistId && <span className="ml-1 text-accent">{t.selected}</span>}
                          </p>
                          <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                          {target && (
                            <p className="mt-1 text-[11px] text-accent">
                              {t.linkedTo} {optionTitleById.get(target.mediumTermGoalId)}
                            </p>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="min-h-0 rounded-2xl border border-border bg-surface/70 p-3">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.goals}</h3>
                <div className="space-y-3 overflow-y-auto pr-1 max-h-full">
                  {goalsWithMedium.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">{t.emptyGoals}</p>
                  ) : (
                    goalsWithMedium.map(({ goalName, mediumTermGoals }) => (
                      <div key={goalName} className="rounded-2xl border border-border bg-background/80 p-3">
                        <h4 className="mb-2 truncate font-serif text-base font-semibold text-foreground">{goalName}</h4>
                        <div className="space-y-2">
                          {mediumTermGoals.map(medium => (
                            <div
                              key={medium.id}
                              onDragOver={event => event.preventDefault()}
                              onDrop={() => handleDrop(goalName, medium.id)}
                              className={cn(
                                'rounded-xl border border-dashed px-3 py-3 transition-colors',
                                draggingId
                                  ? 'border-accent/60 bg-accent/10'
                                  : 'border-border bg-field',
                              )}
                            >
                              <p className="text-sm font-medium text-foreground">{medium.title}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                <span>{medium.startAt} - {medium.endAt} · {selectedTaskId ? t.tapHint : t.dropHint}</span>
                                {selectedTaskId && (
                                  <button
                                    type="button"
                                    onClick={() => linkTaskToGoal(selectedTaskId, goalName, medium.id)}
                                    className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-accent hover:bg-accent/20"
                                  >
                                    {t.linkSelected}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            {isSaving && (
              <div className="border-t border-border bg-accent/10 px-4 py-3 text-xs text-accent">
                <div className="flex items-center gap-2 font-medium">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {language === 'zh'
                    ? `正在保存 ${drafts.size} 条目标链接，请不要关闭窗口。`
                    : `Saving ${drafts.size} Goal Links. Please Keep This Window Open.`}
                </div>
              </div>
            )}

            <div className="flex gap-2 border-t border-border bg-surface/50 p-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="flex-1 rounded-xl">
                {t.cancel}
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving || drafts.size === 0}
                className="flex-1 rounded-xl bg-accent hover:bg-accent/90"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? (language === 'zh' ? '保存中...' : 'Saving...') : t.save}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
