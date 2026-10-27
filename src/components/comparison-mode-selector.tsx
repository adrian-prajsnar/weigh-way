import { useMemo } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { TranslationKey } from '../i18n/translation-keys';
import { useTranslation } from '../i18n/language-context';
import { ComparisonMode } from '../types';
import { useAppStyles } from '../theme/styles';

const COMPARISON_MODE_KEYS: Record<ComparisonMode, TranslationKey> = {
  day: 'comparison.day',
  week: 'comparison.week',
  month: 'comparison.month',
  year: 'comparison.year',
  ageYear: 'comparison.ageYear',
  custom: 'comparison.custom',
};

type ComparisonModeSelectorProps = {
  selected: ComparisonMode;
  onSelect: (mode: ComparisonMode) => void;
  showAgeYear?: boolean;
};

export function ComparisonModeSelector({
  selected,
  onSelect,
  showAgeYear = false,
}: ComparisonModeSelectorProps) {
  const styles = useAppStyles();
  const { t } = useTranslation();

  const options = useMemo(() => {
    const values: ComparisonMode[] = ['day', 'week', 'month', 'year'];
    if (showAgeYear) {
      values.push('ageYear');
    }
    values.push('custom');
    return values.map((value) => ({
      value,
      label: t(COMPARISON_MODE_KEYS[value]),
    }));
  }, [showAgeYear, t]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.presetScroll}
      contentContainerStyle={styles.presetScrollContent}
    >
      {options.map((option) => {
        const isActive = selected === option.value;
        return (
          <Pressable
            key={option.value}
            style={({ pressed }) => [
              styles.presetButton,
              isActive && styles.presetButtonActive,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => onSelect(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[styles.presetButtonText, isActive && styles.presetButtonTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
