import { isNetworkError } from '../auth-errors';
import { getSupabaseAuthStorage } from './auth-session-storage';
import { supabase } from './client';

/** Clears a restored session when the server rejects it; ignores offline errors. */
export async function validateRestoredSessionInBackground(): Promise<void> {
  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) {
    return;
  }
  if (error && isNetworkError(error)) {
    return;
  }

  getSupabaseAuthStorage().resetSignOutPersistWarning();
  getSupabaseAuthStorage().consumeSignOutPersistWarning();
  await supabase.auth.signOut({ scope: 'local' });
}
