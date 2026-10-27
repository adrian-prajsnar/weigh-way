import { Text, TextStyle, View } from 'react-native';
import { calculateBmi } from '../bmi';
import { useBmiDetails } from '../context/bmi-details-context';
import { useSharedBmiDisplay } from '../context/bmi-display-context';
import { useUnits } from '../context/unit-context';
import { useSharedUserProfile } from '../context/user-profile-context';
import { formatWeightLabel } from '../format';
import { getHeightAtDate } from '../height';
import { useTranslation } from '../i18n/language-context';
import { HeightEntry, WeightEntry } from '../types';
import { useAppStyles } from '../theme/styles';
import { BmiBadge } from './bmi-badge';

type WeightWithBmiProps = {
  entry: WeightEntry;
  heightEntries: HeightEntry[];
  weightStyle?: TextStyle;
  compactBmi?: boolean;
  layout?: 'inline' | 'stacked';
  alwaysShowBmi?: boolean;
};

export function WeightWithBmi({
  entry,
  heightEntries,
  weightStyle,
  compactBmi = false,
  layout = 'inline',
  alwaysShowBmi = false,
}: WeightWithBmiProps) {
  const styles = useAppStyles();
  const { units } = useUnits();
  const { locale } = useTranslation();
  const { showBmi: showBmiPreference } = useSharedBmiDisplay();
  const showBmi = alwaysShowBmi || showBmiPreference;
  const { openWeighIn } = useBmiDetails();
  const { birthDate, sex, isLoading: isProfileLoading } = useSharedUserProfile();
  const heightCm = getHeightAtDate(heightEntries, entry.date);
  const bmi =
    heightCm === null
      ? null
      : calculateBmi(entry.weightKg, heightCm, {
          date: entry.date,
          birthDate,
          sex,
        });
  const weightLabel = formatWeightLabel(entry.weightKg, units, locale);

  const badge = showBmi ? (
    <BmiBadge
      bmi={bmi}
      compact={compactBmi}
      showUnavailable={!isProfileLoading && heightCm === null}
      onPress={() =>
        openWeighIn({
          date: entry.date,
          weightKg: entry.weightKg,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        })
      }
    />
  ) : null;

  if (layout === 'stacked') {
    return (
      <View style={styles.weightWithBmiStacked}>
        <Text style={[styles.historyWeight, weightStyle]}>{weightLabel}</Text>
        {badge}
      </View>
    );
  }

  return (
    <View style={styles.weightWithBmiInline}>
      <Text style={[styles.historyWeight, weightStyle]}>{weightLabel}</Text>
      {badge}
    </View>
  );
}
