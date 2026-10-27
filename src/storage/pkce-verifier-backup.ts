import { getSupabaseAuthStorage } from '../supabase/auth-session-storage';
import { getSupabaseLegacyPkceVerifierKey } from '../supabase/auth-storage-key';

export type PkceBackupKind = 'signup' | 'recovery';

function backupStorageKey(kind: PkceBackupKind): string {
  return `@weigh-way/pkce-verifier-backup/${kind}`;
}

function authStorage() {
  return getSupabaseAuthStorage();
}

async function readLegacyVerifier(): Promise<string | null> {
  return authStorage().getItem(getSupabaseLegacyPkceVerifierKey());
}

export async function snapshotLegacyVerifierForFlow(kind: PkceBackupKind): Promise<void> {
  const verifier = await readLegacyVerifier();
  if (!verifier) {
    await authStorage().removeItem(backupStorageKey(kind));
    return;
  }
  await authStorage().setItem(backupStorageKey(kind), verifier);
}

export async function restoreLegacyVerifierForFlow(kind: PkceBackupKind): Promise<boolean> {
  const backup = await authStorage().getItem(backupStorageKey(kind));
  if (!backup) {
    return false;
  }
  await authStorage().setItem(getSupabaseLegacyPkceVerifierKey(), backup);
  return true;
}

export async function backupLegacyVerifierForRollback(): Promise<(() => Promise<void>) | null> {
  const current = await readLegacyVerifier();
  if (!current) {
    return null;
  }
  const snapshot = current;
  return async () => {
    await authStorage().setItem(getSupabaseLegacyPkceVerifierKey(), snapshot);
  };
}

export async function clearPkceVerifierBackup(kind: PkceBackupKind): Promise<void> {
  await authStorage().removeItem(backupStorageKey(kind));
}

export async function clearPkceVerifierBackups(): Promise<void> {
  await Promise.all([clearPkceVerifierBackup('signup'), clearPkceVerifierBackup('recovery')]);
}
