import type { CollectionStatePayloadV1 } from '@/lib/collectionStatePayload';
import { notifyCollectionStateChanged } from '@/lib/collectionStateNotify';
import { saveLongTermGoalMeta } from '@/lib/longTermGoalMetaStorage';
import { LONG_TERM_GOALS_TAGS_KEY } from '@/lib/longTermGoalMetaStorage';
import { applyLifeBookCoverFromSync } from '@/lib/lifeBookCoverStorage';
import {
  CUSTOM_EVENT_TAGS_KEY,
  CUSTOM_EVENT_TAG_LAST_USED_KEY,
} from '@/lib/customEventTagsStorage';
import { applyLifeEnergyStorageDump } from '@/lib/lifeEnergyStorage';
import { applyNextMonthFocusStorageDump } from '@/lib/nextMonthFocusStorage';

/** Apply merged payload to localStorage and emit one `sync` UI refresh. */
export function applyCollectionStatePayloadToLocal(payload: CollectionStatePayloadV1): void {
  if (typeof window === 'undefined') return;

  saveLongTermGoalMeta(payload.longTermGoalMeta, { fromSync: true });
  try {
    localStorage.setItem(LONG_TERM_GOALS_TAGS_KEY, JSON.stringify(payload.longTermGoalTagPool));
  } catch {
    /* ignore */
  }

  applyLifeBookCoverFromSync(payload.lifeBookCover);

  try {
    localStorage.setItem(CUSTOM_EVENT_TAGS_KEY, JSON.stringify(payload.customEventTags));
    localStorage.setItem(
      CUSTOM_EVENT_TAG_LAST_USED_KEY,
      JSON.stringify(payload.customEventTagLastUsed)
    );
  } catch {
    /* ignore */
  }

  applyLifeEnergyStorageDump(payload.lifeEnergyEntries);
  applyNextMonthFocusStorageDump(payload.nextMonthFocusEntries);

  notifyCollectionStateChanged('sync');
}
