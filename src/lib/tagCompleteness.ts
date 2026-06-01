import type { ScheduleEvent } from '@/types';

export type TagField = 'role' | 'eventTag';

export function hasEventTag(event: ScheduleEvent): boolean {
  if (event.label?.text?.trim()) return true;
  return event.tags?.some((t) => t?.trim()) ?? false;
}

export function getMissingTagFields(event: ScheduleEvent): TagField[] {
  const missing: TagField[] = [];
  if (!event.role?.trim()) missing.push('role');
  if (!hasEventTag(event)) missing.push('eventTag');
  return missing;
}

export function isEventUntagged(event: ScheduleEvent): boolean {
  return getMissingTagFields(event).length > 0;
}

export function getEventPersistId(event: ScheduleEvent): string {
  return event.baseEventId || event.id;
}
