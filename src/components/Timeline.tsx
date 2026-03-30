import React from 'react';
import { motion } from 'motion/react';
import { isBefore } from 'date-fns';
import { Plus, Calendar, CornerDownRight, Check, Coffee, Zap, Loader2, Users } from 'lucide-react';
import { ScheduleEvent, AppLanguage, TimeDisplayFormat } from '@/types';
import { formatEventClockForTimeline, formatEventDurationAfterTitle } from '@/lib/formatEventClock';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EventLabelChip } from '@/components/EventLabelChip';

// Mobile layout constants (kept in sync with left-[GUTTER_CENTER] on vertical line)
// Time col: w-14 = 3.5rem = 56px
// Gutter col: w-5 = 1.25rem = 20px
// Gutter center: 56 + 10 = 66px = 4.125rem

interface TimelineProps {
  events: ScheduleEvent[];
  onAddEvent: () => void;
  onEventClick: (event: ScheduleEvent) => void;
  onToggleComplete: (id: string) => void;
  language: AppLanguage;
  timeDisplay: TimeDisplayFormat;
  onGenerateSchedule?: (mode: 'chill' | 'productive') => void;
  generatingMode?: 'chill' | 'productive' | null;
  selectedFilterRole?: string | null;
  roleFilterMode?: 'all' | 'dim' | 'hide';
  getRoleColor?: (roleId: string) => string;
}

export const Timeline: React.FC<TimelineProps> = ({
  events,
  onAddEvent,
  onEventClick,
  onToggleComplete,
  language,
  timeDisplay,
  onGenerateSchedule,
  generatingMode,
  selectedFilterRole = null,
  roleFilterMode = 'dim',
  getRoleColor = ((_: string) => 'var(--app-accent)'),
}) => {
  const filteredEvents = React.useMemo(() => {
    if (!selectedFilterRole || roleFilterMode !== 'hide') return events;
    return events.filter((e) => e.role === selectedFilterRole);
  }, [events, selectedFilterRole, roleFilterMode]);

  const sortedEvents = [...filteredEvents].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  const getOverlapGroup = (event: ScheduleEvent, index: number, allEvents: ScheduleEvent[]) => {
    if (index === 0) return false;
    const prevEvent = allEvents[index - 1];
    const currentStart = new Date(event.startTime);
    const prevEnd = new Date(prevEvent.endTime);
    return isBefore(currentStart, prevEnd);
  };

  if (filteredEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-border shadow-sm min-h-[300px] bg-surface">
        <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mb-6">
          <Calendar className="w-8 h-8 text-accent" />
        </div>
        <h3 className="empty-state-title text-xl font-serif font-medium text-foreground mb-2">
          {language === 'zh' ? '暂无日程' : 'No events scheduled'}
        </h3>
        <p className="text-muted-foreground mb-8 max-w-xs text-sm">
          {language === 'zh' ? '时间不是被填满，而是被设计。' : 'Time is not to be filled, but to be designed.'}
        </p>
        {onGenerateSchedule && (
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[31.36rem] justify-center">
            <Button
              variant="outline"
              onClick={onAddEvent}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-surface hover:bg-accent/20 border-border text-foreground hover:text-accent hover:border-accent transition-all duration-300 group"
            >
              <Plus className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              {language === 'zh' ? '添加新日程' : 'Add New Event'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onGenerateSchedule('chill')}
              disabled={!!generatingMode}
              className="bg-surface hover:bg-accent/20 active:bg-accent/30 border-border text-foreground hover:text-accent hover:border-accent transition-all duration-300 group"
            >
              {generatingMode === 'chill' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Coffee className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              )}
              {language === 'zh' ? '设计清闲的一天' : 'Design a Chill Day'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onGenerateSchedule('productive')}
              disabled={!!generatingMode}
              className="bg-surface hover:bg-accent/20 active:bg-accent/30 border-border text-foreground hover:text-accent hover:border-accent transition-all duration-300 group"
            >
              {generatingMode === 'productive' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              )}
              {language === 'zh' ? '设计高效的一天' : 'Design a Productive Day'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    // Mobile: no left padding (time col is inline).  Desktop: pl-8 (original).
    <div className="relative pb-12 md:pl-8">
      {/*
        Vertical line
        Mobile:  center of gutter col = 56px (time) + 10px (half gutter) = 66px = 4.125rem
        Desktop: original left-3.5
      */}
      <div className="absolute top-0 bottom-0 w-0.5 rounded-full bg-border left-[4.125rem] md:left-3.5" />

      <div className="space-y-8">
        {sortedEvents.map((event, index) => {
          const isOverlap = getOverlapGroup(event, index, sortedEvents);
          const isMatchingRole = !selectedFilterRole || event.role === selectedFilterRole;
          const roleColor = event.role ? getRoleColor(event.role) : undefined;
          const dimmed = selectedFilterRole && roleFilterMode === 'dim' && !isMatchingRole;
          const startD = new Date(event.startTime);
          const endD = new Date(event.endTime);
          const durationAfterTitle = formatEventDurationAfterTitle(startD, endD, language);
          const parts = formatEventClockForTimeline(startD, timeDisplay);
          const is12hBlock = parts.line2 != null;
          const dotStyle =
            event.label?.color || roleColor
              ? { borderColor: event.label?.color || roleColor }
              : undefined;

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                // Mobile: flex row  |  Desktop: block relative (existing)
                'flex items-stretch md:block md:relative',
                // Desktop overlap shift
                isOverlap && 'md:ml-12 md:mt-[-3rem] md:z-10',
                // Mobile overlap: subtle top overlap
                isOverlap && 'max-md:mt-[-2rem] max-md:z-10',
                dimmed && 'opacity-50',
              )}
            >
              {/* ── Time column ─────────────────────────────────────── */}

              {/* Mobile: inline time cell (hidden for overlap rows) */}
              {!isOverlap ? (
                // Use relative container + absolute inner to replicate the same
                // top-[calc(1.25rem+0.25rem+0.625rem)] -translate-y-1/2 formula as desktop,
                // so the time text center aligns with the checkbox center.
                <div className="md:hidden shrink-0 w-14 relative">
                  <div
                    className={cn(
                      'absolute right-2 flex flex-col items-end',
                      'top-[calc(1.25rem+0.25rem+0.625rem)] -translate-y-1/2',
                      'text-xs font-medium text-muted-foreground overflow-visible',
                      is12hBlock ? 'gap-0.5' : 'gap-0',
                    )}
                  >
                    <span className={cn(!is12hBlock && 'leading-none')}>{parts.line1}</span>
                    {parts.line2 != null && (
                      <span className="text-[10px] opacity-70 leading-none">{parts.line2}</span>
                    )}
                  </div>
                </div>
              ) : (
                // Empty spacer keeps gutter + card aligned for overlap rows
                <div className="md:hidden shrink-0 w-14" />
              )}

              {/* Desktop: absolute time (original position) */}
              {!isOverlap && (
                <div
                  className={cn(
                    'hidden md:flex absolute -left-[100px] w-[60px] text-right text-xs font-medium text-muted-foreground overflow-visible translate-x-[1.6mm]',
                    'top-[calc(1.25rem+0.25rem+0.625rem)] -translate-y-1/2 flex-col items-end',
                    is12hBlock ? 'gap-0.5' : 'gap-0',
                  )}
                >
                  <span className={cn(!is12hBlock && 'leading-none')}>{parts.line1}</span>
                  {parts.line2 != null && (
                    <span className="text-[10px] opacity-70 leading-none">{parts.line2}</span>
                  )}
                </div>
              )}

              {/* ── Gutter column (dot / overlap indicator) ─────────── */}

              {/* Mobile gutter cell — sits over the vertical line */}
              {/* dot uses top-7 (28px) so its center lands at 34px, matching checkbox center */}
              <div className="md:hidden shrink-0 w-5 relative">
                {isOverlap ? (
                  <CornerDownRight className="absolute top-7 left-1/2 -translate-x-1/2 w-4 h-4 text-accent z-10" />
                ) : (
                  <div
                    className="absolute top-7 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-surface border-2 border-accent z-10 shadow-sm transition-colors"
                    style={dotStyle}
                  />
                )}
              </div>

              {/* Desktop dot / overlap indicator (original) */}
              {isOverlap ? (
                <div className="hidden md:flex absolute -left-[35px] top-7 w-6 h-6 items-center justify-center text-accent z-10">
                  <CornerDownRight className="w-5 h-5" />
                </div>
              ) : (
                <div
                  className="hidden md:block absolute -left-[29px] top-7 w-3 h-3 rounded-full bg-surface border-2 border-accent z-10 shadow-sm transition-colors"
                  style={dotStyle}
                />
              )}

              {/* ── Card column ──────────────────────────────────────── */}
              <div
                onClick={() => onEventClick(event)}
                className={cn(
                  'cursor-pointer transition-transform duration-300',
                  // Mobile: fill remaining width
                  'min-w-0 flex-1',
                  isOverlap && 'scale-[0.98] origin-top-left shadow-lg',
                )}
              >
                <div className="relative group bg-surface rounded-2xl p-5 shadow-sm border border-border hover:shadow-md transition-all">
                  <div className="flex items-start gap-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleComplete(event.id);
                      }}
                      className={cn(
                        'mt-1 w-5 h-5 border-2 flex items-center justify-center transition-colors flex-shrink-0',
                        event.type === 'meeting' ? 'rounded-[6px]' : 'rounded-full',
                        event.completed ? 'bg-accent border-accent text-white' : 'border-border hover:border-accent',
                      )}
                      style={
                        event.label?.color
                          ? event.completed
                            ? { backgroundColor: event.label.color, borderColor: event.label.color, color: '#fff' }
                            : { borderColor: event.label.color }
                          : undefined
                      }
                    >
                      {event.completed ? (
                        <Check className="w-3 h-3" />
                      ) : event.type === 'meeting' ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground group-hover:bg-emerald-600 transition-colors" />
                      ) : null}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <h3
                          className={cn(
                            'text-base font-medium text-foreground mb-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 md:text-lg',
                            event.completed && 'text-muted-foreground line-through',
                          )}
                        >
                          {event.type === 'meeting' && (
                            <Users
                              className={cn('w-4 h-4 flex-shrink-0', !event.label?.color && 'text-emerald-600 dark:text-emerald-400')}
                              style={event.label?.color ? { color: event.label.color } : undefined}
                            />
                          )}
                          <span className="truncate min-w-0">{event.title}</span>
                          <span className="text-xs font-serif font-normal text-muted-foreground shrink-0 tabular-nums md:text-sm">
                            {durationAfterTitle}
                          </span>
                        </h3>
                        <EventLabelChip
                          label={event.label}
                          className={cn(event.completed && 'opacity-60', 'max-md:text-[10px]')}
                        />
                      </div>
                      {event.description && (
                        <p className={cn('text-xs text-muted-foreground line-clamp-2 md:text-sm', event.completed && 'opacity-60')}>
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {isOverlap && (
                  <div
                    className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-12 rounded-full"
                    style={{ backgroundColor: event.label?.color ? `${event.label.color}55` : undefined }}
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Add another event ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: sortedEvents.length * 0.1 + 0.2 }}
        // Mobile: flex row matching event row structure.  Desktop: relative block.
        className="mt-8 flex items-center md:block md:relative"
      >
        {/* Mobile: spacer (time col width) */}
        <div className="md:hidden shrink-0 w-14" />
        {/* Mobile: gutter with dot */}
        <div className="md:hidden shrink-0 w-5 flex justify-center relative">
          <div className="absolute top-3 w-3 h-3 rounded-full bg-border z-10" />
        </div>
        {/* Desktop dot */}
        <div className="hidden md:block absolute -left-[29px] top-3 w-3 h-3 rounded-full bg-border z-10" />
        {/* Button: flex-1 on mobile, full width on desktop */}
        <div className="min-w-0 flex-1 md:block">
          <Button
            variant="outline"
            onClick={onAddEvent}
            className="w-full justify-start bg-surface hover:bg-accent/20 border-border text-foreground hover:text-accent hover:border-accent pl-4 h-auto py-3 rounded-xl transition-all duration-300 group"
          >
            <Plus className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
            {language === 'zh' ? '添加新日程' : 'Add another event'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
