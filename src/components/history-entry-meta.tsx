import { Ionicons } from '@expo/vector-icons';
import { Platform, Text, View } from 'react-native';
import { formatDateTime, formatHistoryTimestamp, wasWeightEntryUpdated } from '../format';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';
import { WeightEntry } from '../types';

type HistoryEntryMetaProps = {
  entry: WeightEntry;
};

export function HistoryEntryMeta({ entry }: HistoryEntryMetaProps) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const createdLabel = formatHistoryTimestamp(entry.createdAt, entry.date);
  const createdA11y = formatDateTime(entry.createdAt);
  const showUpdated = wasWeightEntryUpdated(entry);
  const updatedLabel = formatHistoryTimestamp(entry.updatedAt, entry.date);
  const updatedA11y = formatDateTime(entry.updatedAt);

  return (
    <View style={styles.historyEntryMeta}>
      <HistoryEntryMetaItem
        icon="time-outline"
        text={createdLabel}
        label={t('history.createdA11y', { date: createdA11y })}
      />
      {showUpdated ? (
        <HistoryEntryMetaItem
          icon="sync-outline"
          text={updatedLabel}
          label={t('history.updatedA11y', { date: updatedA11y })}
        />
      ) : null}
    </View>
  );
}

type HistoryEntryMetaItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  label: string;
};

function HistoryEntryMetaItem({ icon, text, label }: HistoryEntryMetaItemProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const content = (
    <>
      <Ionicons name={icon} size={12} color={colors.textSubtle} />
      <Text style={styles.historyEntryMetaText}>{text}</Text>
    </>
  );

  // react-native-web renders role "text" as a plain div, where screen readers
  // ignore aria-label; read the full sentence from hidden text instead.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.historyEntryMetaItem}>
        <View style={styles.historyEntryMetaItem} aria-hidden>
          {content}
        </View>
        <Text style={styles.visuallyHidden}>{label}</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.historyEntryMetaItem}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      {content}
    </View>
  );
}
