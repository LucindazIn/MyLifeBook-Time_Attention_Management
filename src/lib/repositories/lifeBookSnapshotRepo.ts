import type { SupabaseClient } from '@supabase/supabase-js';
import type { SavedChapter } from '@/lib/chaptersStorage';

export async function fetchLifeBookSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<SavedChapter[]> {
  const { data, error } = await supabase
    .from('life_book_snapshot')
    .select('chapters')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const raw = data?.chapters;
  if (!Array.isArray(raw)) return [];
  return raw as SavedChapter[];
}

export async function upsertLifeBookSnapshot(
  supabase: SupabaseClient,
  userId: string,
  chapters: SavedChapter[]
): Promise<void> {
  const { error } = await supabase.from('life_book_snapshot').upsert(
    {
      user_id: userId,
      chapters,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}
