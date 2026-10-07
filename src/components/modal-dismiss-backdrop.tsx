import { useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { useAppStyles } from '../theme/styles';

type ModalDismissBackdropProps = {
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
};

export function ModalDismissBackdrop({
  onPress,
  disabled = false,
  accessibilityLabel,
}: ModalDismissBackdropProps) {
  const styles = useAppStyles();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      style={[styles.modalSheetDismissArea, focused && styles.modalSheetDismissAreaFocused]}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...(Platform.OS === 'web' ? { dataSet: { wwModalDismiss: 'true' } } : {})}
    />
  );
}
