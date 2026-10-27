import { createClient } from '@supabase/supabase-js';
import { getSupabaseAuthStorage } from './auth-session-storage';
import { resolveDevSupabaseUrl } from './resolve-dev-supabase-url';
import { createSupabaseAuthAwareFetch } from './supabase-auth-fetch';

const supabaseUrl = resolveDevSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getSupabaseAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: {
    fetch: createSupabaseAuthAwareFetch(fetch),
  },
});
