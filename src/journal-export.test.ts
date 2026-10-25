import { describe, expect, it } from 'vitest';
import { buildJournalJson, buildWeighInsCsv, canExportJournalData } from './journal-export';
import { HeightEntry, WeightEntry } from './types';

describe('buildJournalJson', () => {
  const now = new Date('2026-03-15T10:30:00.000Z');
  const weightEntries: WeightEntry[] = [
    {
      date: '2026-01-02',
      weightKg: 80.5,
      createdAt: '2026-01-02T08:00:00.000Z',
      updatedAt: '2026-01-02T08:00:00.000Z',
    },
  ];
  const heightEntries: HeightEntry[] = [{ effectiveDate: '2025-06-01', heightCm: 175 }];

  it('includes export metadata and profile fields', () => {
    const json = buildJournalJson({
      weightEntries,
      heightEntries,
      birthDate: '1990-04-12',
      sex: 'female',
      now,
    });
    const parsed = JSON.parse(json) as {
      exportedAt: string;
      birthDate: string;
      sex: string;
      heightEntries: HeightEntry[];
      weightEntries: WeightEntry[];
    };

    expect(parsed.exportedAt).toBe(now.toISOString());
    expect(parsed.birthDate).toBe('1990-04-12');
    expect(parsed.sex).toBe('female');
    expect(parsed.heightEntries).toEqual(heightEntries);
    expect(parsed.weightEntries).toEqual(weightEntries);
  });
});

describe('canExportJournalData', () => {
  it('blocks export when weight or profile data failed to load', () => {
    expect(canExportJournalData({ weightEntriesError: null, profileError: null })).toBe(true);
    expect(canExportJournalData({ weightEntriesError: 'x', profileError: null })).toBe(false);
    expect(canExportJournalData({ weightEntriesError: null, profileError: 'y' })).toBe(false);
  });
});

describe('buildWeighInsCsv', () => {
  it('uses header and sorts rows by date ascending', () => {
    const csv = buildWeighInsCsv([
      {
        date: '2026-03-01',
        weightKg: 77,
        createdAt: '',
        updatedAt: '',
      },
      {
        date: '2026-01-15',
        weightKg: 79.2,
        createdAt: '',
        updatedAt: '',
      },
    ]);

    expect(csv).toBe('date,weight_kg\n2026-01-15,79.2\n2026-03-01,77\n');
  });
});
