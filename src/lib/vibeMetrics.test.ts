import { describe, it, expect } from 'vitest';
import { computeDayVibeAvgs, vibeMetricColor, VIBE_METRICS } from '@/lib/vibeMetrics';

describe('vibeMetrics', () => {
  it('computeDayVibeAvgs averages recorded days only', () => {
    const days = [new Date('2026-05-01'), new Date('2026-05-02')];
    const avgs = computeDayVibeAvgs(days, {
      '2026-05-01': { energy: 80, mood: 60 },
      '2026-05-02': { energy: 40, focus: 100 },
    });
    expect(avgs.energy).toBe(60);
    expect(avgs.mood).toBe(60);
    expect(avgs.focus).toBe(100);
  });

  it('vibeMetricColor picks tier by average', () => {
    const m = VIBE_METRICS[0];
    expect(vibeMetricColor(m, 80)).toBe(m.colorHigh);
    expect(vibeMetricColor(m, 50)).toBe(m.colorMid);
    expect(vibeMetricColor(m, 10)).toBe(m.colorLow);
  });
});
