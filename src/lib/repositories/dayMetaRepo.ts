import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAll } from '@/lib/repositories/supabase/paging';
import type { AppLanguage } from '@/types';

export type DbDayMetaRow = {
  id?: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  day_name: string | null;
  day_name_is_manual: boolean | null;
  day_name_language: string | null;
  day_tag: string | null;
  journal: string | null;
  energy_level?: number | null;
  mood_level?: number | null;
  focus_level?: number | null;
  deleted?: boolean | null;
};

export type DayVibes = {
  energy?: number;
  mood?: number;
  focus?: number;
};

export async function listAllDayMeta(supabase: SupabaseClient, userId: string) {
  const rows = await fetchAll<DbDayMetaRow>((from, to) =>
    supabase
      .from('day_meta')
      .select('date,day_name,day_name_is_manual,day_name_language,day_tag,journal,energy_level,mood_level,focus_level,deleted')
      .eq('user_id', userId)
      .range(from, to)
  );

  const dayNames: Record<string, { name: string; isManual: boolean; language?: AppLanguage }> = {};
  const dayTags: Record<string, string> = {};
  const journalEntries: Record<string, string> = {};
  const dayVibes: Record<string, DayVibes> = {};

  for (const r of rows) {
    if (r.deleted) continue;
    if (r.day_name) {
      dayNames[r.date] = { name: r.day_name, isManual: !!r.day_name_is_manual, language: (r.day_name_language as any) || undefined };
    }
    if (r.day_tag) dayTags[r.date] = r.day_tag;
    if (r.journal) journalEntries[r.date] = r.journal;
    if (r.energy_level != null || r.mood_level != null || r.focus_level != null) {
      dayVibes[r.date] = {
        ...(r.energy_level != null && { energy: r.energy_level }),
        ...(r.mood_level != null && { mood: r.mood_level }),
        ...(r.focus_level != null && { focus: r.focus_level }),
      };
    }
  }

  return { dayNames, dayTags, journalEntries, dayVibes };
}

export async function upsertDayMeta(
  supabase: SupabaseClient,
  userId: string,
  dateKey: string,
  patch: Partial<Pick<DbDayMetaRow, 'day_name' | 'day_name_is_manual' | 'day_name_language' | 'day_tag' | 'journal' | 'energy_level' | 'mood_level' | 'focus_level'>>
) {
  const row: DbDayMetaRow = {
    user_id: userId,
    date: dateKey,
    day_name: patch.day_name ?? null,
    day_name_is_manual: patch.day_name_is_manual ?? null,
    day_name_language: patch.day_name_language ?? null,
    day_tag: patch.day_tag ?? null,
    journal: patch.journal ?? null,
    ...(patch.energy_level !== undefined && { energy_level: patch.energy_level }),
    ...(patch.mood_level !== undefined && { mood_level: patch.mood_level }),
    ...(patch.focus_level !== undefined && { focus_level: patch.focus_level }),
    deleted: false,
  };
  const { error } = await supabase.from('day_meta').upsert(row, { onConflict: 'user_id,date' });
  if (error) throw error;
}

