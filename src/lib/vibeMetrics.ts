import { format } from 'date-fns';
import type { DayVibes } from '@/lib/repositories/dayMetaRepo';
import { VIBE_ICON_URL } from '@/lib/vibeIcons';

export type VibeMetricKey = 'energy' | 'mood' | 'focus';

export type VibeMetricDef = {
  key: VibeMetricKey;
  labelZh: string;
  labelEn: string;
  iconSrc: string;
  colorHigh: string;
  colorMid: string;
  colorLow: string;
};

export const VIBE_METRICS: VibeMetricDef[] = [
  {
    key: 'energy',
    labelZh: '能量',
    labelEn: 'Energy',
    iconSrc: VIBE_ICON_URL.energy,
    colorHigh: 'bg-emerald-400',
    colorMid: 'bg-amber-400',
    colorLow: 'bg-slate-300',
  },
  {
    key: 'mood',
    labelZh: '心情',
    labelEn: 'Mood',
    iconSrc: VIBE_ICON_URL.mood,
    colorHigh: 'bg-rose-400',
    colorMid: 'bg-rose-300',
    colorLow: 'bg-slate-300',
  },
  {
    key: 'focus',
    labelZh: '专注',
    labelEn: 'Focus',
    iconSrc: VIBE_ICON_URL.focus,
    colorHigh: 'bg-indigo-400',
    colorMid: 'bg-indigo-300',
    colorLow: 'bg-slate-300',
  },
];

export type VibeAvgs = Record<VibeMetricKey, number | null>;

export function vibeMetricColor(metric: VibeMetricDef, avg: number): string {
  return avg >= 70 ? metric.colorHigh : avg >= 40 ? metric.colorMid : metric.colorLow;
}

/** Average energy / mood / focus over calendar days that have vibe data. */
export function computeDayVibeAvgs(days: Date[], dayVibes: Record<string, DayVibes>): VibeAvgs {
  const sums: Record<VibeMetricKey, number> = { energy: 0, mood: 0, focus: 0 };
  const counts: Record<VibeMetricKey, number> = { energy: 0, mood: 0, focus: 0 };

  for (const day of days) {
    const dk = format(day, 'yyyy-MM-dd');
    const v = dayVibes[dk];
    if (!v) continue;
    for (const m of VIBE_METRICS) {
      const val = v[m.key];
      if (val != null) {
        sums[m.key] += val;
        counts[m.key] += 1;
      }
    }
  }

  return {
    energy: counts.energy > 0 ? Math.round(sums.energy / counts.energy) : null,
    mood: counts.mood > 0 ? Math.round(sums.mood / counts.mood) : null,
    focus: counts.focus > 0 ? Math.round(sums.focus / counts.focus) : null,
  };
}
