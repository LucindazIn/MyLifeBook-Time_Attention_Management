import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAll } from '@/lib/repositories/supabase/paging';

export type DbCompletionRow = {
  id?: string;
  user_id: string;
  event_id: string;
  instance_date: string; // YYYY-MM-DD
  completed: boolean;
  deleted?: boolean | null;
  updated_at?: string;
};

export async function listAllCompletions(supabase: SupabaseClient, userId: string): Promise<Record<string, boolean>> {
  const rows = await fetchAll<DbCompletionRow>((from, to) =>
    supabase
      .from('event_instance_completions')
      .select('event_id,instance_date,completed,deleted')
      .eq('user_id', userId)
      .range(from, to)
  );

  const out: Record<string, boolean> = {};
  for (const r of rows) {
    if (r.deleted) continue;
    const key = `${r.event_id}_${r.instance_date}`;
    out[key] = !!r.completed;
  }
  return out;
}

export async function setInstanceCompletion(
  supabase: SupabaseClient,
  userId: string,
  args: { eventId: string; instanceDate: string; completed: boolean }
): Promise<void> {
  const row: DbCompletionRow = {
    user_id: userId,
    event_id: args.eventId,
    instance_date: args.instanceDate,
    completed: args.completed,
    deleted: false,
  };

  const { error } = await supabase
    .from('event_instance_completions')
    .upsert(row, { onConflict: 'user_id,event_id,instance_date' });
  if (error) throw error;
}

