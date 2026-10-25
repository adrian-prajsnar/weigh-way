import AsyncStorage from '@react-native-async-storage/async-storage';

const EMAIL_CONFIRMATION_PENDING_KEY = '@weigh-way/auth-email-confirmation-pending';
const PASSWORD_RESET_PENDING_KEY = '@weigh-way/auth-password-reset-pending';

/** Matches typical Supabase email link lifetime (1 hour). */
export const AUTH_PENDING_FLOW_TTL_MS = 60 * 60 * 1000;

type PendingFlowRecord = {
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

async function readPending(key: string): Promise<PendingFlowRecord | null> {
  const raw = await AsyncStorage.getItem(key);
  const record = parsePendingRecord(raw);
  if (!isRecordValid(record)) {
    if (raw) {
      await AsyncStorage.removeItem(key);
    }
    return null;
  }
  return record;
}

export async function markEmailConfirmationPending(email: string): Promise<void> {
  await writePending(EMAIL_CONFIRMATION_PENDING_KEY, email);
}

export async function markPasswordResetPending(email: string): Promise<void> {
  await writePending(PASSWORD_RESET_PENDING_KEY, email);
}

export async function isEmailConfirmationPending(): Promise<boolean> {
  return (await readPending(EMAIL_CONFIRMATION_PENDING_KEY)) !== null;
}

export async function isPasswordResetPending(): Promise<boolean> {
  return (await readPending(PASSWORD_RESET_PENDING_KEY)) !== null;
}

export async function getEmailConfirmationPendingEmail(): Promise<string | null> {
  const record = await readPending(EMAIL_CONFIRMATION_PENDING_KEY);
  return record?.email ?? null;
}

export async function getPasswordResetPendingEmail(): Promise<string | null> {
  const record = await readPending(PASSWORD_RESET_PENDING_KEY);
  return record?.email ?? null;
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
