import { describe, expect, it } from 'vitest';
import {
  filterEntriesByRange,
  getComparison,
  getDashboardPeriodRange,
  getLast7WeighIns,
  getTrendRows,
} from './stats';
import { WeightEntry } from './types';

const entries: WeightEntry[] = [
  {
    date: '2023-06-01',
    weightKg: 80,
    createdAt: '2023-06-01T08:00:00.000Z',
    updatedAt: '2023-06-01T08:00:00.000Z',
  },
  {
    date: '2024-01-15',
    weightKg: 78,
    createdAt: '2024-01-15T08:00:00.000Z',
    updatedAt: '2024-01-15T08:00:00.000Z',
  },
  {
    date: '2024-06-01',
    weightKg: 77,
    createdAt: '2024-06-01T08:00:00.000Z',
    updatedAt: '2024-06-01T08:00:00.000Z',
  },
  {
    date: '2024-06-02',
    weightKg: 76.5,
    createdAt: '2024-06-02T08:00:00.000Z',
    updatedAt: '2024-06-02T08:00:00.000Z',
  },
];

describe('getDashboardPeriodRange', () => {
  it('uses the previous calendar year for lastYear', () => {
    const today = new Date(2024, 8, 14);
    expect(getDashboardPeriodRange('lastYear', today)).toEqual({
      start: '2023-01-01',
      end: '2023-12-31',
    });
  });

  it('uses this week from Monday through today', () => {
    const today = new Date(2024, 8, 18);
    expect(getDashboardPeriodRange('thisWeek', today)).toEqual({
      start: '2024-09-16',
      end: '2024-09-18',
    });
  });

  it('uses the previous age year for lastAgeYear when birth date is set', () => {
    const today = new Date(2024, 8, 14);
    expect(getDashboardPeriodRange('lastAgeYear', today, '1990-05-10')).toEqual({
      start: '2023-05-10',
      end: '2024-05-09',
    });
  });
});

describe('filterEntriesByRange', () => {
  it('includes entries on both range boundaries', () => {
    const filtered = filterEntriesByRange(entries, {
      start: '2024-01-01',
      end: '2024-12-31',
    });
    expect(filtered.map((entry) => entry.date)).toEqual([
      '2024-01-15',
      '2024-06-01',
      '2024-06-02',
    ]);
  });
});

describe('getLast7WeighIns', () => {
  it('returns the seven most recent weigh-ins by date', () => {
    const manyEntries: WeightEntry[] = Array.from({ length: 10 }, (_, index) => ({
      date: `2024-06-${String(index + 1).padStart(2, '0')}`,
      weightKg: 80 - index,
      createdAt: `2024-06-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`,
      updatedAt: `2024-06-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`,
    }));

    expect(getLast7WeighIns(manyEntries).map((entry) => entry.date)).toEqual([
      '2024-06-10',
      '2024-06-09',
      '2024-06-08',
      '2024-06-07',
      '2024-06-06',
      '2024-06-05',
      '2024-06-04',
    ]);
  });

  it('returns all entries when fewer than seven exist', () => {
    expect(getLast7WeighIns(entries).map((entry) => entry.date)).toEqual([
      '2024-06-02',
      '2024-06-01',
      '2024-01-15',
      '2023-06-01',
    ]);
  });
});

describe('getTrendRows', () => {
  it('builds daily rows with per-day weights and deltas', () => {
    const rows = getTrendRows(
      entries,
      'day',
      { start: '2024-06-01', end: '2024-06-02' },
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].stats.average).toBe(76.5);
    expect(rows[0].deltaToOlder).toBe(-0.5);
  });

  it('omits days without a weigh-in from daily trend rows', () => {
    const rows = getTrendRows(
      entries,
      'day',
      { start: '2024-06-01', end: '2024-06-03' },
    );

    expect(rows.map((row) => row.range.start)).toEqual(['2024-06-02', '2024-06-01']);
    expect(rows).toHaveLength(2);
    expect(rows[0].deltaToOlder).toBe(-0.5);
  });

  it('omits weeks without weigh-ins from weekly trend rows', () => {
    const rows = getTrendRows(
      entries,
      'week',
      { start: '2024-06-01', end: '2024-06-16' },
    );

    expect(rows.every((row) => row.stats.count > 0)).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0].stats.average).toBe(76.75);
  });
});

describe('getComparison', () => {
  it('compares custom period averages', () => {
    const result = getComparison(
      entries,
      'custom',
      {
        rangeA: { start: '2024-06-01', end: '2024-06-02' },
        rangeB: { start: '2024-01-15', end: '2024-01-15' },
      },
    );

    expect(result?.statsA.average).toBe(76.75);
    expect(result?.statsB.average).toBe(78);
    expect(result?.difference).toBe(-1.25);
  });

  it('returns null for invalid custom ranges', () => {
    expect(
      getComparison(entries, 'custom', {
        rangeA: { start: '2024-06-02', end: '2024-06-01' },
        rangeB: { start: '2024-01-15', end: '2024-01-15' },
      }),
    ).toBeNull();
  });
});
