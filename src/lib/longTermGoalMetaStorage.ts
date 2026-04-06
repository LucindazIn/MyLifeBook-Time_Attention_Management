import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { ScheduleEvent } from '@/types';
import { notifyCollectionStateChanged } from '@/lib/collectionStateNotify';

/** Sync with AddEventModal — goal suggestion pool */
export const LONG_TERM_GOALS_TAGS_KEY = 'feather_long_term_goal_tags';

/** Persisted long-term goal meta (status / milestones) — also synced via `user_collection_state`. */
export const LONG_TERM_GOAL_META_STORAGE_KEY = 'feather_long_term_goal_meta';

/** Display order (priority, top first) — synced via `user_collection_state` with `longTermGoalOrderUpdatedAt`. */
export const LONG_TERM_GOAL_DISPLAY_ORDER_KEY = 'feather_long_term_goal_display_order';
export const LONG_TERM_GOAL_ORDER_UPDATED_AT_KEY = 'feather_long_term_goal_order_updated_at';

const META_STORAGE_KEY = LONG_TERM_GOAL_META_STORAGE_KEY;

export type GoalStatus = 'sprout' | 'in_progress' | 'deviated' | 'completed';

export interface GoalMilestone {
  id: string;
  /** YYYY-MM-DD */
  at: string;
  text: string;
}

/** 中短期目标：起止日期区间 + 下属里程碑（日程只挂父长期目标名） */
export interface MediumTermGoal {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  startAt: string;
  /** YYYY-MM-DD */
  endAt: string;
  milestones: GoalMilestone[];
}

export interface LongTermGoalRecord {
  status: GoalStatus;
  /** ISO timestamp — updated on rename, status change, milestone add */
  lastAlignedAt: string;
  /** 目标完成时间（YYYY-MM-DD），可选 */
  targetAt?: string;
  /** 中短期目标（里程碑挂在每一项下） */
  mediumTermGoals?: MediumTermGoal[];
}

export type LongTermGoalMetaMap = Record<string, LongTermGoalRecord>;

export const DEFAULT_GOAL_TITLE_ZH = '我想要';
export const DEFAULT_GOAL_TITLE_EN = 'I Want';

const defaultRecord = (): LongTermGoalRecord => ({
  status: 'sprout',
  lastAlignedAt: new Date().toISOString(),
  targetAt: undefined,
  mediumTermGoals: [],
});

function sortMilestones(ms: GoalMilestone[]): GoalMilestone[] {
  return [...ms].sort((a, b) => a.at.localeCompare(b.at));
}

/** 旧版顶层 milestones → 并入首个中短期或生成「Legacy Milestones」区间 */
export function migrateLegacyGoalRecord(raw: unknown): LongTermGoalRecord {
  const r = raw as Partial<LongTermGoalRecord> & { milestones?: GoalMilestone[] };
  const status = r.status ?? 'sprout';
  const lastAlignedAt = r.lastAlignedAt ?? new Date().toISOString();
  const legacyTop = Array.isArray(r.milestones) ? r.milestones : [];
  let medium: MediumTermGoal[] = Array.isArray(r.mediumTermGoals)
    ? r.mediumTermGoals.map((m) => ({
        id: m.id,
        title: (m.title ?? '').trim(),
        startAt: (m.startAt ?? '').trim(),
        endAt: (m.endAt ?? '').trim(),
        milestones: sortMilestones(Array.isArray(m.milestones) ? m.milestones : []),
      }))
    : [];

  if (legacyTop.length > 0) {
    if (medium.length > 0) {
      medium = medium.map((row, i) =>
        i === 0
          ? { ...row, milestones: sortMilestones([...row.milestones, ...legacyTop]) }
          : row
      );
    } else {
      const dates = legacyTop.map((x) => x.at).filter(Boolean).sort();
      const startAt = dates[0] ?? format(new Date(), 'yyyy-MM-dd');
      const endAt = dates[dates.length - 1] ?? startAt;
      medium = [
        {
          id: uuidv4(),
          title: 'Legacy Milestones',
          startAt,
          endAt,
          milestones: sortMilestones(legacyTop),
        },
      ];
    }
  }

  const out: LongTermGoalRecord = {
    status,
    lastAlignedAt,
    mediumTermGoals: medium,
  };
  if (r.targetAt?.trim()) out.targetAt = r.targetAt.trim();
  return out;
}

function recordNeedsResaveAfterMigration(raw: unknown): boolean {
  const r = raw as { milestones?: unknown; mediumTermGoals?: unknown };
  if (Array.isArray(r.milestones) && r.milestones.length > 0) return true;
  if (!Array.isArray(r.mediumTermGoals)) return false;
  return r.mediumTermGoals.some((m: { milestones?: unknown }) => m && !Array.isArray(m.milestones));
}

export function loadLongTermGoalMeta(): LongTermGoalMetaMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};

    let dirty = false;
    const out: LongTermGoalMetaMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (recordNeedsResaveAfterMigration(v)) dirty = true;
      out[k] = migrateLegacyGoalRecord(v);
    }
    if (dirty) {
      saveLongTermGoalMeta(out, { silent: true });
      notifyCollectionStateChanged('user');
    }
    return out;
  } catch {
    return {};
  }
}

export function saveLongTermGoalMeta(
  map: LongTermGoalMetaMap,
  opts?: { fromSync?: boolean; silent?: boolean }
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(map));
  } catch (_) {}
  if (opts?.silent) return;
  if (opts?.fromSync) return;
  notifyCollectionStateChanged('user');
}

export function getOrCreateRecord(map: LongTermGoalMetaMap, goalName: string): LongTermGoalRecord {
  const existing = map[goalName];
  if (existing?.lastAlignedAt && existing.status) {
    return migrateLegacyGoalRecord(existing);
  }
  return defaultRecord();
}

/** Ensure every key in `names` has a meta entry (mutates and returns map). */
export function ensureMetaForGoals(map: LongTermGoalMetaMap, names: string[]): LongTermGoalMetaMap {
  const next = { ...map };
  let changed = false;
  for (const n of names) {
    if (!n.trim()) continue;
    if (!next[n]) {
      next[n] = defaultRecord();
      changed = true;
    }
  }
  if (changed) saveLongTermGoalMeta(next);
  return next;
}

export function setGoalTargetAt(
  map: LongTermGoalMetaMap,
  goalName: string,
  targetAt: string | undefined
): LongTermGoalMetaMap {
  const rec = getOrCreateRecord(map, goalName);
  const trimmed = targetAt?.trim();
  const updated: LongTermGoalRecord = { ...rec };
  if (trimmed) updated.targetAt = trimmed;
  else delete updated.targetAt;
  const next = { ...map, [goalName]: updated };
  saveLongTermGoalMeta(next);
  return next;
}

export function setMediumTermGoals(
  map: LongTermGoalMetaMap,
  goalName: string,
  items: MediumTermGoal[]
): LongTermGoalMetaMap {
  const rec = getOrCreateRecord(map, goalName);
  const normalized = items
    .map((m) => ({
      id: m.id,
      title: m.title.trim(),
      startAt: m.startAt.trim(),
      endAt: m.endAt.trim(),
      milestones: sortMilestones(Array.isArray(m.milestones) ? m.milestones : []),
    }))
    .filter((m) => m.title && m.startAt && m.endAt);
  const updated: LongTermGoalRecord = {
    ...rec,
    mediumTermGoals: normalized,
  };
  const next = { ...map, [goalName]: updated };
  saveLongTermGoalMeta(next);
  return next;
}

export function loadLongTermGoalOrder(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LONG_TERM_GOAL_DISPLAY_ORDER_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function loadLongTermGoalOrderUpdatedAt(): number {
  if (typeof localStorage === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(LONG_TERM_GOAL_ORDER_UPDATED_AT_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveLongTermGoalDisplayOrder(
  order: string[],
  opts?: { fromSync?: boolean; silent?: boolean; updatedAt?: number }
): void {
  if (typeof localStorage === 'undefined') return;
  const ts = opts?.updatedAt ?? Date.now();
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const n of order) {
    const t = n.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    deduped.push(t);
  }
  try {
    localStorage.setItem(LONG_TERM_GOAL_DISPLAY_ORDER_KEY, JSON.stringify(deduped));
    localStorage.setItem(LONG_TERM_GOAL_ORDER_UPDATED_AT_KEY, String(ts));
  } catch (_) {}
  if (opts?.fromSync || opts?.silent) return;
  notifyCollectionStateChanged('user');
}

/** Apply saved priority order; names not listed follow `sortedUnion` order (locale sort). */
export function applyDisplayOrderToSortedNames(sortedUnion: string[], order: string[]): string[] {
  const nameSet = new Set(sortedUnion);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of order) {
    const t = n.trim();
    if (!nameSet.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  for (const n of sortedUnion) {
    if (!seen.has(n)) out.push(n);
  }
  return out;
}

export function prependLongTermGoalDisplayOrder(goalName: string): void {
  const g = goalName.trim();
  if (!g) return;
  const cur = loadLongTermGoalOrder().filter((n) => n !== g);
  cur.unshift(g);
  saveLongTermGoalDisplayOrder(cur);
}

function renameGoalInDisplayOrder(oldName: string, newName: string): void {
  if (oldName === newName) return;
  const cur = loadLongTermGoalOrder();
  const next = cur.map((n) => (n === oldName ? newName : n));
  saveLongTermGoalDisplayOrder(next, { silent: true });
}

function removeGoalFromDisplayOrder(goalName: string): void {
  const cur = loadLongTermGoalOrder().filter((n) => n !== goalName);
  saveLongTermGoalDisplayOrder(cur, { silent: true });
}

/** Unique set: events ∪ meta keys ∪ tag pool (order not applied). */
export function collectLongTermGoalNameSet(events: ScheduleEvent[]): Set<string> {
  const set = new Set<string>();
  events.forEach((e) => e.longTermGoals?.forEach((g) => g?.trim() && set.add(g.trim())));
  const meta = loadLongTermGoalMeta();
  Object.keys(meta).forEach((k) => k.trim() && set.add(k.trim()));
  readGoalTagPool().forEach((g) => g?.trim() && set.add(g.trim()));
  return set;
}

/** 从元数据与标签池中移除愿景（新建未填写时常用）。不修改日程上的标签引用。 */
export function removeGoalFromMetaAndPool(goalName: string): LongTermGoalMetaMap {
  removeGoalFromDisplayOrder(goalName);
  const map = loadLongTermGoalMeta();
  const next = { ...map };
  delete next[goalName];
  saveLongTermGoalMeta(next);
  try {
    const raw = localStorage.getItem(LONG_TERM_GOALS_TAGS_KEY);
    const tags: string[] = raw ? JSON.parse(raw) : [];
    const filtered = tags.filter((t) => t !== goalName);
    localStorage.setItem(LONG_TERM_GOALS_TAGS_KEY, JSON.stringify(filtered));
  } catch (_) {}
  notifyCollectionStateChanged('user');
  return next;
}

export function touchAlignment(map: LongTermGoalMetaMap, goalName: string): LongTermGoalMetaMap {
  const rec = getOrCreateRecord(map, goalName);
  const next = {
    ...map,
    [goalName]: { ...rec, lastAlignedAt: new Date().toISOString() },
  };
  saveLongTermGoalMeta(next);
  return next;
}

export function setGoalStatus(
  map: LongTermGoalMetaMap,
  goalName: string,
  status: GoalStatus
): LongTermGoalMetaMap {
  const rec = getOrCreateRecord(map, goalName);
  const next = {
    ...map,
    [goalName]: {
      ...rec,
      status,
      lastAlignedAt: new Date().toISOString(),
    },
  };
  saveLongTermGoalMeta(next);
  return next;
}

export function addMilestone(
  map: LongTermGoalMetaMap,
  goalName: string,
  mediumTermGoalId: string,
  at: string,
  text: string
): LongTermGoalMetaMap {
  const rec = getOrCreateRecord(map, goalName);
  const milestone: GoalMilestone = { id: uuidv4(), at, text: text.trim() };
  const medium = rec.mediumTermGoals ?? [];
  const nextMedium = medium.map((m) =>
    m.id === mediumTermGoalId
      ? { ...m, milestones: sortMilestones([...m.milestones, milestone]) }
      : m
  );
  const next = {
    ...map,
    [goalName]: {
      ...rec,
      lastAlignedAt: new Date().toISOString(),
      mediumTermGoals: nextMedium,
    },
  };
  saveLongTermGoalMeta(next);
  return next;
}

export function removeMilestone(
  map: LongTermGoalMetaMap,
  goalName: string,
  mediumTermGoalId: string,
  milestoneId: string
): LongTermGoalMetaMap {
  const rec = getOrCreateRecord(map, goalName);
  const medium = (rec.mediumTermGoals ?? []).map((m) =>
    m.id === mediumTermGoalId
      ? { ...m, milestones: m.milestones.filter((x) => x.id !== milestoneId) }
      : m
  );
  const next = {
    ...map,
    [goalName]: { ...rec, mediumTermGoals: medium, lastAlignedAt: new Date().toISOString() },
  };
  saveLongTermGoalMeta(next);
  return next;
}

/** Rename meta key + update tags pool (caller updates events). */
export function migrateGoalRename(
  map: LongTermGoalMetaMap,
  oldName: string,
  newName: string
): LongTermGoalMetaMap {
  if (oldName === newName || !newName.trim()) return map;
  const next = { ...map };
  const rec = next[oldName] ?? defaultRecord();
  delete next[oldName];
  next[newName.trim()] = {
    ...rec,
    lastAlignedAt: new Date().toISOString(),
  };
  saveLongTermGoalMeta(next, { silent: true });

  renameGoalInDisplayOrder(oldName, newName.trim());

  try {
    const raw = localStorage.getItem(LONG_TERM_GOALS_TAGS_KEY);
    const tags: string[] = raw ? JSON.parse(raw) : [];
    const idx = tags.indexOf(oldName);
    const merged = idx >= 0 ? tags.map((t) => (t === oldName ? newName.trim() : t)) : [...tags];
    if (!merged.includes(newName.trim())) merged.unshift(newName.trim());
    const dedup = [...new Set(merged)];
    localStorage.setItem(LONG_TERM_GOALS_TAGS_KEY, JSON.stringify(dedup));
  } catch (_) {}

  notifyCollectionStateChanged('user');
  return next;
}

export function appendGoalTagPool(goalName: string): void {
  if (typeof localStorage === 'undefined' || !goalName.trim()) return;
  try {
    const raw = localStorage.getItem(LONG_TERM_GOALS_TAGS_KEY);
    const tags: string[] = raw ? JSON.parse(raw) : [];
    const g = goalName.trim();
    if (!tags.includes(g)) {
      tags.unshift(g);
      localStorage.setItem(LONG_TERM_GOALS_TAGS_KEY, JSON.stringify(tags));
    }
  } catch (_) {}
  notifyCollectionStateChanged('user');
}

export function readGoalTagPool(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LONG_TERM_GOALS_TAGS_KEY);
    const tags: string[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(tags) ? tags : [];
  } catch {
    return [];
  }
}

const STATUS_ORDER: GoalStatus[] = ['sprout', 'in_progress', 'deviated', 'completed'];

export function cycleGoalStatus(current: GoalStatus): GoalStatus {
  const i = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}

/** Unique list: events ∪ meta ∪ tag pool; order from saved display order (top = higher priority). */
export function mergeLongTermGoalNames(events: ScheduleEvent[]): string[] {
  const set = collectLongTermGoalNameSet(events);
  const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
  return applyDisplayOrderToSortedNames(sorted, loadLongTermGoalOrder());
}

const ALPHA_SUFFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz';

function randomAlphaSuffix(len: number): string {
  const out: string[] = [];
  const buf = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < len; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < len; i++) {
    out.push(ALPHA_SUFFIX_CHARS[buf[i]! % ALPHA_SUFFIX_CHARS.length]!);
  }
  return out.join('');
}

/**
 * Title for a new vision row: default `我想要` / `I Want` once, then `我想要·abcd` style
 * (middle dot + letters only — no underscores, no parentheses, no digits) so keys stay unique.
 */
export function pickUniqueNewVisionTitle(events: ScheduleEvent[], isZh: boolean): string {
  const base = isZh ? DEFAULT_GOAL_TITLE_ZH : DEFAULT_GOAL_TITLE_EN;
  const existing = collectLongTermGoalNameSet(events);
  if (!existing.has(base)) return base;
  const sep = '·';
  for (let attempt = 0; attempt < 96; attempt++) {
    const candidate = `${base}${sep}${randomAlphaSuffix(4)}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}${sep}${randomAlphaSuffix(8)}`;
}
