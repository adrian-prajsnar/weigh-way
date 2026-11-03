import { addMonths, fromDateKey, getTodayDate, toDateKey } from './format';
import { t } from './i18n';
import { DateRange } from './types';

export type AgeParts = {
  years: number;
  months: number;
  days: number;
  /** Age in months, including a day fraction, for CDC LMS lookup. */
  ageMonths: number;
};

function birthdayOnYear(birth: Date, year: number): Date {
  const month = birth.getMonth();
  const day = birth.getDate();
  const candidate = new Date(year, month, day);
  candidate.setHours(0, 0, 0, 0);

  if (month === 1 && day === 29 && candidate.getMonth() !== 1) {
    return new Date(year, 1, 28);
  }

  return candidate;
}

export function getAgeOnDate(birthDateKey: string, onDateKey: string): AgeParts | null {
  if (onDateKey < birthDateKey) {
    return null;
  }

  const birth = fromDateKey(birthDateKey);
  const onDate = fromDateKey(onDateKey);

  let wholeMonths =
    (onDate.getFullYear() - birth.getFullYear()) * 12 + onDate.getMonth() - birth.getMonth();
  if (addMonths(birth, wholeMonths) > onDate) {
    wholeMonths -= 1;
  }
  const anniversary = addMonths(birth, wholeMonths);
  const nextAnniversary = addMonths(birth, wholeMonths + 1);
  // Calendar days must not shrink or grow across daylight-saving transitions.
  const dayNumber = (date: Date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  const dayDiff = dayNumber(onDate) - dayNumber(anniversary);
  const monthDays = dayNumber(nextAnniversary) - dayNumber(anniversary);
  const ageMonths = wholeMonths + dayDiff / monthDays;

  return {
    years: Math.floor(wholeMonths / 12),
    months: wholeMonths % 12,
    days: dayDiff,
    ageMonths,
  };
}

export function getLastBirthdayDate(birthDateKey: string, todayInput?: Date): Date {
  const today = todayInput ? new Date(todayInput) : getTodayDate();
  today.setHours(0, 0, 0, 0);
  const birth = fromDateKey(birthDateKey);
  const thisYear = birthdayOnYear(birth, today.getFullYear());

  if (thisYear.getTime() <= today.getTime()) {
    return thisYear;
  }

  return birthdayOnYear(birth, today.getFullYear() - 1);
}

export function getLastBirthdayKey(birthDateKey: string, todayInput?: Date): string {
  return toDateKey(getLastBirthdayDate(birthDateKey, todayInput));
}

export function getThisAgeYearRange(birthDateKey: string, todayInput?: Date): DateRange {
  const today = todayInput ? new Date(todayInput) : getTodayDate();
  today.setHours(0, 0, 0, 0);
  return {
    start: toDateKey(getLastBirthdayDate(birthDateKey, today)),
    end: toDateKey(today),
  };
}

export function getLastAgeYearRange(birthDateKey: string, todayInput?: Date): DateRange {
  const today = todayInput ? new Date(todayInput) : getTodayDate();
  today.setHours(0, 0, 0, 0);
  const lastBirthday = getLastBirthdayDate(birthDateKey, today);
  const end = new Date(lastBirthday);
  end.setDate(end.getDate() - 1);
  const birth = fromDateKey(birthDateKey);
  const start = birthdayOnYear(birth, lastBirthday.getFullYear() - 1);
  return {
    start: toDateKey(start),
    end: toDateKey(end),
  };
}

export function formatAge(age: AgeParts | null): string {
  if (!age) {
    return t('common.emDash');
  }

  if (age.years < 18) {
    return t('age.yearsMonths', {
      years: t('age.years', { count: age.years }),
      months: t('age.months', { count: age.months }),
    });
  }

  return t('age.years', { count: age.years });
}

export function formatAgeDetailed(age: AgeParts | null): string {
  if (!age) {
    return t('common.emDash');
  }

  return t('age.yearsMonthsDays', {
    years: t('age.years', { count: age.years }),
    months: t('age.months', { count: age.months }),
    days: t('age.days', { count: age.days }),
  });
}
