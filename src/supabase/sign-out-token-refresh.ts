import { authAnonHeaders, authApiUrl } from './auth-api-http';
import { isAuthServerUnreachableError } from './auth-reachability-error';
import { supabaseAuthHttpConfig } from './client';
import {
  isSignOutDeadlineError,
  SignOutDeadlineError,
  withSignOutDeadline,
} from './sign-out-deadlines';

export type RefreshedSignOutTokens = {
  accessToken: string;
  userId: string;
};

function parseRefreshResponseBody(body: unknown): RefreshedSignOutTokens | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const payload = body as {
    access_token?: string;
    user?: { id?: string };
  };
  if (payload.access_token && payload.user?.id) {
    return { accessToken: payload.access_token, userId: payload.user.id };
  }
  return null;
}

/** Bounded refresh for sign-out only (no auth-js lock / long retry loop). */
export async function refreshAccessTokenForSignOut(
  refreshToken: string,
  timeoutMs: number,
): Promise<RefreshedSignOutTokens> {
  const { url, anonKey } = supabaseAuthHttpConfig;
  if (!url || !anonKey) {
    throw new Error('sign_out_failed');
  }

  try {
    const response = await withSignOutDeadline(timeoutMs, async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(authApiUrl(url, '/token?grant_type=refresh_token'), {
          method: 'POST',
          headers: {
            ...authAnonHeaders(anonKey),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    });

    const body = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const errorPayload =
        typeof body === 'object' && body !== null
          ? (() => {
              const payload = body as {
                error?: string;
                error_description?: string;
                error_code?: string;
                msg?: string;
              };
              return {
                status: response.status,
                error_code: payload.error_code,
                code: payload.error_code ?? payload.error,
                msg: payload.msg,
                message: payload.msg ?? payload.error_description,
                error: payload.error,
              };
            })()
          : { status: response.status, message: 'refresh_failed' };
      throw errorPayload;
    }

    const parsed = parseRefreshResponseBody(body);
    if (!parsed) {
      throw new Error('sign_out_failed');
    }
    return parsed;
  } catch (error) {
    if (isSignOutDeadlineError(error)) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SignOutDeadlineError();
    }
    if (isAuthServerUnreachableError(error)) {
      throw new SignOutDeadlineError();
    }
    throw error;
  }
}
