import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fromDateKey } from '../format';
import { useKeyboardHeight } from '../hooks/use-keyboard-height';
import { useSheetContainerStyle } from '../hooks/use-sheet-container-style';
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
  onSaved: () => Promise<void>;
  isDataLoading?: boolean;
};

export function WeightEntryModal({
  visible,
  date,
  entries,
  onClose,
  onSaved,
  isDataLoading = false,
}: WeightEntryModalProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight(visible && date !== null);
  const sheetContainerStyle = useSheetContainerStyle();
  const { t } = useTranslation();

  if (!date) {
    return null;
  }

  const sheetBottomInset = keyboardHeight > 0 ? spacing.xl : Math.max(insets.bottom, spacing.lg);
  const sheetLift = keyboardHeight > 0 ? keyboardHeight + spacing.lg : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalSheetBackdrop}>
        <ModalSheetDismissArea onPress={onClose} />
        <View
          style={[
            sheetContainerStyle,
            {
              marginBottom: sheetLift,
              paddingBottom: sheetBottomInset,
              maxHeight: keyboardHeight > 0 ? '100%' : '90%',
            },
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
            contentContainerStyle={keyboardHeight > 0 ? { paddingBottom: spacing.sm } : undefined}
          >
            <WeightEntryFormBody
              key={date}
              entries={entries}
              onSaved={onSaved}
              isDataLoading={isDataLoading}
              initialDate={fromDateKey(date)}
              onSaveSuccess={onClose}
              autoFocusWeight
              dateReadOnly
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
