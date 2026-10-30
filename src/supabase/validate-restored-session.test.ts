import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

const fetchUserState = vi.hoisted(() => ({
  fetchAuthUserForAccessToken: vi.fn(),
}));

const signOutSessionMock = vi.hoisted(() => vi.fn());

vi.mock('./fetch-auth-user', () => ({
  fetchAuthUserForAccessToken: fetchUserState.fetchAuthUserForAccessToken,
}));

vi.mock('./sign-out-session', () => ({
  signOutSession: signOutSessionMock,
}));

vi.mock('./client', () => ({
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

describe('validateRestoredSessionInBackground', () => {
  beforeEach(() => {
    fetchUserState.fetchAuthUserForAccessToken.mockReset();
    authState.getSession.mockReset();
    signOutSessionMock.mockReset();
    signOutSessionMock.mockResolvedValue({ serverSignOutUnreachable: false });
  });

  it('clears a session rejected with 401', async () => {
    authState.getSession.mockResolvedValue({ data: { session: sessionA } });
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 401,
      message: 'invalid',
    });

    await validateRestoredSessionInBackground();

    expect(signOutSessionMock).toHaveBeenCalledWith({
      accessToken: 'token-a',
      refreshToken: 'refresh-a',
      userId: 'user-a',
    });
  });

  it('clears a session rejected with bad_jwt including expired tokens', async () => {
    authState.getSession.mockResolvedValue({ data: { session: sessionA } });
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'bad_jwt',
      message: 'token is expired',
    });

    await validateRestoredSessionInBackground();

    expect(signOutSessionMock).toHaveBeenCalled();
  });

  it.each([500, 503, 429])('keeps the session when user fetch returns %s', async (status) => {
    authState.getSession.mockResolvedValue({ data: { session: sessionA } });
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status,
      message: 'unavailable',
    });

    await validateRestoredSessionInBackground();

    expect(signOutSessionMock).not.toHaveBeenCalled();
  });

  it('keeps the session when user fetch is unreachable', async () => {
    authState.getSession.mockResolvedValue({ data: { session: sessionA } });
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 0,
      unreachable: true,
    });

    await validateRestoredSessionInBackground();

    expect(signOutSessionMock).not.toHaveBeenCalled();
  });
});
