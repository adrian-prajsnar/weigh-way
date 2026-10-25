import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseLegacyPkceVerifierKey } from '../supabase/auth-storage-key';

export type PkceBackupKind = 'signup' | 'recovery';

function backupStorageKey(kind: PkceBackupKind): string {
  return `@weigh-way/pkce-verifier-backup/${kind}`;
}

async function readLegacyVerifier(): Promise<string | null> {
  return AsyncStorage.getItem(getSupabaseLegacyPkceVerifierKey());
}

export async function snapshotLegacyVerifierForFlow(kind: PkceBackupKind): Promise<void> {
  const verifier = await readLegacyVerifier();
  if (!verifier) {
    return;
  }
  await AsyncStorage.setItem(backupStorageKey(kind), verifier);
}

export async function restoreLegacyVerifierForFlow(kind: PkceBackupKind): Promise<boolean> {
  const backup = await AsyncStorage.getItem(backupStorageKey(kind));
  if (!backup) {
    return false;
  }
  await AsyncStorage.setItem(getSupabaseLegacyPkceVerifierKey(), backup);
  return true;
}

export async function backupLegacyVerifierForRollback(): Promise<(() => Promise<void>) | null> {
  const current = await readLegacyVerifier();
  if (!current) {
    return null;
  }
  const snapshot = current;
  return async () => {
    await AsyncStorage.setItem(getSupabaseLegacyPkceVerifierKey(), snapshot);
  };
}

export async function clearPkceVerifierBackups(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(backupStorageKey('signup')),
    AsyncStorage.removeItem(backupStorageKey('recovery')),
  ]);
}
