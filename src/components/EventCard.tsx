import React from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { CheckSquare, Square, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScheduleEvent } from '@/types';

interface EventCardProps {
  event: ScheduleEvent;
  onToggleComplete?: (id: string) => void;
  className?: string;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onToggleComplete, className }) => {
  const isTodo = event.type === 'todo';
  const isCompleted = event.completed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "group relative flex items-start gap-4 p-4 rounded-2xl transition-all duration-300 hover:shadow-md border border-transparent hover:border-slate-100 bg-white/60 backdrop-blur-sm",
        isCompleted && "opacity-60 grayscale",
        className
      )}
    >
      <div className="mt-1 shrink-0">
        {isTodo ? (
          <button
            onClick={() => onToggleComplete?.(event.id)}
            className="text-slate-400 hover:text-indigo-500 transition-colors"
          >
            {isCompleted ? (
              <CheckSquare className="w-5 h-5 text-indigo-500" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>
        ) : (
          <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <CalendarIcon className="w-3 h-3" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className={cn("font-medium text-slate-900 truncate", isCompleted && "line-through text-slate-500")}>
            {event.title}
          </h3>
          <div className="flex items-center text-xs text-slate-400 shrink-0">
            <Clock className="w-3 h-3 mr-1" />
            {format(new Date(event.startTime), 'h:mm a')}
          </div>
        </div>
        
        {event.description && (
          <p className="mt-1 text-sm text-slate-500 line-clamp-2 group-hover:line-clamp-none transition-all">
            {event.description}
          </p>
        )}
      </div>
      
      {/* Decorative accent based on type */}
      <div className={cn(
        "absolute left-0 top-4 bottom-4 w-1 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity",
        isTodo ? "bg-indigo-400" : "bg-emerald-400"
      )} />
    </motion.div>
  );
};
