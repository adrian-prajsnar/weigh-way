import { signOutLocallyOnce } from './local-auth-sign-out';
import { supabase } from './client';

const SESSION_REJECTION_CODES = new Set([
  'session_not_found',
  'user_not_found',
  'bad_jwt',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_expired',
]);

function isClearSessionRejection(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const authError = error as { name?: string; status?: number; code?: string };

  if (authError.name === 'AuthSessionMissingError') {
    return true;
  }

  const code = authError.code;
  if (code && SESSION_REJECTION_CODES.has(code)) {
    return true;
  }

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

  return false;
}

function isExpiredBadJwt(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const authError = error as { status?: number; code?: string; message?: string };
  if (authError.code !== 'bad_jwt' || authError.status !== 401) {
    return false;
  }
  const message = (authError.message ?? '').toLowerCase();
  return message.includes('expired') || message.includes('token is expired');
}

async function shouldSignOutAfterSessionRejection(
  error: unknown,
  accessTokenAtStart: string,
): Promise<boolean> {
  let rejection = error;

  if (isExpiredBadJwt(rejection)) {
    const { data, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && data.session) {
      return false;
    }
    if (!refreshError) {
      return false;
    }
    if (!isClearSessionRejection(refreshError)) {
      return false;
    }
    rejection = refreshError;
  } else if (!isClearSessionRejection(rejection)) {
    return false;
  }

  const {
    data: { session: sessionNow },
  } = await supabase.auth.getSession();
  if (sessionNow?.access_token !== accessTokenAtStart) {
    return false;
  }

  return isClearSessionRejection(rejection);
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
  if (!error) {
    return;
  }

  const shouldSignOut = await shouldSignOutAfterSessionRejection(error, accessTokenAtStart);
  if (!shouldSignOut) {
    return;
  }

  await signOutLocallyOnce();
}
