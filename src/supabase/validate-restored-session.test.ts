import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  adminSignOut: vi.fn(),
  refreshSession: vi.fn(),
}));

const storageState = vi.hoisted(() => ({
  resetSignOutPersistWarning: vi.fn(),
  consumeSignOutPersistWarning: vi.fn(),
  removeItem: vi.fn().mockResolvedValue(undefined),
  getLastSeenPrimaryAuthSessionKey: vi.fn().mockReturnValue('sb-localhost-auth-token'),
}));

vi.mock('./client', () => ({
  supabase: {
    auth: {
      getUser: authState.getUser,
      getSession: authState.getSession,
      signOut: authState.signOut,
      refreshSession: authState.refreshSession,
      admin: {
        signOut: authState.adminSignOut,
      },
    },
  },
}));

vi.mock('./auth-session-storage', () => ({
  getSupabaseAuthStorage: () => storageState,
}));

/* eslint-disable import/first -- after vi.mock */
import { validateRestoredSessionInBackground } from './validate-restored-session';
/* eslint-enable import/first */

const sessionA = { access_token: 'token-a', user: { id: 'user-a' } };
const sessionB = { access_token: 'token-b', user: { id: 'user-b' } };

function mockSessionAtStartAndEnd(
  start: { access_token: string } | null,
  end: { access_token: string } | null,
) {
  authState.getSession
    .mockResolvedValueOnce({ data: { session: start } })
    .mockResolvedValueOnce({ data: { session: end } })
    .mockResolvedValue({ data: { session: end } });
}

describe('validateRestoredSessionInBackground', () => {
  beforeEach(() => {
    authState.getUser.mockReset();
    authState.getSession.mockReset();
    authState.signOut.mockReset();
    authState.adminSignOut.mockReset();
    authState.refreshSession.mockReset();
    storageState.resetSignOutPersistWarning.mockReset();
    storageState.consumeSignOutPersistWarning.mockReset();
    authState.signOut.mockResolvedValue({ error: null });
    authState.adminSignOut.mockResolvedValue({ error: null });
    authState.refreshSession.mockResolvedValue({ data: { session: sessionA }, error: null });
  });

  it('clears a session rejected with 401', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid', status: 401 },
    });

    await validateRestoredSessionInBackground();

    expect(storageState.resetSignOutPersistWarning).toHaveBeenCalled();
    expect(authState.adminSignOut).toHaveBeenCalledWith('token-a', 'global');
    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('clears a session rejected with 403', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'forbidden', status: 403 },
    });

    await validateRestoredSessionInBackground();

    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('clears a session rejected with bad_jwt', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'jwt', status: 400, code: 'bad_jwt' },
    });

    await validateRestoredSessionInBackground();

    expect(authState.refreshSession).not.toHaveBeenCalled();
    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('refreshes once on expired bad_jwt and keeps the session when refresh succeeds', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'token is expired',
        status: 401,
        code: 'bad_jwt',
      },
    });
    authState.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'token-a-refreshed' } },
      error: null,
    });

    await validateRestoredSessionInBackground();

    expect(authState.refreshSession).toHaveBeenCalledTimes(1);
    expect(authState.signOut).not.toHaveBeenCalled();
  });

  it.each([
    'refresh_token_not_found',
    'refresh_token_already_used',
    'session_expired',
  ])('clears the session when refresh after expired jwt returns %s', async (code) => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'token is expired',
        status: 401,
        code: 'bad_jwt',
      },
    });
    authState.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'rejected', status: 401, code },
    });

    await validateRestoredSessionInBackground();

    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('clears the session when refresh returns AuthSessionMissingError', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'token is expired',
        status: 401,
        code: 'bad_jwt',
      },
    });
    authState.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'missing', name: 'AuthSessionMissingError' },
    });

    await validateRestoredSessionInBackground();

    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('clears the session when refresh after expired jwt returns 400 refresh_token_not_found', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'token is expired',
        status: 401,
        code: 'bad_jwt',
      },
    });
    authState.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'not found', status: 400, code: 'refresh_token_not_found' },
    });

    await validateRestoredSessionInBackground();

    expect(authState.adminSignOut).toHaveBeenCalledTimes(1);
    expect(authState.signOut).toHaveBeenCalledTimes(1);
    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('runs at most one local sign-out when validation is invoked concurrently', async () => {
    authState.getSession.mockResolvedValue({ data: { session: sessionA } });
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'token is expired',
        status: 401,
        code: 'bad_jwt',
      },
    });
    authState.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'not found', status: 400, code: 'refresh_token_not_found' },
    });

    await Promise.all([
      validateRestoredSessionInBackground(),
      validateRestoredSessionInBackground(),
    ]);

    expect(authState.adminSignOut).toHaveBeenCalledTimes(1);
    expect(authState.signOut).toHaveBeenCalledTimes(1);
  });

  it('signs out when expired bad_jwt refresh is clearly rejected', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'token is expired',
        status: 401,
        code: 'bad_jwt',
      },
    });
    authState.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'invalid', status: 401, code: 'session_not_found' },
    });

    await validateRestoredSessionInBackground();

    expect(authState.refreshSession).toHaveBeenCalledTimes(1);
    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('keeps the session when expired bad_jwt refresh hits a transient error', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'token is expired',
        status: 401,
        code: 'bad_jwt',
      },
    });
    authState.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'rate limited', status: 429 },
    });

    await validateRestoredSessionInBackground();

    expect(authState.refreshSession).toHaveBeenCalledTimes(1);
    expect(authState.signOut).not.toHaveBeenCalled();
  });

  it.each([500, 503, 429])('keeps the session when getUser returns %s', async (status) => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'unavailable',
        status,
        name: status >= 500 || status === 0 ? 'AuthRetryableFetchError' : undefined,
      },
    });

    await validateRestoredSessionInBackground();

    expect(authState.signOut).not.toHaveBeenCalled();
  });

  it('keeps the session on AuthRetryableFetchError with status 0', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'fetch failed', status: 0, name: 'AuthRetryableFetchError' },
    });

    await validateRestoredSessionInBackground();

    expect(authState.signOut).not.toHaveBeenCalled();
  });

  it('does not sign out when offline', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Network request failed' },
    });

    await validateRestoredSessionInBackground();

    expect(authState.signOut).not.toHaveBeenCalled();
  });

  it('does not clear a newer session when a stale getUser rejection arrives', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionB);
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid', status: 401 },
    });

    await validateRestoredSessionInBackground();

    expect(authState.signOut).not.toHaveBeenCalled();
  });
});
