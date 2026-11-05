import { describe, expect, it } from 'vitest';
import {
  getRangeDayCount,
  getRangeDaysInMonth,
  getRangeSelectionBounds,
  selectRangeDate,
} from './date-range-selection';
import { translateForLocale } from '../i18n';
import {
  addDays,
  fromDateKey,
  getHistoryLatestTo,
  getTrendLatestTo,
  toDateKey,
  validateHistoryDateRange,
  validateTrendDateRange,
} from '../format';

describe('getRangeSelectionBounds', () => {
  const today = '2026-11-04';
  const selection = { start: '2025-01-01', end: null, active: 'end' as const };

  it('caps History end dates at the existing one-year limit', () => {
    const latest = getHistoryLatestTo(fromDateKey(selection.start), fromDateKey(today));
    expect(getRangeSelectionBounds(selection, undefined, today, toDateKey(latest))).toEqual({
      minimumDate: selection.start,
      maximumDate: '2026-01-01',
    });
    expect(
      validateHistoryDateRange(fromDateKey(selection.start), latest, fromDateKey(today)),
    ).toBeNull();
    expect(
      validateHistoryDateRange(
        fromDateKey(selection.start),
        addDays(latest, 1),
        fromDateKey(today),
      ),
    ).toBe('maxSpanExceeded');
  });

  it.each([
    ['day', '2025-01-01', '2025-12-31'],
    ['week', '2020-01-01', '2025-01-01'],
    ['month', '2000-01-01', '2025-01-01'],
    ['year', '1920-01-01', '2020-01-01'],
    ['ageYear', '1920-01-01', '2020-01-01'],
  ] as const)('caps %s comparisons at their existing limit', (mode, start, expectedEnd) => {
    const latest = getTrendLatestTo(fromDateKey(start), mode, fromDateKey(today));
    const bounds = getRangeSelectionBounds(
      { ...selection, start },
      undefined,
      today,
      toDateKey(latest),
    );
    expect(bounds.maximumDate).toBe(expectedEnd);
    expect(validateTrendDateRange(fromDateKey(start), latest, mode, fromDateKey(today))).toBeNull();
    expect(
      validateTrendDateRange(fromDateKey(start), addDays(latest, 1), mode, fromDateKey(today)),
    ).toBe('maxSpanExceeded');
  });

  it('keeps an earlier screen maximum, including today, when the span limit is later', () => {
    expect(
      getRangeSelectionBounds({ ...selection, start: '2026-10-01' }, undefined, today, '2027-10-01')
        .maximumDate,
    ).toBe(today);
  });

  it('releases the span limit when editing the start date', () => {
    expect(
      getRangeSelectionBounds({ ...selection, active: 'start' }, '1990-01-01', today, '2026-01-01'),
    ).toEqual({
      minimumDate: '1990-01-01',
      maximumDate: today,
    });
  });

  it('keeps the birth-date floor and allows uncapped custom ranges', () => {
    expect(getRangeSelectionBounds(selection, '2025-02-01', today)).toEqual({
      minimumDate: '2025-02-01',
      maximumDate: today,
    });
  });

  it('supports a span cap without a global maximum and leaves empty drafts unrestricted', () => {
    expect(getRangeSelectionBounds(selection, undefined, undefined, '2026-01-01').maximumDate).toBe(
      '2026-01-01',
    );
    expect(
      getRangeSelectionBounds(
        { start: null, end: null, active: 'end' },
        undefined,
        today,
        '2026-01-01',
      ),
    ).toEqual({
      minimumDate: undefined,
      maximumDate: today,
    });
  });
});

describe('range endpoint labels', () => {
  it.each([
    ['start', 'From', 'Od'],
    ['end', 'To', 'Do'],
    ['rangeStart', 'Range start', 'Początek zakresu'],
    ['rangeEnd', 'Range end', 'Koniec zakresu'],
    ['rangeSingleDay', 'Range start and end', 'Początek i koniec zakresu'],
  ] as const)('localizes %s', (key, english, polish) => {
    const keys = {
      start: 'dateRange.start',
      end: 'dateRange.end',
      rangeStart: 'dateRange.rangeStart',
      rangeEnd: 'dateRange.rangeEnd',
      rangeSingleDay: 'dateRange.rangeSingleDay',
    } as const;
    expect(translateForLocale(keys[key], 'en')).toBe(english);
    expect(translateForLocale(keys[key], 'pl')).toBe(polish);
  });
});

describe('getRangeDayCount', () => {
  it.each([
    ['2026-10-01', '2026-10-01', 1],
    ['2026-10-01', '2026-10-20', 20],
    ['2026-10-01', '2026-10-30', 30],
    ['2026-01-01', '2026-03-01', 60],
    ['2024-02-28', '2024-03-01', 3],
    ['2026-03-28', '2026-03-30', 3],
    ['2026-10-24', '2026-10-26', 3],
    ['2025-12-31', '2026-01-01', 2],
  ])('counts %s through %s inclusively as %i days', (start, end, expected) => {
    expect(getRangeDayCount(start, end)).toBe(expected);
  });

  it('counts just the start as one selected day while awaiting the end', () => {
    expect(getRangeDayCount('2026-10-01', null)).toBe(1);
  });

  it('has no count for an empty or reversed range', () => {
    expect(getRangeDayCount(null, null)).toBeNull();
    expect(getRangeDayCount('2026-10-02', '2026-10-01')).toBeNull();
  });
});

describe('selected day labels', () => {
  it.each([
    [1, '1 day selected', 'Wybrano 1 dzień'],
    [2, '2 days selected', 'Wybrano 2 dni'],
    [12, '12 days selected', 'Wybrano 12 dni'],
    [30, '30 days selected', 'Wybrano 30 dni'],
  ])('localizes %i selected days', (count, english, polish) => {
    expect(translateForLocale('dateRange.selectedDays', 'en', { count })).toBe(english);
    expect(translateForLocale('dateRange.selectedDays', 'pl', { count })).toBe(polish);
  });
});

describe('selectRangeDate', () => {
  it('moves to the end after choosing the start', () => {
    expect(selectRangeDate({ start: null, end: null, active: 'start' }, '2026-10-01')).toEqual({
      start: '2026-10-01',
      end: null,
      active: 'end',
    });
  });

  it('allows a same-day range', () => {
    expect(
      selectRangeDate({ start: '2026-10-01', end: null, active: 'end' }, '2026-10-01'),
    ).toEqual({
      start: '2026-10-01',
      end: '2026-10-01',
      active: 'end',
    });
  });

  it('keeps a valid end when editing the start', () => {
    expect(
      selectRangeDate({ start: '2026-10-01', end: '2026-10-20', active: 'start' }, '2026-10-10')
        .end,
    ).toBe('2026-10-20');
  });

  it('clears the end when the new start is later', () => {
    expect(
      selectRangeDate({ start: '2026-10-01', end: '2026-10-20', active: 'start' }, '2026-10-21'),
    ).toEqual({
      start: '2026-10-21',
      end: null,
      active: 'end',
    });
  });

  it('rejects an end before the start', () => {
    const selection = { start: '2026-10-10', end: null, active: 'end' as const };
    expect(selectRangeDate(selection, '2026-10-09')).toEqual(selection);
  });
});

describe('getRangeDaysInMonth', () => {
  it('marks a single start while awaiting an end', () => {
    expect(getRangeDaysInMonth('2026-10-01', null, '2026-10-01')).toEqual(['2026-10-01']);
  });

  it('includes both endpoints across a year boundary', () => {
    expect(getRangeDaysInMonth('2025-12-30', '2026-01-02', '2026-01-01')).toEqual([
      '2026-01-01',
      '2026-01-02',
    ]);
    expect(getRangeDaysInMonth('2025-12-30', '2026-01-02', '2025-12-01')).toEqual([
      '2025-12-30',
      '2025-12-31',
    ]);
  });

  it('bounds long ranges to the visible month and handles leap years', () => {
    expect(getRangeDaysInMonth('2000-01-01', '2026-12-31', '2024-02-01')).toHaveLength(29);
  });

  it('does not mark dates outside the range or an empty selection', () => {
    expect(getRangeDaysInMonth('2026-10-01', '2026-10-20', '2026-11-01')).toEqual([]);
    expect(getRangeDaysInMonth(null, null, '2026-10-01')).toEqual([]);
  });
});
