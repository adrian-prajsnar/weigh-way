import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  TextInputInstance,
  View,
} from 'react-native';
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
import { useNetworkStatus } from '../hooks/use-network-status';
import { shouldBlockSaveForOffline } from '../network/connectivity';
import {
  formatDateLabel,
  formatWeightValue,
  getTodayDate,
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

type WeightEntryFormBodyProps = {
  entries: WeightEntry[];
  onSaved: () => Promise<void>;
  isDataLoading?: boolean;
  initialDate?: Date;
  resetDateAfterSave?: boolean;
  onSaveSuccess?: () => void;
  autoFocusWeight?: boolean;
  dateReadOnly?: boolean;
};

export function WeightEntryFormBody({
  entries,
  onSaved: _onSaved,
  isDataLoading = false,
  initialDate,
  resetDateAfterSave = false,
  onSaveSuccess,
  autoFocusWeight = false,
  dateReadOnly = false,
}: WeightEntryFormBodyProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const { units } = useUnits();
  const { heightEntries, birthDate, sex, isLoading: isProfileLoading } = useSharedUserProfile();
  const { showBmi } = useSharedBmiDisplay();
  const { openWeighIn } = useBmiDetails();
  const { showError, showSuccess } = useToast();
  const { confirm } = useConfirm();
  const { isOffline } = useNetworkStatus();
  const { upsertEntry } = useSharedWeightEntries();
  const [selectedDate, setSelectedDate] = useState(initialDate ?? getTodayDate);
  const [weightInput, setWeightInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [weightValidationMessage, setWeightValidationMessage] = useState<string | null>(null);
  const [isConfirmingReplace, setIsConfirmingReplace] = useState(false);
  const weightInputRef = useRef<TextInputInstance>(null);

  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
  const existingEntryForDate = useMemo(
    () => entries.find((entry) => entry.date === selectedDateKey),
    [entries, selectedDateKey],
  );
  const existingEntryWeightKg = existingEntryForDate?.weightKg;
  const weightPlaceholder = units === 'imperial' ? '0.0' : '0.00';
  const heightAtDate = getHeightAtDate(heightEntries, selectedDateKey);
  const parsedWeightKg = useMemo(
    () =>
      resolveWeightKgForSave(weightInput, units, existingEntryWeightKg) ??
      parseWeightInput(weightInput, units),
    [weightInput, units, existingEntryWeightKg],
  );

  const previewBmi = useMemo(() => {
    if (!showBmi || parsedWeightKg === null || heightAtDate === null) {
      return null;
    }
    return calculateBmi(parsedWeightKg, heightAtDate, {
      date: selectedDateKey,
      birthDate,
      sex,
    });
  }, [parsedWeightKg, heightAtDate, showBmi, selectedDateKey, birthDate, sex]);

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  useEffect(() => {
    setWeightInput(
      existingEntryWeightKg !== undefined ? formatWeightValue(existingEntryWeightKg, units) : '',
    );
  }, [selectedDateKey, existingEntryWeightKg, units]);

  useEffect(() => {
    if (!autoFocusWeight) {
      return;
    }
    const timer = setTimeout(() => weightInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [autoFocusWeight, initialDate]);

  const isDisabled = isSaving || isDataLoading || isProfileLoading;

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
    setWeightInput(formatWeightValue(Math.round((current + deltaKg) * 100) / 100, units));
  };

  const decreaseWeightStepper = useWebStepperPress(() => adjustWeight(-1));
  const increaseWeightStepper = useWebStepperPress(() => adjustWeight(1));

  const handleSave = async () => {
    if (isSaving || isConfirmingReplace) {
      return;
    }

    if (shouldBlockSaveForOffline(isOffline, isDemoMode())) {
      showError(t('entryForm.offlineSaveBlocked'));
      return;
    }

    const weightKg = resolveWeightKgForSave(weightInput, units, existingEntryWeightKg);
    if (weightKg === null) {
      const message = normalizeWeightInputText(weightInput)
        ? getWeightRangeMessage(units)
        : t('entryForm.invalidWeight');
      setWeightValidationMessage(message);
      showError(message);
      return;
    }

    setWeightValidationMessage(null);

    if (existingEntryForDate !== undefined && existingEntryForDate.weightKg === weightKg) {
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
      if (resetDateAfterSave) {
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

  return (
    <View style={{ gap: spacing.md }}>
      <DateField
        label={t('entryForm.date')}
        value={selectedDate}
        onChange={(date) => {
          if (date) {
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
                  setWeightInput(value);
                  if (weightValidationMessage) {
                    setWeightValidationMessage(null);
                  }
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                keyboardType="decimal-pad"
                placeholder={weightPlaceholder}
                placeholderTextColor={colors.textSubtle}
                editable={!isDisabled}
                {...(Platform.OS === 'web' ? { dataSet: { wwFieldInput: 'true' } } : {})}
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
            <Text style={styles.fieldErrorText}>{weightValidationMessage}</Text>
          ) : null}
        </View>

        {showBmi && parsedWeightKg !== null ? (
          <View style={styles.bmiPreviewRow}>
            <Text style={styles.fieldLabel}>{t('entryForm.estimatedBmi')}</Text>
            <BmiBadge
              bmi={previewBmi}
              showUnavailable={heightAtDate === null}
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

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            isDisabled && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => void handleSave()}
          disabled={isDisabled}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryButtonText}>{t('entryForm.saveEntry')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
