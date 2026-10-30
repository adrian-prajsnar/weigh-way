/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
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
    signOutSessionMock.mockReset();
    authState.getSession
      .mockResolvedValueOnce({ data: { session: sessionA } })
      .mockResolvedValueOnce({ data: { session: sessionA } })
      .mockResolvedValue({ data: { session: sessionA } });
    signOutSessionMock.mockResolvedValue({ serverSignOutUnreachable: false });
  });

  it('signs out on legacy GoTrue expired body from GET /user', async () => {
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
    expect(signOutSessionMock).toHaveBeenCalledWith({
      accessToken: 'token-a',
      refreshToken: 'refresh-a',
      userId: 'user-a',
    });
  });
});
