import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({
  supabaseAuthHttpConfig: {
    url: 'https://example.supabase.co/',
    anonKey: 'public-anon-key',
  },
}));

/* eslint-disable import/first -- after vi.mock */
import { SUPABASE_AUTH_API_VERSION } from './auth-api-http';
import { fetchAuthUserForAccessToken } from './fetch-auth-user';
/* eslint-enable import/first */

describe('fetchAuthUserForAccessToken', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends X-Supabase-Api-Version on GET /user', async () => {
    await fetchAuthUserForAccessToken('jwt-a');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/v1/user'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-a',
          'X-Supabase-Api-Version': SUPABASE_AUTH_API_VERSION,
        }),
      }),
    );
  });

  it('maps legacy GoTrue expired JWT bodies using error_code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            code: 401,
            error_code: 'bad_jwt',
            msg: 'token is expired',
          },
          { status: 401 },
        ),
      ),
    );

    const result = await fetchAuthUserForAccessToken('jwt-a');
    expect(result).toEqual({
      ok: false,
      status: 401,
      code: 'bad_jwt',
      message: 'token is expired',
    });
  });

  it('maps new-format OAuth error bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: 'invalid_grant',
            error_description: 'Refresh token is invalid',
          },
          { status: 400 },
        ),
      ),
    );

    const result = await fetchAuthUserForAccessToken('jwt-a');
    expect(result).toEqual({
      ok: false,
      status: 400,
      code: 'invalid_grant',
      message: 'Refresh token is invalid',
    });
  });
});
