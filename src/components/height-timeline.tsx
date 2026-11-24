import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type Ref } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useUnits } from '../context/unit-context';
import { getRecentHeightEntries, getSortedHeightEntries } from '../height';
import {
  formatDateLabel,
  formatHeight,
  fromDateKey,
  getHeightRangeMessage,
  heightToInputParts,
  toDateKey,
} from '../format';
import { useTranslation } from '../i18n/language-context';
import { HeightEntry } from '../types';
import { UnitSystem } from '../units';
import { useAppStyles } from '../theme/styles';
import { revealWebFocus, webFocusTarget } from '../theme/web-focus-target';
import { useColors } from '../theme/theme-context';
import { useConfirm } from '../context/confirm-context';
import { useRecordDeletionFocus } from '../hooks/use-record-deletion-focus';
import { useTodayKey } from '../hooks/use-today-key';
import { hasHeightDateCollision, resolveHeightCmForSave } from './height-entry-input';
import { DateField } from './date-field';

const PREVIEW_LIMIT = 1;

type HeightHistoryPreviewProps = {
  heightEntries: HeightEntry[];
  onShowAll: () => void;
  showAllRef?: Ref<ComponentRef<typeof Pressable>>;
};

export function HeightHistoryPreview({ heightEntries, onShowAll, showAllRef }: HeightHistoryPreviewProps) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { units } = useUnits();

  const latestEntry = useMemo(
    () => getRecentHeightEntries(heightEntries, PREVIEW_LIMIT)[0],
    [heightEntries],
  );

  return (
    <View style={{ gap: 12 }}>
      {latestEntry ? (
        <View>
          <Text style={styles.accountLabel}>
            {t('profile.heightFrom', { date: formatDateLabel(latestEntry.effectiveDate) })}
          </Text>
          <Text style={styles.accountValue}>{formatHeight(latestEntry.heightCm, units)}</Text>
        </View>
      ) : (
        <Text style={styles.settingHint}>{t('profile.heightTimelineEmptyHint')}</Text>
      )}

      <Pressable
        ref={showAllRef}
        accessibilityRole="button"
        onPress={onShowAll}
        hitSlop={8}
        {...webFocusTarget('text-button')}
      >
        <Text style={styles.linkText}>{t('profile.manageHeightRecords')}</Text>
      </Pressable>
    </View>
  );
}

type HeightTimelineEditorProps = {
  heightEntries: HeightEntry[];
  isSaving: boolean;
  deletingEffectiveDate: string | null;
  onSave: (effectiveDate: string, heightCm: number) => Promise<void>;
  onUpdate: (
    previousEffectiveDate: string,
    effectiveDate: string,
    heightCm: number,
  ) => Promise<void>;
  onDelete?: (effectiveDate: string) => Promise<void>;
  onInvalidHeight: () => void;
};

type EditorFocusRequest =
  | { area: 'form' }
  | { area: 'list'; date: string | null; from?: Element | null };

export function HeightTimelineEditor({
  heightEntries,
  isSaving,
  deletingEffectiveDate,
  onSave,
  onUpdate,
  onDelete,
  onInvalidHeight,
}: HeightTimelineEditorProps) {
  const heightErrorId = useId();
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const { units } = useUnits();
  const todayKey = useTodayKey();
  const today = useMemo(() => fromDateKey(todayKey), [todayKey]);
  const { confirm } = useConfirm();
  const isFocused = useIsFocused();
  const savingRef = useRef(false);
  const focusRequest = useRef<EditorFocusRequest | null>(null);
  const addButtonRef = useRef<ComponentRef<typeof Pressable>>(null);
  const cancelButtonRef = useRef<ComponentRef<typeof Pressable>>(null);
  const heightInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const focusInvalidHeight = useRef(false);
  const editButtons = useRef(new Map<string, ComponentRef<typeof Pressable>>());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingEffectiveDate, setEditingEffectiveDate] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [heightPrimaryInput, setHeightPrimaryInput] = useState('');
  const [heightSecondaryInput, setHeightSecondaryInput] = useState('');
  const [showHeightError, setShowHeightError] = useState(false);
  const prevUnitsRef = useRef<UnitSystem>(units);

  const sortedEntries = useMemo(() => getSortedHeightEntries(heightEntries), [heightEntries]);
  const dates = useMemo(() => sortedEntries.map(({ effectiveDate }) => effectiveDate), [sortedEntries]);
  const { deleteRecord, canEdit } = useRecordDeletionFocus(
    dates,
    deletingEffectiveDate,
    editButtons,
    addButtonRef,
  );

  useLayoutEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    if (!isFocused) {
      focusRequest.current = null;
      return;
    }

    if (request.area === 'form' && formMode) {
      focusRequest.current = null;
      cancelButtonRef.current?.focus();
    } else if (request.area === 'list' && !formMode && !isSaving && !isSubmitting) {
      focusRequest.current = null;
      const active = document.activeElement;
      if (request.from !== undefined && active !== request.from && active !== document.body) return;
      const target = request.date ? editButtons.current.get(request.date) : undefined;
      (target ?? addButtonRef.current)?.focus();
    }
  }, [formMode, isFocused, isSaving, isSubmitting]);

  const resetForm = () => {
    setFormMode(null);
    setEditingEffectiveDate(null);
    setHeightPrimaryInput('');
    setHeightSecondaryInput('');
    setShowHeightError(false);
  };

  const startAdding = () => {
    if (Platform.OS === 'web') focusRequest.current = { area: 'form' };
    setFormMode('add');
    setEditingEffectiveDate(null);
    setEffectiveDate(today);
    setHeightPrimaryInput('');
    setHeightSecondaryInput('');
    setShowHeightError(false);
  };

  const startEditing = (entry: HeightEntry) => {
    if (Platform.OS === 'web') focusRequest.current = { area: 'form' };
    setFormMode('edit');
    setEditingEffectiveDate(entry.effectiveDate);
    setEffectiveDate(fromDateKey(entry.effectiveDate));
    const parts = heightToInputParts(entry.heightCm, units);
    setHeightPrimaryInput(parts.primary);
    setHeightSecondaryInput(parts.secondary);
    setShowHeightError(false);
  };

  const storedHeightCm =
    formMode === 'edit'
      ? heightEntries.find((entry) => entry.effectiveDate === editingEffectiveDate)?.heightCm
      : undefined;
  const heightCm = resolveHeightCmForSave(
    units,
    heightPrimaryInput,
    heightSecondaryInput,
    storedHeightCm,
  );
  const heightError = showHeightError && heightCm === null ? getHeightRangeMessage(units) : undefined;
  const heightErrorA11y =
    Platform.OS === 'web' && heightError
      ? { 'aria-invalid': true, 'aria-describedby': heightErrorId }
      : undefined;

  useLayoutEffect(() => {
    if (!heightError || !focusInvalidHeight.current) return;
    focusInvalidHeight.current = false;
    if (isFocused) heightInputRef.current?.focus();
  }, [heightError, isFocused]);

  const handleSave = async () => {
    if (savingRef.current || isSaving) return;
    if (heightCm === null) {
      if (Platform.OS !== 'web') {
        onInvalidHeight();
      } else if (heightError) {
        heightInputRef.current?.focus();
      } else {
        focusInvalidHeight.current = true;
        setShowHeightError(true);
      }
      return;
    }

    const effectiveDateKey = toDateKey(effectiveDate);
    const from = Platform.OS === 'web' ? document.activeElement : undefined;

    savingRef.current = true;
    setIsSubmitting(true);
    try {
      const collision = hasHeightDateCollision(
        heightEntries,
        effectiveDateKey,
        editingEffectiveDate,
      );
      if (
        collision &&
        !(await confirm({
          title: t('profile.replaceHeightTitle'),
          message: t('profile.replaceHeightMessage', { date: formatDateLabel(effectiveDateKey) }),
          confirmLabel: t('entryForm.replaceExistingConfirm'),
          destructive: true,
        }))
      )
        return;
      if (formMode === 'edit' && editingEffectiveDate) {
        await onUpdate(editingEffectiveDate, effectiveDateKey, heightCm);
      } else {
        await onSave(effectiveDateKey, heightCm);
      }
      if (Platform.OS === 'web') {
        focusRequest.current = { area: 'list', date: effectiveDateKey, from };
      }
      resetForm();
    } catch {
      // The screen reports the error; preserve the user's inputs for retry.
    } finally {
      savingRef.current = false;
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (formMode === null) {
      prevUnitsRef.current = units;
      return;
    }

    const prevUnits = prevUnitsRef.current;
    if (prevUnits === units) {
      return;
    }
    prevUnitsRef.current = units;

    const storedHeightCm =
      formMode === 'edit'
        ? heightEntries.find((entry) => entry.effectiveDate === editingEffectiveDate)?.heightCm
        : undefined;
    const parsed = resolveHeightCmForSave(
      prevUnits,
      heightPrimaryInput,
      heightSecondaryInput,
      storedHeightCm,
    );
    if (parsed === null) {
      return;
    }

    const parts = heightToInputParts(parsed, units);
    setHeightPrimaryInput(parts.primary);
    setHeightSecondaryInput(parts.secondary);
    // Intentionally only when units change: reformat open form values for the new unit system.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- height inputs read at units-change time only
  }, [units]);

  const isFormOpen = formMode !== null;

  return (
    <View style={{ gap: 12 }}>
      {sortedEntries.length === 0 && !isFormOpen ? (
        <Text style={styles.settingHint}>{t('profile.heightTimelineEmptyHint')}</Text>
      ) : null}

      {sortedEntries.length > 0 ? (
        <View style={{ gap: 10 }}>
          {sortedEntries.map((entry) => (
            <View key={entry.effectiveDate} style={styles.historyRow}>
              <View style={styles.historyRowContent}>
                <Text style={styles.accountLabel}>
                  {t('profile.heightFrom', { date: formatDateLabel(entry.effectiveDate) })}
                </Text>
                <Text style={styles.accountValue}>{formatHeight(entry.heightCm, units)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Pressable
                  ref={(button) => {
                    if (button) editButtons.current.set(entry.effectiveDate, button);
                    else editButtons.current.delete(entry.effectiveDate);
                  }}
                  onPress={() => startEditing(entry)}
                  disabled={isSaving || !canEdit || isFormOpen}
                  style={({ pressed }) => [
                    styles.historyDeleteButton,
                    pressed && styles.buttonPressed,
                  ]}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.editHeightA11y', {
                    date: formatDateLabel(entry.effectiveDate),
                  })}
                >
                  <Ionicons name="create-outline" size={19} color={colors.textMuted} />
                </Pressable>
                {onDelete ? (
                  <Pressable
                    onPress={(event) => {
                      if (deletingEffectiveDate === null) {
                        void deleteRecord(event.currentTarget, entry.effectiveDate, onDelete);
                      }
                    }}
                    disabled={
                      (deletingEffectiveDate !== null &&
                        !(Platform.OS === 'web' && deletingEffectiveDate === entry.effectiveDate)) ||
                      isSaving ||
                      isFormOpen
                    }
                    aria-busy={deletingEffectiveDate === entry.effectiveDate}
                    style={({ pressed }) => [
                      styles.historyDeleteButton,
                      pressed && styles.iconButtonDanger,
                    ]}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.deleteHeightA11y', {
                      date: formatDateLabel(entry.effectiveDate),
                    })}
                  >
                    {deletingEffectiveDate === entry.effectiveDate ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Ionicons name="trash-outline" size={19} color={colors.danger} />
                    )}
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.filterFieldHeader}>
        {!isFormOpen ? (
          <Pressable
            ref={addButtonRef}
            onPress={startAdding}
            accessibilityRole="button"
            hitSlop={8}
            disabled={isSaving || isSubmitting}
            {...webFocusTarget('text-button')}
          >
            <Text style={styles.linkText}>
              {sortedEntries.length === 0 ? t('common.add') : t('profile.addHeightRecord')}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            ref={cancelButtonRef}
            onPress={() => {
              if (Platform.OS === 'web') {
                focusRequest.current = { area: 'list', date: editingEffectiveDate };
              }
              resetForm();
            }}
            accessibilityRole="button"
            hitSlop={8}
            disabled={isSaving || isSubmitting}
            {...webFocusTarget('text-button')}
          >
            <Text style={styles.linkText}>{t('common.cancel')}</Text>
          </Pressable>
        )}
      </View>

      {isFormOpen ? (
        <View style={{ gap: 12 }}>
          <DateField
            label={t('profile.effectiveFrom')}
            value={effectiveDate}
            onChange={(date) => {
              if (date) {
                setEffectiveDate(date);
              }
            }}
            maximumDate={today}
          />

          <View>
            <View style={styles.heightInputRow}>
              <View style={styles.heightInputGroup}>
                <Text style={styles.fieldLabel}>
                  {units === 'imperial' ? t('profile.feet') : t('profile.meters')}
                </Text>
                <TextInput
                  ref={heightInputRef}
                  style={styles.input}
                  accessibilityLabel={`${t('profile.height')}, ${
                    units === 'imperial' ? t('profile.feet') : t('profile.meters')
                  }`}
                  value={heightPrimaryInput}
                  {...heightErrorA11y}
                  onChangeText={setHeightPrimaryInput}
                  onFocus={
                    Platform.OS === 'web' ? (event) => revealWebFocus(event.currentTarget) : undefined
                  }
                  keyboardType="number-pad"
                  placeholder={units === 'imperial' ? '5' : '1'}
                  placeholderTextColor={colors.textSubtle}
                  maxLength={2}
                  editable={!isSaving && !isSubmitting}
                />
              </View>
              <View style={styles.heightInputGroup}>
                <Text style={styles.fieldLabel}>
                  {units === 'imperial' ? t('profile.inches') : t('profile.centimeters')}
                </Text>
                <TextInput
                  style={styles.input}
                  accessibilityLabel={`${t('profile.height')}, ${
                    units === 'imperial' ? t('profile.inches') : t('profile.centimeters')
                  }`}
                  value={heightSecondaryInput}
                  {...heightErrorA11y}
                  onChangeText={setHeightSecondaryInput}
                  keyboardType="number-pad"
                  placeholder={units === 'imperial' ? '10' : '75'}
                  placeholderTextColor={colors.textSubtle}
                  maxLength={2}
                  editable={!isSaving && !isSubmitting}
                />
              </View>
            </View>
            {Platform.OS === 'web' ? (
              <Text nativeID={heightErrorId} aria-live="polite" style={styles.fieldErrorText}>
                {heightError}
              </Text>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              (isSaving || isSubmitting) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => void handleSave()}
            accessibilityRole="button"
            accessibilityLabel={formMode === 'edit' ? t('profile.updateHeight') : t('profile.saveHeight')}
            aria-busy={isSaving || isSubmitting}
            disabled={Platform.OS !== 'web' && (isSaving || isSubmitting)}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {formMode === 'edit' ? t('profile.updateHeight') : t('profile.saveHeight')}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
