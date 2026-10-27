import { getSupabaseAuthStorage } from './auth-session-storage';
import { supabase } from './client';

const SESSION_REJECTION_CODES = new Set(['session_not_found', 'user_not_found', 'bad_jwt']);

function isClearSessionRejection(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const authError = error as { name?: string; status?: number; code?: string };

  if (authError.name === 'AuthRetryableFetchError') {
    return false;
  }

  const status = authError.status;
  if (status === 429) {
    return false;
  }
  if (status === 0 || (typeof status === 'number' && status >= 500)) {
    return false;
  }

  if (status === 401 || status === 403) {
    return true;
  }

  const code = authError.code;
  if (code && SESSION_REJECTION_CODES.has(code)) {
    return true;
  }

  return false;
}

/** Clears a restored session when the server rejects it; ignores transient and unknown errors. */
export async function validateRestoredSessionInBackground(): Promise<void> {
  const {
    data: { session: sessionAtStart },
  } = await supabase.auth.getSession();
  const accessTokenAtStart = sessionAtStart?.access_token ?? null;
  if (!accessTokenAtStart) {
    return;
  }

  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) {
    return;
  }
  if (!error || !isClearSessionRejection(error)) {
    return;
  }

  const {
    data: { session: sessionNow },
  } = await supabase.auth.getSession();
  if (sessionNow?.access_token !== accessTokenAtStart) {
    return;
  }

  getSupabaseAuthStorage().resetSignOutPersistWarning();
  getSupabaseAuthStorage().consumeSignOutPersistWarning();
  await supabase.auth.signOut({ scope: 'local' });
}
