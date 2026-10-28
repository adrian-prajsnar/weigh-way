import { supabase } from './client';
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

function isUnreachableRevokeError(error: unknown): boolean {
  if (isNetworkError(error)) {
    return true;
  }
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const authError = error as { status?: number; name?: string };
  if (authError.name === 'AuthRetryableFetchError') {
    return true;
  }
  const status = authError.status;
  return status === 0 || (typeof status === 'number' && status >= 500);
}

/** Revokes the session on the server using the user's access token (no service role). */
export async function revokeSessionOnServer(
  accessToken: string,
  scope: 'global' | 'local' | 'others' = 'global',
): Promise<{ result: ServerRevokeResult; error?: unknown }> {
  const response = await supabase.auth.admin.signOut(accessToken, scope);
  const error = response?.error ?? null;
  if (!error) {
    return { result: 'revoked' };
  }
  if (isExpiredAccessTokenRevokeError(error)) {
    return { result: 'token_expired', error };
  }
  if (isAlreadyRevokedError(error)) {
    return { result: 'already_revoked' };
  }
  if (isUnreachableRevokeError(error)) {
    return { result: 'unreachable' };
  }
  return { result: 'failed', error };
}
