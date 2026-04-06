import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildCollectionStatePayloadFromLocal,
  emptyCollectionStatePayload,
  mergeCollectionStatePayloads,
} from '@/lib/collectionStatePayload';
import { applyCollectionStatePayloadToLocal } from '@/lib/collectionStateApply';
import { fetchUserCollectionState, upsertUserCollectionState } from '@/lib/repositories/userCollectionStateRepo';
import { supabase } from '@/lib/supabase/client';

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export async function syncCollectionClientState(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<void> {
  const remoteRow = await fetchUserCollectionState(supabaseClient, userId);
  const local = buildCollectionStatePayloadFromLocal();
  const remote = remoteRow ?? emptyCollectionStatePayload();
  const merged = mergeCollectionStatePayloads(local, remote);
  applyCollectionStatePayloadToLocal(merged);
  await upsertUserCollectionState(supabaseClient, userId, merged);
}

export async function pushCollectionClientState(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<void> {
  const payload = buildCollectionStatePayloadFromLocal();
  await upsertUserCollectionState(supabaseClient, userId, payload);
}

/** Debounced upload after local edits (长期目标 / 封面 / 标签 / 曲线等). */
export function schedulePushCollectionClientState(userId: string | null | undefined): void {
  if (!userId) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushCollectionClientState(supabase, userId).catch(() => {});
  }, 450);
}
