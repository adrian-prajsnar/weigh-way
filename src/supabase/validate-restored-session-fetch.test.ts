/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

const signOutSessionMock = vi.hoisted(() => vi.fn());

vi.mock('./sign-out-session', () => ({
  signOutSession: signOutSessionMock,
}));

vi.mock('./client', () => ({
  supabaseAuthHttpConfig: {
    url: 'https://example.supabase.co/',
    anonKey: 'public-anon-key',
  },
  supabase: {
    auth: {
      getSession: authState.getSession,
      refreshSession: authState.refreshSession,
    },
  },
}));

/* eslint-disable import/first -- after vi.mock */
import { validateRestoredSessionInBackground } from './validate-restored-session';
/* eslint-enable import/first */

const sessionA = {
  access_token: 'token-a',
  refresh_token: 'refresh-a',
  user: { id: 'user-a' },
};

describe('validateRestoredSessionInBackground with direct GET /user', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { code: 401, error_code: 'bad_jwt', msg: 'token is expired' },
          { status: 401 },
        ),
      ),
    );
    authState.getSession.mockReset();
    authState.refreshSession.mockReset();
    signOutSessionMock.mockReset();
    authState.getSession
      .mockResolvedValueOnce({ data: { session: sessionA } })
      .mockResolvedValueOnce({ data: { session: sessionA } })
      .mockResolvedValue({ data: { session: sessionA } });
    authState.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'token-a-refreshed' } },
      error: null,
    });
  });

  it('refreshes on legacy GoTrue expired body without calling auth-js getUser', async () => {
    await validateRestoredSessionInBackground();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/v1/user'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-a',
          'X-Supabase-Api-Version': '2024-01-01',
        }),
      }),
    );
    expect(authState.refreshSession).toHaveBeenCalledTimes(1);
    expect(signOutSessionMock).not.toHaveBeenCalled();
  });
});
