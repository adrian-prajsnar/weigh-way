import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { BmiInfo, formatBmiValue, getBmiTheme } from '../bmi';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';
import { useTheme } from '../theme/theme-context';

type BmiBadgeProps = {
  bmi: BmiInfo | null;
  compact?: boolean;
  centered?: boolean;
  labelOnly?: boolean;
  showUnavailable?: boolean;
  onPress?: () => void;
};

export function BmiBadge({
  bmi,
  compact = false,
  centered = false,
  labelOnly = false,
  showUnavailable = false,
  onPress,
}: BmiBadgeProps) {
  const styles = useAppStyles();
  const { scheme } = useTheme();
  const { t, locale } = useTranslation();

  if (bmi === null) {
    if (!showUnavailable) {
      return null;
    }

    const unavailableTheme = getBmiTheme('unclassified', scheme);

    return (
      <View
        style={[
          styles.bmiBadge,
          compact && styles.bmiBadgeCompact,
          centered ? styles.bmiBadgeCentered : null,
          { backgroundColor: unavailableTheme.backgroundColor },
        ]}
        accessibilityRole="text"
        accessibilityLabel={t('bmi.unavailableLabel')}
      >
        <Text
          style={[
            styles.bmiBadgeText,
            compact && styles.bmiBadgeTextCompact,
            { color: unavailableTheme.textColor },
          ]}
        >
          {t('bmi.unavailableLabel')}
        </Text>
      </View>
    );
  }

  const badgeTheme = getBmiTheme(bmi.category, scheme);
  const formattedValue = formatBmiValue(bmi.value, locale);
  const label = labelOnly
    ? bmi.label
    : onPress && !compact
      ? t('bmi.badgeInteractive', { category: bmi.label, value: formattedValue })
      : t('bmi.label', { value: formattedValue });
  const iconSize = compact ? 12 : 13;
  const badgeStyle = [
    styles.bmiBadge,
    onPress ? styles.bmiBadgeInteractive : null,
    compact && styles.bmiBadgeCompact,
    centered ? styles.bmiBadgeCentered : null,
    { backgroundColor: badgeTheme.backgroundColor },
  ];
  const badgeText = (
    <Text
      style={[
        styles.bmiBadgeText,
        compact && styles.bmiBadgeTextCompact,
        { color: badgeTheme.textColor },
      ]}
    >
      {label}
    </Text>
  );

  if (!onPress) {
    return (
      <View style={badgeStyle} accessibilityRole="text" accessibilityLabel={label}>
        {badgeText}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [...badgeStyle, pressed && styles.buttonPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${t('bmi.openDetailsA11y')}`}
    >
      {badgeText}
      <View style={[styles.bmiBadgeChevron, compact && styles.bmiBadgeChevronCompact]}>
        <Ionicons name="chevron-forward" size={iconSize} color={badgeTheme.textColor} />
      </View>
    </Pressable>
  );
}
