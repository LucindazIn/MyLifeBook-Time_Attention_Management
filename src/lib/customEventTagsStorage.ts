/**
 * 用户自定义「事件标签」（日程 label 文案）存在 localStorage。
 * 预设标签不写入此列表；自定义标签超过 2 天未在保存日程时选用则从列表移除。
 */

import { notifyCollectionStateChanged } from '@/lib/collectionStateNotify';

export const PRESET_EVENT_LABELS_ZH = ['深度工作', '阅读', '休息', '兴趣'] as const;
export const PRESET_EVENT_LABELS_EN = ['Work', 'Reading', 'Rest', 'Interest'] as const;

export const CUSTOM_EVENT_TAGS_KEY = 'feather_custom_event_tags';

const LAST_USED_KEY = 'feather_custom_event_tag_last_used';

/** Exported for cross-device sync payload. */
export const CUSTOM_EVENT_TAG_LAST_USED_KEY = LAST_USED_KEY;

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export function isPresetEventLabel(text: string): boolean {
  const t = text.trim();
  return (
    (PRESET_EVENT_LABELS_ZH as readonly string[]).includes(t) ||
    (PRESET_EVENT_LABELS_EN as readonly string[]).includes(t)
  );
}

function loadLastUsed(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LAST_USED_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

function saveLastUsed(m: Record<string, number>, opts?: { fromSync?: boolean }): void {
  try {
    localStorage.setItem(LAST_USED_KEY, JSON.stringify(m));
  } catch (_) {}
  if (!opts?.fromSync) notifyCollectionStateChanged('user');
}

function saveTags(tags: string[], opts?: { fromSync?: boolean }): void {
  try {
    localStorage.setItem(CUSTOM_EVENT_TAGS_KEY, JSON.stringify(tags));
  } catch (_) {}
  if (!opts?.fromSync) notifyCollectionStateChanged('user');
}

export function loadSavedCustomEventTags(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_EVENT_TAGS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** 用户保存日程时选用了该自定义标签（预设标签不记录）。 */
export function touchCustomEventLabel(tag: string): void {
  const t = tag.trim();
  if (!t || isPresetEventLabel(t)) return;
  const m = loadLastUsed();
  m[t] = Date.now();
  saveLastUsed(m);
}

/**
 * 为无时间戳的自定义标签补上「当前时间」以免升级当日被清空；
 * 删除超过 2 天未 touch 的自定义标签。预设项若误存则保留不按时长删除。
 */
export function syncAndPruneCustomEventTags(): { tags: string[]; changed: boolean } {
  if (typeof localStorage === 'undefined') return { tags: [], changed: false };
  const tags = loadSavedCustomEventTags();
  const lastUsed = loadLastUsed();
  const now = Date.now();
  let changed = false;

  const next: string[] = [];
  for (const tag of tags) {
    const t = tag.trim();
    if (!t) continue;

    if (isPresetEventLabel(t)) {
      next.push(t);
      continue;
    }

    let lu = lastUsed[t];
    if (lu == null) {
      lastUsed[t] = now;
      lu = now;
      changed = true;
    }

    if (now - lu > TWO_DAYS_MS) {
      delete lastUsed[t];
      changed = true;
      continue;
    }
    next.push(t);
  }

  if (changed) {
    saveLastUsed(lastUsed, { fromSync: true });
    saveTags(next, { fromSync: true });
    notifyCollectionStateChanged('user');
  }

  return { tags: next, changed };
}
