import { supabase } from './client';
import { isAuthServerUnreachableError } from './auth-reachability-error';
import {
  isSignOutDeadlineError,
  SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS,
  withSignOutDeadline,
} from './sign-out-deadlines';
import { isNetworkError } from '../auth-errors';

export type ServerRevokeResult =
  | 'revoked'
  | 'already_revoked'
  | 'token_expired'
  | 'unreachable'
  | 'failed';

export function isExpiredAccessTokenRevokeError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const authError = error as { status?: number; code?: string; message?: string };
  if (authError.status !== 401) {
    return false;
  }
  const code = authError.code ?? '';
  if (code === 'bad_jwt') {
    return true;
  }
  const message = (authError.message ?? '').toLowerCase();
  return message.includes('expired') || message.includes('token is expired');
}

function isAlreadyRevokedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  if (isExpiredAccessTokenRevokeError(error)) {
    return false;
  }
  const authError = error as { status?: number; code?: string; message?: string };
  if (authError.status === 403 || authError.status === 404) {
    return true;
  }
  const code = authError.code ?? '';
  if (code === 'session_not_found' || code === 'session_expired') {
    return true;
  }
  return false;
}

function mapRevokeError(error: unknown): { result: ServerRevokeResult; error?: unknown } {
  if (isSignOutDeadlineError(error) || isNetworkError(error)) {
    return { result: 'unreachable', error };
  }
  if (isAuthServerUnreachableError(error)) {
    return { result: 'unreachable', error };
  }
  if (isExpiredAccessTokenRevokeError(error)) {
    return { result: 'token_expired', error };
  }
  if (isAlreadyRevokedError(error)) {
    return { result: 'already_revoked' };
  }
  return { result: 'failed', error };
}

/** Revokes the session on the server using the user's access token (no service role). */
export async function revokeSessionOnServer(
  accessToken: string,
  scope: 'global' | 'local' | 'others' = 'global',
): Promise<{ result: ServerRevokeResult; error?: unknown }> {
  try {
    const response = await withSignOutDeadline(SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS, () =>
      supabase.auth.admin.signOut(accessToken, scope),
    );
    const error = response?.error ?? null;
    if (!error) {
      return { result: 'revoked' };
    }
    return mapRevokeError(error);
  } catch (error) {
    return mapRevokeError(error);
  }
}
