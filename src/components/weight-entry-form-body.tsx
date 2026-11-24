import { Ionicons } from '@expo/vector-icons';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { calculateBmi } from '../bmi';
import { BmiBadge } from './bmi-badge';
import { DateField } from './date-field';
import { useBmiDetails } from '../context/bmi-details-context';
import { useSharedBmiDisplay } from '../context/bmi-display-context';
import { useUnits } from '../context/unit-context';
import { useConfirm } from '../context/confirm-context';
import { useToast } from '../context/toast-context';
import { useSharedUserProfile } from '../context/user-profile-context';
import { useSharedWeightEntries } from '../context/weight-entries-context';
import { isDemoMode } from '../demo/is-demo-mode';
import { useTodayKey } from '../hooks/use-today-key';
import { useNetworkStatus } from '../hooks/use-network-status';
import { shouldBlockSaveForOffline } from '../network/connectivity';
import {
  formatDateLabel,
  formatWeightValue,
  getTodayDate,
  fromDateKey,
  getWeightRangeMessage,
  getWeightUnitLabel,
  normalizeWeightInputText,
  parseWeightInput,
  resolveWeightKgForSave,
  toDateKey,
} from '../format';
import { getHeightAtDate } from '../height';
import { useTranslation } from '../i18n/language-context';
import { getLatestChange } from '../stats';
import { WeightEntry } from '../types';
import { lbToKg, WEIGHT_STEP_KG, WEIGHT_STEP_LB } from '../units';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';
import { spacing } from '../theme/tokens';
import { useWebStepperPress } from '../theme/use-web-stepper-press';
import { revealWebFocus } from '../theme/web-focus-target';
import { useWeightEntryPrefill } from './use-weight-entry-prefill';

type WeightEntryFormBodyProps = {
  entries: WeightEntry[];
  isDataLoading?: boolean;
  initialDate?: Date;
  resetDateAfterSave?: boolean;
  onSaveSuccess?: () => void;
  autoFocusWeight?: boolean;
  dateReadOnly?: boolean;
};

export function WeightEntryFormBody({
  entries,
  isDataLoading = false,
  initialDate,
  resetDateAfterSave = false,
  onSaveSuccess,
  autoFocusWeight = false,
  dateReadOnly = false,
}: WeightEntryFormBodyProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t, locale } = useTranslation();
  const { units } = useUnits();
  const { heightEntries, birthDate, sex, isLoading: isProfileLoading } = useSharedUserProfile();
  const { showBmi } = useSharedBmiDisplay();
  const { openWeighIn } = useBmiDetails();
  const { showError, showSuccess } = useToast();
  const { confirm } = useConfirm();
  const { isOffline } = useNetworkStatus();
  const { upsertEntry } = useSharedWeightEntries();
  const todayKey = useTodayKey();
  const dateTouchedRef = useRef(false);
  const [selectedDate, setSelectedDate] = useState(initialDate ?? getTodayDate);
  const [isSaving, setIsSaving] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [weightValidationMessage, setWeightValidationMessage] = useState<string | null>(null);
  const weightErrorId = useId();
  const [isConfirmingReplace, setIsConfirmingReplace] = useState(false);
  const weightInputRef = useRef<TextInputInstance>(null);

  useLayoutEffect(() => {
    if (Platform.OS === 'web' && weightValidationMessage) {
      weightInputRef.current?.focus();
    }
  }, [weightValidationMessage]);

  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
  const existingEntryForDate = useMemo(
    () => entries.find((entry) => entry.date === selectedDateKey),
    [entries, selectedDateKey],
  );
  const existingEntryWeightKg = existingEntryForDate?.weightKg;
  const { weightInput, setWeightInput, weightInputTouchedRef } = useWeightEntryPrefill({
    selectedDateKey,
    units,
    locale,
    existingEntryWeightKg,
  });
  const weightPlaceholder = formatWeightValue(0, units, locale);
  const heightAtDate = getHeightAtDate(heightEntries, selectedDateKey);
  const parsedWeightKg = useMemo(
    () =>
      resolveWeightKgForSave(weightInput, units, locale, existingEntryWeightKg) ??
      parseWeightInput(weightInput, units),
    [weightInput, units, locale, existingEntryWeightKg],
  );

  // Not memoized: the result carries a category label translated for the active language.
  const previewBmi =
    !showBmi || parsedWeightKg === null || heightAtDate === null
      ? null
      : calculateBmi(parsedWeightKg, heightAtDate, {
          date: selectedDateKey,
          birthDate,
          sex,
        });

  useEffect(() => {
    if (!initialDate && !dateTouchedRef.current && !weightInputTouchedRef.current) {
      setSelectedDate(fromDateKey(todayKey));
    }
  }, [initialDate, todayKey, weightInputTouchedRef]);

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  useEffect(() => {
    if (!autoFocusWeight) {
      return;
    }
    if (Platform.OS === 'web') {
      const frame = requestAnimationFrame(() => weightInputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
    const timer = setTimeout(() => weightInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [autoFocusWeight, initialDate]);

  const isLoading = isDataLoading || isProfileLoading;
  const isDisabled = isSaving || isConfirmingReplace || isLoading;

  const adjustWeight = (direction: -1 | 1) => {
    if (Platform.OS === 'web') {
      weightInputRef.current?.blur();
    }

    const current =
      parseWeightInput(weightInput, units) ?? getLatestChange(entries).latest?.weightKg ?? null;
    if (current === null) {
      return;
    }

    const deltaKg =
      units === 'imperial' ? lbToKg(WEIGHT_STEP_LB) * direction : WEIGHT_STEP_KG * direction;
    weightInputTouchedRef.current = true;
    setWeightInput(formatWeightValue(Math.round((current + deltaKg) * 100) / 100, units, locale));
    setWeightValidationMessage(null);
  };

  const decreaseWeightStepper = useWebStepperPress(() => adjustWeight(-1));
  const increaseWeightStepper = useWebStepperPress(() => adjustWeight(1));

  const handleSave = async () => {
    if (isDisabled) {
      return;
    }

    if (shouldBlockSaveForOffline(isOffline, isDemoMode())) {
      showError(t('entryForm.offlineSaveBlocked'));
      return;
    }

    const weightKg = resolveWeightKgForSave(weightInput, units, locale, existingEntryWeightKg);
    if (weightKg === null) {
      const message = normalizeWeightInputText(weightInput)
        ? getWeightRangeMessage(units, locale)
        : t('entryForm.invalidWeight');
      setWeightValidationMessage(message);
      if (Platform.OS !== 'web') {
        showError(message);
      } else if (weightValidationMessage === message) {
        weightInputRef.current?.focus();
      }
      return;
    }

    setWeightValidationMessage(null);

    if (existingEntryForDate !== undefined && existingEntryForDate.weightKg === weightKg) {
      weightInputTouchedRef.current = false;
      if (selectedDateKey === toDateKey(getTodayDate())) dateTouchedRef.current = false;
      showSuccess(t('entryForm.saved'));
      onSaveSuccess?.();
      return;
    }

    if (
      !dateReadOnly &&
      existingEntryForDate !== undefined &&
      existingEntryForDate.weightKg !== weightKg
    ) {
      const dateLabel = formatDateLabel(selectedDateKey);
      setIsConfirmingReplace(true);
      let confirmed = false;
      try {
        confirmed = await confirm({
          title: t('entryForm.replaceExistingTitle'),
          message: t('entryForm.replaceExistingMessage', { date: dateLabel }),
          confirmLabel: t('entryForm.replaceExistingConfirm'),
          destructive: true,
        });
      } finally {
        setIsConfirmingReplace(false);
      }
      if (!confirmed) {
        return;
      }
    }

    setIsSaving(true);

    try {
      await upsertEntry(selectedDateKey, weightKg);
      weightInputTouchedRef.current = false;
      if (selectedDateKey === toDateKey(getTodayDate())) dateTouchedRef.current = false;
      if (resetDateAfterSave) {
        dateTouchedRef.current = false;
        setSelectedDate(getTodayDate());
      }
      showSuccess(t('entryForm.saved'));
      onSaveSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('entryForm.saveFailed');
      showError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const saveLabel = t('entryForm.saveEntry');
  const saveContent = isSaving ? (
    <ActivityIndicator color={colors.onAccent} />
  ) : (
    <Text style={styles.primaryButtonText}>{saveLabel}</Text>
  );

  return (
    <View style={{ gap: spacing.md }}>
      <DateField
        label={t('entryForm.date')}
        value={selectedDate}
        onChange={(date) => {
          if (date) {
            dateTouchedRef.current = true;
            setSelectedDate(date);
          }
        }}
        maximumDate={getTodayDate()}
        readOnly={dateReadOnly}
        showDayStepper={!dateReadOnly}
      />

      <View style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.fieldLabel}>{t('entryForm.weight')}</Text>
          <View style={styles.weightEntryRow}>
            <Pressable
              style={({ pressed }) => [styles.stepperButton, pressed && styles.buttonPressed]}
              disabled={isDisabled}
              accessibilityRole="button"
              accessibilityLabel={t('entryForm.decreaseWeight')}
              {...decreaseWeightStepper}
              {...(Platform.OS === 'web' ? { dataSet: { wwStepperButton: 'true' } } : {})}
            >
              <Ionicons name="remove" size={22} color={colors.textMuted} />
            </Pressable>

            <View
              style={[styles.weightInputWrapper, isFocused && styles.weightInputWrapperFocused]}
            >
              <TextInput
                ref={weightInputRef}
                style={styles.weightInput}
                value={weightInput}
                onChangeText={(value) => {
                  weightInputTouchedRef.current = true;
                  setWeightInput(value);
                  if (weightValidationMessage) {
                    setWeightValidationMessage(null);
                  }
                }}
                onFocus={(event) => {
                  setIsFocused(true);
                  revealWebFocus(event.currentTarget);
                }}
                onBlur={() => setIsFocused(false)}
                keyboardType="decimal-pad"
                accessibilityLabel={`${t('entryForm.weight')} (${getWeightUnitLabel(units)})`}
                placeholder={weightPlaceholder}
                placeholderTextColor={colors.textSubtle}
                editable={!isDisabled}
                accessibilityHint={weightValidationMessage ?? undefined}
                {...(Platform.OS === 'web'
                  ? {
                      dataSet: { wwFieldInput: 'true' },
                      'aria-invalid': weightValidationMessage ? true : undefined,
                      'aria-describedby': weightValidationMessage ? weightErrorId : undefined,
                    }
                  : {})}
              />
              <Text style={styles.weightInputUnit}>{getWeightUnitLabel(units)}</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.stepperButton, pressed && styles.buttonPressed]}
              disabled={isDisabled}
              accessibilityRole="button"
              accessibilityLabel={t('entryForm.increaseWeight')}
              {...increaseWeightStepper}
              {...(Platform.OS === 'web' ? { dataSet: { wwStepperButton: 'true' } } : {})}
            >
              <Ionicons name="add" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          {weightValidationMessage ? (
            <Text nativeID={weightErrorId} style={styles.fieldErrorText}>
              {weightValidationMessage}
            </Text>
          ) : null}
        </View>

        {showBmi && parsedWeightKg !== null ? (
          <View style={styles.bmiPreviewRow}>
            <Text style={styles.fieldLabel}>{t('entryForm.estimatedBmi')}</Text>
            <BmiBadge
              bmi={previewBmi}
              showUnavailable={!isProfileLoading && heightAtDate === null}
              onPress={() => {
                openWeighIn({
                  date: selectedDateKey,
                  weightKg: parsedWeightKg,
                  createdAt: existingEntryForDate?.createdAt ?? null,
                  updatedAt: existingEntryForDate?.updatedAt ?? null,
                });
              }}
            />
          </View>
        ) : null}

        {Platform.OS === 'web' ? (
          <button
            type="button"
            style={{ ...styles.primaryButtonWeb, ...(isDisabled && styles.buttonDisabled) }}
            data-ww-press-feedback="true"
            disabled={isLoading}
            aria-label={saveLabel}
            aria-disabled={isDisabled}
            aria-busy={isSaving}
            onClick={() => void handleSave()}
          >
            {saveContent}
          </button>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              isDisabled && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => void handleSave()}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityLabel={saveLabel}
            aria-busy={isSaving}
          >
            {saveContent}
          </Pressable>
        )}
      </View>
    </View>
  );
}
