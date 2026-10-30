import { fetchAuthUserForAccessToken } from './fetch-auth-user';
import { signOutSession } from './sign-out-session';
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

/** Clears a restored session when the server rejects it; ignores transient and unknown errors. */
export async function validateRestoredSessionInBackground(): Promise<void> {
  const {
    data: { session: sessionAtStart },
  } = await supabase.auth.getSession();
  const accessTokenAtStart = sessionAtStart?.access_token ?? null;
  const userIdAtStart = sessionAtStart?.user?.id ?? null;
  if (!accessTokenAtStart) {
    return;
  }

  const userResult = await fetchAuthUserForAccessToken(accessTokenAtStart);
  if (userResult.ok) {
    return;
  }
  if (userResult.unreachable) {
    return;
  }

  const rejection = {
    status: userResult.status,
    code: userResult.code,
    message: userResult.message,
  };

  if (!isClearSessionRejection(rejection)) {
    return;
  }

  await signOutSession({
    accessToken: accessTokenAtStart,
    refreshToken: sessionAtStart?.refresh_token ?? null,
    userId: userIdAtStart,
  });
}
