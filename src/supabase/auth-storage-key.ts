import { resolveDevSupabaseUrl } from './resolve-dev-supabase-url';

/** Matches the default Supabase JS auth `storageKey` for this project URL. */
export function getSupabaseAuthStorageKey(): string {
  const url = resolveDevSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost');
  const hostname = new URL(url).hostname.split('.')[0] ?? 'localhost';
  return `sb-${hostname}-auth-token`;
}

export function getSupabaseLegacyPkceVerifierKey(): string {
  return `${getSupabaseAuthStorageKey()}-code-verifier`;
}
