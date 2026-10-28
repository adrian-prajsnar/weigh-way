import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({
  supabaseAuthHttpConfig: {
    url: 'https://example.supabase.co',
    anonKey: 'public-anon-key',
  },
}));

/* eslint-disable import/first -- after vi.mock */
import { revokeSessionOnServer } from './revoke-session-on-server';
/* eslint-enable import/first */

describe('revokeSessionOnServer', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
  });

  it('POSTs /logout with the user access token', async () => {
    await revokeSessionOnServer('token-a', 'global');
    expect(fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/logout?scope=global',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-a',
          apikey: 'public-anon-key',
        }),
      }),
    );
  });

  it('treats session-not-found responses as already revoked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ code: 'session_not_found' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    await expect(revokeSessionOnServer('token-a')).resolves.toEqual({
      result: 'already_revoked',
    });
  });

  it('treats expired access tokens as needing refresh, not already revoked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ code: 'bad_jwt', message: 'token is expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    await expect(revokeSessionOnServer('token-a')).resolves.toMatchObject({
      result: 'token_expired',
    });
  });

  it('treats revoke 429 as rate limited', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 429 })),
    );
    await expect(revokeSessionOnServer('token-a')).resolves.toEqual({
      result: 'rate_limited',
      error: expect.objectContaining({ status: 429 }),
    });
  });
});
