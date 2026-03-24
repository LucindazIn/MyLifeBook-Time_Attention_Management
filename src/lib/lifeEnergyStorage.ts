import { format } from 'date-fns';

const PREFIX = 'feather_life_energy_';

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
  computedEnergy?: number
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
  computedEnergy?: number
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
}
