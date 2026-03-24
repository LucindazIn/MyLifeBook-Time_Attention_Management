import { ScheduleEvent } from '@/types';
import { addDays, addWeeks, addMonths, isBefore, isSameDay, startOfDay, endOfDay, parseISO, format } from 'date-fns';

export const expandRecurringEvents = (events: ScheduleEvent[], startDate: Date, endDate: Date, completedInstances: Record<string, boolean> = {}): ScheduleEvent[] => {
  const expandedEvents: ScheduleEvent[] = [];

  events.forEach(event => {
    if (!event.recurrence) {
      // Non-recurring event
      const eventDate = new Date(event.startTime);
      if (eventDate >= startOfDay(startDate) && eventDate <= endOfDay(endDate)) {
        expandedEvents.push({
          ...event,
          completed: event.completed || completedInstances[event.id] || false,
        });
      }
      return;
    }

    // Recurring event
    const { frequency, interval, endDate: recurEndDate } = event.recurrence;
    let currentInstanceDate = new Date(event.startTime);
    const endLimit = recurEndDate ? new Date(recurEndDate) : endOfDay(endDate);
    const finalEndLimit = endLimit < endOfDay(endDate) ? endLimit : endOfDay(endDate);

    while (currentInstanceDate <= finalEndLimit) {
      if (currentInstanceDate >= startOfDay(startDate)) {
        const dateKey = format(currentInstanceDate, 'yyyy-MM-dd');
        const instanceId = `${event.id}_${dateKey}`;
        
        let newEndTime = undefined;
        if (event.endTime) {
          const duration = new Date(event.endTime).getTime() - new Date(event.startTime).getTime();
          newEndTime = new Date(currentInstanceDate.getTime() + duration).toISOString();
        }

        expandedEvents.push({
          ...event,
          id: instanceId,
          baseEventId: event.id,
          startTime: currentInstanceDate.toISOString(),
          endTime: newEndTime,
          completed: completedInstances[instanceId] || false,
        });
      }

      if (frequency === 'daily') {
        currentInstanceDate = addDays(currentInstanceDate, interval);
      } else if (frequency === 'weekly') {
        currentInstanceDate = addWeeks(currentInstanceDate, interval);
      } else if (frequency === 'monthly') {
        currentInstanceDate = addMonths(currentInstanceDate, interval);
      } else {
        break;
      }
    }
  });

  return expandedEvents;
};
