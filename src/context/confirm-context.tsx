import {
  createContext,
  type ComponentRef,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getConfirmDialogPressableA11y } from './confirm-dialog-a11y';
import {
  focusFirstConfirmDialogControl,
  handleConfirmDialogTabKey,
  subscribeConfirmDialogKeydown,
} from './confirm-dialog-focus-web';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmationPhrase?: string;
  confirmationPhraseHint?: string;
};

type ConfirmContextValue = {
  isConfirming: boolean;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

type PendingConfirm = ConfirmOptions & { id: number };

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

function ConfirmDialogBody({ children }: { children: ReactNode }) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const overflows = contentHeight > viewportHeight + 1;
  // Keep the region role stable: React Native Web changes the DOM tag when it changes.
  return (
    <ScrollView
      style={styles.confirmDialogScroll}
      contentContainerStyle={styles.confirmDialogScrollContent}
      onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
      onContentSizeChange={(_width, height) => setContentHeight(height)}
      tabIndex={overflows ? 0 : -1}
      role="region"
      aria-label={t('common.confirmationDetails')}
    >
      {children}
    </ScrollView>
  );
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const titleId = useId();
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [webModalShown, setWebModalShown] = useState(false);
  const [phraseInput, setPhraseInput] = useState('');
  const [secondaryActionsEnabled, setSecondaryActionsEnabled] = useState(false);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const closingResultRef = useRef<boolean | null>(null);
  const idRef = useRef(0);
  const [dialogFrame, setDialogFrame] = useState<ComponentRef<typeof View> | null>(null);

  const finishClose = useCallback((result: boolean) => {
    closingResultRef.current = null;
    setPending(null);
    setModalVisible(false);
    setWebModalShown(false);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  useEffect(() => {
    setPhraseInput('');
    if (!pending) {
      setSecondaryActionsEnabled(false);
      return;
    }

    setSecondaryActionsEnabled(false);
    const timer = setTimeout(() => setSecondaryActionsEnabled(true), 320);
    return () => clearTimeout(timer);
  }, [pending?.id, pending]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !pending) {
      return;
    }

    const frame = dialogFrame as unknown as HTMLElement | null;
    if (!frame) {
      return;
    }

    const focusTimer = webModalShown
      ? requestAnimationFrame(() => focusFirstConfirmDialogControl(frame))
      : null;

    const onKeyDown = (event: KeyboardEvent) => {
      handleConfirmDialogTabKey(frame, event, document.activeElement);
    };

    const unsubscribeKeydown = subscribeConfirmDialogKeydown(onKeyDown);
    return () => {
      if (focusTimer !== null) cancelAnimationFrame(focusTimer);
      unsubscribeKeydown();
    };
  }, [dialogFrame, pending, webModalShown]);

  const close = useCallback(
    (result: boolean) => {
      if (Platform.OS === 'ios') {
        // Keep the modal mounted until onDismiss; otherwise a follow-up native
        // presentation (e.g. SFSafariViewController) stacks on a half-dismissed VC.
        if (closingResultRef.current !== null) {
          return;
        }
        closingResultRef.current = result;
        setModalVisible(false);
        return;
      }
      finishClose(result);
    },
    [finishClose],
  );

  const handleModalDismiss = useCallback(() => {
    if (Platform.OS !== 'ios' || closingResultRef.current === null) {
      return;
    }
    finishClose(closingResultRef.current);
  }, [finishClose]);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(closingResultRef.current ?? false);
      closingResultRef.current = null;
      idRef.current += 1;
      resolverRef.current = resolve;
      setPending({ ...options, id: idRef.current });
      setModalVisible(true);
    });
  }, []);

  useEffect(
    () => () => {
      if (closingResultRef.current !== null && Platform.OS === 'ios') {
        finishClose(closingResultRef.current);
      } else {
        resolverRef.current?.(false);
        resolverRef.current = null;
      }
    },
    [finishClose],
  );

  const cancelLabel = pending?.cancelLabel ?? t('common.cancel');
  const confirmLabel = pending?.confirmLabel ?? t('common.confirm');
  const phraseRequired = Boolean(pending?.confirmationPhrase);
  const phraseMatches = !phraseRequired || phraseInput === pending?.confirmationPhrase;
  const dialogBody = pending && (
    <>
      <Text style={styles.confirmDialogMessage}>{pending.message}</Text>
      {pending.confirmationPhrase ? (
        <View style={styles.passwordFieldGroup}>
          {pending.confirmationPhraseHint ? (
            <Text style={styles.fieldLabel}>{pending.confirmationPhraseHint}</Text>
          ) : null}
          <TextInput
            accessibilityLabel={pending.confirmationPhraseHint ?? t('common.confirmationPhrase')}
            style={styles.input}
            value={phraseInput}
            onChangeText={setPhraseInput}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={pending.confirmationPhrase}
            placeholderTextColor={colors.textSubtle}
          />
        </View>
      ) : null}
    </>
  );

  return (
    <ConfirmContext.Provider value={{ confirm, isConfirming: pending !== null }}>
      <View style={styles.overlayRoot}>
        {children}
        {pending ? (
          <Modal
            visible={modalVisible}
            transparent
            animationType={Platform.OS === 'web' ? 'none' : 'fade'}
            aria-labelledby={titleId}
            statusBarTranslucent
            onRequestClose={() => close(false)}
            onShow={Platform.OS === 'web' ? () => setWebModalShown(true) : undefined}
            onDismiss={handleModalDismiss}
          >
            <View
              style={styles.modalBackdropCentered}
              {...(Platform.OS === 'web' ? { focusable: false } : {})}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => {
                  if (secondaryActionsEnabled) {
                    close(false);
                  }
                }}
                focusable={false}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
                {...(Platform.OS === 'web'
                  ? { dataSet: { wwModalDismiss: 'true', wwConfirmDismiss: 'true' } }
                  : {})}
              />
              <View
                ref={Platform.OS === 'web' ? setDialogFrame : undefined}
                style={styles.confirmDialogFrame}
                {...(Platform.OS === 'web' ? { dataSet: { wwConfirmDialog: 'true' } } : {})}
              >
                <View style={styles.confirmDialogCard}>
                  <Text nativeID={titleId} style={styles.confirmDialogTitle}>
                    {pending.title}
                  </Text>
                  {Platform.OS === 'web' ? (
                    <ConfirmDialogBody key={pending.id}>{dialogBody}</ConfirmDialogBody>
                  ) : (
                    dialogBody
                  )}
                  <View style={styles.confirmDialogActions}>
                    <Pressable
                      {...getConfirmDialogPressableA11y(cancelLabel)}
                      style={({ pressed }) => [
                        styles.confirmDialogButton,
                        styles.secondaryButton,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => close(false)}
                    >
                      <Text
                        style={styles.secondaryButtonText}
                        importantForAccessibility="no-hide-descendants"
                        accessibilityElementsHidden
                      >
                        {cancelLabel}
                      </Text>
                    </Pressable>
                    <Pressable
                      {...getConfirmDialogPressableA11y(confirmLabel)}
                      disabled={!phraseMatches}
                      accessibilityState={{ disabled: !phraseMatches }}
                      style={({ pressed }) => [
                        styles.confirmDialogButton,
                        pending.destructive
                          ? styles.confirmDialogDestructiveButton
                          : styles.primaryButton,
                        !phraseMatches && styles.buttonDisabled,
                        pressed && phraseMatches && styles.buttonPressed,
                      ]}
                      onPress={() => {
                        if (!secondaryActionsEnabled) {
                          return;
                        }
                        close(true);
                      }}
                    >
                      <Text
                        style={
                          pending.destructive
                            ? styles.confirmDialogDestructiveButtonText
                            : styles.primaryButtonText
                        }
                        importantForAccessibility="no-hide-descendants"
                        accessibilityElementsHidden
                      >
                        {confirmLabel}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        ) : null}
      </View>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return context;
}
