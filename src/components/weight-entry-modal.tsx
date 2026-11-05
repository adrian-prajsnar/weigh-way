import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fromDateKey } from '../format';
import { useTranslation } from '../i18n/language-context';
import { WeightEntry } from '../types';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';
import { spacing } from '../theme/tokens';
import { ModalSheetDismissArea } from './modal-sheet-dismiss-area';
import { WeightEntryFormBody } from './weight-entry-form-body';

type WeightEntryModalProps = {
  visible: boolean;
  date: string | null;
  entries: WeightEntry[];
  onClose: () => void;
  isDataLoading?: boolean;
};

export function WeightEntryModal({
  visible,
  date,
  entries,
  onClose,
  isDataLoading = false,
}: WeightEntryModalProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  if (!date) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalSheetBackdrop, styles.weightEntryModalBackdrop]}>
        <View
          style={[
            styles.datePickerSheet,
            styles.weightEntryModalSheet,
            { marginTop: insets.top + spacing.lg },
          ]}
        >
          <View style={styles.datePickerSheetHeader}>
            <Text style={styles.datePickerSheetTitle}>{t('entryForm.editTitle')}</Text>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            <WeightEntryFormBody
              key={date}
              entries={entries}
              isDataLoading={isDataLoading}
              initialDate={fromDateKey(date)}
              onSaveSuccess={onClose}
              autoFocusWeight
              dateReadOnly
            />
          </ScrollView>
        </View>
        <ModalSheetDismissArea onPress={onClose} />
      </View>
    </Modal>
  );
}
