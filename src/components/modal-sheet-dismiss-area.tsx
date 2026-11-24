import { Platform, Pressable } from 'react-native';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';

type ModalSheetDismissAreaProps = {
  onPress?: () => void;
  disabled?: boolean;
  pointerOnlyOnWeb?: boolean;
};

export function ModalSheetDismissArea({
  onPress,
  disabled = false,
  pointerOnlyOnWeb = false,
}: ModalSheetDismissAreaProps) {
  const styles = useAppStyles();
  const { t } = useTranslation();

  if (Platform.OS === 'web' && pointerOnlyOnWeb) {
    // The focus trap also focuses elements with a negative tab index.
    return (
      <div
        aria-hidden="true"
        style={styles.modalSheetDismissArea}
        onClick={disabled ? undefined : onPress}
      />
    );
  }

  return (
    <Pressable
      style={styles.modalSheetDismissArea}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t('common.cancel')}
      {...(Platform.OS === 'web' ? { dataSet: { wwModalDismiss: 'true' } } : {})}
    />
  );
}
