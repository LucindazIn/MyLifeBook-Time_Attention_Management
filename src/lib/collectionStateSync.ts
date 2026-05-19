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

export type CollectionSyncOptions = {
  /** When true, abort before mutating local/remote (stale concurrent sync). */
  isStale?: () => boolean;
};

export async function syncCollectionClientState(
  supabaseClient: SupabaseClient,
  userId: string,
  options?: CollectionSyncOptions
): Promise<void> {
  const remoteRow = await fetchUserCollectionState(supabaseClient, userId);
  if (options?.isStale?.()) return;
  const local = buildCollectionStatePayloadFromLocal();
  const remote = remoteRow ?? emptyCollectionStatePayload();
  const merged = mergeCollectionStatePayloads(local, remote);
  if (options?.isStale?.()) return;
  applyCollectionStatePayloadToLocal(merged);
  await upsertUserCollectionState(supabaseClient, userId, merged);
}

/** Upload local edits; merge with remote first to avoid last-write-wins data loss. */
export async function pushCollectionClientState(
  supabaseClient: SupabaseClient,
  userId: string,
  options?: CollectionSyncOptions
): Promise<void> {
  const remoteRow = await fetchUserCollectionState(supabaseClient, userId);
  if (options?.isStale?.()) return;
  const local = buildCollectionStatePayloadFromLocal();
  const remote = remoteRow ?? emptyCollectionStatePayload();
  const merged = mergeCollectionStatePayloads(local, remote);
  if (options?.isStale?.()) return;
  applyCollectionStatePayloadToLocal(merged);
  await upsertUserCollectionState(supabaseClient, userId, merged);
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
