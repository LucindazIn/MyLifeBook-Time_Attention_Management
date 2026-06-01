import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScheduleEvent } from '@/types';
import { fetchAll } from '@/lib/repositories/supabase/paging';

export type DbEventRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  type: string;
  recurrence: any | null;
  label_text: string | null;
  label_color: string | null;
  role: string | null;
  medium_term_goal_id: string | null;
  completed: boolean | null;
  deleted: boolean | null;
  meaning?: string | null;
  starred?: boolean | null;
  highlight?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

export type DbEventTagRow = {
  id?: string;
  user_id: string;
  event_id: string;
  tag: string;
  deleted?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

const LONGTERM_PREFIX = 'longterm:';

function toScheduleEvent(row: DbEventRow, tags: string[], longTermGoals: string[]): ScheduleEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    type: row.type as any,
    completed: row.completed ?? false,
    recurrence: row.recurrence ?? undefined,
    tags,
    ...(row.label_text && row.label_color ? { label: { text: row.label_text, color: row.label_color } } : {}),
    ...(row.role != null && row.role !== '' ? { role: row.role } : {}),
    ...(row.meaning != null && row.meaning !== '' ? { meaning: row.meaning } : {}),
    starred: row.starred ?? false,
    highlight: row.highlight ?? false,
    ...(longTermGoals.length > 0 ? { longTermGoals } : {}),
    ...(row.medium_term_goal_id != null && row.medium_term_goal_id !== '' ? { mediumTermGoalId: row.medium_term_goal_id } : {}),
  };
}

function normalizeTag(tag: string) {
  return tag.trim();
}

function isMissingMediumTermGoalColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = String((error as { message?: unknown }).message ?? '');
  return /medium_term_goal_id/i.test(message) && /schema cache|column/i.test(message);
}

export async function listAllEventsWithTags(supabase: SupabaseClient, userId: string): Promise<ScheduleEvent[]> {
  const events = await fetchAll<DbEventRow>((from, to) =>
    supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .range(from, to)
  );

  const tagRows = await fetchAll<DbEventTagRow>((from, to) =>
    supabase
      .from('event_tags')
      .select('user_id,event_id,tag,deleted')
      .eq('user_id', userId)
      .range(from, to)
  );

  const tagsByEventId: Record<string, string[]> = {};
  const longTermGoalsByEventId: Record<string, string[]> = {};
  for (const tr of tagRows) {
    if (tr.deleted) continue;
    const t = normalizeTag(tr.tag);
    if (!t) continue;
    if (t.startsWith(LONGTERM_PREFIX)) {
      const goal = t.slice(LONGTERM_PREFIX.length).trim();
      if (goal) (longTermGoalsByEventId[tr.event_id] ||= []).push(goal);
    } else {
      (tagsByEventId[tr.event_id] ||= []).push(t);
    }
  }

  return events
    .filter(e => !e.deleted)
    .map(e => toScheduleEvent(e, tagsByEventId[e.id] || [], longTermGoalsByEventId[e.id] || []));
}

export type UpsertEventWithTagsOptions = {
  /**
   * New events have no prior `event_tags` rows; skip the "mark all deleted" UPDATE
   * to save one network round trip (common case: create with no tags).
   */
  isNewEvent?: boolean;
};

export async function upsertEventWithTags(
  supabase: SupabaseClient,
  userId: string,
  event: ScheduleEvent,
  options?: UpsertEventWithTagsOptions
): Promise<void> {
  const payload: Partial<DbEventRow> = {
    id: event.id,
    user_id: userId,
    title: event.title,
    description: event.description ?? null,
    start_time: event.startTime,
    end_time: event.endTime ?? null,
    type: event.type,
    recurrence: event.recurrence ?? null,
    label_text: event.label?.text ?? null,
    label_color: event.label?.color ?? null,
    role: event.role ?? null,
    medium_term_goal_id: event.mediumTermGoalId ?? null,
    completed: event.completed ?? false,
    deleted: false,
    meaning: event.meaning ?? null,
    starred: event.starred ?? false,
    highlight: event.highlight ?? false,
  };

  let { error: upsertErr } = await supabase.from('events').upsert(payload, { onConflict: 'id' });
  if (upsertErr && isMissingMediumTermGoalColumnError(upsertErr)) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.medium_term_goal_id;
    const retry = await supabase.from('events').upsert(fallbackPayload, { onConflict: 'id' });
    upsertErr = retry.error;
  }
  if (upsertErr) throw upsertErr;

  const tags = Array.from(new Set((event.tags || []).map(normalizeTag).filter(Boolean)));
  const longTermGoals = Array.from(new Set((event.longTermGoals || []).map(normalizeTag).filter(Boolean)));
  const tagRows: DbEventTagRow[] = [
    ...tags.map(tag => ({ user_id: userId, event_id: event.id, tag, deleted: false })),
    ...longTermGoals.map(g => ({ user_id: userId, event_id: event.id, tag: LONGTERM_PREFIX + g, deleted: false })),
  ];

  if (options?.isNewEvent) {
    if (tagRows.length === 0) return;
    const { error: tagsErr } = await supabase.from('event_tags').upsert(tagRows, { onConflict: 'user_id,event_id,tag' });
    if (tagsErr) throw tagsErr;
    return;
  }

  // Edit flow: mark all existing tags deleted, then upsert the current set.
  const { error: markDelErr } = await supabase
    .from('event_tags')
    .update({ deleted: true })
    .eq('user_id', userId)
    .eq('event_id', event.id);
  if (markDelErr) throw markDelErr;

  if (tagRows.length === 0) return;

  const { error: tagsErr } = await supabase.from('event_tags').upsert(tagRows, { onConflict: 'user_id,event_id,tag' });
  if (tagsErr) throw tagsErr;
}

export async function softDeleteEvent(supabase: SupabaseClient, userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({ deleted: true })
    .eq('user_id', userId)
    .eq('id', eventId);
  if (error) throw error;
}

