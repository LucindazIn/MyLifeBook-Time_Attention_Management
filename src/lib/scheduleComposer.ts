import type { EventType } from '@/types';

/** One row from `activities.*.json` (runtime catalog). */
export type CatalogActivity = {
  title: string;
  description: string;
  intensity: 'high' | 'low';
  mode_tags: ('productive' | 'chill' | 'both')[];
  type: EventType;
  default_duration_minutes: number;
  locale: string;
};

export type ComposerSuggestion = {
  title: string;
  description: string;
  type: EventType;
  startTime: string;
  endTime: string;
};

const DAY_START_MIN = 7 * 60;
const DAY_END_MIN = 22 * 60;
const MORNING_START_MIN = 7 * 60;
const MORNING_END_MIN = 12 * 60;
const AFTERNOON_START_MIN = 12 * 60;
const AFTERNOON_END_MIN = 18 * 60;
const LUNCH_START_MIN = 12 * 60;
const LUNCH_END_MIN = 13 * 60;

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32). */
export function createRng(seedStr: string): () => number {
  let state = hashSeed(seedStr) || 1;
  return () => {
    let t = (state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

function minutesToHHMM(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** If an event would cross the lunch window, start it after lunch instead. */
export function nextEventSlot(cursorMin: number, durationMin: number): [number, number] {
  const d = Math.max(5, durationMin);
  let start = cursorMin;
  if (start >= LUNCH_START_MIN && start < LUNCH_END_MIN) start = LUNCH_END_MIN;
  let end = start + d;
  if (start < LUNCH_START_MIN && end > LUNCH_START_MIN) {
    start = LUNCH_END_MIN;
    end = start + d;
  }
  return [start, end];
}

function filterForMode(items: CatalogActivity[], mode: 'chill' | 'productive', locale: string): CatalogActivity[] {
  return items.filter((it) => it.locale === locale && (it.mode_tags.includes(mode) || it.mode_tags.includes('both')));
}

function splitByIntensity(items: CatalogActivity[]): { high: CatalogActivity[]; low: CatalogActivity[] } {
  const high: CatalogActivity[] = [];
  const low: CatalogActivity[] = [];
  for (const it of items) {
    if (it.intensity === 'high') high.push(it);
    else low.push(it);
  }
  return { high, low };
}

function pickNWithOptionalRepeat<T>(pool: T[], n: number, rng: () => number): T[] {
  if (pool.length === 0) return [];
  if (pool.length >= n) {
    const copy = [...pool];
    shuffleInPlace(copy, rng);
    return copy.slice(0, n);
  }
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    out.push(pool[Math.floor(rng() * pool.length)]!);
  }
  return out;
}

function pickFive(
  mode: 'chill' | 'productive',
  filtered: CatalogActivity[],
  rng: () => number
): CatalogActivity[] {
  const { high, low } = splitByIntensity(filtered);
  if (mode === 'productive') {
    const highs = high.length ? pickNWithOptionalRepeat(high, 4, rng) : pickNWithOptionalRepeat(filtered, 4, rng);
    const lows = low.length ? pickNWithOptionalRepeat(low, 1, rng) : pickNWithOptionalRepeat(filtered, 1, rng);
    return [...highs, ...lows];
  }
  const lows = low.length ? pickNWithOptionalRepeat(low, 4, rng) : pickNWithOptionalRepeat(filtered, 4, rng);
  const highs = high.length ? pickNWithOptionalRepeat(high, 1, rng) : pickNWithOptionalRepeat(filtered, 1, rng);
  return [...lows, ...highs];
}

function randomInt(min: number, max: number, rng: () => number): number {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

function pickStartWithinWindow(windowStart: number, windowEnd: number, durationMin: number, rng: () => number): number {
  const latest = Math.max(windowStart, windowEnd - durationMin);
  return randomInt(windowStart, latest, rng);
}

function assignTimeline(events: CatalogActivity[], rng: () => number): ComposerSuggestion[] {
  const order = [...events];
  shuffleInPlace(order, rng);
  const count = order.length;
  const morningIndex = count > 0 ? Math.floor(rng() * count) : -1;
  let afternoonIndex = -1;
  if (count > 1) {
    afternoonIndex = Math.floor(rng() * (count - 1));
    if (afternoonIndex >= morningIndex) afternoonIndex += 1;
  }

  const out: ComposerSuggestion[] = [];
  for (let i = 0; i < order.length; i++) {
    const ev = order[i]!;
    const dur = Math.max(5, ev.default_duration_minutes);
    let tentativeStart: number;

    if (i === morningIndex) {
      tentativeStart = pickStartWithinWindow(MORNING_START_MIN, MORNING_END_MIN, dur, rng);
    } else if (i === afternoonIndex) {
      tentativeStart = pickStartWithinWindow(AFTERNOON_START_MIN, AFTERNOON_END_MIN, dur, rng);
    } else {
      tentativeStart = pickStartWithinWindow(DAY_START_MIN, DAY_END_MIN, dur, rng);
    }

    const [startMin, endMin] = nextEventSlot(tentativeStart, dur);
    const clampedStart = endMin > DAY_END_MIN ? Math.max(DAY_START_MIN, DAY_END_MIN - dur) : startMin;
    const clampedEnd = Math.min(DAY_END_MIN, clampedStart + dur);
    out.push({
      title: ev.title,
      description: ev.description,
      type: ev.type,
      startTime: minutesToHHMM(clampedStart),
      endTime: minutesToHHMM(clampedEnd),
    });
  }
  out.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return out;
}

/**
 * Picks 5 catalog activities (4+1 by intensity vs mode), shuffles, then distributes
 * start times with hard constraints:
 * - At least one event starts in 07:00–12:00
 * - At least one event starts in 12:00–18:00
 * Remaining events are randomly placed in 07:00–22:00 (deterministic by seed).
 */
export function composeRandomDaySchedule(
  catalogItems: CatalogActivity[],
  mode: 'chill' | 'productive',
  locale: 'en' | 'zh',
  seed: string
): ComposerSuggestion[] {
  const filtered = filterForMode(catalogItems, mode, locale);
  if (filtered.length === 0) {
    return [];
  }
  const rng = createRng(seed);
  const five = pickFive(mode, filtered, rng);
  return assignTimeline(five, rng);
}
