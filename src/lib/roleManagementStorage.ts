/**
 * 角色管理：已删除预设 id、自定义角色颜色目录（与 user_collection_state 同步）。
 */

import { notifyCollectionStateChanged } from '@/lib/collectionStateNotify';

export const HIDDEN_PRESET_ROLE_IDS_KEY = 'feather_hidden_preset_role_ids';
export const ROLE_CATALOG_KEY = 'feather_role_catalog';

export type RoleCatalogEntry = { color: string; updatedAt: number };

export type RoleCatalogMap = Record<string, RoleCatalogEntry>;

export function loadHiddenPresetRoleIds(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HIDDEN_PRESET_ROLE_IDS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function loadRoleCatalog(): RoleCatalogMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ROLE_CATALOG_KEY);
    const o = raw ? JSON.parse(raw) : {};
    if (!o || typeof o !== 'object') return {};
    const out: RoleCatalogMap = {};
    for (const [k, v] of Object.entries(o)) {
      if (!v || typeof v !== 'object') continue;
      const c = (v as { color?: unknown; updatedAt?: unknown }).color;
      const u = (v as { updatedAt?: unknown }).updatedAt;
      if (typeof c !== 'string' || typeof u !== 'number' || !Number.isFinite(u)) continue;
      out[k] = { color: c, updatedAt: u };
    }
    return out;
  } catch {
    return {};
  }
}

export function saveHiddenPresetRoleIds(ids: string[], opts?: { fromSync?: boolean }): void {
  try {
    const uniq = [...new Set(ids)].sort((a, b) => a.localeCompare(b));
    localStorage.setItem(HIDDEN_PRESET_ROLE_IDS_KEY, JSON.stringify(uniq));
  } catch {
    /* ignore */
  }
  if (!opts?.fromSync) notifyCollectionStateChanged('user');
}

export function saveRoleCatalog(map: RoleCatalogMap, opts?: { fromSync?: boolean }): void {
  try {
    localStorage.setItem(ROLE_CATALOG_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
  if (!opts?.fromSync) notifyCollectionStateChanged('user');
}

export function upsertRoleCatalogColor(roleId: string, color: string): void {
  const cur = loadRoleCatalog();
  cur[roleId] = { color, updatedAt: Date.now() };
  saveRoleCatalog(cur);
}

export function addHiddenPresetRoleId(presetId: string): void {
  const cur = loadHiddenPresetRoleIds();
  if (cur.includes(presetId)) return;
  saveHiddenPresetRoleIds([...cur, presetId]);
}

/** 合并角色 id 时迁移目录中的颜色条目 */
export function migrateRoleCatalogId(oldId: string, newId: string): void {
  if (oldId === newId) return;
  const cat = loadRoleCatalog();
  if (!cat[oldId]) return;
  const next = { ...cat };
  next[newId] = { ...cat[oldId], updatedAt: Date.now() };
  delete next[oldId];
  saveRoleCatalog(next);
}

export function removeRoleCatalogEntry(roleId: string): void {
  const cat = loadRoleCatalog();
  if (!cat[roleId]) return;
  const next = { ...cat };
  delete next[roleId];
  saveRoleCatalog(next);
}
