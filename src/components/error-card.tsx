import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useCallback, useLayoutEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';

type ErrorCardProps = {
  message: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  recoveryFocusRef: RefObject<ComponentRef<typeof View> | null>;
  onRetry: () => Promise<void>;
};

export function ErrorCard({
  message,
  isLoading,
  isRefreshing,
  recoveryFocusRef,
  onRetry,
}: ErrorCardProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const isWeb = Platform.OS === 'web';
  const isBusy = isLoading || isRefreshing;
  const retryButton = useRef<ComponentRef<typeof Pressable> | null>(null);
  const restoreFocus = useRef(false);
  const retrying = useRef(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const setRetryButton = useCallback((button: ComponentRef<typeof Pressable> | null) => {
    // The ref is detached before the focused button is removed from the DOM.
    if (!button && retryButton.current === document.activeElement) {
      restoreFocus.current = true;
    }
    retryButton.current = button;
  }, []);

  useLayoutEffect(() => {
    if (!isWeb || message) return;
    if (retryAttempt > 0) setRetryAttempt(0);
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    if (isFocused && document.activeElement === document.body) {
      recoveryFocusRef.current?.focus();
    }
  }, [isFocused, isWeb, message, recoveryFocusRef, retryAttempt]);

  const handleRetry = async () => {
    if (!isWeb) {
      await onRetry();
      return;
    }
    if (isBusy || retrying.current) return;
    retrying.current = true;
    try {
      await onRetry();
      setRetryAttempt((attempt) => attempt + 1);
    } finally {
      retrying.current = false;
    }
  };

  if (!message || (!isWeb && isLoading)) return null;

  return (
    <View style={styles.errorCard}>
      <View style={styles.errorCardHeader}>
        <Ionicons name="alert-circle" size={18} color={colors.danger} />
        <Text style={styles.errorCardTitle}>{t('errors.couldNotLoadData')}</Text>
      </View>
      <Text style={styles.errorCardMessage}>{message}</Text>
      <Pressable
        ref={isWeb ? setRetryButton : undefined}
        accessibilityRole="button"
        aria-busy={isWeb && isBusy ? true : undefined}
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
        onPress={() => void handleRetry()}
      >
        <Text style={styles.secondaryButtonText}>{t('common.retry')}</Text>
      </Pressable>
      {isWeb ? (
        <View style={styles.visuallyHidden} role="status" aria-live="polite">
          {/* Insert a fresh live-region child even when successive failures have the same text. */}
          {isFocused && retryAttempt > 0 ? (
            <Text key={retryAttempt}>{t('errors.retryFailed')}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
