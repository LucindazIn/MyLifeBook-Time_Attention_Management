import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, RefreshCw, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ScheduleEvent, AppLanguage } from '@/types';
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
}

export const ScheduleSuggestionModal: React.FC<ScheduleSuggestionModalProps> = ({
  isOpen,
  onClose,
  suggestions,
  onConfirm,
  onRegenerate,
  isRegenerating,
  mode,
  language
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[35.84rem] overflow-hidden border border-slate-100"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-serif font-bold text-slate-800">{labels.title}</h2>
                <p className="text-sm text-slate-500">{labels.subtitle}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-200/50">
                <X className="w-5 h-5 text-slate-400" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {suggestions.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  {labels.empty}
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((event) => {
                    const isSelected = selectedIds.includes(event.id);
                    return (
                      <div 
                        key={event.id}
                        onClick={() => toggleSelection(event.id)}
                        className={cn(
                          "relative p-4 rounded-xl border-2 transition-all cursor-pointer group hover:shadow-md",
                          isSelected 
                            ? "border-indigo-500 bg-indigo-50/30" 
                            : "border-slate-100 bg-white hover:border-indigo-200"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors",
                            isSelected 
                              ? "bg-indigo-500 border-indigo-500 text-white" 
                              : "border-slate-300 group-hover:border-indigo-400"
                          )}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                              <h3 className={cn(
                                "font-medium text-slate-800",
                                isSelected ? "text-indigo-900" : "text-slate-600"
                              )}>
                                {event.title}
                              </h3>
                              <div className="flex items-center text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                <Clock className="w-3 h-3 mr-1" />
                                {format(new Date(event.startTime), 'HH:mm')} - {event.endTime ? format(new Date(event.endTime), 'HH:mm') : ''}
                              </div>
                            </div>
                            {event.description && (
                              <p className="text-sm text-slate-500 line-clamp-2">
                                {event.description}
                              </p>
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
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center gap-4">
              <Button 
                variant="outline" 
                onClick={onRegenerate} 
                disabled={isRegenerating}
                className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isRegenerating && "animate-spin")} />
                {labels.regenerate}
              </Button>
              
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose} className="text-slate-500 hover:text-slate-700">
                  {labels.cancel}
                </Button>
                <Button 
                  onClick={handleConfirm} 
                  disabled={selectedIds.length === 0 || isRegenerating}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
                >
                  {labels.add} ({selectedIds.length})
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
