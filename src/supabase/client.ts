import { createClient } from '@supabase/supabase-js';
import { createResilientAuthStorage } from './resilient-auth-storage';
import { resolveDevSupabaseUrl } from './resolve-dev-supabase-url';

const supabaseUrl = resolveDevSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

const authStorage = createResilientAuthStorage();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
