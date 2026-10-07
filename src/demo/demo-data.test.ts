import { describe, expect, it } from 'vitest';
import { toDateKey } from '../format';
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG } from '../units';
import {
  DEMO_HEIGHT_ENTRIES,
  buildDemoWeightEntries,
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
  const today = new Date(2026, 9, 4);

  it('covers today, skips some days, and stays inside the stored weight range', () => {
    const entries = buildDemoWeightEntries(today);
    const dates = entries.map((entry) => entry.date);

    expect(dates[0]).toBe(toDateKey(today));
    expect(new Set(dates).size).toBe(dates.length);
    expect(entries.length).toBeGreaterThan(50);
    expect(entries.length).toBeLessThan(141);
    expect(entries.every((entry) => entry.weightKg >= MIN_WEIGHT_KG && entry.weightKg <= MAX_WEIGHT_KG)).toBe(
      true,
    );
    expect(DEMO_HEIGHT_ENTRIES[0].effectiveDate < toDateKey(today)).toBe(true);
  });
});
