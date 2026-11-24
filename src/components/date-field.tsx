import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentRef, type Ref } from 'react';
import { Platform, Pressable, Text, View, type GestureResponderEvent } from 'react-native';
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
  onClearPress?: (event: GestureResponderEvent) => void;
  triggerRef?: Ref<ComponentRef<typeof Pressable>>;
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
  triggerRef,
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
      ref={triggerRef}
      style={({ pressed }) => [
        styles.dateButton,
        invalid && styles.dateButtonInvalid,
        showDayStepper && styles.dateButtonInStepper,
        pressed && styles.buttonPressed,
      ]}
      onPress={() => setShowPicker(true)}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${dateLabel}`}
      aria-haspopup="dialog"
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

  const renderDayStepper = (direction: -1 | 1) => {
    const enabled = direction === -1 ? canDecreaseDay : canIncreaseDay;
    const label = t(direction === -1 ? 'dateField.decreaseDay' : 'dateField.increaseDay');
    const icon = (
      <Ionicons name={direction === -1 ? 'remove' : 'add'} size={22} color={colors.textMuted} />
    );

    if (Platform.OS === 'web') {
      return (
        <button
          type="button"
          style={{
            ...styles.stepperButton,
            display: 'flex',
            borderStyle: 'solid',
            padding: 0,
            ...(!enabled && styles.buttonDisabled),
          }}
          data-ww-stepper-button="true"
          data-ww-press-feedback="true"
          aria-label={label}
          aria-disabled={!enabled}
          onPointerDown={(event) => {
            if (document.activeElement?.matches('[data-ww-field-input="true"]')) {
              event.preventDefault();
            }
          }}
          onClick={(event) => {
            if (!enabled) return;
            if (event.detail > 0 && !document.activeElement?.matches('[data-ww-field-input="true"]')) {
              event.currentTarget.focus({ preventScroll: true });
            }
            adjustDay(direction);
          }}
        >
          {icon}
        </button>
      );
    }

    return (
      <Pressable
        style={({ pressed }) => [
          styles.stepperButton,
          !enabled && styles.buttonDisabled,
          pressed && enabled && styles.buttonPressed,
        ]}
        disabled={!enabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => adjustDay(direction)}
      >
        {icon}
      </Pressable>
    );
  };

  return (
    <View style={styles.rangeRow}>
      <View style={styles.filterFieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {optional && value && !readOnly ? (
          <Pressable
            onPress={(event) => (onClearPress ? onClearPress(event) : onChange(null))}
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
          {renderDayStepper(-1)}
          {dateButton}
          {renderDayStepper(1)}
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
