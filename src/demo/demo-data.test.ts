import { describe, expect, it } from 'vitest';
import { addDays, toDateKey } from '../format';
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG } from '../units';
import {
  DEMO_HEIGHT_ENTRIES,
  DEMO_WEIGHT_ENTRY_COUNT,
  DEMO_WEIGHT_NET_LOSS_KG,
  DEMO_WEIGHT_START_KG,
  DEMO_WEIGHT_STEP_KG,
  buildDemoWeightEntries,
  getDemoLatestWeighInDate,
  roundDemoWeightKg,
} from './demo-data';
import { isDemoLocation } from './demo-location';

describe('isDemoLocation', () => {
  it('matches the hosted demo path and the local query', () => {
    expect(isDemoLocation('/weigh-way/demo/', '')).toBe(true);
    expect(isDemoLocation('/weigh-way/demo/index.html', '')).toBe(true);
    expect(isDemoLocation('/', '?demo=1')).toBe(true);
    expect(isDemoLocation('/weigh-way/', '')).toBe(false);
    expect(isDemoLocation('/weigh-way/geeks/', '')).toBe(false);
  });
});

describe('buildDemoWeightEntries', () => {
  const today = new Date(2026, 9, 8);

  it('ends on yesterday, includes 1000 daily entries, and stays inside the stored weight range', () => {
    const entries = buildDemoWeightEntries(today);
    const dates = entries.map((entry) => entry.date);
    const latest = getDemoLatestWeighInDate(today);

    expect(dates[0]).toBe(toDateKey(latest));
    expect(dates.at(-1)).toBe(toDateKey(addDays(latest, -(DEMO_WEIGHT_ENTRY_COUNT - 1))));
    expect(new Set(dates).size).toBe(dates.length);
    expect(entries.length).toBe(DEMO_WEIGHT_ENTRY_COUNT);
    expect(entries.every((entry) => entry.weightKg >= MIN_WEIGHT_KG && entry.weightKg <= MAX_WEIGHT_KG)).toBe(
      true,
    );
    expect(DEMO_HEIGHT_ENTRIES[0].effectiveDate < toDateKey(today)).toBe(true);
  });

  it('uses 0.05 kg steps, realistic day-to-day swings, and ~15 kg net loss', () => {
    const entries = buildDemoWeightEntries(today);
    const isStep = (weightKg: number) =>
      Math.abs(weightKg / DEMO_WEIGHT_STEP_KG - Math.round(weightKg / DEMO_WEIGHT_STEP_KG)) < 1e-9;

    expect(entries.every((entry) => isStep(entry.weightKg))).toBe(true);
    expect(entries.at(-1)?.weightKg).toBe(roundDemoWeightKg(DEMO_WEIGHT_START_KG));
    expect(entries[0].weightKg).toBe(
      roundDemoWeightKg(DEMO_WEIGHT_START_KG - DEMO_WEIGHT_NET_LOSS_KG),
    );

    const dayChanges = entries.slice(0, -1).map(
      (entry, index) => entry.weightKg - entries[index + 1].weightKg,
    );

    expect(dayChanges.some((change) => change > 0)).toBe(true);
    expect(dayChanges.some((change) => change < 0)).toBe(true);
    expect(dayChanges.every((change) => Math.abs(change) <= 1.05)).toBe(true);
    expect(dayChanges.filter((change) => Math.abs(change) >= 0.2 && Math.abs(change) <= 0.75).length).toBeGreaterThan(
      280,
    );
    expect(dayChanges.filter((change) => Math.abs(change) >= 0.9).length).toBeGreaterThan(15);

    const oldest = entries.at(-1)?.weightKg ?? 0;
    const newest = entries[0]?.weightKg ?? 0;
    expect(oldest - newest).toBeCloseTo(DEMO_WEIGHT_NET_LOSS_KG, 1);
  });

  it('is deterministic for the same anchor day', () => {
    const first = buildDemoWeightEntries(today);
    const second = buildDemoWeightEntries(today);
    expect(second).toEqual(first);
  });

  it('uses varied morning weigh-in times and rare later edits', () => {
    const entries = buildDemoWeightEntries(today);
    const createdAtValues = entries.map((entry) => entry.createdAt);

    expect(new Set(createdAtValues).size).toBe(entries.length);

    const morningWeighIns = entries.filter((entry) => {
      const hour = new Date(entry.createdAt).getUTCHours();
      return hour >= 5 && hour <= 9;
    });
    expect(morningWeighIns.length / entries.length).toBeGreaterThan(0.7);

    const editedEntries = entries.filter((entry) => entry.updatedAt !== entry.createdAt);
    expect(editedEntries.length).toBeGreaterThan(20);
    expect(editedEntries.length).toBeLessThan(120);

    const sameDayEdits = editedEntries.filter((entry) => entry.updatedAt.startsWith(entry.date));
    expect(sameDayEdits.length / editedEntries.length).toBeGreaterThan(0.7);

    const laterDayEdits = editedEntries.filter((entry) => !entry.updatedAt.startsWith(entry.date));
    expect(laterDayEdits.length).toBeGreaterThan(2);

    expect(editedEntries.every((entry) => entry.updatedAt > entry.createdAt)).toBe(true);
  });
});
