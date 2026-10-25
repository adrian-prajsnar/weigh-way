import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@weigh-way/auth-last-exchanged-code';
/** Match Supabase email link / pending-flow TTL. */
export const AUTH_LAST_EXCHANGED_CODE_TTL_MS = 60 * 60 * 1000;

type StoredRecord = {
  code: string;
  exchangedAt: number;
};

async function readRecord(): Promise<StoredRecord | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredRecord;
    if (typeof parsed.code !== 'string' || !Number.isFinite(parsed.exchangedAt)) {
      return null;
    }
    if (Date.now() - parsed.exchangedAt > AUTH_LAST_EXCHANGED_CODE_TTL_MS) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function isAuthCodeAlreadyExchanged(code: string): Promise<boolean> {
  const record = await readRecord();
  return record?.code === code;
}

export async function rememberExchangedAuthCode(code: string): Promise<void> {
  const payload: StoredRecord = { code, exchangedAt: Date.now() };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function clearRememberedAuthCode(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
