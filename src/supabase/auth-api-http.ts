const AUTH_JS_CLIENT_INFO = 'gotrue-js/2.112.4';
export const SUPABASE_AUTH_API_VERSION = '2024-01-01';

function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export function authApiUrl(baseUrl: string, path: string): string {
  return `${normalizeSupabaseUrl(baseUrl)}/auth/v1${path.startsWith('/') ? path : `/${path}`}`;
}

export function parseAuthApiErrorFields(body: unknown): { code?: string; message?: string } {
  if (typeof body !== 'object' || body === null) {
    return {};
  }
  const payload = body as {
    code?: string | number;
    error?: string;
    error_code?: string;
    msg?: string;
    message?: string;
    error_description?: string;
  };
  const code =
    typeof payload.error_code === 'string'
      ? payload.error_code
      : typeof payload.code === 'string'
        ? payload.code
        : typeof payload.error === 'string'
          ? payload.error
          : undefined;
  const message = payload.msg ?? payload.message ?? payload.error_description;
  return { code, message };
}

function authVersionHeaders(): Record<string, string> {
  return { 'X-Supabase-Api-Version': SUPABASE_AUTH_API_VERSION };
}

export function authAnonHeaders(anonKey: string): Record<string, string> {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'X-Client-Info': AUTH_JS_CLIENT_INFO,
    ...authVersionHeaders(),
  };
}

export function authUserJwtHeaders(anonKey: string, accessToken: string): Record<string, string> {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    'X-Client-Info': AUTH_JS_CLIENT_INFO,
    ...authVersionHeaders(),
  };
}

export function authUserJwtLogoutHeaders(
  anonKey: string,
  accessToken: string,
): Record<string, string> {
  return {
    ...authUserJwtHeaders(anonKey, accessToken),
    'Content-Type': 'application/json',
  };
}
