import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { calculateBmi } from '../bmi';
import { BmiBadge } from './bmi-badge';
import { DateField } from './date-field';
import { useBmiDetails } from '../context/bmi-details-context';
import { useSharedBmiDisplay } from '../context/bmi-display-context';
import { useUnits } from '../context/unit-context';
import { useToast } from '../context/toast-context';
import { useSharedUserProfile } from '../context/user-profile-context';
import { useSharedWeightEntries } from '../context/weight-entries-context';
import {
  formatWeightValue,
  getTodayDate,
  getWeightRangeMessage,
  getWeightUnitLabel,
  parseWeightInput,
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
  const { upsertEntry } = useSharedWeightEntries();
  const [selectedDate, setSelectedDate] = useState(initialDate ?? getTodayDate);
  const [weightInput, setWeightInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const weightInputRef = useRef<TextInput>(null);

  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
  const weightPlaceholder = units === 'imperial' ? '0.0' : '0.00';
  const heightAtDate = getHeightAtDate(heightEntries, selectedDateKey);
  const parsedWeightKg = useMemo(
    () => parseWeightInput(weightInput, units),
    [weightInput, units],
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
    const existing = entries.find((entry) => entry.date === selectedDateKey);
    setWeightInput(existing ? formatWeightValue(existing.weightKg, units) : '');
  }, [entries, selectedDateKey, units]);

  useEffect(() => {
    if (!autoFocusWeight) {
      return;
    }
    const timer = setTimeout(() => weightInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [autoFocusWeight, initialDate]);

  const isDisabled = isSaving || isDataLoading || isProfileLoading;

  const adjustWeight = (direction: -1 | 1) => {
    const current =
      parseWeightInput(weightInput, units) ?? getLatestChange(entries).latest?.weightKg ?? null;
    if (current === null) {
      return;
    }

    const deltaKg =
      units === 'imperial' ? lbToKg(WEIGHT_STEP_LB) * direction : WEIGHT_STEP_KG * direction;
    setWeightInput(formatWeightValue(Math.round((current + deltaKg) * 100) / 100, units));
  };

  const handleSave = async () => {
    const weightKg = parseWeightInput(weightInput, units);
    if (weightKg === null) {
      showError(getWeightRangeMessage(units));
      return;
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
              onPress={() => adjustWeight(-1)}
              disabled={isDisabled}
              accessibilityRole="button"
              accessibilityLabel={t('entryForm.decreaseWeight')}
              {...(Platform.OS === 'web' ? { dataSet: { wwStepperButton: 'true' } } : {})}
            >
              <Ionicons name="remove" size={22} color={colors.textMuted} />
            </Pressable>

            <View
              style={[styles.weightInputWrapper, isFocused && styles.weightInputWrapperFocused]}
              {...(Platform.OS === 'web' ? { dataSet: { wwWeightField: 'true' } } : {})}
            >
              <TextInput
                ref={weightInputRef}
                style={styles.weightInput}
                value={weightInput}
                onChangeText={setWeightInput}
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
              onPress={() => adjustWeight(1)}
              disabled={isDisabled}
              accessibilityRole="button"
              accessibilityLabel={t('entryForm.increaseWeight')}
              {...(Platform.OS === 'web' ? { dataSet: { wwStepperButton: 'true' } } : {})}
            >
              <Ionicons name="add" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {showBmi && parsedWeightKg !== null ? (
          <View style={styles.bmiPreviewRow}>
            <Text style={styles.fieldLabel}>{t('entryForm.estimatedBmi')}</Text>
            <BmiBadge
              bmi={previewBmi}
              showUnavailable={heightAtDate === null}
              onPress={() => {
                const existing = entries.find((entry) => entry.date === selectedDateKey);
                openWeighIn({
                  date: selectedDateKey,
                  weightKg: parsedWeightKg,
                  createdAt: existing?.createdAt ?? null,
                  updatedAt: existing?.updatedAt ?? null,
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
