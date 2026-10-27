import { isFatalRefreshTokenResponseBody } from './auth-fatal-refresh-error';

export type FatalRefreshTokenHandler = () => void;

let fatalRefreshTokenHandler: FatalRefreshTokenHandler | null = null;

export function registerFatalRefreshTokenHandler(handler: FatalRefreshTokenHandler | null): void {
  fatalRefreshTokenHandler = handler;
}

export function createSupabaseAuthAwareFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const response = await baseFetch(input, init);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/auth/v1/token') && !response.ok) {
      try {
        const body = await response.clone().json();
        if (isFatalRefreshTokenResponseBody(body)) {
          fatalRefreshTokenHandler?.();
        }
      } catch {
        // Ignore non-JSON auth error bodies.
      }
    }
    return response;
  };
}
