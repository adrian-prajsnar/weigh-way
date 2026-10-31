import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveDevSupabaseUrl } from './resolve-dev-supabase-url';

function getSupabaseAuthStorageKey(): string {
  const url = resolveDevSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost');
  const hostname = new URL(url).hostname.split('.')[0] ?? 'localhost';
  return `sb-${hostname}-auth-token`;
}

export function getSupabaseLegacyPkceVerifierKey(): string {
  return `${getSupabaseAuthStorageKey()}-code-verifier`;
}

/** Removes persisted Supabase auth keys (offline sign-out local clear). */
export async function clearPersistedAuthSession(): Promise<void> {
  const key = getSupabaseAuthStorageKey();
  await AsyncStorage.multiRemove([key, `${key}-user`, getSupabaseLegacyPkceVerifierKey()]);
}
