import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { AuthLayout } from '../components/auth-layout';
import { EmailField } from '../components/email-field';
import { useSupabaseAuth } from '../context/supabase-auth-context';
import { useToast } from '../context/toast-context';
import { useTranslation } from '../i18n/language-context';
import { AuthStackParamList } from '../navigation/types';
import { useAppStyles } from '../theme/styles';
import { webFocusTarget } from '../theme/web-focus-target';
import { useColors } from '../theme/theme-context';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation, route }: Props) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const { resetPassword } = useSupabaseAuth();
  const { showError, showSuccess } = useToast();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [isBusy, setIsBusy] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      showError(t('auth.enterEmail'));
      return;
    }

    setIsBusy(true);
    try {
      await resetPassword(email.trim());
      showSuccess(t('auth.resetSent'));
      navigation.navigate('Login', { email: email.trim() });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('auth.couldNotSendReset');
      showError(message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.resetPassword')}
      subtitle={t('auth.resetSubtitle')}
      footer={
        <Pressable
          onPress={() =>
            navigation.navigate('Login', { email: email.trim() || undefined })
          }
          {...webFocusTarget('text-button')}
        >
          <Text style={styles.linkText}>{t('auth.backToSignIn')}</Text>
        </Pressable>
      }
    >
      <EmailField
        value={email}
        onChangeText={setEmail}
        returnKeyType="done"
        onSubmitEditing={() => void handleResetPassword()}
      />

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          isBusy && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => void handleResetPassword()}
        disabled={isBusy}
      >
        {isBusy ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.primaryButtonText}>{t('auth.sendResetLink')}</Text>
        )}
      </Pressable>
    </AuthLayout>
  );
}
