import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as format from '../format';
import { toDateKey } from '../format';
import { getDemoLatestWeighInDate } from './demo-data';
import {
  deleteDemoWeightEntry,
  getDemoWeightEntries,
  saveDemoHeight,
  saveDemoUserProfile,
  saveDemoWeightEntry,
} from './demo-storage';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
  },
}));

describe('demo-storage', () => {
  beforeEach(() => {
    store.clear();
  });

  it('seeds sample data on first load', async () => {
    const today = new Date(2026, 9, 8);
    vi.spyOn(format, 'getTodayDate').mockReturnValue(today);

    const entries = await getDemoWeightEntries();
    expect(entries[0]?.date).toBe(toDateKey(getDemoLatestWeighInDate(today)));
    expect(entries.length).toBe(1000);

    vi.restoreAllMocks();
  });

  it('reseeds weight entries when the calendar day changes', async () => {
    const firstDay = new Date(2026, 9, 7);
    const secondDay = new Date(2026, 9, 8);
    const todaySpy = vi.spyOn(format, 'getTodayDate');
    todaySpy.mockReturnValue(firstDay);

    const firstEntries = await getDemoWeightEntries();
    expect(firstEntries[0]?.date).toBe(toDateKey(getDemoLatestWeighInDate(firstDay)));

    todaySpy.mockReturnValue(secondDay);
    const secondEntries = await getDemoWeightEntries();
    expect(secondEntries[0]?.date).toBe(toDateKey(getDemoLatestWeighInDate(secondDay)));
    expect(secondEntries[0]?.date).not.toBe(firstEntries[0]?.date);

    vi.restoreAllMocks();
  });

  it('persists weight upserts and deletes', async () => {
    await saveDemoWeightEntry('2026-10-05', 79.4);
    expect(await getDemoWeightEntries()).toEqual(
      expect.arrayContaining([expect.objectContaining({ date: '2026-10-05', weightKg: 79.4 })]),
    );

    await saveDemoWeightEntry('2026-10-05', 79.1);
    const updated = (await getDemoWeightEntries()).find((entry) => entry.date === '2026-10-05');
    expect(updated?.weightKg).toBe(79.1);

    await deleteDemoWeightEntry('2026-10-05');
    expect((await getDemoWeightEntries()).some((entry) => entry.date === '2026-10-05')).toBe(false);
  });

  it('persists profile and height changes', async () => {
    await saveDemoUserProfile('1990-01-01', 'female');
    await saveDemoHeight('2026-01-01', 170);

    const reloaded = await import('./demo-storage');
    const profile = await reloaded.getDemoProfile();

    expect(profile.birthDate).toBe('1990-01-01');
    expect(profile.sex).toBe('female');
    expect(profile.heightEntries).toEqual(
      expect.arrayContaining([expect.objectContaining({ effectiveDate: '2026-01-01', heightCm: 170 })]),
    );
  });
});
