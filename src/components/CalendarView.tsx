import React from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  getISOWeek
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { ScheduleEvent, AppLanguage } from '@/types';
import { DayVibes } from '@/lib/repositories/dayMetaRepo';
import { expandRecurringEvents } from '@/lib/events';

interface CalendarViewProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  events: ScheduleEvent[];
  dayNames: Record<string, { name: string; isManual: boolean }>;
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
  { key: 'energy' as const, labelZh: '能量', labelEn: 'Energy', iconSrc: '/vibes/energy-high.svg', colorHigh: 'bg-emerald-400', colorMid: 'bg-amber-400', colorLow: 'bg-slate-300' },
  { key: 'mood'   as const, labelZh: '心情', labelEn: 'Mood',   iconSrc: '/vibes/mood-happy.svg', colorHigh: 'bg-rose-400',   colorMid: 'bg-rose-300',   colorLow: 'bg-slate-300' },
  { key: 'focus'  as const, labelZh: '专注', labelEn: 'Focus',  iconSrc: '/vibes/focus-focused.svg', colorHigh: 'bg-indigo-400', colorMid: 'bg-indigo-300', colorLow: 'bg-slate-300' },
];

function metricColor(m: typeof METRICS[0], avg: number) {
  return avg >= 70 ? m.colorHigh : avg >= 40 ? m.colorMid : m.colorLow;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  currentDate, onDateSelect, events,
  dayNames, dayTags, completedInstances, selectedFilterTag,
  selectedFilterRole = null, roleFilterMode = 'dim', getRoleColor = (_: string) => 'var(--app-accent)',
  highlightDates, language, dayVibes = {}
}) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = language === 'zh'
    ? ['日', '一', '二', '三', '四', '五', '六']
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Monthly averages (all 3 metrics)
  const monthlyAvgs = React.useMemo(() => {
    const sums = { energy: 0, mood: 0, focus: 0 };
    const counts = { energy: 0, mood: 0, focus: 0 };
    for (const day of eachDayOfInterval({ start: monthStart, end: monthEnd })) {
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
  }, [currentDate, dayVibes]);

  // Weekly averages (all 3 metrics), one entry per ISO week
  const weeklyAvgs = React.useMemo(() => {
    const weekMap = new Map<number, {
      wk: number;
      sums: { energy: number; mood: number; focus: number };
      counts: { energy: number; mood: number; focus: number };
      firstDay: Date;
    }>();

    for (const day of calendarDays) {
      if (!isSameMonth(day, monthStart)) continue;
      const wk = getISOWeek(day);
      if (!weekMap.has(wk)) {
        weekMap.set(wk, { wk, sums: { energy: 0, mood: 0, focus: 0 }, counts: { energy: 0, mood: 0, focus: 0 }, firstDay: day });
      }
      const entry = weekMap.get(wk)!;
      const dk = format(day, 'yyyy-MM-dd');
      const v = dayVibes[dk];
      if (!v) continue;
      for (const m of METRICS) {
        const val = v[m.key];
        if (val != null) { entry.sums[m.key] += val; entry.counts[m.key]++; }
      }
    }

    return Array.from(weekMap.values()).map(({ wk, sums, counts, firstDay }) => ({
      wk,
      label: language === 'zh' ? `第${wk}周` : `W${wk}`,
      weekStart: firstDay,
      energy: counts.energy > 0 ? Math.round(sums.energy / counts.energy) : null,
      mood:   counts.mood   > 0 ? Math.round(sums.mood   / counts.mood)   : null,
      focus:  counts.focus  > 0 ? Math.round(sums.focus  / counts.focus)  : null,
    }));
  }, [currentDate, dayVibes, language]);

  const expandedEvents = React.useMemo(() => {
    const raw = expandRecurringEvents(events, startDate, endDate, completedInstances);
    if (selectedFilterRole && roleFilterMode === 'hide') {
      return raw.filter(e => e.role === selectedFilterRole);
    }
    return raw;
  }, [events, currentDate, completedInstances, selectedFilterRole, roleFilterMode]);

  const getEventsForDay = (day: Date) =>
    expandedEvents.filter(event => isSameDay(new Date(event.startTime), day));

  const hasAnyWeeklyData = weeklyAvgs.some(w => w.energy != null || w.mood != null || w.focus != null);

  // Chunk calendar days into week rows (each row = 7 days)
  const weekRows = React.useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      rows.push(calendarDays.slice(i, i + 7));
    }
    return rows;
  }, [calendarDays]);

  return (
    <div className="w-full rounded-[2rem] p-5 md:p-6 shadow-xl border border-border min-h-[200px]" style={{ background: 'var(--app-surface)' }}>
      {/* Calendar grid: 7 days + 1 metrics column (after Saturday). Month title is in App header. */}
      <div className="grid grid-cols-[repeat(7,1fr)_auto] gap-x-1 gap-y-1 items-start">
        {weekDays.map(day => (
          <div key={day} className="text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider py-1.5">
            {day}
          </div>
        ))}
        <div className="min-w-[4rem]" />

        {weekRows.map((rowDays, rowIndex) => (
          <React.Fragment key={rowIndex}>
            {rowDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const eventCount = dayEvents.length;
              const isSelected = isSameDay(day, currentDate);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isTodayDate = isToday(day);
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayName = dayNames[dateKey]?.name;
              const dayTag = dayTags[dateKey];
              const isHighlighted = !!highlightDates?.has(dateKey);
              const isFilteredOut = selectedFilterTag && dayTag !== selectedFilterTag;
              const dayHasMatchingRole = selectedFilterRole && getEventsForDay(day).some(e => e.role === selectedFilterRole);
              const roleColor = selectedFilterRole ? getRoleColor(selectedFilterRole) : undefined;

              return (
                <motion.button
                  key={day.toString()}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onDateSelect(day)}
                  className={cn(
                    "relative h-20 rounded-xl flex flex-col items-start justify-start p-1.5 transition-all text-left group overflow-hidden",
                    !isCurrentMonth && "opacity-30",
                    isCurrentMonth && "bg-field hover:bg-surface",
                    isSelected && "ring-2 ring-accent bg-surface",
                    !isSelected && isTodayDate && "bg-amber-500/20",
                    !isSelected && isHighlighted && "ring-2 ring-amber-400/80",
                    isFilteredOut && "opacity-20 grayscale hover:opacity-40",
                    selectedFilterRole && roleFilterMode === 'dim' && isCurrentMonth && !dayHasMatchingRole && eventCount > 0 && "opacity-50"
                  )}
                  style={
                    selectedFilterRole && dayHasMatchingRole && roleColor
                      ? { boxShadow: `inset 0 0 0 2px ${roleColor}` }
                      : undefined
                  }
                >
                  <div className="flex w-full justify-between items-start">
                    <span className={cn(
                      "text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full",
                      isTodayDate ? "bg-amber-400 text-foreground" : "text-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {dayTag && <span className="text-[10px]">{dayTag}</span>}
                      {eventCount > 0 && (
                        <span className="text-[9px] font-bold text-accent bg-accent/20 px-1 py-0.5 rounded-full leading-none">
                          {eventCount}
                        </span>
                      )}
                    </div>
                  </div>
                  {dayName && (
                    <div className="mt-0.5 w-full">
                      <p className="text-[9px] leading-tight font-serif text-muted-foreground line-clamp-2 italic opacity-80 group-hover:opacity-100">
                        {dayName}
                      </p>
                    </div>
                  )}
                </motion.button>
              );
            })}
            <div className="flex items-center justify-center gap-2 pl-2 h-20 min-w-[4rem]">
              {(() => {
                const saturday = rowDays[6];
                const weekNum = getISOWeek(saturday);
                const weekData = hasAnyWeeklyData ? weeklyAvgs.find(w => w.wk === weekNum) : null;
                return weekData ? (
                  METRICS.map(m => {
                    const avg = weekData[m.key];
                    return (
                      <span key={m.key} className="flex items-center gap-0.5 text-[10px] text-foreground" title={`${language === 'zh' ? m.labelZh : m.labelEn}: ${avg ?? '—'}/100`}>
                        <img src={m.iconSrc} alt="" className="w-4 h-4 flex-shrink-0" />
                        <span className="tabular-nums font-medium">{avg != null ? avg : '—'}</span>
                      </span>
                    );
                  })
                ) : (
                  METRICS.map(m => (
                    <span key={m.key} className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <img src={m.iconSrc} alt="" className="w-4 h-4 flex-shrink-0" />
                      <span className="tabular-nums">—</span>
                    </span>
                  ))
                );
              })()}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
