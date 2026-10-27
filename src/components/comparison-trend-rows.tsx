import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { classifyBmiValue } from '../bmi';
import { useBmiDetails } from '../context/bmi-details-context';
import { useSharedBmiDisplay } from '../context/bmi-display-context';
import { useUnits } from '../context/unit-context';
import { useSharedUserProfile } from '../context/user-profile-context';
import { formatWeightLabel, formatWeightValue } from '../format';
import { getBmiStatsForRange } from '../height';
import { useTranslation } from '../i18n/language-context';
import { DateRange, TrendRow, WeightEntry, WeightStats } from '../types';
import { useAppStyles } from '../theme/styles';
import { BmiBadge } from './bmi-badge';
import { DeltaChip } from './delta-chip';
import { WeightWithBmi } from './weight-with-bmi';

type ComparisonTrendRowsProps = {
  rows: TrendRow[];
  entries: WeightEntry[];
  isDayMode: boolean;
};

function PeriodExtraStats({ stats }: { stats: WeightStats }) {
  const styles = useAppStyles();
  const { t, locale } = useTranslation();
  const { units } = useUnits();
  const emDash = t('common.emDash');

  if (stats.count === 0) {
    return null;
  }

  const formatValue = (value: number | null): string =>
    value === null ? emDash : formatWeightValue(value, units, locale);

  const items = [
    { label: t('stats.lowest'), value: formatValue(stats.min), align: 'left' as const },
    { label: t('stats.highest'), value: formatValue(stats.max), align: 'center' as const },
    { label: t('stats.entries'), value: String(stats.count), align: 'right' as const },
  ];

  return (
    <View style={styles.comparisonTrendPeriodStats}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[
            styles.comparisonTrendPeriodStat,
            item.align === 'center' && styles.comparisonTrendPeriodStatCenter,
            item.align === 'right' && styles.comparisonTrendPeriodStatEnd,
          ]}
        >
          <Text style={styles.comparisonTrendPeriodStatLabel}>{item.label}</Text>
          <Text style={styles.comparisonTrendPeriodStatValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function PeriodAverageWithBmi({
  stats,
  entries,
  range,
}: {
  stats: WeightStats;
  entries: WeightEntry[];
  range: DateRange;
}) {
  const styles = useAppStyles();
  const { t, locale } = useTranslation();
  const { units } = useUnits();
  const { heightEntries, birthDate, sex } = useSharedUserProfile();
  const { showBmi } = useSharedBmiDisplay();
  const { openPeriod } = useBmiDetails();
  const bmiStats = useMemo(
    () => getBmiStatsForRange(entries, heightEntries, range),
    [entries, heightEntries, range],
  );

  if (stats.count === 0 || stats.average === null) {
    return <Text style={styles.comparisonDayNoData}>{t('comparison.noData')}</Text>;
  }

  const bmi =
    bmiStats.average === null
      ? null
      : classifyBmiValue(bmiStats.average, {
          date: range.end,
          birthDate,
          sex,
        });

  const badge =
    showBmi && bmi ? (
      <BmiBadge
        bmi={bmi}
        compact
        onPress={() => openPeriod({ metric: 'average', range, entries })}
      />
    ) : null;

  return (
    <View style={styles.weightWithBmiStacked}>
      <Text style={styles.historyWeight}>
        {formatWeightLabel(stats.average, units, locale)}
      </Text>
      {badge}
    </View>
  );
}

function ComparisonTrendRow({
  row,
  entries,
  isDayMode,
}: {
  row: TrendRow;
  entries: WeightEntry[];
  isDayMode: boolean;
}) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { heightEntries } = useSharedUserProfile();

  const main = (
    <>
      <View style={styles.historyRowContent}>
        <Text style={styles.historyDate}>{row.title}</Text>
        {row.subtitle ? (
          <Text style={styles.comparisonTrendPeriodSubtitle}>{row.subtitle}</Text>
        ) : null}
        {isDayMode ? (
          row.entry ? (
            <WeightWithBmi
              entry={row.entry}
              heightEntries={heightEntries}
              layout="stacked"
              compactBmi
            />
          ) : (
            <Text style={styles.comparisonDayNoData}>{t('comparison.noData')}</Text>
          )
        ) : (
          <PeriodAverageWithBmi stats={row.stats} entries={entries} range={row.range} />
        )}
      </View>
      <View style={styles.comparisonDayDelta}>
        {row.deltaToOlder !== null ? (
          <DeltaChip value={row.deltaToOlder} />
        ) : (
          <Text style={styles.comparisonDayDeltaEmpty}>{t('common.emDash')}</Text>
        )}
      </View>
    </>
  );

  return (
    <View style={[styles.historyRow, !isDayMode && styles.comparisonTrendPeriodRow]}>
      {isDayMode ? main : <View style={styles.comparisonTrendRowMain}>{main}</View>}
      {!isDayMode ? <PeriodExtraStats stats={row.stats} /> : null}
    </View>
  );
}

export function ComparisonTrendRows({ rows, entries, isDayMode }: ComparisonTrendRowsProps) {
  return (
    <View>
      {rows.map((row) => (
        <ComparisonTrendRow key={row.key} row={row} entries={entries} isDayMode={isDayMode} />
      ))}
    </View>
  );
}
