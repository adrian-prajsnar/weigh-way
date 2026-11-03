import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useUnits } from '../context/unit-context';
import { formatWeightValue, getDisplayedWeightDifference, getWeightUnitLabel } from '../format';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';

type DeltaChipProps = {
  /** Signed change in kg. `null` renders nothing. */
  value: number | null;
  suffix?: string;
};

export function DeltaChip({ value, suffix }: DeltaChipProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const { units } = useUnits();
  const { locale } = useTranslation();
  const weightUnit = getWeightUnitLabel(units);

  if (value === null) {
    return null;
  }

  const displayed = getDisplayedWeightDifference(value, units);
  const isFlat = displayed === 0;
  const isDown = displayed < 0;

  const tint = isFlat
    ? { background: colors.surfaceMuted, text: colors.textMuted }
    : isDown
      ? { background: colors.successSoft, text: colors.successText }
      : { background: colors.warningSoft, text: colors.warningText };

  const icon = isFlat ? 'remove' : isDown ? 'arrow-down' : 'arrow-up';
  const sign = isFlat ? '' : isDown ? '−' : '+';

  return (
    <View style={[styles.deltaChip, { backgroundColor: tint.background }]}>
      <Ionicons name={icon} size={13} color={tint.text} />
      <Text style={[styles.deltaChipText, { color: tint.text }]}>
        {sign}
        {formatWeightValue(Math.abs(value), units, locale)} {weightUnit}
        {suffix ? ` ${suffix}` : ''}
      </Text>
    </View>
  );
}
