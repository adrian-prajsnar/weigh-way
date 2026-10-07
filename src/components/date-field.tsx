import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { formatDateLabel, addDays, getTodayDate, toDateKey } from '../format';
import { useTranslation } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/translation-keys';
import { useAppStyles } from '../theme/styles';
import { webFocusTarget } from '../theme/web-focus-target';
import { useColors } from '../theme/theme-context';
import { DatePickerSheet } from './date-picker-sheet';

type DateFieldProps = {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void | Promise<void>;
  optional?: boolean;
  readOnly?: boolean;
  autoOpen?: boolean;
  maximumDate?: Date;
  minimumDate?: Date;
  showDayStepper?: boolean;
  invalid?: boolean;
  clearLabelKey?: TranslationKey;
  onClearPress?: () => void;
};

export function DateField({
  label,
  value,
  onChange,
  optional = false,
  readOnly = false,
  autoOpen = false,
  maximumDate,
  minimumDate,
  showDayStepper = false,
  invalid = false,
  clearLabelKey = 'common.clear',
  onClearPress,
}: DateFieldProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (autoOpen && !readOnly) {
      setShowPicker(true);
    }
  }, [autoOpen, readOnly]);

  const canDecreaseDay =
    value !== null &&
    (minimumDate === undefined || toDateKey(value) > toDateKey(minimumDate));
  const canIncreaseDay =
    value !== null &&
    (maximumDate === undefined || toDateKey(value) < toDateKey(maximumDate));

  const adjustDay = (direction: -1 | 1) => {
    if (!value) {
      return;
    }
    const next = addDays(value, direction);
    if (minimumDate && toDateKey(next) < toDateKey(minimumDate)) {
      return;
    }
    if (maximumDate && toDateKey(next) > toDateKey(maximumDate)) {
      return;
    }
    onChange(next);
  };

  const dateLabel = value
    ? formatDateLabel(toDateKey(value))
    : optional
      ? t('common.any')
      : t('dateField.selectDate');

  const dateButton = readOnly ? (
    <View style={[styles.dateButton, styles.dateButtonReadOnly]}>
      <Text style={styles.dateButtonValue}>{dateLabel}</Text>
    </View>
  ) : (
    <Pressable
      style={({ pressed }) => [
        styles.dateButton,
        invalid && styles.dateButtonInvalid,
        showDayStepper && styles.dateButtonInStepper,
        pressed && styles.buttonPressed,
      ]}
      onPress={() => setShowPicker(true)}
    >
      <View
        style={[
          styles.filterFieldHeader,
          showDayStepper ? { justifyContent: 'center' } : null,
        ]}
      >
        <Text style={[styles.dateButtonValue, optional && !value && styles.filterPlaceholder]}>
          {dateLabel}
        </Text>
        {!showDayStepper ? (
          <Ionicons name="calendar-outline" size={18} color={colors.textSubtle} />
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <View style={styles.rangeRow}>
      <View style={styles.filterFieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {optional && value && !readOnly ? (
          <Pressable
            onPress={() => (onClearPress ? onClearPress() : onChange(null))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t(clearLabelKey)}
            {...webFocusTarget('text-button')}
          >
            <Text style={styles.linkText}>{t(clearLabelKey)}</Text>
          </Pressable>
        ) : null}
      </View>
      {showDayStepper && value && !readOnly ? (
        <View style={styles.weightEntryRow}>
          <Pressable
            style={({ pressed }) => [
              styles.stepperButton,
              !canDecreaseDay && styles.buttonDisabled,
              pressed && canDecreaseDay && styles.buttonPressed,
            ]}
            onPress={() => adjustDay(-1)}
            disabled={!canDecreaseDay}
            accessibilityRole="button"
            accessibilityLabel={t('dateField.decreaseDay')}
            {...(Platform.OS === 'web' ? { dataSet: { wwStepperButton: 'true' } } : {})}
          >
            <Ionicons name="remove" size={22} color={colors.textMuted} />
          </Pressable>
          {dateButton}
          <Pressable
            style={({ pressed }) => [
              styles.stepperButton,
              !canIncreaseDay && styles.buttonDisabled,
              pressed && canIncreaseDay && styles.buttonPressed,
            ]}
            onPress={() => adjustDay(1)}
            disabled={!canIncreaseDay}
            accessibilityRole="button"
            accessibilityLabel={t('dateField.increaseDay')}
            {...(Platform.OS === 'web' ? { dataSet: { wwStepperButton: 'true' } } : {})}
          >
            <Ionicons name="add" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        dateButton
      )}
      {!readOnly ? (
        <DatePickerSheet
          visible={showPicker}
          value={value ?? getTodayDate()}
          title={label}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onClose={() => setShowPicker(false)}
          onConfirm={onChange}
        />
      ) : null}
    </View>
  );
}
