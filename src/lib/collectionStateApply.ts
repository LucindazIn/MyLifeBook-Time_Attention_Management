import type { CollectionStatePayloadV1 } from '@/lib/collectionStatePayload';
import { notifyCollectionStateChanged } from '@/lib/collectionStateNotify';
import {
  migrateLegacyGoalRecord,
  saveLongTermGoalMeta,
  saveLongTermGoalDisplayOrder,
  saveDeletedLongTermGoalNames,
  type LongTermGoalMetaMap,
} from '@/lib/longTermGoalMetaStorage';
import { LONG_TERM_GOALS_TAGS_KEY } from '@/lib/longTermGoalMetaStorage';
import { applyLifeBookCoverFromSync } from '@/lib/lifeBookCoverStorage';
import {
  CUSTOM_EVENT_TAGS_KEY,
  CUSTOM_EVENT_TAG_LAST_USED_KEY,
} from '@/lib/customEventTagsStorage';
import { applyLifeEnergyStorageDump } from '@/lib/lifeEnergyStorage';
import { applyNextMonthFocusStorageDump } from '@/lib/nextMonthFocusStorage';
import { HIDDEN_PRESET_ROLE_IDS_KEY, ROLE_CATALOG_KEY } from '@/lib/roleManagementStorage';

/** Apply merged payload to localStorage and emit one `sync` UI refresh. */
export function applyCollectionStatePayloadToLocal(payload: CollectionStatePayloadV1): void {
  if (typeof window === 'undefined') return;

  const metaIn = payload.longTermGoalMeta ?? {};
  const migratedMeta: LongTermGoalMetaMap = {};
  for (const [k, v] of Object.entries(metaIn)) {
    migratedMeta[k] = migrateLegacyGoalRecord(v);
  }
  saveLongTermGoalMeta(migratedMeta, { fromSync: true });
  saveDeletedLongTermGoalNames(payload.deletedLongTermGoalNames ?? [], { fromSync: true });
  saveLongTermGoalDisplayOrder(payload.longTermGoalDisplayOrder ?? [], {
    fromSync: true,
    updatedAt: payload.longTermGoalOrderUpdatedAt ?? 0,
  });
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

  try {
    localStorage.setItem(
      HIDDEN_PRESET_ROLE_IDS_KEY,
      JSON.stringify(payload.hiddenPresetRoleIds ?? [])
    );
    localStorage.setItem(ROLE_CATALOG_KEY, JSON.stringify(payload.roleCatalog ?? {}));
  } catch {
    /* ignore */
  }

  notifyCollectionStateChanged('sync');
}
