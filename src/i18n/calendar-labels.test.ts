import { describe, expect, it } from 'vitest';
import { getCalendarDayLabel, getCalendarMonthTitle, getCalendarWeekdayNames } from './calendar-labels';

describe('getCalendarDayLabel', () => {
  it('uses the grammatical month name and retains the range detail', () => {
    expect(getCalendarDayLabel('pl', '2026-03-01', 'Początek zakresu')).toBe(
      'niedziela, 1 marca 2026. Początek zakresu',
    );
  });
});

describe('getCalendarMonthTitle', () => {
  it('formats the month heading per locale', () => {
    expect(getCalendarMonthTitle('en', 2026, 9)).toBe('October 2026');
    expect(getCalendarMonthTitle('pl', 2026, 0)).toMatch(/2026$/);
  });
});

describe('getCalendarWeekdayNames', () => {
  it('starts on Sunday by default', () => {
    expect(getCalendarWeekdayNames('en')).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ]);
  });

  it('rotates to start on Monday', () => {
    expect(getCalendarWeekdayNames('pl', 1)).toEqual(['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd']);
  });
});
