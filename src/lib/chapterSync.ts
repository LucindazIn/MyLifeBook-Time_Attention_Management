import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getChaptersSnapshot,
  mergeChapterListsForSync,
  persistChaptersList,
} from '@/lib/chaptersStorage';
import { fetchLifeBookSnapshot, upsertLifeBookSnapshot } from '@/lib/repositories/lifeBookSnapshotRepo';
import { supabase } from '@/lib/supabase/client';

export type ChapterSyncOptions = {
  isStale?: () => boolean;
};

/**
 * Merge local + server chapters, persist locally, push snapshot (login / manual sync).
 */
export async function syncLifeBookChapters(
  supabaseClient: SupabaseClient,
  userId: string,
  options?: ChapterSyncOptions
): Promise<void> {
  const remote = await fetchLifeBookSnapshot(supabaseClient, userId);
  if (options?.isStale?.()) return;
  const local = getChaptersSnapshot();
  const merged = mergeChapterListsForSync(local, remote);
  if (options?.isStale?.()) return;
  persistChaptersList(merged);
  await upsertLifeBookSnapshot(supabaseClient, userId, merged);
}

/** Fire-and-forget after local chapter mutations when logged in. */
export function schedulePushLifeBookSnapshot(userId: string | null | undefined): void {
  if (!userId) return;
  void (async () => {
    try {
      const chapters = getChaptersSnapshot();
      await upsertLifeBookSnapshot(supabase, userId, chapters);
    } catch {
      // Non-blocking; next full sync will retry
    }
  })();
}
