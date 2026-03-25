import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScheduleEvent, AppLanguage, TimeDisplayFormat } from '@/types';
import { formatEventClockLine } from '@/lib/formatEventClock';
import { cn } from '@/lib/utils';

interface ScheduleSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: ScheduleEvent[];
  onConfirm: (selectedEvents: ScheduleEvent[]) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  mode: 'chill' | 'productive' | null;
  language: AppLanguage;
  timeDisplay: TimeDisplayFormat;
}

export const ScheduleSuggestionModal: React.FC<ScheduleSuggestionModalProps> = ({
  isOpen,
  onClose,
  suggestions,
  onConfirm,
  onRegenerate,
  isRegenerating,
  mode,
  language,
  timeDisplay,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Initialize selection when suggestions change
  React.useEffect(() => {
    if (suggestions.length > 0) {
      setSelectedIds(suggestions.map(s => s.id));
    }
  }, [suggestions]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    const selectedEvents = suggestions.filter(s => selectedIds.includes(s.id));
    onConfirm(selectedEvents);
  };

  const labels = {
    title: language === 'zh' 
      ? (mode === 'chill' ? '清闲的一天' : '高效的一天') 
      : (mode === 'chill' ? 'A Chill Day' : 'A Productive Day'),
    subtitle: language === 'zh' 
      ? '选择您想要添加的日程' 
      : 'Select the events you want to add',
    regenerate: language === 'zh' ? '重新生成' : 'Regenerate',
    add: language === 'zh' ? '添加到日程' : 'Add to Schedule',
    cancel: language === 'zh' ? '取消' : 'Cancel',
    empty: language === 'zh' ? '没有生成建议' : 'No suggestions generated'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-[35.84rem] rounded-[2rem] shadow-2xl p-0 pointer-events-auto border overflow-hidden flex flex-col max-h-[90vh]"
              style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
            >
              {/* Header — align with AddEventModal */}
              <div className="p-6 pb-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--app-border)' }}>
                <div>
                  <h2 className="text-xl font-serif font-bold" style={{ color: 'var(--app-text)' }}>
                    {labels.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{labels.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-full transition-colors hover:bg-field"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {suggestions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">{labels.empty}</div>
                ) : (
                  <div className="space-y-3">
                    {suggestions.map((event) => {
                      const isSelected = selectedIds.includes(event.id);
                      return (
                        <div
                          key={event.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleSelection(event.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleSelection(event.id);
                            }
                          }}
                          className={cn(
                            'relative p-4 rounded-xl border-2 transition-all cursor-pointer group hover:shadow-md',
                            isSelected
                              ? 'border-accent bg-accent/20 ring-1 ring-accent'
                              : 'border-border bg-field hover:border-accent'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                'w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors',
                                isSelected
                                  ? 'bg-accent border-accent text-primary-foreground'
                                  : 'border-border group-hover:border-accent'
                              )}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-3 mb-1">
                                <h3
                                  className={cn(
                                    'flex-1 min-w-0 font-medium pr-1 text-foreground',
                                    isSelected && 'text-accent'
                                  )}
                                >
                                  {event.title}
                                </h3>
                                <div className="shrink-0 whitespace-nowrap inline-flex items-center text-xs font-medium tabular-nums text-muted-foreground bg-field border border-border px-2.5 py-1 rounded-md">
                                  <Clock className="w-3 h-3 mr-1 shrink-0" />
                                  {formatEventClockLine(new Date(event.startTime), timeDisplay)} –{' '}
                                  {event.endTime ? formatEventClockLine(new Date(event.endTime), timeDisplay) : ''}
                                </div>
                              </div>
                              {event.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                className="p-6 border-t flex flex-wrap justify-between items-center gap-4 bg-field/50"
                style={{ borderColor: 'var(--app-border)' }}
              >
                <Button
                  variant="outline"
                  onClick={onRegenerate}
                  disabled={isRegenerating}
                  className="border-border text-foreground hover:bg-field hover:text-accent"
                >
                  <RefreshCw className={cn('w-4 h-4 mr-2', isRegenerating && 'animate-spin')} />
                  {labels.regenerate}
                </Button>

                <div className="flex gap-2">
                  <Button variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
                    {labels.cancel}
                  </Button>
                  <Button onClick={handleConfirm} disabled={selectedIds.length === 0 || isRegenerating}>
                    {labels.add} ({selectedIds.length})
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
