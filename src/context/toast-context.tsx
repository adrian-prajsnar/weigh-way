import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import { AccessibilityInfo, Platform, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../i18n/language-context';
import { TranslationKey } from '../i18n/translation-keys';
import { toastEntering, toastExiting } from '../hooks/toast-animation';
import { useToastSwipeDismiss } from '../hooks/use-toast-swipe-dismiss';
import { AppStyles, useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';
import { Palette, spacing } from '../theme/tokens';

export type ToastType = 'success' | 'error' | 'info';

type ToastOptions = {
  type: ToastType;
  message: string;
};

type ToastState = ToastOptions & {
  id: number;
};

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 3200;

const TOAST_TITLE_KEYS: Record<ToastType, TranslationKey> = {
  success: 'toasts.success',
  error: 'toasts.error',
  info: 'toasts.info',
};

const TOAST_ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

function toastVariant(styles: AppStyles, type: ToastType) {
  switch (type) {
    case 'success':
      return {
        card: styles.toastCardSuccess,
        title: styles.toastTitleSuccess,
        message: styles.toastMessageSuccess,
      };
    case 'error':
      return {
        card: styles.toastCardError,
        title: styles.toastTitleError,
        message: styles.toastMessageError,
      };
    default:
      return {
        card: styles.toastCardInfo,
        title: styles.toastTitleInfo,
        message: styles.toastMessageInfo,
      };
  }
}

function toastIconColor(colors: Palette, type: ToastType): string {
  switch (type) {
    case 'success':
      return colors.success;
    case 'error':
      return colors.danger;
    default:
      return colors.accent;
  }
}

function ToastBanner({
  toast,
  onDismiss,
  focusAppContent,
}: {
  toast: ToastState;
  onDismiss: () => void;
  focusAppContent?: () => void;
}) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const toastTop = insets.top + spacing.sm;
  const variant = toastVariant(styles, toast.type);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissHasFocus = useRef(false);
  const focusBeforeDismiss = useRef<HTMLElement | null>(null);
  const isSwiping = useRef(false);
  const isWeb = Platform.OS === 'web';

  const toastTitle = t(TOAST_TITLE_KEYS[toast.type]);

  useEffect(() => {
    // Web announces through the persistent live regions in ToastAnnouncer.
    if (Platform.OS !== 'web') {
      AccessibilityInfo.announceForAccessibility(`${toastTitle}. ${toast.message}`);
    }
  }, [toastTitle, toast.message]);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const scheduleDismissTimer = useCallback(() => {
    clearDismissTimer();
    if (!dismissHasFocus.current && !isSwiping.current) {
      dismissTimerRef.current = setTimeout(onDismiss, TOAST_DURATION_MS);
    }
  }, [clearDismissTimer, onDismiss]);

  const handleDismiss = useCallback(() => {
    if (dismissHasFocus.current) {
      if (focusBeforeDismiss.current?.isConnected) {
        focusBeforeDismiss.current.focus();
      }
      if (dismissHasFocus.current) focusAppContent?.();
    }
    clearDismissTimer();
    onDismiss();
  }, [clearDismissTimer, focusAppContent, onDismiss]);

  const { panHandlers, animatedCardStyle } = useToastSwipeDismiss({
    onDismiss: handleDismiss,
    pauseAutoDismiss: () => {
      isSwiping.current = true;
      clearDismissTimer();
    },
    resumeAutoDismiss: () => {
      isSwiping.current = false;
      scheduleDismissTimer();
    },
  });

  useEffect(() => {
    scheduleDismissTimer();
    return clearDismissTimer;
  }, [clearDismissTimer, scheduleDismissTimer, toast.id]);

  return (
    <Animated.View
      pointerEvents="box-none"
      entering={isWeb ? undefined : toastEntering}
      exiting={isWeb ? undefined : toastExiting}
      style={[styles.toastContainer, !isWeb && { top: toastTop }]}
    >
      <Animated.View
        style={[styles.toastCard, variant.card, animatedCardStyle]}
        {...panHandlers}
      >
        <Ionicons
          name={TOAST_ICONS[toast.type]}
          size={20}
          color={toastIconColor(colors, toast.type)}
        />
        <View style={styles.toastTextGroup}>
          <Text style={[styles.toastTitle, variant.title]}>{toastTitle}</Text>
          <Text style={[styles.toastMessage, variant.message]}>{toast.message}</Text>
        </View>
        <Pressable
          style={styles.toastCloseButton}
          onPress={handleDismiss}
          onFocus={
            isWeb
              ? (event) => {
                  const previous = 'relatedTarget' in event ? event.relatedTarget : null;
                  focusBeforeDismiss.current = previous instanceof HTMLElement ? previous : null;
                  dismissHasFocus.current = true;
                  clearDismissTimer();
                }
              : undefined
          }
          onBlur={
            isWeb
              ? () => {
                  dismissHasFocus.current = false;
                  scheduleDismissTimer();
                }
              : undefined
          }
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('toasts.dismiss')}
        >
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Web live regions must exist before their content changes to be announced, so
 * they stay mounted and each toast inserts a new keyed node. Errors use an
 * alert region; other toasts use a polite status region.
 */
function ToastAnnouncer({ toast }: { toast: ToastState | null }) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const text = toast ? `${t(TOAST_TITLE_KEYS[toast.type])}: ${toast.message}` : null;
  const isError = toast?.type === 'error';

  return (
    <>
      <View style={styles.visuallyHidden} role="status" aria-live="polite">
        {toast && !isError ? <Text key={toast.id}>{text}</Text> : null}
      </View>
      <View style={styles.visuallyHidden} role="alert" aria-live="assertive">
        {toast && isError ? <Text key={toast.id}>{text}</Text> : null}
      </View>
    </>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const styles = useAppStyles();
  const [toast, setToast] = useState<ToastState | null>(null);
  const idRef = useRef(0);
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const appContentRef = useRef<ComponentRef<typeof View>>(null);

  const showToast = useCallback((options: ToastOptions) => {
    idRef.current += 1;
    setToast({ ...options, id: idRef.current });
  }, []);

  const showSuccess = useCallback(
    (message: string) => showToast({ type: 'success', message }),
    [showToast],
  );

  const showError = useCallback(
    (message: string) => showToast({ type: 'error', message }),
    [showToast],
  );

  const showInfo = useCallback(
    (message: string) => showToast({ type: 'info', message }),
    [showToast],
  );

  const dismiss = useCallback(() => setToast(null), []);
  const focusAppContent = useCallback(() => appContentRef.current?.focus(), []);
  const isWeb = Platform.OS === 'web';

  useLayoutEffect(() => {
    if (!isWeb || !toast) return;
    const active = document.activeElement;
    const root = rootRef.current;
    const content = appContentRef.current;
    if (
      !(active instanceof HTMLElement) ||
      !(root instanceof HTMLElement) ||
      !(content instanceof HTMLElement) ||
      !content.contains(active)
    ) return;

    // A new banner can move a control that already has focus below the viewport.
    const controlBounds = active.getBoundingClientRect();
    const viewportBounds = root.getBoundingClientRect();
    if (controlBounds.top < viewportBounds.top || controlBounds.bottom > viewportBounds.bottom) {
      active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
  }, [isWeb, toast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo }}>
      <View ref={rootRef} style={styles.toastRoot} tabIndex={isWeb ? -1 : undefined}>
        {isWeb && toast ? (
          <ToastBanner toast={toast} onDismiss={dismiss} focusAppContent={focusAppContent} />
        ) : null}
        {isWeb ? (
          <View ref={appContentRef} style={styles.toastContent} tabIndex={-1}>
            {children}
          </View>
        ) : (
          children
        )}
        {!isWeb && toast ? <ToastBanner key={toast.id} toast={toast} onDismiss={dismiss} /> : null}
        {isWeb ? <ToastAnnouncer toast={toast} /> : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
