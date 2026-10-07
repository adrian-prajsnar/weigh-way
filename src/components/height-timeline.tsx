import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUnits } from '../context/unit-context';
import { getRecentHeightEntries, getSortedHeightEntries } from '../height';
import {
  formatDateLabel,
  formatHeight,
  fromDateKey,
  getHeightRangeMessage,
  getTodayDate,
  heightToInputParts,
  parseHeightInput,
  toDateKey,
} from '../format';
import { useTranslation } from '../i18n/language-context';
import { HeightEntry } from '../types';
import { useAppStyles } from '../theme/styles';
import { webFocusTarget } from '../theme/web-focus-target';
import { useColors } from '../theme/theme-context';
import { DateField } from './date-field';

const PREVIEW_LIMIT = 1;

type HeightHistoryPreviewProps = {
  heightEntries: HeightEntry[];
  onShowAll: () => void;
};

export function HeightHistoryPreview({ heightEntries, onShowAll }: HeightHistoryPreviewProps) {
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

      <Pressable onPress={onShowAll} hitSlop={8} {...webFocusTarget('text-button')}>
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
  onUpdate: (previousEffectiveDate: string, effectiveDate: string, heightCm: number) => Promise<void>;
  onDelete?: (effectiveDate: string) => void;
  onInvalidHeight: () => void;
};

export function HeightTimelineEditor({
  heightEntries,
  isSaving,
  deletingEffectiveDate,
  onSave,
  onUpdate,
  onDelete,
  onInvalidHeight,
}: HeightTimelineEditorProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const { units } = useUnits();
  const today = getTodayDate();

  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingEffectiveDate, setEditingEffectiveDate] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [heightPrimaryInput, setHeightPrimaryInput] = useState('');
  const [heightSecondaryInput, setHeightSecondaryInput] = useState('');

  const canDelete = onDelete !== undefined;

  const sortedEntries = useMemo(() => getSortedHeightEntries(heightEntries), [heightEntries]);

  const resetForm = () => {
    setFormMode(null);
    setEditingEffectiveDate(null);
    setHeightPrimaryInput('');
    setHeightSecondaryInput('');
  };

  const startAdding = () => {
    setFormMode('add');
    setEditingEffectiveDate(null);
    setEffectiveDate(today);
    setHeightPrimaryInput('');
    setHeightSecondaryInput('');
  };

  const startEditing = (entry: HeightEntry) => {
    setFormMode('edit');
    setEditingEffectiveDate(entry.effectiveDate);
    setEffectiveDate(fromDateKey(entry.effectiveDate));
    const parts = heightToInputParts(entry.heightCm, units);
    setHeightPrimaryInput(parts.primary);
    setHeightSecondaryInput(parts.secondary);
  };

  const handleSave = async () => {
    const heightCm = parseHeightInput(units, heightPrimaryInput, heightSecondaryInput);
    if (heightCm === null) {
      onInvalidHeight();
      return;
    }

    const effectiveDateKey = toDateKey(effectiveDate);

    if (formMode === 'edit' && editingEffectiveDate) {
      await onUpdate(editingEffectiveDate, effectiveDateKey, heightCm);
    } else {
      await onSave(effectiveDateKey, heightCm);
    }

    resetForm();
  };

  useEffect(() => {
    if (formMode === null) {
      return;
    }

    const parsed = parseHeightInput(units, heightPrimaryInput, heightSecondaryInput);
    if (parsed === null) {
      return;
    }

    const parts = heightToInputParts(parsed, units);
    setHeightPrimaryInput(parts.primary);
    setHeightSecondaryInput(parts.secondary);
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
                  onPress={() => startEditing(entry)}
                  disabled={isSaving || deletingEffectiveDate !== null || isFormOpen}
                  style={({ pressed }) => [styles.historyDeleteButton, pressed && styles.buttonPressed]}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.editHeightA11y', {
                    date: formatDateLabel(entry.effectiveDate),
                  })}
                >
                  <Ionicons name="create-outline" size={19} color={colors.textMuted} />
                </Pressable>
                {canDelete ? (
                  <Pressable
                    onPress={() => onDelete?.(entry.effectiveDate)}
                    disabled={deletingEffectiveDate !== null || isSaving || isFormOpen}
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
            onPress={startAdding}
            hitSlop={8}
            disabled={isSaving}
            {...webFocusTarget('text-button')}
          >
            <Text style={styles.linkText}>
              {sortedEntries.length === 0 ? t('common.add') : t('profile.addHeightRecord')}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={resetForm}
            hitSlop={8}
            disabled={isSaving}
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

          <View style={styles.heightInputRow}>
            <View style={styles.heightInputGroup}>
              <Text style={styles.fieldLabel}>
                {units === 'imperial' ? t('profile.feet') : t('profile.meters')}
              </Text>
              <TextInput
                style={styles.input}
                value={heightPrimaryInput}
                onChangeText={setHeightPrimaryInput}
                keyboardType="number-pad"
                placeholder={units === 'imperial' ? '5' : '1'}
                placeholderTextColor={colors.textSubtle}
                maxLength={2}
                editable={!isSaving}
              />
            </View>
            <View style={styles.heightInputGroup}>
              <Text style={styles.fieldLabel}>
                {units === 'imperial' ? t('profile.inches') : t('profile.centimeters')}
              </Text>
              <TextInput
                style={styles.input}
                value={heightSecondaryInput}
                onChangeText={setHeightSecondaryInput}
                keyboardType="number-pad"
                placeholder={units === 'imperial' ? '10' : '75'}
                placeholderTextColor={colors.textSubtle}
                maxLength={2}
                editable={!isSaving}
              />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              isSaving && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => void handleSave()}
            disabled={isSaving}
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
