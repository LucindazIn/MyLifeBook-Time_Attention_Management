import type { SupabaseClient } from '@supabase/supabase-js';
import type { CollectionStatePayloadV1 } from '@/lib/collectionStatePayload';

export async function fetchUserCollectionState(
  supabase: SupabaseClient,
  userId: string
): Promise<CollectionStatePayloadV1 | null> {
  const { data, error } = await supabase
    .from('user_collection_state')
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const p = data?.payload as unknown;
  if (!p || typeof p !== 'object') return null;
  const payload = p as CollectionStatePayloadV1;
  if (payload.v !== 1) return null;
  return payload;
}

export async function upsertUserCollectionState(
  supabase: SupabaseClient,
  userId: string,
  payload: CollectionStatePayloadV1
): Promise<void> {
  const { error } = await supabase.from('user_collection_state').upsert(
    {
      user_id: userId,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}
