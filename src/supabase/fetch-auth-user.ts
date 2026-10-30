import { isNetworkError } from '../auth-errors';
import { authApiUrl, authUserJwtHeaders, parseAuthApiErrorFields } from './auth-api-http';
import { isAuthServerUnreachableError } from './auth-reachability-error';
import { supabaseAuthHttpConfig } from './client';

export const VALIDATION_AUTH_USER_TIMEOUT_MS = 10_000;

export type FetchAuthUserResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; code?: string; message?: string; unreachable?: boolean };

/** Validates an access token via GET /user without auth-js session side effects. */
export async function fetchAuthUserForAccessToken(
  accessToken: string,
): Promise<FetchAuthUserResult> {
  const { url, anonKey } = supabaseAuthHttpConfig;
  if (!url || !anonKey) {
    return { ok: false, status: 0, message: 'not_configured', unreachable: true };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VALIDATION_AUTH_USER_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(authApiUrl(url, '/user'), {
        method: 'GET',
        headers: authUserJwtHeaders(anonKey, accessToken),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const body = (await response.json().catch(() => null)) as { id?: string } | null;

    if (response.ok && body && typeof body === 'object' && 'id' in body && body.id) {
      return { ok: true, userId: body.id };
    }

    const { code, message } = parseAuthApiErrorFields(body);
    return {
      ok: false,
      status: response.status,
      code,
      message,
    };
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === 'AbortError') ||
      isNetworkError(error) ||
      isAuthServerUnreachableError(error)
    ) {
      return { ok: false, status: 0, message: 'unreachable', unreachable: true };
    }
    throw error;
  }
}
