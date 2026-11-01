export type WeightEntry = {
  date: string;
  weightKg: number;
  createdAt: string;
  updatedAt: string;
};

export type WeightStats = {
  average: number | null;
  min: number | null;
  max: number | null;
  count: number;
};

export type DashboardPeriod =
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last6Months'
  | 'lastYear'
  | 'thisAgeYear'
  | 'lastAgeYear';

export type DateRange = {
  start: string;
  end: string;
};

export type TrendGranularity = 'day' | 'week' | 'month' | 'year' | 'ageYear';

export type ComparisonMode = TrendGranularity | 'custom';

export type CustomCompareKind = 'period' | 'dates';

export type TrendRow = {
  key: string;
  title: string;
  subtitle?: string;
  range: DateRange;
  stats: WeightStats;
  /** Set for day buckets when a weigh-in exists. */
  entry?: WeightEntry | null;
  /** Newer minus the nearest older period that has weigh-ins; null otherwise. */
  deltaToOlder: number | null;
};

export type ChartRange = '30d' | '90d' | '1y';

export type WeightSeries = {
  /** Entries inside the window, ascending by date. */
  points: WeightEntry[];
  min: number;
  max: number;
};

export type EntryGroup = {
  /** `YYYY-MM` key the group covers. */
  monthKey: string;
  entries: WeightEntry[];
};

export type LatestChange = {
  latest: WeightEntry | null;
  /** Signed difference against the previous entry, or null when there is none. */
  change: number | null;
};

export type PeriodComparison = {
  labelA: string;
  labelB: string;
  rangeA: DateRange;
  rangeB: DateRange;
  statsA: WeightStats;
  statsB: WeightStats;
  difference: number | null;
};

export type BiologicalSex = 'female' | 'male';

export type HeightEntry = {
  effectiveDate: string;
  heightCm: number;
};
