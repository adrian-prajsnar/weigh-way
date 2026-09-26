import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSupabaseAuth } from '../context/supabase-auth-context';
import { useToast } from '../context/toast-context';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';

type Props = {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

export function GoogleSignInButton({ disabled = false, onBusyChange }: Props) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const { signInWithGoogle } = useSupabaseAuth();
  const { showError, showSuccess } = useToast();
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  const handlePress = async () => {
    setIsBusy(true);
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) {
        showSuccess(t('auth.signedIn'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('auth.googleSignInFailed');
      showError(message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.oauthButton,
        (disabled || isBusy) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
      onPress={() => void handlePress()}
      disabled={disabled || isBusy}
    >
      {isBusy ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <View style={styles.oauthButtonContent}>
          <Ionicons name="logo-google" size={18} color={colors.text} />
          <Text style={styles.oauthButtonText}>{t('auth.continueWithGoogle')}</Text>
        </View>
      )}
    </Pressable>
  );
}
