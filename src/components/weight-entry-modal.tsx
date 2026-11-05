import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { SlideInUp } from 'react-native-reanimated';
import { fromDateKey } from '../format';
import { useTranslation } from '../i18n/language-context';
import { WeightEntry } from '../types';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';
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
  const { t } = useTranslation();

  if (!visible || !date) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={SlideInUp.duration(300)}
        style={[styles.modalSheetBackdrop, styles.weightEntryModalBackdrop]}
      >
        <View style={[styles.datePickerSheet, styles.weightEntryModalSheet]}>
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
      </Animated.View>
    </Modal>
  );
}
