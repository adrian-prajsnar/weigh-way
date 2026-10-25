import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';
import { spacing } from '../theme/tokens';

type OfflineConnectivityBannerProps = {
  isRefreshing: boolean;
  onRefresh: () => void;
};

export function OfflineConnectivityBanner({
  isRefreshing,
  onRefresh,
}: OfflineConnectivityBannerProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.offlineBanner,
        {
          paddingTop: insets.top + spacing.sm,
        },
      ]}
      accessibilityRole="alert"
    >
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warningText} />
      <Text style={styles.offlineBannerText}>{t('navigation.offlineBanner')}</Text>
      <Pressable
        onPress={onRefresh}
        disabled={isRefreshing}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('navigation.offlineRefresh')}
      >
        {isRefreshing ? (
          <ActivityIndicator size="small" color={colors.warningText} />
        ) : (
          <Ionicons name="refresh" size={18} color={colors.warningText} />
        )}
      </Pressable>
    </View>
  );
}
