import type { ScheduleEvent } from '@/types';

export function collectRoleIdsFromEvents(events: ScheduleEvent[]): string[] {
  const s = new Set<string>();
  for (const e of events) {
    if (e.role) s.add(e.role);
  }
  return [...s].sort((a, b) => a.localeCompare(b));
}

export function collectAllEventLabelTags(events: ScheduleEvent[]): string[] {
  const s = new Set<string>();
  for (const e of events) {
    const lt = e.label?.text?.trim();
    if (lt) s.add(lt);
    e.tags?.forEach((t) => {
      const x = t?.trim();
      if (x) s.add(x);
    });
  }
  return [...s].sort((a, b) => a.localeCompare(b));
}

export function eventTouchesTag(e: ScheduleEvent, tag: string): boolean {
  const t = tag.trim();
  if (!t) return false;
  if (e.label?.text?.trim() === t) return true;
  return e.tags?.some((x) => x?.trim() === t) ?? false;
}

export function countEventsWithRole(events: ScheduleEvent[], roleId: string): number {
  return events.filter((e) => e.role === roleId).length;
}

export function filterEventsWithRole(events: ScheduleEvent[], roleId: string): ScheduleEvent[] {
  return events.filter((e) => e.role === roleId);
}

export function countEventsWithTag(events: ScheduleEvent[], tag: string): number {
  return events.filter((e) => eventTouchesTag(e, tag)).length;
}

export function filterEventsWithTag(events: ScheduleEvent[], tag: string): ScheduleEvent[] {
  return events.filter((e) => eventTouchesTag(e, tag));
}

/** 日程 `longTermGoals[]` 中去重后的长期目标名称数量（单个子集）。 */
export function countDistinctLongTermGoals(events: ScheduleEvent[]): number {
  const s = new Set<string>();
  for (const e of events) {
    for (const g of e.longTermGoals ?? []) {
      const t = g?.trim();
      if (t) s.add(t);
    }
  }
  return s.size;
}

export function countDistinctLongTermGoalsForRole(events: ScheduleEvent[], roleId: string): number {
  return countDistinctLongTermGoals(filterEventsWithRole(events, roleId));
}

export function countDistinctLongTermGoalsForTag(events: ScheduleEvent[], tag: string): number {
  return countDistinctLongTermGoals(filterEventsWithTag(events, tag));
}

export function applyTagRenameToEvent(e: ScheduleEvent, oldTag: string, newTag: string): ScheduleEvent {
  const o = oldTag.trim();
  const n = newTag.trim();
  if (!o || !n) return e;
  let label: ScheduleEvent['label'] = e.label;
  if (label?.text?.trim() === o) {
    label = { text: n, color: label.color };
  }
  let tags = e.tags ? [...e.tags] : undefined;
  if (tags) {
    tags = [...new Set(tags.map((t) => (t?.trim() === o ? n : t)))];
    if (tags.length === 0) tags = undefined;
  }
  const next: ScheduleEvent = { ...e };
  if (label !== undefined) next.label = label;
  else delete next.label;
  if (tags !== undefined && tags.length > 0) next.tags = tags;
  else delete next.tags;
  return next;
}

export function stripTagFromEvent(e: ScheduleEvent, tag: string): ScheduleEvent {
  const t = tag.trim();
  if (!t) return e;
  let label = e.label;
  if (label?.text?.trim() === t) {
    label = undefined;
  }
  let tags = e.tags?.filter((x) => x?.trim() !== t);
  if (tags && tags.length === 0) tags = undefined;
  const next: ScheduleEvent = { ...e };
  if (label !== undefined) next.label = label;
  else delete next.label;
  if (tags !== undefined) next.tags = tags;
  else delete next.tags;
  return next;
}
