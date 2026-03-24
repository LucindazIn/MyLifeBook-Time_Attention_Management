import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAll } from '@/lib/repositories/supabase/paging';

export type DbDailyQuoteRow = {
  id?: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  text: string;
  author: string | null;
  deleted?: boolean | null;
};

export async function listAllDailyQuotes(supabase: SupabaseClient, userId: string) {
  const rows = await fetchAll<DbDailyQuoteRow>((from, to) =>
    supabase
      .from('daily_quotes')
      .select('date,text,author,deleted')
      .eq('user_id', userId)
      .range(from, to)
  );

  const out: Record<string, { text: string; author?: string }> = {};
  for (const r of rows) {
    if (r.deleted) continue;
    out[r.date] = { text: r.text, author: r.author ?? undefined };
  }
  return out;
}

export async function upsertDailyQuote(
  supabase: SupabaseClient,
  userId: string,
  dateKey: string,
  quote: { text: string; author?: string }
) {
  const row: DbDailyQuoteRow = {
    user_id: userId,
    date: dateKey,
    text: quote.text,
    author: quote.author ?? null,
    deleted: false,
  };
  const { error } = await supabase.from('daily_quotes').upsert(row, { onConflict: 'user_id,date' });
  if (error) throw error;
}

