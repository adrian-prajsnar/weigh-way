import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { formatAgeDetailed, getAgeOnDate } from '../age';
import { calculateBmi } from '../bmi';
import { useBmiDetails } from '../context/bmi-details-context';
import { useSharedBmiDisplay } from '../context/bmi-display-context';
import { useSharedUserProfile } from '../context/user-profile-context';
import { formatDateLabel, formatWeightValue, getWeightUnitLabel } from '../format';
import { useUnits } from '../context/unit-context';
import { getHeightAtDate } from '../height';
import { useTranslation } from '../i18n/language-context';
import { getChartSeries, getLatestChange } from '../stats';
import { useAppStyles } from '../theme/styles';
import { ChartRange, WeightEntry } from '../types';
import { AppCard } from './app-card';
import { BmiBadge } from './bmi-badge';
import { DeltaChip } from './delta-chip';
import { EmptyState } from './empty-state';
import { SegmentedControl, SegmentedOption } from './segmented-control';
import { SkeletonBlock } from './skeleton';
import { WeightChart } from './weight-chart';
import { shouldShowBmiUnavailableBadge } from './weight-with-bmi-availability';

type HeroWeightCardProps = {
  entries: WeightEntry[];
  isLoading: boolean;
  isBusy?: boolean;
};

export function HeroWeightCard({ entries, isLoading, isBusy = false }: HeroWeightCardProps) {
  const styles = useAppStyles();
  const { t, locale } = useTranslation();
  const { units } = useUnits();
  const { heightEntries, birthDate, sex, isLoading: isProfileLoading } = useSharedUserProfile();
  const { showBmi } = useSharedBmiDisplay();
  const { openWeighIn } = useBmiDetails();
  const [range, setRange] = useState<ChartRange>('30d');

  const rangeOptions = useMemo<SegmentedOption<ChartRange>[]>(
    () => [
      { value: '30d', label: t('hero.range30d') },
      { value: '90d', label: t('hero.range90d') },
      { value: '1y', label: t('hero.range1y') },
    ],
    [t],
  );

  const { latest, change } = useMemo(() => getLatestChange(entries), [entries]);
  const series = useMemo(() => getChartSeries(entries, range), [entries, range]);

  const bmi = useMemo(() => {
    if (!latest) {
      return null;
    }
    const heightCm = getHeightAtDate(heightEntries, latest.date);
    return heightCm === null
      ? null
      : calculateBmi(latest.weightKg, heightCm, {
          date: latest.date,
          birthDate,
          sex,
        });
  }, [heightEntries, latest, birthDate, sex]);

  if (isLoading) {
    return (
      <AppCard elevated isBusy={isBusy}>
        <SkeletonBlock height={12} width="35%" />
        <SkeletonBlock height={48} width="60%" />
        <SkeletonBlock height={40} width="100%" />
        <SkeletonBlock height={140} width="100%" />
      </AppCard>
    );
  }

  return (
    <AppCard elevated isBusy={isBusy}>
      <Text style={styles.heroLabel}>{t('hero.currentWeight')}</Text>

      {latest ? (
        <>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>
              {formatWeightValue(latest.weightKg, units, locale)}
            </Text>
            <Text style={styles.heroUnit}>{getWeightUnitLabel(units)}</Text>
          </View>
          <View style={styles.heroMetaRow}>
            <DeltaChip value={change} />
            {showBmi ? (
              <View>
                <BmiBadge
                  bmi={bmi}
                  compact
                  showUnavailable={shouldShowBmiUnavailableBadge(
                    isProfileLoading,
                    getHeightAtDate(heightEntries, latest.date),
                  )}
                  onPress={() =>
                    openWeighIn({
                      date: latest.date,
                      weightKg: latest.weightKg,
                      createdAt: latest.createdAt,
                      updatedAt: latest.updatedAt,
                    })
                  }
                />
              </View>
            ) : null}
          </View>
          <Text style={styles.cardSubtitle}>
            {birthDate
              ? t('hero.loggedOnWithAge', {
                  date: formatDateLabel(latest.date),
                  age: formatAgeDetailed(getAgeOnDate(birthDate, latest.date)),
                })
              : t('hero.loggedOn', { date: formatDateLabel(latest.date) })}
          </Text>
        </>
      ) : (
        <EmptyState
          icon="scale-outline"
          title={t('hero.noWeightTitle')}
          message={t('hero.noWeightMessage')}
        />
      )}

      {latest ? (
        <>
          <SegmentedControl options={rangeOptions} value={range} onChange={setRange} />
          <WeightChart series={series} />
        </>
      ) : null}
    </AppCard>
  );
}
