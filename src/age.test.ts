import { afterEach, describe, expect, it } from 'vitest';
import {
  formatAgeDetailed,
  getAgeOnDate,
  getLastAgeYearRange,
  getLastBirthdayKey,
  getThisAgeYearRange,
} from './age';
import { setI18nLocale } from './i18n';

describe('getAgeOnDate', () => {
  it('returns null for dates before birth', () => {
    expect(getAgeOnDate('2000-06-15', '1999-01-01')).toBeNull();
  });

  it('returns zero age on birth date', () => {
    const age = getAgeOnDate('2000-06-15', '2000-06-15');
    expect(age).toEqual({ years: 0, months: 0, days: 0, ageMonths: 0 });
  });

  it('handles Feb 29 birthdays on non-leap years', () => {
    const age = getAgeOnDate('2000-02-29', '2023-03-01');
    expect(age?.years).toBe(23);
  });

  it('caps month anniversaries and never returns negative days', () => {
    const age = getAgeOnDate('2000-01-31', '2023-03-01');
    expect(age).toMatchObject({ years: 23, months: 1, days: 1 });
    expect(age?.ageMonths).toBeCloseTo(277 + 1 / 31);
  });

  it('counts February 28 as the non-leap birthday consistently', () => {
    expect(getAgeOnDate('2000-02-29', '2027-02-28')).toEqual({
      years: 27,
      months: 0,
      days: 0,
      ageMonths: 324,
    });
    expect(getLastBirthdayKey('2000-02-29', new Date(2027, 1, 28))).toBe('2027-02-28');
  });

  it('has monotonic fractional months over short months and leap days', () => {
    for (const birth of ['2000-01-31', '2000-02-29', '2000-08-31']) {
      let previous = 0;
      for (let day = 1; day <= 365; day += 1) {
        const date = new Date(2027, 0, day);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const age = getAgeOnDate(birth, key)!;
        expect(age.days).toBeGreaterThanOrEqual(0);
        expect(age.ageMonths).toBeGreaterThan(previous);
        previous = age.ageMonths;
      }
    }
  });
});

describe('formatAgeDetailed', () => {
  afterEach(() => {
    setI18nLocale('en');
  });

  it('uses full Polish month labels with correct plural forms', () => {
    setI18nLocale('pl');
    expect(formatAgeDetailed(getAgeOnDate('2000-06-15', '2022-07-16'))).toBe(
      '22 lata, 1 miesiąc, 1 dzień',
    );
    expect(formatAgeDetailed(getAgeOnDate('2000-06-15', '2022-08-18'))).toBe(
      '22 lata, 2 miesiące, 3 dni',
    );
    expect(formatAgeDetailed(getAgeOnDate('2000-06-15', '2023-01-20'))).toBe(
      '22 lata, 7 miesięcy, 5 dni',
    );
  });
});

describe('birthday helpers', () => {
  it('finds the latest birthday on or before today', () => {
    expect(getLastBirthdayKey('1990-05-10', new Date(2024, 8, 14))).toBe('2024-05-10');
  });

  it('builds the current age-year range from the last birthday', () => {
    const today = new Date(2024, 8, 14);
    expect(getThisAgeYearRange('1990-05-10', today)).toEqual({
      start: '2024-05-10',
      end: '2024-09-14',
    });
  });

  it('builds the previous age-year range ending the day before the last birthday', () => {
    const today = new Date(2024, 8, 14);
    expect(getLastAgeYearRange('1990-05-10', today)).toEqual({
      start: '2023-05-10',
      end: '2024-05-09',
    });
  });
});
