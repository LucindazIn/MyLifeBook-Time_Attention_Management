import type { LongTermGoalMetaMap } from '@/lib/longTermGoalMetaStorage';
import {
  LONG_TERM_GOALS_TAGS_KEY,
  LONG_TERM_GOAL_META_STORAGE_KEY,
  loadDeletedLongTermGoalNames,
  loadLongTermGoalOrder,
  loadLongTermGoalOrderUpdatedAt,
} from '@/lib/longTermGoalMetaStorage';
import { getLifeBookCoverLines, getLifeBookCoverUpdatedAt } from '@/lib/lifeBookCoverStorage';
import {
  CUSTOM_EVENT_TAGS_KEY,
  CUSTOM_EVENT_TAG_LAST_USED_KEY,
  loadSavedCustomEventTags,
} from '@/lib/customEventTagsStorage';
import { dumpLifeEnergyStorage } from '@/lib/lifeEnergyStorage';
import { dumpNextMonthFocusStorage } from '@/lib/nextMonthFocusStorage';
import { type RoleCatalogMap, loadHiddenPresetRoleIds, loadRoleCatalog } from '@/lib/roleManagementStorage';

/** Synced blob version — bump when shape changes. */
export const COLLECTION_STATE_VERSION = 3 as const;

export type CollectionStatePayloadV1 = {
  v: typeof COLLECTION_STATE_VERSION | 1 | 2;
  longTermGoalMeta: LongTermGoalMetaMap;
  longTermGoalTagPool: string[];
  /** Names intentionally deleted by the user; prevents union-merge sync from resurrecting them. */
  deletedLongTermGoalNames: string[];
  /** Priority list (top = first); merged with union of names; see `longTermGoalOrderUpdatedAt`. */
  longTermGoalDisplayOrder: string[];
  /** For merging display order across devices (newer array wins, then append missing names). */
  longTermGoalOrderUpdatedAt: number;
  lifeBookCover: { line1: string; line2: string; line3: string; updatedAt: number };
  customEventTags: string[];
  customEventTagLastUsed: Record<string, number>;
  /** Full localStorage key → raw value for feather_life_energy_* */
  lifeEnergyEntries: Record<string, string>;
  /** feather_next_month_focus_* key → raw value */
  nextMonthFocusEntries: Record<string, string>;
  /** 用户从选择器中移除的预设角色 id（并集合并） */
  hiddenPresetRoleIds: string[];
  /** 自定义角色 id → 继承色（合并取 updatedAt 较新） */
  roleCatalog: RoleCatalogMap;
};

export function emptyCollectionStatePayload(): CollectionStatePayloadV1 {
  return {
    v: COLLECTION_STATE_VERSION,
    longTermGoalMeta: {},
    longTermGoalTagPool: [],
    deletedLongTermGoalNames: [],
    longTermGoalDisplayOrder: [],
    longTermGoalOrderUpdatedAt: 0,
    lifeBookCover: { line1: '', line2: '', line3: '', updatedAt: 0 },
    customEventTags: [],
    customEventTagLastUsed: {},
    lifeEnergyEntries: {},
    nextMonthFocusEntries: {},
    hiddenPresetRoleIds: [],
    roleCatalog: {},
  };
}

/** Normalize remote or legacy payload (v1 → v2 fields). */
export function normalizeCollectionStatePayload(raw: unknown): CollectionStatePayloadV1 {
  const empty = emptyCollectionStatePayload();
  if (!raw || typeof raw !== 'object') return empty;
  const r = raw as Partial<CollectionStatePayloadV1>;
  const merged = mergeCollectionStatePayloads(empty, {
    ...empty,
    ...r,
    v:
      r.v === 1 || r.v === 2 || r.v === 3
        ? r.v
        : COLLECTION_STATE_VERSION,
  });
  merged.v = COLLECTION_STATE_VERSION;
  return merged;
}

function loadCustomEventTagLastUsed(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CUSTOM_EVENT_TAG_LAST_USED_KEY);
    const o = raw ? JSON.parse(raw) : {};
    if (!o || typeof o !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function buildCollectionStatePayloadFromLocal(): CollectionStatePayloadV1 {
  if (typeof window === 'undefined') return emptyCollectionStatePayload();

  const lines = getLifeBookCoverLines();
  const metaRaw = localStorage.getItem(LONG_TERM_GOAL_META_STORAGE_KEY);
  let longTermGoalMeta: LongTermGoalMetaMap = {};
  try {
    if (metaRaw) {
      const p = JSON.parse(metaRaw) as LongTermGoalMetaMap;
      if (p && typeof p === 'object') longTermGoalMeta = p;
    }
  } catch {
    /* keep empty */
  }

  let tagPool: string[] = [];
  try {
    const raw = localStorage.getItem(LONG_TERM_GOALS_TAGS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    tagPool = Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'string') : [];
  } catch {
    tagPool = [];
  }

  const hiddenPresetRoleIds = loadHiddenPresetRoleIds();

  return {
    v: COLLECTION_STATE_VERSION,
    longTermGoalMeta,
    longTermGoalTagPool: tagPool,
    deletedLongTermGoalNames: loadDeletedLongTermGoalNames(),
    longTermGoalDisplayOrder: loadLongTermGoalOrder(),
    longTermGoalOrderUpdatedAt: loadLongTermGoalOrderUpdatedAt(),
    lifeBookCover: {
      line1: lines.line1,
      line2: lines.line2,
      line3: lines.line3,
      updatedAt: getLifeBookCoverUpdatedAt(),
    },
    customEventTags: loadSavedCustomEventTags(),
    customEventTagLastUsed: loadCustomEventTagLastUsed(),
    lifeEnergyEntries: dumpLifeEnergyStorage(),
    nextMonthFocusEntries: dumpNextMonthFocusStorage(),
    hiddenPresetRoleIds,
    roleCatalog: loadRoleCatalog(),
  };
}

function mergeGoalMeta(a: LongTermGoalMetaMap, b: LongTermGoalMetaMap): LongTermGoalMetaMap {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: LongTermGoalMetaMap = {};
  for (const k of keys) {
    const x = a[k];
    const y = b[k];
    if (!x) {
      if (y) out[k] = y;
      continue;
    }
    if (!y) {
      out[k] = x;
      continue;
    }
    const ta = Date.parse(x.lastAlignedAt || '') || 0;
    const tb = Date.parse(y.lastAlignedAt || '') || 0;
    out[k] = ta >= tb ? x : y;
  }
  return out;
}

function mergeLifeEnergy(
  local: Record<string, string>,
  remote: Record<string, string>
): Record<string, string> {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const out: Record<string, string> = {};
  for (const k of keys) {
    const a = local[k];
    const b = remote[k];
    if (!a) {
      if (b) out[k] = b;
      continue;
    }
    if (!b) {
      out[k] = a;
      continue;
    }
    try {
      const ea = JSON.parse(a) as { updatedAt?: string };
      const eb = JSON.parse(b) as { updatedAt?: string };
      const ta = Date.parse(ea.updatedAt || '') || 0;
      const tb = Date.parse(eb.updatedAt || '') || 0;
      out[k] = ta >= tb ? a : b;
    } catch {
      out[k] = a.length >= b.length ? a : b;
    }
  }
  return out;
}

/** Parse next month raw: JSON { text, updatedAt } or legacy plain string. */
function parseNextMonthEntry(raw: string): { text: string; updatedAt: number } {
  try {
    if (raw.trim().startsWith('{')) {
      const o = JSON.parse(raw) as { text?: string; updatedAt?: number };
      const text = typeof o.text === 'string' ? o.text : '';
      const updatedAt = typeof o.updatedAt === 'number' ? o.updatedAt : 0;
      return { text, updatedAt };
    }
  } catch {
    /* fall through */
  }
  return { text: raw, updatedAt: 0 };
}

function serializeNextMonthEntry(text: string, updatedAt: number): string {
  return JSON.stringify({ v: 1, text, updatedAt });
}

function mergeRoleCatalog(local: RoleCatalogMap, remote: RoleCatalogMap): RoleCatalogMap {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const out: RoleCatalogMap = {};
  for (const k of keys) {
    const a = local[k];
    const b = remote[k];
    if (!a) {
      if (b) out[k] = b;
      continue;
    }
    if (!b) {
      out[k] = a;
      continue;
    }
    out[k] = a.updatedAt >= b.updatedAt ? a : b;
  }
  return out;
}

function mergeNextMonthFocus(
  local: Record<string, string>,
  remote: Record<string, string>
): Record<string, string> {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const out: Record<string, string> = {};
  for (const k of keys) {
    const a = local[k];
    const b = remote[k];
    if (!a) {
      if (b) out[k] = b;
      continue;
    }
    if (!b) {
      out[k] = a;
      continue;
    }
    const pa = parseNextMonthEntry(a);
    const pb = parseNextMonthEntry(b);
    if (pa.updatedAt >= pb.updatedAt) {
      out[k] = pa.updatedAt > 0 ? serializeNextMonthEntry(pa.text, pa.updatedAt) : a;
    } else {
      out[k] = pb.updatedAt > 0 ? serializeNextMonthEntry(pb.text, pb.updatedAt) : b;
    }
  }
  return out;
}

function mergeLongTermGoalDisplayOrderFields(
  localOrder: string[] | undefined,
  remoteOrder: string[] | undefined,
  localAt: number,
  remoteAt: number,
  allNames: Set<string>
): { longTermGoalDisplayOrder: string[]; longTermGoalOrderUpdatedAt: number } {
  const ta = localAt ?? 0;
  const tb = remoteAt ?? 0;
  const win = ta >= tb ? (localOrder ?? []) : (remoteOrder ?? []);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const n of win) {
    const t = n.trim();
    if (!allNames.has(t) || seen.has(t)) continue;
    seen.add(t);
    ordered.push(t);
  }
  const rest = [...allNames].filter((n) => !seen.has(n)).sort((a, b) => a.localeCompare(b));
  return {
    longTermGoalDisplayOrder: [...ordered, ...rest],
    longTermGoalOrderUpdatedAt: Math.max(ta, tb),
  };
}

export function mergeCollectionStatePayloads(
  local: CollectionStatePayloadV1,
  remote: CollectionStatePayloadV1
): CollectionStatePayloadV1 {
  const deletedGoalNames = [
    ...new Set([...(local.deletedLongTermGoalNames ?? []), ...(remote.deletedLongTermGoalNames ?? [])].map((name) => name.trim()).filter(Boolean)),
  ];
  const deletedGoalSet = new Set(deletedGoalNames);
  const pool = [...new Set([...local.longTermGoalTagPool, ...remote.longTermGoalTagPool])]
    .filter((name) => !deletedGoalSet.has(name));
  pool.sort((a, b) => a.localeCompare(b));

  const lastUsed: Record<string, number> = {};
  for (const src of [local.customEventTagLastUsed, remote.customEventTagLastUsed]) {
    for (const [k, v] of Object.entries(src)) {
      lastUsed[k] = Math.max(lastUsed[k] ?? 0, v);
    }
  }

  const tags = [...new Set([...local.customEventTags, ...remote.customEventTags])];
  tags.sort((a, b) => a.localeCompare(b));

  const coverA = local.lifeBookCover;
  const coverB = remote.lifeBookCover;
  const lifeBookCover =
    (coverA.updatedAt ?? 0) >= (coverB.updatedAt ?? 0)
      ? { ...coverA }
      : { ...coverB };

  const hiddenPresetRoleIds = [
    ...new Set([
      ...(local.hiddenPresetRoleIds ?? []),
      ...(remote.hiddenPresetRoleIds ?? []),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const roleCatalog = mergeRoleCatalog(local.roleCatalog ?? {}, remote.roleCatalog ?? {});

  const mergedMetaRaw = mergeGoalMeta(local.longTermGoalMeta, remote.longTermGoalMeta);
  const mergedMeta = Object.fromEntries(
    Object.entries(mergedMetaRaw).filter(([name]) => !deletedGoalSet.has(name))
  ) as LongTermGoalMetaMap;
  const allGoalNames = new Set<string>([...Object.keys(mergedMeta), ...pool]);
  const orderMerged = mergeLongTermGoalDisplayOrderFields(
    local.longTermGoalDisplayOrder,
    remote.longTermGoalDisplayOrder,
    local.longTermGoalOrderUpdatedAt ?? 0,
    remote.longTermGoalOrderUpdatedAt ?? 0,
    allGoalNames
  );

  return {
    v: COLLECTION_STATE_VERSION,
    longTermGoalMeta: mergedMeta,
    longTermGoalTagPool: pool,
    deletedLongTermGoalNames: deletedGoalNames,
    longTermGoalDisplayOrder: orderMerged.longTermGoalDisplayOrder,
    longTermGoalOrderUpdatedAt: orderMerged.longTermGoalOrderUpdatedAt,
    lifeBookCover,
    customEventTags: tags,
    customEventTagLastUsed: lastUsed,
    lifeEnergyEntries: mergeLifeEnergy(local.lifeEnergyEntries, remote.lifeEnergyEntries),
    nextMonthFocusEntries: mergeNextMonthFocus(local.nextMonthFocusEntries, remote.nextMonthFocusEntries),
    hiddenPresetRoleIds,
    roleCatalog,
  };
}
