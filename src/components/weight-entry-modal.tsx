import { Ionicons } from '@expo/vector-icons';
import { useId, useMemo } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { SlideInUp } from 'react-native-reanimated';
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
  const titleId = useId();
  const initialDate = useMemo(() => (date ? fromDateKey(date) : undefined), [date]);

  if (!visible || !date) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      aria-labelledby={titleId}
      onRequestClose={onClose}
    >
      <Animated.View
        entering={SlideInUp.duration(300)}
        style={[styles.modalSheetBackdrop, styles.weightEntryModalBackdrop]}
      >
        <View
          style={[
            styles.datePickerSheet,
            styles.weightEntryModalSheet,
            { paddingTop: insets.top + spacing.lg },
          ]}
        >
          <View style={styles.datePickerSheetHeader}>
            <Text nativeID={titleId} style={styles.datePickerSheetTitle}>
              {t('entryForm.editTitle')}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
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
              initialDate={initialDate}
              onSaveSuccess={onClose}
              autoFocusWeight
              dateReadOnly
            />
          </ScrollView>
        </View>
        <ModalSheetDismissArea onPress={onClose} pointerOnlyOnWeb />
      </Animated.View>
    </Modal>
  );
}
