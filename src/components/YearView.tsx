import React from 'react';
import { format, setMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, startOfYear, endOfYear } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { ScheduleEvent } from '@/types';
import { expandRecurringEvents } from '@/lib/events';
import { AppLanguage } from '@/types';
import { DayVibes } from '@/lib/repositories/dayMetaRepo';

interface YearViewProps {
  currentDate: Date;
  onMonthSelect: (date: Date) => void;
  events: ScheduleEvent[];
  dayTags: Record<string, string>;
  completedInstances: Record<string, boolean>;
  selectedFilterTag: string | null;
  selectedFilterRole?: string | null;
  roleFilterMode?: 'all' | 'dim' | 'hide';
  getRoleColor?: (roleId: string) => string;
  highlightDates?: Set<string>;
  language: AppLanguage;
  dayVibes?: Record<string, DayVibes>;
}

const METRICS = [
  { key: 'energy' as const, labelZh: '能量', labelEn: 'Energy', icon: '⚡', colorHigh: 'bg-emerald-400', colorMid: 'bg-amber-400', colorLow: 'bg-slate-300' },
  { key: 'mood'   as const, labelZh: '心情', labelEn: 'Mood',   icon: '🙂', colorHigh: 'bg-rose-400',   colorMid: 'bg-rose-300',   colorLow: 'bg-slate-300' },
  { key: 'focus'  as const, labelZh: '专注', labelEn: 'Focus',  icon: '🎯', colorHigh: 'bg-indigo-400', colorMid: 'bg-indigo-300', colorLow: 'bg-slate-300' },
];

function metricColor(m: typeof METRICS[0], avg: number) {
  return avg >= 70 ? m.colorHigh : avg >= 40 ? m.colorMid : m.colorLow;
}

function computeAvgsForRange(days: Date[], dayVibes: Record<string, DayVibes>) {
  const sums = { energy: 0, mood: 0, focus: 0 };
  const counts = { energy: 0, mood: 0, focus: 0 };
  for (const day of days) {
    const dk = format(day, 'yyyy-MM-dd');
    const v = dayVibes[dk];
    if (!v) continue;
    for (const m of METRICS) {
      const val = v[m.key];
      if (val != null) { sums[m.key] += val; counts[m.key]++; }
    }
  }
  return {
    energy: counts.energy > 0 ? Math.round(sums.energy / counts.energy) : null,
    mood:   counts.mood   > 0 ? Math.round(sums.mood   / counts.mood)   : null,
    focus:  counts.focus  > 0 ? Math.round(sums.focus  / counts.focus)  : null,
  };
}

export const YearView: React.FC<YearViewProps> = ({
  currentDate, onMonthSelect, events, dayTags,
  completedInstances, selectedFilterTag, selectedFilterRole = null, roleFilterMode = 'dim', getRoleColor = (_: string) => 'var(--app-accent)',
  highlightDates, language, dayVibes = {}
}) => {
  const months = Array.from({ length: 12 }, (_, i) => i);
  const currentYear = currentDate.getFullYear();

  const expandedEvents = React.useMemo(() => {
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(currentDate);
    const raw = expandRecurringEvents(events, yearStart, yearEnd, completedInstances);
    if (selectedFilterRole && roleFilterMode === 'hide') {
      return raw.filter(e => e.role === selectedFilterRole);
    }
    return raw;
  }, [events, currentYear, completedInstances, selectedFilterRole, roleFilterMode]);

  const eventsByDate = React.useMemo(() => {
    const map: Record<string, ScheduleEvent[]> = {};
    expandedEvents.forEach(event => {
      const dateKey = format(new Date(event.startTime), 'yyyy-MM-dd');
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(event);
    });
    return map;
  }, [expandedEvents]);

  const getEventsForMonth = (date: Date) =>
    expandedEvents.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.getMonth() === date.getMonth() && eventDate.getFullYear() === date.getFullYear();
    });

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 lg:gap-5">
        {months.map((monthIndex) => {
          const monthDate = setMonth(new Date(currentYear, 0, 1), monthIndex);
          const monthStart = startOfMonth(monthDate);
          const monthEnd = endOfMonth(monthStart);
          const startDate = startOfWeek(monthStart);
          const endDate = endOfWeek(monthEnd);

          const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
          const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

          const monthEvents = getEventsForMonth(monthDate);
          const hasMatchingRole = selectedFilterRole && monthEvents.some(e => e.role === selectedFilterRole);
          const roleColor = selectedFilterRole ? getRoleColor(selectedFilterRole) : undefined;
          const hasEvents = monthEvents.length > 0;
          const isCurrentMonth = isSameMonth(new Date(), monthDate);
          const monthAvgs = computeAvgsForRange(monthDays, dayVibes);
          const hasMonthAvg = monthAvgs.energy != null || monthAvgs.mood != null || monthAvgs.focus != null;

          return (
            <motion.button
              key={monthIndex}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onMonthSelect(monthDate)}
              className={cn(
                "bg-surface rounded-2xl p-3 border border-border shadow-sm hover:shadow-md transition-all text-left flex flex-col h-full",
                isCurrentMonth && "ring-2 ring-accent",
                selectedFilterRole && roleFilterMode === 'dim' && hasEvents && !hasMatchingRole && "opacity-50"
              )}
              style={
                selectedFilterRole && hasMatchingRole && roleColor
                  ? { boxShadow: `inset 0 0 0 2px ${roleColor}` }
                  : undefined
              }
            >
              <div className="flex justify-between items-center mb-1.5 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-medium text-foreground text-sm truncate">
                    {format(monthDate, language === 'zh' ? 'M月' : 'MMM', language === 'zh' ? { locale: zhCN } : undefined)}
                  </h3>
                  {hasEvents && (
                    <span className="text-[10px] font-bold text-accent bg-accent/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {monthEvents.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {METRICS.map(m => {
                    const avg = monthAvgs[m.key];
                    return (
                      <span key={m.key} className="flex items-center gap-0.5 text-[10px] text-foreground" title={`${language === 'zh' ? m.labelZh : m.labelEn}: ${avg ?? '—'}/100`}>
                        <span>{m.icon}</span>
                        <span className="tabular-nums font-medium">{avg != null ? avg : '—'}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Mini Calendar Grid */}
              <div className="grid grid-cols-7 gap-0.5 mt-auto">
                {calendarDays.map((day, idx) => {
                  const isDayInMonth = isSameMonth(day, monthDate);
                  const isDayToday = isToday(day);
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayEvents = eventsByDate[dateKey] || [];
                  const dayHasEvents = dayEvents.length > 0;
                  const dayTag = dayTags[dateKey];
                  const isHighlighted = !!highlightDates?.has(dateKey);

                  const isMatched = selectedFilterTag && dayTag === selectedFilterTag;
                  const isFilteredOut = selectedFilterTag && dayTag !== selectedFilterTag;

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "w-full pt-[100%] relative rounded-full transition-all",
                        dayHasEvents && isDayInMonth && !selectedFilterTag && "bg-accent/20",
                        isMatched && isDayInMonth && "ring-2 ring-accent/80 bg-accent/20",
                        isHighlighted && isDayInMonth && !isMatched && "ring-2 ring-amber-400/80",
                        isFilteredOut && "opacity-20 grayscale"
                      )}
                    >
                      <span className={cn(
                        "absolute inset-0 flex items-center justify-center text-[8px]",
                        !isDayInMonth && "opacity-0",
                        isDayInMonth && isDayToday ? "text-amber-500 font-bold" : "text-muted-foreground",
                        isMatched && isDayInMonth && "text-accent font-medium",
                        isHighlighted && isDayInMonth && !isMatched && "text-amber-600 dark:text-amber-400 font-medium"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {dayTag && isDayInMonth && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full" />
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
