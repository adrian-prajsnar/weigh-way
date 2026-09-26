import { Text, View } from 'react-native';
import { AuthShell } from '../components/auth-shell';
import { useSupabaseAuth } from '../context/supabase-auth-context';
import { useTranslation } from '../i18n/language-context';
import { NewPasswordScreen } from '../screens/new-password-screen';
import { AuthNavigator } from './auth-navigator';
import { MainTabNavigator } from './main-tab-navigator';
import { useAppStyles } from '../theme/styles';

export function RootNavigator() {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const { isAuthenticated, isPasswordRecovery, isLoading, isCompletingOAuth, isConfigured } =
    useSupabaseAuth();

  if (isLoading || isCompletingOAuth) {
    return null;
  }

  if (!isConfigured) {
    return (
      <View style={[styles.screen, styles.centered, styles.authContent]}>
        <View style={styles.authFrame}>
          <Text style={styles.title}>{t('navigation.setupRequired')}</Text>
          <Text style={styles.subtitle}>{t('navigation.setupSubtitle')}</Text>
        </View>
      </View>
    );
  }

  return isPasswordRecovery ? (
    <AuthShell>
      <NewPasswordScreen />
    </AuthShell>
  ) : isAuthenticated ? (
    <MainTabNavigator />
  ) : (
    <AuthNavigator />
  );
}
