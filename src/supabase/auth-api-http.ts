/** Matches `@supabase/auth-js` DEFAULT_HEADERS (see lib/constants.ts). */
export const AUTH_JS_CLIENT_INFO = 'gotrue-js/2.112.4';

export function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export function authApiUrl(baseUrl: string, path: string): string {
  return `${normalizeSupabaseUrl(baseUrl)}/auth/v1${path.startsWith('/') ? path : `/${path}`}`;
}

export function authAnonHeaders(anonKey: string): Record<string, string> {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'X-Client-Info': AUTH_JS_CLIENT_INFO,
  };
}

export function authUserJwtHeaders(anonKey: string, accessToken: string): Record<string, string> {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    'X-Client-Info': AUTH_JS_CLIENT_INFO,
  };
}
