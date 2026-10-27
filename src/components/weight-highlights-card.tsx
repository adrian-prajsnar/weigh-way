import { ReactNode, useMemo } from 'react';
import { StyleProp, Text, TextStyle, View } from 'react-native';
import { calculateBmi } from '../bmi';
import { useBmiDetails } from '../context/bmi-details-context';
import { useSharedBmiDisplay } from '../context/bmi-display-context';
import { useUnits } from '../context/unit-context';
import { useSharedUserProfile } from '../context/user-profile-context';
import { formatDateLabel, formatWeightDifference, formatWeightValue, getWeightUnitLabel } from '../format';
import { getHeightAtDate } from '../height';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';
import { Palette } from '../theme/tokens';
import { useColors } from '../theme/theme-context';
import { WeightEntry } from '../types';
import { getChangeSinceLastBirthday, getWeightExtremes } from '../weight-insights';
import { AppCard } from './app-card';
import { BmiBadge } from './bmi-badge';

type WeightHighlightsCardProps = {
  entries: WeightEntry[];
  birthDate: string;
  isBusy?: boolean;
};

function getWeightChangeTextStyle(changeKg: number, colors: Palette): TextStyle | undefined {
  if (changeKg < 0) {
    return { color: colors.successText };
  }
  if (changeKg > 0) {
    return { color: colors.warningText };
  }
  return undefined;
}

function InsightRow({
  label,
  value,
  valueTextStyle,
  meta,
  badge,
}: {
  label: string;
  value: string;
  valueTextStyle?: StyleProp<TextStyle>;
  meta: string;
  badge?: ReactNode;
}) {
  const styles = useAppStyles();

  return (
    <View style={styles.insightRow}>
      <Text style={styles.statTileLabel}>{label}</Text>
      <View style={styles.insightValueRow}>
        <Text style={[styles.insightValue, valueTextStyle]}>{value}</Text>
        {badge}
      </View>
      <Text style={styles.insightMeta}>{meta}</Text>
    </View>
  );
}

export function WeightHighlightsCard({
  entries,
  birthDate,
  isBusy = false,
}: WeightHighlightsCardProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t, locale } = useTranslation();
  const { units } = useUnits();
  const { heightEntries, sex } = useSharedUserProfile();
  const { showBmi } = useSharedBmiDisplay();
  const { openWeighIn } = useBmiDetails();
  const weightUnit = getWeightUnitLabel(units);

  const extremes = useMemo(() => getWeightExtremes(entries, birthDate), [entries, birthDate]);
  const sinceBirthday = useMemo(
    () => getChangeSinceLastBirthday(entries, birthDate),
    [entries, birthDate],
  );

  if (!extremes) {
    return null;
  }

  const formatWeighIn = (weightKg: number) =>
    `${formatWeightValue(weightKg, units, locale)} ${weightUnit}`;
  const formatMeta = (date: string, ageLabel: string) =>
    t('dashboard.onDateAtAge', { date: formatDateLabel(date), age: ageLabel });
  const bmiBadgeForEntry = (entry: WeightEntry) => {
    if (!showBmi) {
      return null;
    }

    const heightCm = getHeightAtDate(heightEntries, entry.date);
    const bmi =
      heightCm === null
        ? null
        : calculateBmi(entry.weightKg, heightCm, {
            date: entry.date,
            birthDate,
            sex,
          });

    return (
      <BmiBadge
        bmi={bmi}
        compact
        centered
        onPress={() =>
          openWeighIn({
            date: entry.date,
            weightKg: entry.weightKg,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          })
        }
      />
    );
  };

  return (
    <AppCard title={t('dashboard.highlights')} isBusy={isBusy} delay={40}>
      <View style={styles.insightList}>
        {extremes.heaviest ? (
          <InsightRow
            label={t('dashboard.heaviestAtAge')}
            value={formatWeighIn(extremes.heaviest.entry.weightKg)}
            meta={formatMeta(extremes.heaviest.entry.date, extremes.heaviest.ageLabel)}
            badge={bmiBadgeForEntry(extremes.heaviest.entry)}
          />
        ) : null}
        {extremes.lightest ? (
          <InsightRow
            label={t('dashboard.lightestAtAge')}
            value={formatWeighIn(extremes.lightest.entry.weightKg)}
            meta={formatMeta(extremes.lightest.entry.date, extremes.lightest.ageLabel)}
            badge={bmiBadgeForEntry(extremes.lightest.entry)}
          />
        ) : null}
        {sinceBirthday ? (
          <InsightRow
            label={t('dashboard.sinceBirthday')}
            value={formatWeightDifference(sinceBirthday.changeKg, units, locale)}
            valueTextStyle={getWeightChangeTextStyle(sinceBirthday.changeKg, colors)}
            meta={formatMeta(sinceBirthday.birthday.entry.date, sinceBirthday.birthday.ageLabel)}
          />
        ) : null}
      </View>
    </AppCard>
  );
}
