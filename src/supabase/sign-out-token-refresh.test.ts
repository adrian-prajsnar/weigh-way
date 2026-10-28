import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./sign-out-deadlines', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sign-out-deadlines')>();
  return {
    ...actual,
    SIGN_OUT_REFRESH_TIMEOUT_MS: 50,
  };
});

vi.mock('./client', () => ({
  supabaseAuthHttpConfig: {
    url: 'https://example.supabase.co',
    anonKey: 'public-anon-key',
  },
}));

/* eslint-disable import/first -- after vi.mock */
import { SignOutDeadlineError } from './sign-out-deadlines';
import { refreshAccessTokenForSignOut } from './sign-out-token-refresh';
/* eslint-enable import/first */

describe('refreshAccessTokenForSignOut', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects within the refresh deadline when token fetch hangs', async () => {
    const started = Date.now();
    await expect(refreshAccessTokenForSignOut('refresh-token', 50)).rejects.toBeInstanceOf(
      SignOutDeadlineError,
    );
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('treats hosted refresh_token_not_found as invalid grant without retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            code: 400,
            error_code: 'refresh_token_not_found',
            msg: 'Invalid Refresh Token: Refresh Token Not Found',
          },
          { status: 400 },
        ),
      ),
    );

    await expect(refreshAccessTokenForSignOut('refresh-token', 5000)).rejects.toMatchObject({
      status: 400,
      error_code: 'refresh_token_not_found',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
