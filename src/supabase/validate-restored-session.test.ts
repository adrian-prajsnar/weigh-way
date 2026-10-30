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
const sessionB = {
  access_token: 'token-b',
  refresh_token: 'refresh-b',
  user: { id: 'user-b' },
};

function mockSessionAtStartAndEnd(
  start: typeof sessionA | null,
  end: typeof sessionA | null,
) {
  authState.getSession
    .mockResolvedValueOnce({ data: { session: start } })
    .mockResolvedValueOnce({ data: { session: end } })
    .mockResolvedValue({ data: { session: end } });
}

describe('validateRestoredSessionInBackground', () => {
  beforeEach(() => {
    fetchUserState.fetchAuthUserForAccessToken.mockReset();
    authState.getSession.mockReset();
    signOutSessionMock.mockReset();
    signOutSessionMock.mockResolvedValue({ serverSignOutUnreachable: false });
  });

  it('clears a session rejected with 401', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 401,
      message: 'invalid',
    });

    await validateRestoredSessionInBackground();

    expect(fetchUserState.fetchAuthUserForAccessToken).toHaveBeenCalledWith('token-a');
    expect(signOutSessionMock).toHaveBeenCalledWith({
      accessToken: 'token-a',
      refreshToken: 'refresh-a',
      userId: 'user-a',
    });
  });

  it('clears a session rejected with 403', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 403,
      message: 'forbidden',
    });

    await validateRestoredSessionInBackground();

    expect(signOutSessionMock).toHaveBeenCalled();
  });

  it('clears a session rejected with bad_jwt including expired tokens', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'bad_jwt',
      message: 'token is expired',
    });

    await validateRestoredSessionInBackground();

    expect(signOutSessionMock).toHaveBeenCalled();
  });

  it('runs at most one sign-out when validation is invoked concurrently', async () => {
    authState.getSession.mockResolvedValue({ data: { session: sessionA } });
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'bad_jwt',
      message: 'token is expired',
    });

    await Promise.all([
      validateRestoredSessionInBackground(),
      validateRestoredSessionInBackground(),
    ]);

    expect(signOutSessionMock).toHaveBeenCalledTimes(1);
  });

  it.each([500, 503, 429])('keeps the session when user fetch returns %s', async (status) => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status,
      message: 'unavailable',
    });

    await validateRestoredSessionInBackground();

    expect(signOutSessionMock).not.toHaveBeenCalled();
  });

  it('keeps the session when user fetch is unreachable', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 0,
      unreachable: true,
    });

    await validateRestoredSessionInBackground();

    expect(signOutSessionMock).not.toHaveBeenCalled();
  });

  it('does not clear a newer session when a stale rejection arrives for token A', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionB);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 403,
      code: 'session_not_found',
      message: 'not found',
    });

    await validateRestoredSessionInBackground();

    expect(fetchUserState.fetchAuthUserForAccessToken).toHaveBeenCalledWith('token-a');
    expect(signOutSessionMock).not.toHaveBeenCalled();
  });
});
