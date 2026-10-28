import { isRefreshInvalidGrantError, isAuthServerUnreachableError } from './auth-reachability-error';
import { supabaseAuthHttpConfig } from './client';
import {
  isSignOutDeadlineError,
  SIGN_OUT_REFRESH_TIMEOUT_MS,
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
    error?: string;
    error_description?: string;
  };
  if (payload.access_token && payload.user?.id) {
    return { accessToken: payload.access_token, userId: payload.user.id };
  }
  return null;
}

/** Bounded refresh for sign-out only (no auth-js lock / long retry loop). */
export async function refreshAccessTokenForSignOut(
  refreshToken: string,
): Promise<RefreshedSignOutTokens> {
  const { url, anonKey } = supabaseAuthHttpConfig;
  if (!url || !anonKey) {
    throw new Error('sign_out_failed');
  }

  try {
    const response = await withSignOutDeadline(SIGN_OUT_REFRESH_TIMEOUT_MS, async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SIGN_OUT_REFRESH_TIMEOUT_MS);
      try {
        return await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
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
          ? {
              status: response.status,
              code: (body as { error?: string }).error,
              message: (body as { error_description?: string }).error_description,
              error: (body as { error?: string }).error,
            }
          : { status: response.status, message: 'refresh_failed' };
      if (isRefreshInvalidGrantError(errorPayload)) {
        throw errorPayload;
      }
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
