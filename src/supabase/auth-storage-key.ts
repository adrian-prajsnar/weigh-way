import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { resolveDevSupabaseUrl } from './resolve-dev-supabase-url';

function getSupabaseAuthStorageKey(): string {
  const url = resolveDevSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost');
  const hostname = new URL(url).hostname.split('.')[0] ?? 'localhost';
  return `sb-${hostname}-auth-token`;
}

export function getSupabaseLegacyPkceVerifierKey(): string {
  return `${getSupabaseAuthStorageKey()}-code-verifier`;
}

/** Reads the persisted Supabase session JSON from AsyncStorage (bootstrap fallback). */
export async function readPersistedAuthSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(getSupabaseAuthStorageKey());
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Session;
    return parsed.access_token ? parsed : null;
  } catch {
    return null;
  }
}
