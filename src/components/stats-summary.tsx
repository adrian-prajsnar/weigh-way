import { useMemo } from 'react';
import { View } from 'react-native';
import { calculateBmi, classifyBmiValue } from '../bmi';
import { useBmiDetails } from '../context/bmi-details-context';
import { useSharedBmiDisplay } from '../context/bmi-display-context';
import { useUnits } from '../context/unit-context';
import { useSharedUserProfile } from '../context/user-profile-context';
import { formatWeightValue, getWeightUnitLabel } from '../format';
import { getBmiStatsForRange, getHeightAtDate } from '../height';
import { filterEntriesByRange } from '../stats';
import { useTranslation } from '../i18n/language-context';
import { DateRange, WeightEntry, WeightStats } from '../types';
import { useAppStyles } from '../theme/styles';
import { BmiBadge } from './bmi-badge';
import { StatTile } from './stat-tile';

type StatsSummaryProps = {
  stats: WeightStats;
  entries: WeightEntry[];
  range: DateRange;
};

export function StatsSummary({ stats, entries, range }: StatsSummaryProps) {
  const styles = useAppStyles();
  const { t, locale } = useTranslation();
  const { units } = useUnits();
  const { heightEntries, birthDate, sex } = useSharedUserProfile();
  const { showBmi } = useSharedBmiDisplay();
  const { openPeriod, openWeighIn } = useBmiDetails();
  const weightUnit = getWeightUnitLabel(units);
  const bmiStats = useMemo(
    () => getBmiStatsForRange(entries, heightEntries, range),
    [entries, heightEntries, range],
  );

  const weightExtremeBadge = (metric: 'min' | 'max') => {
    const entry = filterEntriesByRange(entries, range)
      .filter((candidate) => candidate.weightKg === stats[metric])
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const heightCm = entry ? getHeightAtDate(heightEntries, entry.date) : null;
    const bmi =
      entry && heightCm !== null
        ? calculateBmi(entry.weightKg, heightCm, { date: entry.date, birthDate, sex })
        : null;
    return showBmi ? (
      <BmiBadge bmi={bmi} compact onPress={entry ? () => openWeighIn(entry) : undefined} />
    ) : null;
  };

  const emDash = t('common.emDash');

  const formatValue = (value: number | null): string =>
    value === null ? emDash : formatWeightValue(value, units, locale);

  const bmiBadge = (value: number | null, metric: 'average' | 'min' | 'max', centered = false) => {
    const sourceDate =
      metric === 'min' ? bmiStats.minDate : metric === 'max' ? bmiStats.maxDate : range.end;
    const bmi =
      value === null
        ? null
        : classifyBmiValue(value, {
            date: sourceDate ?? range.end,
            birthDate,
            sex,
          });

    return showBmi ? (
      <BmiBadge
        bmi={bmi}
        compact
        centered={centered}
        onPress={() => openPeriod({ metric, range, entries })}
      />
    ) : null;
  };

  return (
    <View style={styles.statGrid}>
      <StatTile
        label={t('stats.average')}
        value={formatValue(stats.average)}
        unit={stats.average === null ? undefined : weightUnit}
        badge={bmiBadge(bmiStats.average, 'average')}
      />
      <StatTile
        label={t('stats.lowest')}
        value={formatValue(stats.min)}
        unit={stats.min === null ? undefined : weightUnit}
        badge={weightExtremeBadge('min')}
      />
      <StatTile
        label={t('stats.highest')}
        value={formatValue(stats.max)}
        unit={stats.max === null ? undefined : weightUnit}
        badge={weightExtremeBadge('max')}
      />
      <StatTile label={t('stats.entries')} value={String(stats.count)} />
    </View>
  );
}
