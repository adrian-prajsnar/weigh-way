import { Ionicons } from '@expo/vector-icons';
import { memo, useMemo, useRef, type ComponentRef, type RefObject } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { useSharedUserProfile } from '../context/user-profile-context';
import { formatDateLabel, formatMonthLabel } from '../format';
import { useRecordDeletionFocus } from '../hooks/use-record-deletion-focus';
import { useTranslation } from '../i18n/language-context';
import { groupEntriesByMonth } from '../stats';
import { WeightEntry } from '../types';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';
import { EmptyState } from './empty-state';
import { HistoryEntryMeta } from './history-entry-meta';
import { WeightWithBmi } from './weight-with-bmi';

type HistoryListProps = {
  entries: WeightEntry[];
  onEdit?: (date: string) => void;
  onDelete?: (date: string) => Promise<void>;
  deleteFocusFallback: RefObject<ComponentRef<typeof Pressable> | null>;
  deletingDate?: string | null;
  emptyMessage?: string;
  grouped?: boolean;
};

export const HistoryList = memo(function HistoryList({
  entries,
  onEdit,
  onDelete,
  deleteFocusFallback,
  deletingDate = null,
  emptyMessage,
  grouped = false,
}: HistoryListProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const { heightEntries } = useSharedUserProfile();

  const resolvedEmptyMessage = emptyMessage ?? t('history.emptyDefault');

  const groups = useMemo(
    () => (grouped ? groupEntriesByMonth(entries) : [{ monthKey: 'all', entries }]),
    [entries, grouped],
  );
  const dates = useMemo(() => groups.flatMap((group) => group.entries.map(({ date }) => date)), [groups]);
  const editButtons = useRef(new Map<string, ComponentRef<typeof Pressable>>());
  const { deleteRecord, canEdit } = useRecordDeletionFocus(
    dates,
    deletingDate,
    editButtons,
    deleteFocusFallback,
  );

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="documents-outline"
        title={t('history.noEntries')}
        message={resolvedEmptyMessage}
      />
    );
  }

  const renderRow = (item: WeightEntry) => (
    <View key={item.date} style={styles.historyRow}>
      <View style={styles.historyRowContent}>
        <View style={styles.historyRowWhen}>
          <Text style={styles.historyDate}>{formatDateLabel(item.date)}</Text>
          <HistoryEntryMeta entry={item} />
        </View>
        <WeightWithBmi
          entry={item}
          heightEntries={heightEntries}
          layout="stacked"
          compactBmi
        />
      </View>
      {onEdit || onDelete ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {onEdit ? (
            <Pressable
              ref={(button) => {
                if (button) editButtons.current.set(item.date, button);
                else editButtons.current.delete(item.date);
              }}
              onPress={() => onEdit(item.date)}
              disabled={!canEdit}
              style={({ pressed }) => [
                styles.historyDeleteButton,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('history.editA11y', { date: formatDateLabel(item.date) })}
            >
              <Ionicons name="create-outline" size={19} color={colors.textMuted} />
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable
              onPress={(event) => {
                if (deletingDate === null) void deleteRecord(event.currentTarget, item.date, onDelete);
              }}
              disabled={deletingDate !== null && !(Platform.OS === 'web' && deletingDate === item.date)}
              aria-busy={deletingDate === item.date}
              style={({ pressed }) => [
                styles.historyDeleteButton,
                pressed && styles.iconButtonDanger,
              ]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('history.deleteA11y', { date: formatDateLabel(item.date) })}
            >
              {deletingDate === item.date ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Ionicons name="trash-outline" size={19} color={colors.danger} />
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <View>
      {groups.map((group) => (
        <View key={group.monthKey} style={styles.historyGroup}>
          {grouped ? (
            <Text style={styles.historyGroupLabel}>
              {formatMonthLabel(group.entries[0].date)}
            </Text>
          ) : null}
          {group.entries.map(renderRow)}
        </View>
      ))}
    </View>
  );
});
