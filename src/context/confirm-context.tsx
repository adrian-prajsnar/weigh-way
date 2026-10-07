import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

type PendingConfirm = ConfirmOptions & { id: number };

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [phraseInput, setPhraseInput] = useState('');
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    setPhraseInput('');
  }, [pending?.id]);

  const close = useCallback((result: boolean) => {
    setPending(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      idRef.current += 1;
      resolverRef.current = resolve;
      setPending({ ...options, id: idRef.current });
    });
  }, []);

  const cancelLabel = pending?.cancelLabel ?? t('common.cancel');
  const confirmLabel = pending?.confirmLabel ?? t('common.confirm');
  const phraseRequired = Boolean(pending?.confirmationPhrase);
  const phraseMatches =
    !phraseRequired || phraseInput === pending?.confirmationPhrase;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      <View style={styles.overlayRoot}>
        {children}
        {pending ? (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => close(false)}
          >
            <View style={styles.modalBackdropCentered}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => close(false)}
                focusable={false}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                {...(Platform.OS === 'web'
                  ? { dataSet: { wwModalDismiss: 'true', wwConfirmDismiss: 'true' }, tabIndex: -1 }
                  : {})}
              />
              <View
                style={styles.confirmDialogFrame}
                {...(Platform.OS === 'web' ? { dataSet: { wwConfirmDialog: 'true' } } : {})}
              >
                <View style={styles.confirmDialogCard}>
                    <Text style={styles.confirmDialogTitle}>{pending.title}</Text>
                    <Text style={styles.confirmDialogMessage}>{pending.message}</Text>
                    {pending.confirmationPhrase ? (
                      <View style={styles.passwordFieldGroup}>
                        {pending.confirmationPhraseHint ? (
                          <Text style={styles.fieldLabel}>{pending.confirmationPhraseHint}</Text>
                        ) : null}
                        <TextInput
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
                    <View style={styles.confirmDialogActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.confirmDialogButton,
                          styles.secondaryButton,
                          pressed && styles.buttonPressed,
                        ]}
                        onPress={() => close(false)}
                      >
                        <Text style={styles.secondaryButtonText}>{cancelLabel}</Text>
                      </Pressable>
                      <Pressable
                        disabled={!phraseMatches}
                        style={({ pressed }) => [
                          styles.confirmDialogButton,
                          pending.destructive
                            ? styles.confirmDialogDestructiveButton
                            : styles.primaryButton,
                          !phraseMatches && styles.buttonDisabled,
                          pressed && phraseMatches && styles.buttonPressed,
                        ]}
                        onPress={() => close(true)}
                      >
                        <Text
                          style={
                            pending.destructive
                              ? styles.confirmDialogDestructiveButtonText
                              : styles.primaryButtonText
                          }
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
