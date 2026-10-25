import AsyncStorage from '@react-native-async-storage/async-storage';

const EMAIL_CONFIRMATION_PENDING_KEY = '@weigh-way/auth-email-confirmation-pending';
const PASSWORD_RESET_PENDING_KEY = '@weigh-way/auth-password-reset-pending';

/** How long an in-app sign-up / reset request remains valid for deep-link completion. */
export const AUTH_PENDING_FLOW_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isTimestampValid(raw: string | null): boolean {
  if (!raw) {
    return false;
  }
  const startedAt = Number(raw);
  if (!Number.isFinite(startedAt)) {
    return false;
  }
  return Date.now() - startedAt < AUTH_PENDING_FLOW_TTL_MS;
}

export async function markEmailConfirmationPending(): Promise<void> {
  await AsyncStorage.setItem(EMAIL_CONFIRMATION_PENDING_KEY, String(Date.now()));
}

export async function markPasswordResetPending(): Promise<void> {
  await AsyncStorage.setItem(PASSWORD_RESET_PENDING_KEY, String(Date.now()));
}

export async function isEmailConfirmationPending(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(EMAIL_CONFIRMATION_PENDING_KEY);
  if (!isTimestampValid(raw)) {
    if (raw) {
      await AsyncStorage.removeItem(EMAIL_CONFIRMATION_PENDING_KEY);
    }
    return false;
  }
  return true;
}

export async function isPasswordResetPending(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PASSWORD_RESET_PENDING_KEY);
  if (!isTimestampValid(raw)) {
    if (raw) {
      await AsyncStorage.removeItem(PASSWORD_RESET_PENDING_KEY);
    }
    return false;
  }
  return true;
}

export async function clearEmailConfirmationPending(): Promise<void> {
  await AsyncStorage.removeItem(EMAIL_CONFIRMATION_PENDING_KEY);
}

export async function clearPasswordResetPending(): Promise<void> {
  await AsyncStorage.removeItem(PASSWORD_RESET_PENDING_KEY);
}

export async function clearAuthPendingFlows(): Promise<void> {
  await Promise.all([clearEmailConfirmationPending(), clearPasswordResetPending()]);
}
