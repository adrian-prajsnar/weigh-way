import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearPkceVerifierBackup,
  clearPkceVerifierBackups,
  snapshotLegacyVerifierForFlow,
  type PkceBackupKind,
} from './pkce-verifier-backup';

const EMAIL_CONFIRMATION_PENDING_KEY = '@weigh-way/auth-email-confirmation-pending';
const PASSWORD_RESET_PENDING_KEY = '@weigh-way/auth-password-reset-pending';

/** Matches typical Supabase email link lifetime (1 hour). */
export const AUTH_PENDING_FLOW_TTL_MS = 60 * 60 * 1000;

export type PendingFlowRecord = {
  startedAt: number;
  email: string;
};

function parsePendingRecord(raw: string | null): PendingFlowRecord | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PendingFlowRecord;
    if (!Number.isFinite(parsed.startedAt) || typeof parsed.email !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isRecordValid(record: PendingFlowRecord | null): boolean {
  if (!record) {
    return false;
  }
  return Date.now() - record.startedAt < AUTH_PENDING_FLOW_TTL_MS;
}

async function writePending(key: string, email: string): Promise<void> {
  const payload: PendingFlowRecord = {
    startedAt: Date.now(),
    email: email.trim().toLowerCase(),
  };
  await AsyncStorage.setItem(key, JSON.stringify(payload));
}

async function readPending(
  key: string,
  backupKind: PkceBackupKind,
): Promise<PendingFlowRecord | null> {
  const raw = await AsyncStorage.getItem(key);
  const record = parsePendingRecord(raw);
  if (!isRecordValid(record)) {
    if (raw) {
      await AsyncStorage.removeItem(key);
      await clearPkceVerifierBackup(backupKind);
    }
    return null;
  }
  return record;
}

export async function markEmailConfirmationPending(email: string): Promise<void> {
  await snapshotLegacyVerifierForFlow('signup');
  await writePending(EMAIL_CONFIRMATION_PENDING_KEY, email);
}

export async function markPasswordResetPending(email: string): Promise<void> {
  await snapshotLegacyVerifierForFlow('recovery');
  await writePending(PASSWORD_RESET_PENDING_KEY, email);
}

export async function isEmailConfirmationPending(): Promise<boolean> {
  return (await readPending(EMAIL_CONFIRMATION_PENDING_KEY, 'signup')) !== null;
}

export async function isPasswordResetPending(): Promise<boolean> {
  return (await readPending(PASSWORD_RESET_PENDING_KEY, 'recovery')) !== null;
}

export async function hasOverlappingEmailFlows(): Promise<boolean> {
  return (await isEmailConfirmationPending()) && (await isPasswordResetPending());
}

export async function resolveEmailCallbackFlowKind(): Promise<'signup' | 'recovery' | null> {
  const emailRecord = await readPending(EMAIL_CONFIRMATION_PENDING_KEY, 'signup');
  const resetRecord = await readPending(PASSWORD_RESET_PENDING_KEY, 'recovery');
  if (!emailRecord && !resetRecord) {
    return null;
  }
  if (emailRecord && !resetRecord) {
    return 'signup';
  }
  if (resetRecord && !emailRecord) {
    return 'recovery';
  }
  return emailRecord!.startedAt >= resetRecord!.startedAt ? 'signup' : 'recovery';
}

export type AuthLinkErrorContext = {
  isPasswordRecovery?: boolean;
  hasOverlappingEmailFlows?: boolean;
};

export async function getAuthLinkErrorContext(): Promise<AuthLinkErrorContext> {
  const emailPending = await isEmailConfirmationPending();
  const resetPending = await isPasswordResetPending();
  const overlapping = emailPending && resetPending;
  if (overlapping) {
    const kind = await resolveEmailCallbackFlowKind();
    return {
      isPasswordRecovery: kind === 'recovery',
      hasOverlappingEmailFlows: true,
    };
  }
  return {
    isPasswordRecovery: resetPending,
    hasOverlappingEmailFlows: false,
  };
}

export async function clearEmailConfirmationPending(): Promise<void> {
  await AsyncStorage.removeItem(EMAIL_CONFIRMATION_PENDING_KEY);
  await clearPkceVerifierBackup('signup');
}

export async function clearPasswordResetPending(): Promise<void> {
  await AsyncStorage.removeItem(PASSWORD_RESET_PENDING_KEY);
  await clearPkceVerifierBackup('recovery');
}

export async function clearAuthPendingFlows(): Promise<void> {
  await Promise.all([clearEmailConfirmationPending(), clearPasswordResetPending()]);
}
