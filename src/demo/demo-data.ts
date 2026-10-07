import { toDateKey } from '../format';
import { BiologicalSex, HeightEntry, WeightEntry } from '../types';

export const DEMO_EMAIL = 'demo@weighway.app';
export const DEMO_MEMBER_SINCE = '2026-01-08T00:00:00.000Z';
export const DEMO_BIRTH_DATE = '1992-04-18';
export const DEMO_SEX: BiologicalSex = 'male';

export const DEMO_HEIGHT_ENTRIES: HeightEntry[] = [
  { effectiveDate: '2024-03-01', heightCm: 181 },
  { effectiveDate: '2025-11-12', heightCm: 182 },
];

export function buildDemoWeightEntries(today: Date): WeightEntry[] {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const spanDays = 140;
  const entries: WeightEntry[] = [];

  for (let daysAgo = spanDays; daysAgo >= 0; daysAgo -= 1) {
    if (daysAgo % 7 === 4) {
      continue;
    }

    const date = new Date(start);
    date.setDate(start.getDate() - daysAgo);
    const progress = (spanDays - daysAgo) / spanDays;
    const wave = Math.sin(daysAgo / 4.5) * 0.28;
    const weightKg = Math.round((80.4 - progress * 3.15 + wave) * 100) / 100;
    const key = toDateKey(date);
    const stamp = `${key}T07:15:00.000Z`;
    entries.push({
      date: key,
      weightKg,
      createdAt: stamp,
      updatedAt: stamp,
    });
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}
