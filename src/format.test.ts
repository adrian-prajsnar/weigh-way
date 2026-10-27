import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getI18nLocale, setI18nLocale } from './i18n';
import {
  formatDecimal,
  formatWeightValue,
  fromDateKey,
  getHistoryDateRangeFieldHighlight,
  getTrendDateRangeFieldHighlight,
  parseWeightInput,
  resolveWeightKgForSave,
  toDateKey,
  validateHistoryDateRange,
  validateTrendDateRange,
} from './format';
import { WeightEntry } from './types';
import {
  BIRTHDAY_WINDOW_DAYS,
  getChangeSinceLastBirthday,
  nearestEntryWithinDays,
} from './weight-insights';

describe('locale-aware weight formatting', () => {
  let previousLocale = getI18nLocale();

  beforeEach(() => {
    previousLocale = getI18nLocale();
    setI18nLocale('en');
  });

  afterEach(() => {
    setI18nLocale(previousLocale);
  });

  it('formats metric weights with a comma decimal separator in Polish', () => {
    setI18nLocale('pl');
    expect(formatWeightValue(82, 'metric')).toBe('82,00');
    expect(formatDecimal(1.5, 1, 1)).toBe('1,5');
  });

  it('keeps a dot decimal separator in English', () => {
    setI18nLocale('en');
    expect(formatWeightValue(82, 'metric')).toBe('82.00');
  });
});

describe('parseWeightInput', () => {
  it('accepts valid metric weights', () => {
    expect(parseWeightInput('75.50', 'metric')).toBe(75.5);
    expect(parseWeightInput('75,50', 'metric')).toBe(75.5);
  });

  it('rejects out-of-range metric weights', () => {
    expect(parseWeightInput('10', 'metric')).toBeNull();
    expect(parseWeightInput('abc', 'metric')).toBeNull();
  });

  it('accepts valid imperial weights', () => {
    expect(parseWeightInput('165.5', 'imperial')).not.toBeNull();
  });

  it('preserves stored kg when imperial display is unchanged', () => {
    const storedKg = 73.1;
    const display = formatWeightValue(storedKg, 'imperial');
    expect(resolveWeightKgForSave(display, 'imperial', storedKg)).toBe(storedKg);
    expect(parseWeightInput(display, 'imperial')).not.toBe(storedKg);
  });
});

describe('validateHistoryDateRange', () => {
  const today = fromDateKey('2024-09-14');

  it('rejects reversed ranges', () => {
    expect(
      validateHistoryDateRange(fromDateKey('2024-09-15'), fromDateKey('2024-09-01'), today),
    ).toBe('invalidOrder');
  });

  it('rejects future end dates', () => {
    expect(
      validateHistoryDateRange(fromDateKey('2024-09-01'), fromDateKey('2024-09-20'), today),
    ).toBe('futureDate');
  });
});

describe('validateTrendDateRange', () => {
  const today = fromDateKey('2024-09-14');

  it('rejects day ranges longer than one year', () => {
    expect(
      validateTrendDateRange(
        fromDateKey('2023-01-01'),
        fromDateKey('2024-09-14'),
        'day',
        today,
      ),
    ).toBe('maxSpanExceeded');
  });
});

describe('getHistoryDateRangeFieldHighlight', () => {
  const today = fromDateKey('2024-09-14');

  it('highlights from when the range order is reversed', () => {
    const error = validateHistoryDateRange(
      fromDateKey('2024-09-15'),
      fromDateKey('2024-09-01'),
      today,
    );
    expect(
      getHistoryDateRangeFieldHighlight(
        error,
        fromDateKey('2024-09-15'),
        fromDateKey('2024-09-01'),
        today,
      ),
    ).toEqual({ from: true, to: false });
  });

  it('highlights to when the end date is in the future', () => {
    const error = validateHistoryDateRange(
      fromDateKey('2024-09-01'),
      fromDateKey('2024-09-20'),
      today,
    );
    expect(
      getHistoryDateRangeFieldHighlight(
        error,
        fromDateKey('2024-09-01'),
        fromDateKey('2024-09-20'),
        today,
      ),
    ).toEqual({ from: false, to: true });
  });

  it('highlights both fields when the range is too long', () => {
    const from = fromDateKey('2023-01-01');
    const to = fromDateKey('2024-09-14');
    const error = validateHistoryDateRange(from, to, today);
    expect(getHistoryDateRangeFieldHighlight(error, from, to, today)).toEqual({
      from: true,
      to: true,
    });
  });
});

describe('getTrendDateRangeFieldHighlight', () => {
  const today = fromDateKey('2024-09-14');

  it('highlights both fields when the day range is too long', () => {
    const from = fromDateKey('2023-01-01');
    const to = fromDateKey('2024-09-14');
    const error = validateTrendDateRange(from, to, 'day', today);
    expect(getTrendDateRangeFieldHighlight(error, from, to, 'day', today)).toEqual({
      from: true,
      to: true,
    });
  });
});

describe('nearestEntryWithinDays', () => {
  const entries: WeightEntry[] = [
    {
      date: '2024-09-01',
      weightKg: 80,
      createdAt: '2024-09-01T08:00:00.000Z',
      updatedAt: '2024-09-01T08:00:00.000Z',
    },
    {
      date: '2024-09-10',
      weightKg: 79,
      createdAt: '2024-09-10T08:00:00.000Z',
      updatedAt: '2024-09-10T08:00:00.000Z',
    },
  ];

  it('picks the closest entry within the window', () => {
    expect(nearestEntryWithinDays(entries, '2024-09-02', BIRTHDAY_WINDOW_DAYS)?.date).toBe(
      '2024-09-01',
    );
  });

  it('returns null when nothing is close enough', () => {
    expect(nearestEntryWithinDays(entries, '2024-01-01', BIRTHDAY_WINDOW_DAYS)).toBeNull();
  });
});

describe('getChangeSinceLastBirthday', () => {
  it('computes change between birthday weigh-in and latest entry', () => {
    const entries: WeightEntry[] = [
      {
        date: '2024-09-01',
        weightKg: 80,
        createdAt: '2024-09-01T08:00:00.000Z',
        updatedAt: '2024-09-01T08:00:00.000Z',
      },
      {
        date: '2024-09-14',
        weightKg: 78.5,
        createdAt: '2024-09-14T08:00:00.000Z',
        updatedAt: '2024-09-14T08:00:00.000Z',
      },
    ];

    const change = getChangeSinceLastBirthday(
      entries,
      '1990-09-01',
      fromDateKey('2024-09-14'),
    );

    expect(change?.changeKg).toBe(-1.5);
    expect(change?.latest.entry.date).toBe('2024-09-14');
  });
});

describe('toDateKey', () => {
  it('formats dates as ISO date keys', () => {
    expect(toDateKey(new Date(2024, 8, 5))).toBe('2024-09-05');
  });
});
