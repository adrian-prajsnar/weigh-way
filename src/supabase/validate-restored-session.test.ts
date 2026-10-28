import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

const fetchUserState = vi.hoisted(() => ({
  fetchAuthUserForAccessToken: vi.fn(),
}));

const storageState = vi.hoisted(() => ({
  resetSignOutPersistWarning: vi.fn(),
  consumeSignOutPersistWarning: vi.fn(),
}));

const signOutSessionMock = vi.hoisted(() => vi.fn());

vi.mock('./fetch-auth-user', () => ({
  fetchAuthUserForAccessToken: fetchUserState.fetchAuthUserForAccessToken,
}));

vi.mock('./sign-out-session', () => ({
  signOutSession: signOutSessionMock,
}));

vi.mock('./auth-session-storage', () => ({
  getSupabaseAuthStorage: () => storageState,
}));

vi.mock('./client', () => ({
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
    authState.refreshSession.mockReset();
    signOutSessionMock.mockReset();
    storageState.resetSignOutPersistWarning.mockReset();
    storageState.consumeSignOutPersistWarning.mockReset();
    signOutSessionMock.mockResolvedValue({ serverSignOutUnreachable: false });
    authState.refreshSession.mockResolvedValue({ data: { session: sessionA }, error: null });
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

  it('clears a session rejected with bad_jwt', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 400,
      code: 'bad_jwt',
      message: 'jwt',
    });

    await validateRestoredSessionInBackground();

    expect(authState.refreshSession).not.toHaveBeenCalled();
    expect(signOutSessionMock).toHaveBeenCalled();
  });

  it('refreshes once on expired bad_jwt and keeps the session when refresh succeeds', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'bad_jwt',
      message: 'token is expired',
    });
    authState.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'token-a-refreshed' } },
      error: null,
    });

    await validateRestoredSessionInBackground();

    expect(authState.refreshSession).toHaveBeenCalledTimes(1);
    expect(signOutSessionMock).not.toHaveBeenCalled();
  });

  it.each([
    'refresh_token_not_found',
    'refresh_token_already_used',
    'session_expired',
  ])('clears the session when refresh after expired jwt returns %s', async (code) => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'bad_jwt',
      message: 'token is expired',
    });
    authState.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'rejected', status: 401, code },
    });

    await validateRestoredSessionInBackground();

    expect(signOutSessionMock).toHaveBeenCalled();
  });

  it('clears the session when refresh returns AuthSessionMissingError', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'bad_jwt',
      message: 'token is expired',
    });
    authState.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'missing', name: 'AuthSessionMissingError' },
    });

    await validateRestoredSessionInBackground();

    expect(signOutSessionMock).toHaveBeenCalled();
  });

  it('clears the session when refresh after expired jwt returns 400 refresh_token_not_found', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'bad_jwt',
      message: 'token is expired',
    });
    authState.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'not found', status: 400, code: 'refresh_token_not_found' },
    });

    await validateRestoredSessionInBackground();

    expect(signOutSessionMock).toHaveBeenCalledTimes(1);
  });

  it('runs at most one sign-out when validation is invoked concurrently', async () => {
    authState.getSession.mockResolvedValue({ data: { session: sessionA } });
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'bad_jwt',
      message: 'token is expired',
    });
    authState.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'not found', status: 400, code: 'refresh_token_not_found' },
    });

    await Promise.all([
      validateRestoredSessionInBackground(),
      validateRestoredSessionInBackground(),
    ]);

    expect(signOutSessionMock).toHaveBeenCalledTimes(1);
  });

  it('signs out when expired bad_jwt refresh is clearly rejected', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'bad_jwt',
      message: 'token is expired',
    });
    authState.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'invalid', status: 401, code: 'session_not_found' },
    });

    await validateRestoredSessionInBackground();

    expect(authState.refreshSession).toHaveBeenCalledTimes(1);
    expect(signOutSessionMock).toHaveBeenCalled();
  });

  it('keeps the session when expired bad_jwt refresh hits a transient error', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'bad_jwt',
      message: 'token is expired',
    });
    authState.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'rate limited', status: 429 },
    });

    await validateRestoredSessionInBackground();

    expect(authState.refreshSession).toHaveBeenCalledTimes(1);
    expect(signOutSessionMock).not.toHaveBeenCalled();
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

  it('keeps the session on AuthRetryableFetchError with status 0', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 0,
      unreachable: true,
    });

    await validateRestoredSessionInBackground();

    expect(signOutSessionMock).not.toHaveBeenCalled();
  });

  it('does not sign out when offline', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    fetchUserState.fetchAuthUserForAccessToken.mockResolvedValue({
      ok: false,
      status: 0,
      message: 'unreachable',
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
