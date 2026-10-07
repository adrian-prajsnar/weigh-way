import { Platform, Pressable } from 'react-native';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';

type ModalSheetDismissAreaProps = {
  onPress?: () => void;
  disabled?: boolean;
};

export function ModalSheetDismissArea({ onPress, disabled = false }: ModalSheetDismissAreaProps) {
  const styles = useAppStyles();
  const { t } = useTranslation();

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
