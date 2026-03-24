import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { BookMarked, Tag } from 'lucide-react';
import type { ScheduleEvent, AppLanguage } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { getChapterRange, type ChapterPeriodKey } from '@/lib/dateRange';
import { cn } from '@/lib/utils';

const THEME_RANGE_OPTIONS: ChapterPeriodKey[] = ['this_week', 'this_month'];

export interface ThemeTimelineCardProps {
  events: ScheduleEvent[];
  completedInstances: Record<string, boolean>;
  language: AppLanguage;
}

function getRangeLabel(period: ChapterPeriodKey, isZh: boolean): string {
  const labels: Record<ChapterPeriodKey, { zh: string; en: string }> = {
    this_week: { zh: '本周', en: 'This week' },
    last_week: { zh: '上周', en: 'Last week' },
    this_month: { zh: '本月', en: 'This month' },
    custom: { zh: '自定义', en: 'Custom' },
  };
  return isZh ? labels[period].zh : labels[period].en;
}

export const ThemeTimelineCard: React.FC<ThemeTimelineCardProps> = ({
  events,
  completedInstances,
  language,
}) => {
  const [range, setRange] = useState<ChapterPeriodKey>('this_week');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const isZh = language === 'zh';

  const availableTags = useMemo(() => {
    const list = events.flatMap((e) => e.tags ?? []).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [events]);

  const { start, end } = useMemo(() => getChapterRange(range), [range]);

  const expanded = useMemo(
    () => expandRecurringEvents(events, start, end, completedInstances),
    [events, start, end, completedInstances]
  );

  const filteredByTag = useMemo(() => {
    if (selectedTags.size === 0) return [];
    return expanded.filter((e) => e.tags?.some((t) => selectedTags.has(t)) ?? false);
  }, [expanded, selectedTags]);

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    filteredByTag.forEach((e) => {
      const key = format(new Date(e.startTime), 'yyyy-MM-dd');
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    });
    map.forEach((list) => list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredByTag]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
          <Tag className="w-4 h-4" style={{ color: 'var(--app-accent)' }} />
          {isZh ? '主题线' : 'Theme timeline'}
        </h3>
        <button
          type="button"
          className="text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors opacity-80 hover:opacity-100"
          style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
          title={isZh ? '后续接入 Life Book 共创' : 'For Life Book (coming soon)'}
        >
          <BookMarked className="w-3.5 h-3.5 inline-block mr-1.5 align-middle" />
          {isZh ? '加入我的 Life Book' : 'Add to Life Book'}
        </button>
      </div>

      <div className="flex gap-2">
        {THEME_RANGE_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={cn(
              'text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors',
              range === r
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border text-muted-foreground hover:bg-field'
            )}
          >
            {getRangeLabel(r, isZh)}
          </button>
        ))}
      </div>

      {availableTags.length > 0 ? (
        <>
          <p className="text-xs" style={{ color: 'var(--app-muted)' }}>
            {isZh ? '选择标签查看事件流' : 'Select tags to view events'}
          </p>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  'text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors',
                  selectedTags.has(tag)
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border text-muted-foreground hover:bg-field'
                )}
              >
                {tag}
              </button>
            ))}
          </div>

          {selectedTags.size > 0 ? (
            <div className="space-y-3 max-h-[280px] overflow-y-auto">
              {byDate.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: 'var(--app-muted)' }}>
                  {isZh ? '该时间范围内无匹配事件' : 'No matching events in this range'}
                </p>
              ) : (
                byDate.map(([dateKey, list]) => (
                  <div key={dateKey} className="space-y-1.5">
                    <p className="text-xs font-medium sticky top-0 py-1" style={{ color: 'var(--app-muted)', background: 'var(--app-surface)' }}>
                      {format(new Date(dateKey + 'T00:00:00'), isZh ? 'M月d日 EEE' : 'MMM d, EEE')}
                    </p>
                    <ul className="space-y-1">
                      {list.map((e) => (
                        <li
                          key={e.id}
                          className={cn(
                            'rounded-lg px-3 py-2 border text-left text-sm',
                            e.completed && 'opacity-80'
                          )}
                          style={{
                            background: 'var(--app-surface)',
                            borderColor: 'var(--app-border)',
                            color: 'var(--app-text)',
                          }}
                        >
                          <span className="font-medium">{e.title}</span>
                          <span className="text-[11px] ml-2" style={{ color: 'var(--app-muted)' }}>
                            {format(new Date(e.startTime), 'HH:mm')}
                            {e.completed ? ' ✓' : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          ) : (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--app-muted)' }}>
              {isZh ? '在上方选择至少一个标签' : 'Select at least one tag above'}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--app-muted)' }}>
          {isZh ? '为事件添加标签后，将在此按主题查看时间流' : 'Add tags to events to see theme timeline here'}
        </p>
      )}
    </div>
  );
};
