import { v4 as uuidv4 } from 'uuid';
import type { ScheduleEvent } from '@/types';
import { notifyCollectionStateChanged } from '@/lib/collectionStateNotify';

/** Sync with AddEventModal — goal suggestion pool */
export const LONG_TERM_GOALS_TAGS_KEY = 'feather_long_term_goal_tags';

/** Persisted long-term goal meta (status / milestones) — also synced via `user_collection_state`. */
export const LONG_TERM_GOAL_META_STORAGE_KEY = 'feather_long_term_goal_meta';

const META_STORAGE_KEY = LONG_TERM_GOAL_META_STORAGE_KEY;

export type GoalStatus = 'sprout' | 'in_progress' | 'deviated' | 'completed';

export interface GoalMilestone {
  id: string;
  /** YYYY-MM-DD */
  at: string;
  text: string;
}

export interface LongTermGoalRecord {
  status: GoalStatus;
  /** ISO timestamp — updated on rename, status change, milestone add */
  lastAlignedAt: string;
  /** 目标完成时间（YYYY-MM-DD），可选 */
  targetAt?: string;
  milestones: GoalMilestone[];
}

export type LongTermGoalMetaMap = Record<string, LongTermGoalRecord>;

export const DEFAULT_GOAL_TITLE_ZH = '我想要___';
export const DEFAULT_GOAL_TITLE_EN = 'I Want To ___';

const defaultRecord = (): LongTermGoalRecord => ({
  status: 'sprout',
  lastAlignedAt: new Date().toISOString(),
  milestones: [],
  targetAt: undefined,
});

export function loadLongTermGoalMeta(): LongTermGoalMetaMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LongTermGoalMetaMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
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
    return {
      status: existing.status,
      lastAlignedAt: existing.lastAlignedAt,
      milestones: Array.isArray(existing.milestones) ? existing.milestones : [],
      ...(existing.targetAt?.trim() ? { targetAt: existing.targetAt.trim() } : {}),
    };
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

/** 从元数据与标签池中移除愿景（新建未填写时常用）。不修改日程上的标签引用。 */
export function removeGoalFromMetaAndPool(goalName: string): LongTermGoalMetaMap {
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
  at: string,
  text: string
): LongTermGoalMetaMap {
  const rec = getOrCreateRecord(map, goalName);
  const milestone: GoalMilestone = { id: uuidv4(), at, text: text.trim() };
  const next = {
    ...map,
    [goalName]: {
      ...rec,
      lastAlignedAt: new Date().toISOString(),
      milestones: [...rec.milestones, milestone].sort((a, b) => a.at.localeCompare(b.at)),
    },
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

/** Unique sorted list: events ∪ meta keys ∪ tag pool (visions not yet on calendar). */
export function mergeLongTermGoalNames(events: ScheduleEvent[]): string[] {
  const set = new Set<string>();
  events.forEach((e) => e.longTermGoals?.forEach((g) => g?.trim() && set.add(g.trim())));
  const meta = loadLongTermGoalMeta();
  Object.keys(meta).forEach((k) => k.trim() && set.add(k.trim()));
  readGoalTagPool().forEach((g) => g?.trim() && set.add(g.trim()));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
