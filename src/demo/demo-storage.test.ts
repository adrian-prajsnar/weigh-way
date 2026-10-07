import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    const entries = await getDemoWeightEntries();
    expect(entries.length).toBeGreaterThan(0);
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
