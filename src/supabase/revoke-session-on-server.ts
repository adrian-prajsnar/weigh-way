import { authApiUrl, authUserJwtLogoutHeaders, parseAuthApiErrorFields } from './auth-api-http';
import { isAuthRateLimitedError, isAuthServerUnreachableError } from './auth-reachability-error';
import { supabaseAuthHttpConfig } from './client';
import {
  isSignOutDeadlineError,
  SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS,
  SignOutDeadlineError,
  withSignOutDeadline,
} from './sign-out-deadlines';
import { isNetworkError } from '../auth-errors';

export type ServerRevokeResult =
  | 'revoked'
  | 'already_revoked'
  | 'token_expired'
  | 'rate_limited'
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

function mapRevokeHttpError(status: number, body: unknown): { result: ServerRevokeResult; error?: unknown } {
  const { code, message } = parseAuthApiErrorFields(body);
  const error = { status, code, message };
  if (status === 429 || isAuthRateLimitedError(error)) {
    return { result: 'rate_limited', error };
  }
  if (isExpiredAccessTokenRevokeError(error)) {
    return { result: 'token_expired', error };
  }
  if (isAlreadyRevokedError(error)) {
    return { result: 'already_revoked' };
  }
  if (status === 0 || status >= 500) {
    return { result: 'unreachable', error };
  }
  return { result: 'failed', error };
}

function mapRevokeError(error: unknown): { result: ServerRevokeResult; error?: unknown } {
  if (isSignOutDeadlineError(error) || isNetworkError(error)) {
    return { result: 'unreachable', error };
  }
  if (isAuthServerUnreachableError(error)) {
    return { result: 'unreachable', error };
  }
  if (isAuthRateLimitedError(error)) {
    return { result: 'rate_limited', error };
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
  timeoutMs: number = SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS,
  externalSignal?: AbortSignal,
): Promise<{ result: ServerRevokeResult; error?: unknown }> {
  const { url, anonKey } = supabaseAuthHttpConfig;
  if (!url || !anonKey) {
    return { result: 'failed', error: new Error('sign_out_not_configured') };
  }

  try {
    const response = await withSignOutDeadline(timeoutMs, async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onExternalAbort = () => controller.abort();
      if (externalSignal?.aborted) {
        controller.abort();
      } else {
        externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
      }
      try {
        return await fetch(authApiUrl(url, `/logout?scope=${scope}`), {
          method: 'POST',
          headers: authUserJwtLogoutHeaders(anonKey, accessToken),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
        externalSignal?.removeEventListener('abort', onExternalAbort);
      }
    });

    if (response.ok) {
      return { result: 'revoked' };
    }

    const body = await response.json().catch(() => null);
    return mapRevokeHttpError(response.status, body);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return mapRevokeError(new SignOutDeadlineError());
    }
    return mapRevokeError(error);
  }
}
