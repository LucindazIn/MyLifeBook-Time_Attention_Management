/**
 * Random day suggestions from local activity catalog (`activities.*.json`), no network.
 */
import activitiesZh from '@/data/contentPools/activities.zh.json';
import activitiesEn from '@/data/contentPools/activities.en.json';
import { composeRandomDaySchedule, type CatalogActivity } from '@/lib/scheduleComposer';
import type { EventType } from '@/types';

export type LocalScheduleSuggestion = {
  title: string;
  startTime: string;
  endTime: string;
  type: EventType;
  description: string;
};

const zhItems = activitiesZh.items as CatalogActivity[];
const enItems = activitiesEn.items as CatalogActivity[];

export function getLocalScheduleSuggestions(
  mode: 'chill' | 'productive',
  language: string,
  options?: { seed?: string }
): LocalScheduleSuggestion[] {
  const isZh = language === 'zh';
  const items = isZh ? zhItems : enItems;
  const locale = isZh ? 'zh' : 'en';
  const seed = options?.seed ?? `fallback-${mode}-${locale}`;
  return composeRandomDaySchedule(items, mode, locale, seed);
}
