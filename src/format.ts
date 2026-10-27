import { getI18nLocale, t } from './i18n';
import { formatDecimal } from './i18n/locale-number-format';
import { AppLocale, getDateLocale } from './i18n/resolve-locale';
import { TranslationKey } from './i18n/translation-keys';
import {
  cmToFeetInches,
  feetInchesToCm,
  kgToLb,
  lbToKg,
  MAX_HEIGHT_CM,
  MAX_WEIGHT_KG,
  MAX_WEIGHT_LB,
  MIN_HEIGHT_CM,
  MIN_WEIGHT_KG,
  MIN_WEIGHT_LB,
  UnitSystem,
} from './units';
import { DateRange, TrendGranularity } from './types';

export function getWeightUnitLabel(units: UnitSystem): string {
  return units === 'imperial' ? t('common.lb') : t('common.kg');
}

export { formatDecimal } from './i18n/locale-number-format';

export function formatWeightValue(
  weightKg: number,
  units: UnitSystem,
  locale: AppLocale,
): string {
  if (units === 'imperial') {
    return formatDecimal(kgToLb(weightKg), 1, 1, locale);
  }
  return formatDecimal(weightKg, 2, 2, locale);
}

export function normalizeWeightInputText(input: string): string {
  return input.trim().replace(',', '.');
}

/** Resolves kg for save, preserving stored kg when the field still shows the formatted value. */
export function resolveWeightKgForSave(
  input: string,
  units: UnitSystem,
  locale: AppLocale,
  existingWeightKg?: number,
): number | null {
  const normalized = normalizeWeightInputText(input);
  if (!normalized) {
    return null;
  }

  if (existingWeightKg !== undefined) {
    const formattedExisting = formatWeightValue(existingWeightKg, units, locale);
    if (normalizeWeightInputText(formattedExisting) === normalized) {
      return existingWeightKg;
    }
  }

  return parseWeightInput(input, units);
}

export function parseWeightInput(input: string, units: UnitSystem): number | null {
  const trimmed = normalizeWeightInputText(input);
  if (!trimmed) {
    return null;
  }

  if (units === 'imperial') {
    if (!/^\d+(\.\d{0,1})?$/.test(trimmed)) {
      return null;
    }
    const pounds = Number(trimmed);
    if (!Number.isFinite(pounds) || pounds < MIN_WEIGHT_LB || pounds > MAX_WEIGHT_LB) {
      return null;
    }
    const weightKg = Math.round(lbToKg(pounds) * 100) / 100;
    if (weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) {
      return null;
    }
    return weightKg;
  }

  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) {
    return null;
  }

  const weightKg = Math.round(Number(trimmed) * 100) / 100;
  if (!Number.isFinite(weightKg) || weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) {
    return null;
  }

  return weightKg;
}

export function getWeightRangeMessage(units: UnitSystem, locale: AppLocale): string {
  if (units === 'imperial') {
    return t('validation.weightRangeImperial', {
      min: formatDecimal(MIN_WEIGHT_LB, 1, 1, locale),
      max: formatDecimal(MAX_WEIGHT_LB, 1, 1, locale),
    });
  }
  return t('validation.weightRangeMetric', {
    min: formatDecimal(MIN_WEIGHT_KG, 2, 2, locale),
    max: formatDecimal(MAX_WEIGHT_KG, 2, 2, locale),
  });
}

export function formatWeightLabel(
  weightKg: number,
  units: UnitSystem,
  locale: AppLocale,
): string {
  return `${formatWeightValue(weightKg, units, locale)} ${getWeightUnitLabel(units)}`;
}

export function formatWeightDifference(
  deltaKg: number | null,
  units: UnitSystem,
  locale: AppLocale,
): string {
  if (deltaKg === null) {
    return t('common.emDash');
  }
  const sign = deltaKg > 0 ? '+' : '';
  return `${sign}${formatWeightValue(deltaKg, units, locale)} ${getWeightUnitLabel(units)}`;
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getTodayDate(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function getMondayWeekStart(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  return normalized;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getDefaultHistoryDateRange(
  today: Date = getTodayDate(),
): { from: Date; to: Date } {
  return {
    from: addMonths(today, -1),
    to: today,
  };
}

function getHistoryEarliestFrom(to: Date): Date {
  return addYears(to, -1);
}

function getHistoryLatestTo(from: Date, today: Date): Date {
  const latest = addYears(from, 1);
  return toDateKey(latest) > toDateKey(today) ? today : latest;
}

export function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export const TREND_DAY_MAX_RANGE_DAYS = 365;
export const TREND_WEEK_MAX_YEARS = 5;
export const TREND_MONTH_MAX_YEARS = 25;
export const TREND_YEAR_MAX_YEARS = 100;

const TREND_WEEK_DEFAULT_YEARS = 1;
const TREND_MONTH_DEFAULT_YEARS = 5;
const TREND_YEAR_DEFAULT_YEARS = 15;

function getYearViewDefaultFrom(to: Date): Date {
  return new Date(to.getFullYear() - TREND_YEAR_DEFAULT_YEARS - 1, 0, 1);
}

export function validateHistoryDateRange(
  from: Date,
  to: Date,
  today: Date = getTodayDate(),
): TrendDateRangeValidationError | null {
  const fromKey = toDateKey(from);
  const toKey = toDateKey(to);
  const todayKey = toDateKey(today);

  if (fromKey > toKey) {
    return 'invalidOrder';
  }

  if (toKey > todayKey) {
    return 'futureDate';
  }

  if (fromKey < toDateKey(getHistoryEarliestFrom(to))) {
    return 'maxSpanExceeded';
  }

  const latestTo = getHistoryLatestTo(from, today);
  if (toKey > toDateKey(latestTo)) {
    return 'maxSpanExceeded';
  }

  return null;
}

export type DateRangeFieldHighlight = {
  from: boolean;
  to: boolean;
};

const NO_DATE_RANGE_FIELD_HIGHLIGHT: DateRangeFieldHighlight = { from: false, to: false };

export function getHistoryDateRangeFieldHighlight(
  error: TrendDateRangeValidationError | null,
  from: Date,
  to: Date,
  today: Date = getTodayDate(),
): DateRangeFieldHighlight {
  if (!error) {
    return NO_DATE_RANGE_FIELD_HIGHLIGHT;
  }

  switch (error) {
    case 'invalidOrder':
      return { from: true, to: false };
    case 'futureDate':
      return { from: false, to: true };
    case 'beforeBirthDate':
      return { from: true, to: false };
    case 'maxSpanExceeded':
      return { from: true, to: true };
  }
}

export function getHistoryDateRangeValidationMessageKey(
  error: TrendDateRangeValidationError,
): TranslationKey {
  if (error === 'maxSpanExceeded') {
    return 'history.rangeTooLong';
  }

  const keys: Record<Exclude<TrendDateRangeValidationError, 'maxSpanExceeded'>, TranslationKey> = {
    invalidOrder: 'history.invalidRange',
    beforeBirthDate: 'history.invalidRange',
    futureDate: 'history.futureDate',
  };

  return keys[error];
}

function withBirthFloor(earliest: Date, birthDate?: string | null): Date {
  if (!birthDate) {
    return earliest;
  }
  const birth = fromDateKey(birthDate);
  return earliest < birth ? birth : earliest;
}

export function getTrendEarliestFrom(
  to: Date,
  granularity: TrendGranularity,
  birthDate?: string | null,
): Date {
  switch (granularity) {
    case 'day':
      return addDays(to, -(TREND_DAY_MAX_RANGE_DAYS - 1));
    case 'week':
      return withBirthFloor(addYears(to, -TREND_WEEK_MAX_YEARS), birthDate);
    case 'month':
      return withBirthFloor(addYears(to, -TREND_MONTH_MAX_YEARS), birthDate);
    case 'year':
    case 'ageYear':
      return withBirthFloor(addYears(to, -TREND_YEAR_MAX_YEARS), birthDate);
  }
}

function withEarliestWeighInFloor(from: Date, earliestWeighInDate?: string | null): Date {
  if (!earliestWeighInDate || toDateKey(from) >= earliestWeighInDate) {
    return from;
  }

  return fromDateKey(earliestWeighInDate);
}

function getTrendDefaultFrom(
  to: Date,
  granularity: TrendGranularity,
  birthDate?: string | null,
  earliestWeighInDate?: string | null,
): Date {
  let from: Date;
  switch (granularity) {
    case 'day':
      from = addMonths(to, -1);
      break;
    case 'week':
      from = addYears(to, -TREND_WEEK_DEFAULT_YEARS);
      break;
    case 'month':
      from = addYears(to, -TREND_MONTH_DEFAULT_YEARS);
      break;
    case 'year':
    case 'ageYear':
      from = getYearViewDefaultFrom(to);
      break;
  }

  if (granularity !== 'day') {
    from = withBirthFloor(from, birthDate);
  }

  const earliestFrom = getTrendEarliestFrom(to, granularity, birthDate);
  if (toDateKey(from) < toDateKey(earliestFrom)) {
    from = earliestFrom;
  }

  return withEarliestWeighInFloor(from, earliestWeighInDate);
}

function getTrendLatestTo(from: Date, granularity: TrendGranularity, today: Date): Date {
  switch (granularity) {
    case 'day':
      return addDays(from, TREND_DAY_MAX_RANGE_DAYS - 1);
    case 'week':
      return addYears(from, TREND_WEEK_MAX_YEARS);
    case 'month':
      return addYears(from, TREND_MONTH_MAX_YEARS);
    case 'year':
    case 'ageYear':
      return addYears(from, TREND_YEAR_MAX_YEARS);
  }
}

export function getDefaultTrendDateRange(
  granularity: TrendGranularity,
  today: Date = getTodayDate(),
  birthDate?: string | null,
  earliestWeighInDate?: string | null,
): { from: Date; to: Date } {
  const to = today;
  return {
    from: getTrendDefaultFrom(to, granularity, birthDate, earliestWeighInDate),
    to,
  };
}

export type TrendDateRangeValidationError =
  | 'invalidOrder'
  | 'maxSpanExceeded'
  | 'beforeBirthDate'
  | 'futureDate';

export function validateTrendDateRange(
  from: Date,
  to: Date,
  granularity: TrendGranularity,
  today: Date = getTodayDate(),
  birthDate?: string | null,
): TrendDateRangeValidationError | null {
  const fromKey = toDateKey(from);
  const toKey = toDateKey(to);
  const todayKey = toDateKey(today);

  if (fromKey > toKey) {
    return 'invalidOrder';
  }

  if (toKey > todayKey) {
    return 'futureDate';
  }

  if (birthDate && granularity !== 'day' && fromKey < birthDate) {
    return 'beforeBirthDate';
  }

  const earliestFrom = getTrendEarliestFrom(to, granularity, birthDate);
  if (fromKey < toDateKey(earliestFrom)) {
    return 'maxSpanExceeded';
  }

  let latestTo = getTrendLatestTo(from, granularity, today);
  if (toDateKey(latestTo) > todayKey) {
    latestTo = today;
  }
  if (toKey > toDateKey(latestTo)) {
    return 'maxSpanExceeded';
  }

  return null;
}

export function getTrendDateRangeFieldHighlight(
  error: TrendDateRangeValidationError | null,
  from: Date,
  to: Date,
  granularity: TrendGranularity,
  today: Date = getTodayDate(),
  birthDate?: string | null,
): DateRangeFieldHighlight {
  if (!error) {
    return NO_DATE_RANGE_FIELD_HIGHLIGHT;
  }

  switch (error) {
    case 'invalidOrder':
      return { from: true, to: false };
    case 'futureDate':
      return { from: false, to: true };
    case 'beforeBirthDate':
      return { from: true, to: false };
    case 'maxSpanExceeded':
      return { from: true, to: true };
  }
}

export function getTrendDateRangeValidationMessageKey(
  error: TrendDateRangeValidationError,
  granularity: TrendGranularity,
): TranslationKey {
  if (error === 'maxSpanExceeded') {
    return `comparison.rangeTooLong.${granularity}`;
  }

  const keys: Record<Exclude<TrendDateRangeValidationError, 'maxSpanExceeded'>, TranslationKey> = {
    invalidOrder: 'comparison.invalidRange',
    beforeBirthDate: 'comparison.beforeBirthDate',
    futureDate: 'comparison.futureDate',
  };

  return keys[error];
}

export function clampTrendDateRange(
  from: Date,
  to: Date,
  changed: 'from' | 'to',
  granularity: TrendGranularity,
  today: Date = getTodayDate(),
  birthDate?: string | null,
): { from: Date; to: Date } {
  let nextFrom = from;
  let nextTo = to;

  if (toDateKey(nextTo) > toDateKey(today)) {
    nextTo = today;
  }

  if (toDateKey(nextFrom) > toDateKey(nextTo)) {
    if (changed === 'from') {
      nextTo = nextFrom;
      if (toDateKey(nextTo) > toDateKey(today)) {
        nextTo = today;
      }
    } else {
      nextFrom = nextTo;
    }
  }

  const earliestFrom = getTrendEarliestFrom(nextTo, granularity, birthDate);
  if (toDateKey(nextFrom) < toDateKey(earliestFrom)) {
    nextFrom = earliestFrom;
  }

  let latestTo = getTrendLatestTo(nextFrom, granularity, today);
  if (toDateKey(latestTo) > toDateKey(today)) {
    latestTo = today;
  }
  if (toDateKey(nextTo) > toDateKey(latestTo)) {
    nextTo = latestTo;
  }

  return { from: nextFrom, to: nextTo };
}

function getLocaleTag(): string {
  return getDateLocale(getI18nLocale());
}

export function wasWeightEntryUpdated(entry: {
  createdAt: string;
  updatedAt: string;
}): boolean {
  const created = Date.parse(entry.createdAt);
  const updated = Date.parse(entry.updatedAt);
  if (Number.isNaN(created) || Number.isNaN(updated)) {
    return false;
  }
  return updated - created > 2000;
}

function parseIsoDate(isoDate: string | null | undefined): Date | null {
  if (!isoDate) {
    return null;
  }

  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTime(isoDate: string | null | undefined): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    return t('common.emDash');
  }

  return parsed.toLocaleString(getLocaleTag(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatHistoryTimestamp(
  isoDate: string | null | undefined,
  relativeDateKey?: string,
): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) {
    return t('common.emDash');
  }

  if (relativeDateKey && toDateKey(parsed) === relativeDateKey) {
    return parsed.toLocaleTimeString(getLocaleTag(), {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return formatDateTime(isoDate);
}

export function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(getLocaleTag(), {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatMonthLabel(dateKey: string): string {
  return fromDateKey(dateKey).toLocaleDateString(getLocaleTag(), {
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateRange(range: DateRange): string {
  const start = fromDateKey(range.start);
  const end = fromDateKey(range.end);
  const sameYear = start.getFullYear() === end.getFullYear();
  const localeTag = getLocaleTag();
  const startLabel = start.toLocaleDateString(localeTag, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
  const endLabel = end.toLocaleDateString(localeTag, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}

export function formatYearRowTitle(range: DateRange): { title: string; subtitle?: string } {
  const year = fromDateKey(range.start).getFullYear();
  return { title: String(year) };
}

export function parseDateKey(input: string): string | null {
  const trimmed = input.trim();
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return toDateKey(date);
}

export function getHeightRangeMessage(units: UnitSystem): string {
  if (units === 'imperial') {
    const min = cmToFeetInches(MIN_HEIGHT_CM);
    const max = cmToFeetInches(MAX_HEIGHT_CM);
    return t('validation.heightRangeImperial', {
      minFt: min.feet,
      minIn: min.inches,
      maxFt: max.feet,
      maxIn: max.inches,
    });
  }
  return t('validation.heightRangeMetric', {
    min: MIN_HEIGHT_CM,
    max: MAX_HEIGHT_CM,
  });
}

export function formatHeight(heightCm: number | null, units: UnitSystem): string {
  if (heightCm === null) {
    return t('common.notSet');
  }

  if (units === 'imperial') {
    const { feet, inches } = cmToFeetInches(heightCm);
    return `${feet} ${t('common.ft')} ${inches} ${t('common.in')}`;
  }

  const meters = Math.floor(heightCm / 100);
  const centimeters = heightCm % 100;
  return `${meters} m ${centimeters} cm`;
}

export function heightToInputParts(
  heightCm: number | null,
  units: UnitSystem,
): { primary: string; secondary: string } {
  if (heightCm === null) {
    return { primary: '', secondary: '' };
  }

  if (units === 'imperial') {
    const { feet, inches } = cmToFeetInches(heightCm);
    return {
      primary: String(feet),
      secondary: String(inches),
    };
  }

  return {
    primary: String(Math.floor(heightCm / 100)),
    secondary: String(heightCm % 100).padStart(2, '0'),
  };
}

export function parseHeightInput(
  units: UnitSystem,
  primaryInput: string,
  secondaryInput: string,
): number | null {
  const primary = primaryInput.trim();
  const secondary = secondaryInput.trim();

  if (!primary || !secondary) {
    return null;
  }

  if (units === 'imperial') {
    if (!/^\d{1,2}$/.test(primary) || !/^\d{1,2}$/.test(secondary)) {
      return null;
    }

    const feet = Number(primary);
    const inches = Number(secondary);

    if (inches < 0 || inches > 11) {
      return null;
    }

    const total = feetInchesToCm(feet, inches);
    if (total < MIN_HEIGHT_CM || total > MAX_HEIGHT_CM) {
      return null;
    }

    return total;
  }

  if (!/^\d{1,2}$/.test(primary) || !/^\d{1,2}$/.test(secondary)) {
    return null;
  }

  const metersValue = Number(primary);
  const centimetersValue = Number(secondary);

  if (centimetersValue < 0 || centimetersValue > 99) {
    return null;
  }

  const total = metersValue * 100 + centimetersValue;
  if (total < MIN_HEIGHT_CM || total > MAX_HEIGHT_CM) {
    return null;
  }

  return total;
}

export function formatChartWeightRange(
  minKg: number,
  maxKg: number,
  units: UnitSystem,
  locale: AppLocale,
): string {
  if (units === 'imperial') {
    return t('chart.rangeLabelImperial', {
      min: formatWeightValue(minKg, units, locale),
      max: formatWeightValue(maxKg, units, locale),
    });
  }
  return t('chart.rangeLabelMetric', {
    min: formatWeightValue(minKg, units, locale),
    max: formatWeightValue(maxKg, units, locale),
  });
}
