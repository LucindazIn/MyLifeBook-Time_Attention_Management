import { format } from 'date-fns';
import { notifyCollectionStateChanged } from '@/lib/collectionStateNotify';

const PREFIX = 'feather_life_energy_';

/** Prefix for all life-energy localStorage keys (sync uses this to replace the whole subtree). */
export const LIFE_ENERGY_STORAGE_PREFIX = PREFIX;

/** 所有时间维度（本月 / 近三月 / 自定义）拖拽均写入该 rangeKey，按自然日唯一，与章节弹窗人生曲线共用 */
export const LIFE_ENERGY_GLOBAL_RANGE_KEY = 'global';

export type LifeEnergyEntry = {
  energy: number;
  computedEnergy?: number;
  updatedAt?: string;
};

function keyFor(rangeKey: string, startDate: Date): string {
  return PREFIX + rangeKey + '_' + format(startDate, 'yyyy-MM-dd');
}

function keyForDay(rangeKey: string, dateKey: string): string {
  return PREFIX + rangeKey + '_day_' + dateKey;
}

/** 解析 feather_life_energy_{rangeKey}_day_{yyyy-MM-dd} */
function parseDayStorageKey(key: string): { rangeKey: string; dateKey: string } | null {
  if (!key.startsWith(PREFIX)) return null;
  const needle = '_day_';
  const idx = key.lastIndexOf(needle);
  if (idx === -1) return null;
  const dateKey = key.slice(idx + needle.length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const rangeKey = key.slice(PREFIX.length, idx);
  return rangeKey ? { rangeKey, dateKey } : null;
}

/**
 * 读取某日用户覆盖的生命能量：优先全局键；否则回退 legacy（旧版按 month/quarter/custom 分键存储）。
 */
export function getLifeEnergyOverrideForDate(dateKey: string): number | null {
  const g = getLifeEnergyForDay(LIFE_ENERGY_GLOBAL_RANGE_KEY, dateKey);
  if (g != null) return g;

  for (const rk of ['month', 'quarter'] as const) {
    const v = getLifeEnergyForDay(rk, dateKey);
    if (v != null) return v;
  }

  if (typeof localStorage === 'undefined') return null;

  let best: { energy: number; t: number } | null = null;
  const consider = (energy: number, updatedAt?: string) => {
    const t = updatedAt ? Date.parse(updatedAt) || 0 : 0;
    if (!best || t > best.t) best = { energy, t };
  };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const parsed = parseDayStorageKey(key);
    if (!parsed || parsed.dateKey !== dateKey) continue;
    if (parsed.rangeKey === LIFE_ENERGY_GLOBAL_RANGE_KEY) continue;
    if (parsed.rangeKey === 'month' || parsed.rangeKey === 'quarter') continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const v = JSON.parse(raw) as LifeEnergyEntry;
      if (typeof v.energy !== 'number') continue;
      consider(v.energy, v.updatedAt);
    } catch {
      /* continue */
    }
  }
  return best?.energy ?? null;
}

export function getLifeEnergy(rangeKey: string, startDate: Date): LifeEnergyEntry | null {
  try {
    const raw = localStorage.getItem(keyFor(rangeKey, startDate));
    if (!raw) return null;
    const v = JSON.parse(raw) as LifeEnergyEntry;
    return typeof v.energy === 'number' ? v : null;
  } catch {
    return null;
  }
}

export function setLifeEnergy(
  rangeKey: string,
  startDate: Date,
  energy: number,
  computedEnergy?: number,
  opts?: { fromSync?: boolean }
): void {
  try {
    const entry: LifeEnergyEntry = {
      energy: Math.min(100, Math.max(0, Math.round(energy))),
      ...(computedEnergy !== undefined && { computedEnergy }),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(keyFor(rangeKey, startDate), JSON.stringify(entry));
  } catch {
    // ignore
  }
  if (!opts?.fromSync) notifyCollectionStateChanged('user');
}

export function getLifeEnergyForDay(rangeKey: string, dateKey: string): number | null {
  try {
    const raw = localStorage.getItem(keyForDay(rangeKey, dateKey));
    if (!raw) return null;
    const v = JSON.parse(raw) as LifeEnergyEntry;
    return typeof v.energy === 'number' ? v.energy : null;
  } catch {
    return null;
  }
}

export function setLifeEnergyForDay(
  rangeKey: string,
  dateKey: string,
  energy: number,
  computedEnergy?: number,
  opts?: { fromSync?: boolean }
): void {
  try {
    const entry: LifeEnergyEntry = {
      energy: Math.min(100, Math.max(0, Math.round(energy))),
      ...(computedEnergy !== undefined && { computedEnergy }),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(keyForDay(rangeKey, dateKey), JSON.stringify(entry));
  } catch {
    // ignore
  }
  if (!opts?.fromSync) notifyCollectionStateChanged('user');
}

export function dumpLifeEnergyStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof localStorage === 'undefined') return out;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) {
      const v = localStorage.getItem(k);
      if (v != null) out[k] = v;
    }
  }
  return out;
}

export function applyLifeEnergyStorageDump(entries: Record<string, string>): void {
  if (typeof localStorage === 'undefined') return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) toRemove.push(k);
  }
  for (const k of toRemove) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(entries)) {
    if (k.startsWith(PREFIX)) localStorage.setItem(k, v);
  }
}
