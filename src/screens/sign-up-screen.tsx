import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { AuthLayout } from '../components/auth-layout';
import { AuthOrDivider } from '../components/auth-or-divider';
import { EmailField } from '../components/email-field';
import { GoogleSignInButton } from '../components/google-sign-in-button';
import { useSupabaseAuth } from '../context/supabase-auth-context';
import { PasswordField } from '../components/password-field';
import { useToast } from '../context/toast-context';
import { useTranslation } from '../i18n/language-context';
import { AuthStackParamList } from '../navigation/types';
import { isValidPassword } from '../password';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const { signUp } = useSupabaseAuth();
  const { showError, showSuccess } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isGoogleBusy, setIsGoogleBusy] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      showError(t('auth.enterEmailPassword'));
      return;
    }

    if (!isValidPassword(password)) {
      showError(t('auth.passwordRequirements'));
      return;
    }

    if (password !== confirmPassword) {
      showError(t('auth.passwordsMismatch'));
      return;
    }

    setIsBusy(true);
    const trimmedEmail = email.trim();
    try {
      const { needsEmailConfirmation } = await signUp(trimmedEmail, password);
      if (needsEmailConfirmation) {
        showSuccess(t('auth.accountCreatedConfirm'));
      } else {
        showSuccess(t('auth.accountCreated'));
      }
      navigation.navigate('Login', { email: trimmedEmail });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('auth.signUpFailed');
      showError(message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.createAccount')}
      subtitle={t('auth.signUpSubtitle')}
      footer={
        <Pressable onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>{t('auth.hasAccount')}</Text>
        </Pressable>
      }
    >
      <EmailField value={email} onChangeText={setEmail} />

      <PasswordField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        placeholder={t('auth.passwordMinPlaceholder')}
      />

      <PasswordField
        label={t('auth.confirmPassword')}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={() => void handleSignUp()}
        placeholder={t('auth.repeatPassword')}
      />

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          (isBusy || isGoogleBusy) && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => void handleSignUp()}
        disabled={isBusy || isGoogleBusy}
      >
        {isBusy ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.primaryButtonText}>{t('auth.createAccount')}</Text>
        )}
      </Pressable>

      <AuthOrDivider />

      <GoogleSignInButton disabled={isBusy} onBusyChange={setIsGoogleBusy} />
    </AuthLayout>
  );
}
