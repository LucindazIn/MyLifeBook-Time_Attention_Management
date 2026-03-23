import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AppLanguage } from '@/types';

interface DayVibesProps {
  dateKey: string;
  energy?: number;
  mood?: number;
  focus?: number;
  language: AppLanguage;
  onChange: (vibes: { energy?: number; mood?: number; focus?: number }) => void;
}

const SLIDERS = [
  { key: 'energy' as const, labelZh: '能量', labelEn: 'Energy', low: '😴', high: '⚡' },
  { key: 'mood' as const, labelZh: '心情', labelEn: 'Mood', low: '😔', high: '🙂' },
  { key: 'focus' as const, labelZh: '专注', labelEn: 'Focus', low: '🌫️', high: '🎯' },
];

export const DayVibes: React.FC<DayVibesProps> = ({ dateKey, energy, mood, focus, language, onChange }) => {
  const [values, setValues] = useState({ energy: energy ?? 50, mood: mood ?? 50, focus: focus ?? 50 });
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    setValues({ energy: energy ?? 50, mood: mood ?? 50, focus: focus ?? 50 });
    setHasInteracted(false);
  }, [dateKey, energy, mood, focus]);

  const handleChange = (key: 'energy' | 'mood' | 'focus', val: number) => {
    const next = { ...values, [key]: val };
    setValues(next);
    setHasInteracted(true);
  };

  const handleCommit = () => {
    if (hasInteracted) {
      onChange(values);
    }
  };

  const title = language === 'zh' ? '今天的状态' : "Today's Vibes";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface rounded-2xl p-5 shadow-sm border border-border"
    >
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">{title}</h3>
      <div className="space-y-4">
        {SLIDERS.map(({ key, labelZh, labelEn, low, high }) => {
          const val = values[key];
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-muted-foreground">{language === 'zh' ? labelZh : labelEn}</span>
                <span className="text-xs text-foreground tabular-nums">{val}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{low}</span>
                <div className="relative flex-1 h-2 rounded-full bg-field overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full transition-[width]"
                    style={{ width: `${val}%`, backgroundColor: 'var(--app-accent)' }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={val}
                    onChange={e => handleChange(key, Number(e.target.value))}
                    onMouseUp={handleCommit}
                    onTouchEnd={handleCommit}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <span className="text-base leading-none">{high}</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
