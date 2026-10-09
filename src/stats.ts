import {
  getAgeOnDate,
  getLastAgeYearRange,
  getLastBirthdayDate,
  getThisAgeYearRange,
} from './age';
import {
  addDays,
  formatDateLabel,
  formatDateRange,
  formatMonthLabel,
  formatYearRowTitle,
  fromDateKey,
  getMondayWeekStart,
  getTodayDate,
  toDateKey,
} from './format';
import { t } from './i18n';
import {
  ChartRange,
  ComparisonMode,
  DashboardPeriod,
  DateRange,
  EntryGroup,
  LatestChange,
  PeriodComparison,
  TrendGranularity,
  TrendRow,
  WeightEntry,
  WeightSeries,
  WeightStats,
} from './types';

const CHART_RANGE_DAYS: Record<ChartRange, number> = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

function normalizeToday(today?: Date): Date {
  const date = today ? new Date(today) : getTodayDate();
  date.setHours(0, 0, 0, 0);
  return date;
}

function toRange(start: Date, end: Date): DateRange {
  return {
    start: toDateKey(start),
    end: toDateKey(end),
  };
}

export function getDashboardPeriodRange(
  period: DashboardPeriod,
  todayInput?: Date,
  birthDate?: string | null,
): DateRange {
  const today = normalizeToday(todayInput);

  switch (period) {
    case 'thisAgeYear': {
      if (!birthDate) {
        const start = addDays(today, -364);
        return toRange(start, today);
      }
      return getThisAgeYearRange(birthDate, today);
    }
    case 'lastAgeYear': {
      if (!birthDate) {
        const start = addDays(today, -729);
        const end = addDays(today, -365);
        return toRange(start, end);
      }
      return getLastAgeYearRange(birthDate, today);
    }
    case 'thisWeek': {
      const start = getMondayWeekStart(today);
      return toRange(start, today);
    }
    case 'lastWeek': {
      const thisWeekStart = getMondayWeekStart(today);
      const start = addDays(thisWeekStart, -7);
      const end = addDays(thisWeekStart, -1);
      return toRange(start, end);
    }
    case 'thisMonth': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return toRange(start, today);
    }
    case 'lastMonth': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return toRange(start, end);
    }
    case 'last6Months': {
      const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      return toRange(start, today);
    }
    case 'lastYear': {
      const start = new Date(today.getFullYear() - 1, 0, 1);
      const end = new Date(today.getFullYear() - 1, 11, 31);
      return toRange(start, end);
    }
  }
}

export function filterEntriesByRange(
  entries: WeightEntry[],
  range: DateRange,
): WeightEntry[] {
  return entries.filter(
    (entry) => entry.date >= range.start && entry.date <= range.end,
  );
}

export function filterEntriesByBounds(
  entries: WeightEntry[],
  start: string | null,
  end: string | null,
): WeightEntry[] {
  return entries.filter((entry) => {
    if (start && entry.date < start) {
      return false;
    }
    if (end && entry.date > end) {
      return false;
    }
    return true;
  });
}

function buildStatsFromEntries(filtered: WeightEntry[]): WeightStats {
  if (filtered.length === 0) {
    return { average: null, min: null, max: null, count: 0 };
  }

  const weights = filtered.map((entry) => entry.weightKg);
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  return {
    average: Math.round((total / weights.length) * 100) / 100,
    min: Math.min(...weights),
    max: Math.max(...weights),
    count: weights.length,
  };
}

export function getStatsForRange(
  entries: WeightEntry[],
  range: DateRange,
): WeightStats {
  return buildStatsFromEntries(filterEntriesByRange(entries, range));
}

function assignEntriesToBuckets(
  entries: WeightEntry[],
  buckets: { range: DateRange }[],
): WeightEntry[][] {
  const bucketEntries = buckets.map(() => [] as WeightEntry[]);

  for (const entry of entries) {
    for (let index = 0; index < buckets.length; index += 1) {
      const { range } = buckets[index];
      if (entry.date >= range.start && entry.date <= range.end) {
        bucketEntries[index].push(entry);
        break;
      }
    }
  }

  return bucketEntries;
}

export function getLast7WeighIns(entries: WeightEntry[]): WeightEntry[] {
  return [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
}

function clipRangeToFilter(bucket: DateRange, filter: DateRange): DateRange {
  return {
    start: bucket.start < filter.start ? filter.start : bucket.start,
    end: bucket.end > filter.end ? filter.end : bucket.end,
  };
}

type TrendBucket = {
  range: DateRange;
  labelRange?: DateRange;
};

function getWeekRangeContaining(date: Date): DateRange {
  const start = getMondayWeekStart(date);
  const end = addDays(start, 6);
  return toRange(start, end);
}

function generateDayBuckets(filter: DateRange): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  let cursor = fromDateKey(filter.end);

  while (toDateKey(cursor) >= filter.start) {
    const key = toDateKey(cursor);
    buckets.push({ range: { start: key, end: key } });
    cursor = addDays(cursor, -1);
  }

  return buckets;
}

function generateWeekBuckets(filter: DateRange): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  let cursor = fromDateKey(filter.end);

  while (true) {
    const week = getWeekRangeContaining(cursor);
    buckets.push({ range: clipRangeToFilter(week, filter) });

    const previousWeekEnd = addDays(fromDateKey(week.start), -1);
    if (toDateKey(previousWeekEnd) < filter.start) {
      break;
    }
    cursor = previousWeekEnd;
  }

  return buckets;
}

function generateMonthBuckets(filter: DateRange): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  let year = fromDateKey(filter.end).getFullYear();
  let month = fromDateKey(filter.end).getMonth();

  while (true) {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const bucket = toRange(monthStart, monthEnd);
    buckets.push({ range: clipRangeToFilter(bucket, filter) });

    if (toDateKey(monthStart) <= filter.start) {
      break;
    }

    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }

  return buckets;
}

function generateYearBuckets(filter: DateRange): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  let year = fromDateKey(filter.end).getFullYear();
  const startYear = fromDateKey(filter.start).getFullYear();

  while (year >= startYear) {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    buckets.push({
      range: clipRangeToFilter({ start: yearStart, end: yearEnd }, filter),
    });
    year -= 1;
  }

  return buckets;
}

function generateAgeYearBuckets(filter: DateRange, birthDate: string): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  let ageYearEnd = fromDateKey(filter.end);

  while (true) {
    const birthdayStart = getLastBirthdayDate(birthDate, ageYearEnd);
    const bucket = toRange(birthdayStart, ageYearEnd);
    const clipped = clipRangeToFilter(bucket, filter);

    if (clipped.end < filter.start) {
      break;
    }

    buckets.push({ range: clipped, labelRange: bucket });

    const dayBeforeBirthday = addDays(birthdayStart, -1);
    if (toDateKey(dayBeforeBirthday) < filter.start) {
      break;
    }
    ageYearEnd = dayBeforeBirthday;
  }

  return buckets;
}

function generateTrendBuckets(
  granularity: TrendGranularity,
  filter: DateRange,
  birthDate?: string | null,
): TrendBucket[] {
  switch (granularity) {
    case 'day':
      return generateDayBuckets(filter);
    case 'week':
      return generateWeekBuckets(filter);
    case 'month':
      return generateMonthBuckets(filter);
    case 'year':
      return generateYearBuckets(filter);
    case 'ageYear':
      if (!birthDate) {
        return [];
      }
      return generateAgeYearBuckets(filter, birthDate);
  }
}

function clampTrendFilterToBirth(
  filter: DateRange,
  granularity: TrendGranularity,
  birthDate?: string | null,
): DateRange {
  if (!birthDate || granularity === 'day') {
    return filter;
  }

  if (filter.start < birthDate) {
    return { ...filter, start: birthDate };
  }

  return filter;
}

function getTrendRowTitle(
  granularity: TrendGranularity,
  range: DateRange,
  birthDate?: string | null,
  labelRange?: DateRange,
): { title: string; subtitle?: string } {
  switch (granularity) {
    case 'day':
      return { title: formatDateLabel(range.start) };
    case 'week':
      return { title: formatDateRange(range) };
    case 'month':
      return { title: formatMonthLabel(range.start) };
    case 'year':
      return formatYearRowTitle(range);
    case 'ageYear': {
      if (!birthDate) {
        return { title: formatDateRange(labelRange ?? range) };
      }
      const age = getAgeOnDate(birthDate, range.end);
      return {
        title: age ? t('age.years', { count: age.years }) : t('common.emDash'),
        subtitle: formatDateRange(labelRange ?? range),
      };
    }
  }
}

function hasTrendData(stats: WeightStats): boolean {
  return stats.count > 0 && stats.average !== null;
}

function computeDeltaToOlder(
  newer: WeightStats,
  older: WeightStats,
): number | null {
  if (newer.average === null || older.average === null) {
    return null;
  }
  return Math.round((newer.average - older.average) * 100) / 100;
}

export function getTrendRows(
  entries: WeightEntry[],
  granularity: TrendGranularity,
  filter: DateRange,
  birthDate?: string | null,
): TrendRow[] {
  const effectiveFilter = clampTrendFilterToBirth(filter, granularity, birthDate);
  const buckets = generateTrendBuckets(granularity, effectiveFilter, birthDate);

  let rows: TrendRow[];

  if (granularity === 'day') {
    const entryByDate = new Map(entries.map((entry) => [entry.date, entry]));
    rows = buckets.map(({ range, labelRange }) => {
      const entry = entryByDate.get(range.start) ?? null;
      const stats = entry
        ? {
            average: entry.weightKg,
            min: entry.weightKg,
            max: entry.weightKg,
            count: 1,
          }
        : { average: null, min: null, max: null, count: 0 };
      const { title, subtitle } = getTrendRowTitle(
        granularity,
        range,
        birthDate,
        labelRange,
      );
      return {
        key: `${granularity}-${range.start}-${range.end}`,
        title,
        subtitle,
        range,
        stats,
        entry,
        deltaToOlder: null,
      };
    });
  } else {
    const bucketEntries = assignEntriesToBuckets(entries, buckets);
    rows = buckets.map(({ range, labelRange }, index) => {
      const stats = buildStatsFromEntries(bucketEntries[index]);
      const { title, subtitle } = getTrendRowTitle(
        granularity,
        range,
        birthDate,
        labelRange,
      );
      return {
        key: `${granularity}-${range.start}-${range.end}`,
        title,
        subtitle,
        range,
        stats,
        entry: null,
        deltaToOlder: null,
      };
    });
  }

  for (let index = 0; index < rows.length; index += 1) {
    if (!hasTrendData(rows[index].stats)) {
      continue;
    }

    let olderIndex = index + 1;
    while (olderIndex < rows.length && !hasTrendData(rows[olderIndex].stats)) {
      olderIndex += 1;
    }

    if (olderIndex < rows.length) {
      rows[index].deltaToOlder = computeDeltaToOlder(
        rows[index].stats,
        rows[olderIndex].stats,
      );
    }
  }

  return rows.filter((row) => hasTrendData(row.stats));
}

export function getComparison(
  entries: WeightEntry[],
  mode: ComparisonMode,
  customRanges?: { rangeA: DateRange; rangeB: DateRange },
  birthDate?: string | null,
  customKind: 'period' | 'dates' = 'period',
): PeriodComparison | null {
  if (mode !== 'custom') {
    return null;
  }

  if (!customRanges) {
    return null;
  }
  if (customRanges.rangeA.start > customRanges.rangeA.end) {
    return null;
  }
  if (customRanges.rangeB.start > customRanges.rangeB.end) {
    return null;
  }

  const rangeA = customRanges.rangeA;
  const rangeB = customRanges.rangeB;
  const labelA =
    customKind === 'dates' ? formatDateLabel(rangeA.start) : t('periods.rangeA');
  const labelB =
    customKind === 'dates' ? formatDateLabel(rangeB.start) : t('periods.rangeB');

  const statsA = getStatsForRange(entries, rangeA);
  const statsB = getStatsForRange(entries, rangeB);
  const difference =
    statsA.average !== null && statsB.average !== null
      ? Math.round((statsA.average - statsB.average) * 100) / 100
      : null;

  return {
    labelA,
    labelB,
    rangeA,
    rangeB,
    statsA,
    statsB,
    difference,
  };
}

export function dateKeyToDate(dateKey: string): Date {
  return fromDateKey(dateKey);
}

export function groupEntriesByMonth(entries: WeightEntry[]): EntryGroup[] {
  const groups: EntryGroup[] = [];

  for (const entry of entries) {
    const monthKey = entry.date.slice(0, 7);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.monthKey === monthKey) {
      lastGroup.entries.push(entry);
      continue;
    }
    groups.push({ monthKey, entries: [entry] });
  }

  return groups;
}

export function getChartSeries(entries: WeightEntry[], range: ChartRange): WeightSeries {
  const today = getTodayDate();
  const start = addDays(today, -(CHART_RANGE_DAYS[range] - 1));
  const points = filterEntriesByRange(entries, toRange(start, today)).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  if (points.length === 0) {
    return { points, min: 0, max: 0 };
  }

  const weights = points.map((entry) => entry.weightKg);
  return {
    points,
    min: Math.min(...weights),
    max: Math.max(...weights),
  };
}

export function getEarliestEntryDate(entries: WeightEntry[]): string | null {
  if (entries.length === 0) {
    return null;
  }

  return entries.reduce(
    (earliest, entry) => (entry.date < earliest ? entry.date : earliest),
    entries[0].date,
  );
}

export function getLatestChange(entries: WeightEntry[]): LatestChange {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0] ?? null;
  const previous = sorted[1] ?? null;

  if (!latest || !previous) {
    return { latest, change: null };
  }

  return {
    latest,
    change: Math.round((latest.weightKg - previous.weightKg) * 100) / 100,
  };
}
