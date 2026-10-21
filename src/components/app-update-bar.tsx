import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openAppUpdateDownload } from '../app-update/open-app-update-download';
import { useSharedAppUpdate } from '../context/app-update-context';
import { useToast } from '../context/toast-context';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';
import { spacing } from '../theme/tokens';

export function AppUpdateBar() {
  const styles = useAppStyles();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { showInfo } = useToast();
  const { update } = useSharedAppUpdate();

  if (!update) {
    return null;
  }

  const handleDownload = () => {
    void openAppUpdateDownload().then((result) => {
      if (result === 'mocked') {
        showInfo(t('update.mockDownload'));
      }
    });
  };

  return (
    <View style={[styles.appUpdateBar, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.appUpdateBarLabel}>{t('update.availableLabel')}</Text>
      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
        onPress={handleDownload}
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>{t('update.downloadAndInstall')}</Text>
      </Pressable>
    </View>
  );
}
