import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentRef, type Ref } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDateRange, toDateKey } from '../format';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';
import { webFocusTarget } from '../theme/web-focus-target';
import { DatePickerSheet } from './date-picker-sheet';

type DateRangeFieldProps = {
  periodLabel?: string;
  triggerRef?: Ref<ComponentRef<typeof Pressable>>;
  start: Date | null;
  end: Date | null;
  onChange: (start: Date, end: Date) => void | Promise<void>;
  minimumDate?: Date;
  maximumDate?: Date;
  invalid?: boolean;
  validateRange?: (start: Date, end: Date) => string | null;
  getLatestEnd?: (start: Date) => Date;
};

export function DateRangeField({
  periodLabel,
  triggerRef,
  start,
  end,
  onChange,
  minimumDate,
  maximumDate,
  invalid = false,
  validateRange,
  getLatestEnd,
}: DateRangeFieldProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const value =
    start && end
      ? formatDateRange({ start: toDateKey(start), end: toDateKey(end) })
      : t('dateRange.selectRange');
  const label = t('dateRange.label');
  const selectRange = t('dateRange.selectRange');

  return (
    <View style={styles.rangeRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        ref={triggerRef}
        style={({ pressed }) => [
          styles.dateButton,
          invalid && styles.dateButtonInvalid,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => setShowPicker(true)}
        accessibilityRole="button"
        accessibilityLabel={
          periodLabel ? `${label} (${periodLabel}): ${value}` : `${label}: ${value}`
        }
        aria-expanded={showPicker}
        {...webFocusTarget('text-button')}
      >
        <View style={styles.filterFieldHeader}>
          <Text style={styles.dateRangeFieldValue}>{value}</Text>
          <Ionicons name="calendar-outline" size={18} color={colors.textSubtle} />
        </View>
      </Pressable>
      <DatePickerSheet
        mode="range"
        visible={showPicker}
        value={{ start, end }}
        title={periodLabel ? `${selectRange}: ${periodLabel}` : selectRange}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        validateRange={validateRange}
        getLatestEnd={getLatestEnd}
        onConfirm={({ start: nextStart, end: nextEnd }) => onChange(nextStart, nextEnd)}
        onClose={() => setShowPicker(false)}
      />
    </View>
  );
}
