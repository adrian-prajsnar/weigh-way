import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  adminSignOut: vi.fn(),
}));

const storageState = vi.hoisted(() => ({
  resetSignOutPersistWarning: vi.fn(),
  consumeSignOutPersistWarning: vi.fn(),
  forcePersistSignedOutStateForLastKnownSessionKey: vi.fn(),
  removeItem: vi.fn(),
  getLastSeenPrimaryAuthSessionKey: vi.fn(),
}));

const refreshState = vi.hoisted(() => ({
  refreshAccessTokenForSignOut: vi.fn(),
}));

vi.mock('./sign-out-token-refresh', () => ({
  refreshAccessTokenForSignOut: refreshState.refreshAccessTokenForSignOut,
}));

vi.mock('./client', () => ({
  supabase: {
    auth: {
      getSession: authState.getSession,
      signOut: authState.signOut,
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
import { signOutSession } from './sign-out-session';
/* eslint-enable import/first */

const userA = { id: 'user-a' };
const userB = { id: 'user-b' };

describe('signOutSession', () => {
  beforeEach(() => {
    authState.getSession.mockReset();
    authState.signOut.mockReset();
    authState.adminSignOut.mockReset();
    refreshState.refreshAccessTokenForSignOut.mockReset();
    storageState.resetSignOutPersistWarning.mockReset();
    storageState.consumeSignOutPersistWarning.mockReset();
    storageState.removeItem.mockReset();
    storageState.getLastSeenPrimaryAuthSessionKey.mockReset();
    authState.signOut.mockResolvedValue({ error: null });
    authState.adminSignOut.mockResolvedValue({ error: null });
    refreshState.refreshAccessTokenForSignOut.mockRejectedValue(new Error('not used'));
    storageState.consumeSignOutPersistWarning.mockReturnValue(false);
    storageState.getLastSeenPrimaryAuthSessionKey.mockReturnValue('sb-localhost-auth-token');
    storageState.removeItem.mockResolvedValue(undefined);
    authState.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-a', user: userA } },
    });
  });

  it('revokes on the server before local sign-out when a token is provided', async () => {
    await signOutSession({ accessToken: 'token-a', userId: userA.id });

    expect(authState.adminSignOut).toHaveBeenCalledTimes(1);
    expect(authState.adminSignOut).toHaveBeenCalledWith('token-a', 'global');
    expect(storageState.removeItem).toHaveBeenCalledWith('sb-localhost-auth-token');
    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('sends exactly one server revoke (no second /logout from auth-js signOut)', async () => {
    await signOutSession({ accessToken: 'token-a', userId: userA.id });

    expect(authState.adminSignOut).toHaveBeenCalledTimes(1);
  });

  it('does not consume the storage persist warning (caller reads it after sign-out)', async () => {
    await signOutSession({ accessToken: 'token-a', userId: userA.id });

    expect(storageState.consumeSignOutPersistWarning).not.toHaveBeenCalled();
  });

  it('still clears locally when the same user has a refreshed access token', async () => {
    authState.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-a2', user: userA } },
    });

    await signOutSession({ accessToken: 'token-a', userId: userA.id });

    expect(storageState.removeItem).toHaveBeenCalled();
    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('skips local sign-out when another user signed in during server revoke', async () => {
    authState.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-b', user: userB } },
    });

    await signOutSession({ accessToken: 'token-a', userId: userA.id });

    expect(authState.adminSignOut).toHaveBeenCalledWith('token-a', 'global');
    expect(storageState.removeItem).not.toHaveBeenCalled();
    expect(authState.signOut).not.toHaveBeenCalled();
  });

  it('refreshes and retries global revoke once when the captured token is expired on logout', async () => {
    authState.adminSignOut
      .mockResolvedValueOnce({
        error: { status: 401, code: 'bad_jwt', message: 'token is expired' },
      })
      .mockResolvedValueOnce({ error: null });
    refreshState.refreshAccessTokenForSignOut.mockResolvedValue({
      accessToken: 'token-a2',
      userId: userA.id,
    });

    await signOutSession({ accessToken: 'token-a', userId: userA.id, refreshToken: 'refresh-a' });

    expect(refreshState.refreshAccessTokenForSignOut).toHaveBeenCalledWith('refresh-a');
    expect(authState.adminSignOut).toHaveBeenCalledTimes(2);
    expect(authState.adminSignOut).toHaveBeenLastCalledWith('token-a2', 'global');
  });

  it('still clears locally when refresh returns invalid_grant', async () => {
    authState.adminSignOut.mockResolvedValueOnce({
      error: { status: 401, code: 'bad_jwt', message: 'token is expired' },
    });
    refreshState.refreshAccessTokenForSignOut.mockRejectedValue({
      status: 400,
      code: 'invalid_grant',
      message: 'invalid',
    });

    await expect(
      signOutSession({ accessToken: 'token-a', userId: userA.id, refreshToken: 'refresh-a' }),
    ).resolves.toEqual({ serverSignOutUnreachable: false });

    expect(storageState.removeItem).toHaveBeenCalled();
  });

  it('clears locally when the retry logout still sees an expired token', async () => {
    authState.adminSignOut.mockResolvedValue({
      error: { status: 401, code: 'bad_jwt', message: 'token is expired' },
    });
    refreshState.refreshAccessTokenForSignOut.mockResolvedValue({
      accessToken: 'token-a2',
      userId: userA.id,
    });

    const result = await signOutSession({
      accessToken: 'token-a',
      userId: userA.id,
      refreshToken: 'refresh-a',
    });

    expect(result.serverSignOutUnreachable).toBe(true);
    expect(storageState.removeItem).toHaveBeenCalled();
  });

  it('runs at most one sign-out when invoked concurrently', async () => {
    let resolveAdmin: () => void = () => {};
    authState.adminSignOut.mockImplementation(
      () =>
        new Promise<{ error: null }>((resolve) => {
          resolveAdmin = () => resolve({ error: null });
        }),
    );

    const first = signOutSession({ accessToken: 'token-a', userId: userA.id });
    const second = signOutSession({ accessToken: 'token-a', userId: userA.id });
    resolveAdmin();
    await Promise.all([first, second]);

    expect(authState.adminSignOut).toHaveBeenCalledTimes(1);
  });
});
