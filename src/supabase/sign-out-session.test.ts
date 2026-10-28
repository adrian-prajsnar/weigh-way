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

describe('signOutSession', () => {
  beforeEach(() => {
    authState.getSession.mockReset();
    authState.signOut.mockReset();
    authState.adminSignOut.mockReset();
    storageState.resetSignOutPersistWarning.mockReset();
    storageState.consumeSignOutPersistWarning.mockReset();
    storageState.removeItem.mockReset();
    storageState.getLastSeenPrimaryAuthSessionKey.mockReset();
    authState.signOut.mockResolvedValue({ error: null });
    authState.adminSignOut.mockResolvedValue({ error: null });
    storageState.consumeSignOutPersistWarning.mockReturnValue(false);
    storageState.getLastSeenPrimaryAuthSessionKey.mockReturnValue('sb-localhost-auth-token');
    storageState.removeItem.mockResolvedValue(undefined);
    authState.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-a' } },
    });
  });

  it('revokes on the server before local sign-out when a token is provided', async () => {
    await signOutSession({ accessToken: 'token-a' });

    expect(authState.adminSignOut).toHaveBeenCalledTimes(1);
    expect(authState.adminSignOut).toHaveBeenCalledWith('token-a', 'global');
    expect(storageState.removeItem).toHaveBeenCalledWith('sb-localhost-auth-token');
    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('sends exactly one server revoke (no second /logout from auth-js signOut)', async () => {
    await signOutSession({ accessToken: 'token-a' });

    expect(authState.adminSignOut).toHaveBeenCalledTimes(1);
  });

  it('does not consume the storage persist warning (caller reads it after sign-out)', async () => {
    await signOutSession({ accessToken: 'token-a' });

    expect(storageState.consumeSignOutPersistWarning).not.toHaveBeenCalled();
  });

  it('skips local sign-out when another user signed in during server revoke', async () => {
    authState.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-b' } },
    });

    await signOutSession({ accessToken: 'token-a' });

    expect(authState.adminSignOut).toHaveBeenCalledWith('token-a', 'global');
    expect(storageState.removeItem).not.toHaveBeenCalled();
    expect(authState.signOut).not.toHaveBeenCalled();
  });

  it('runs at most one sign-out when invoked concurrently', async () => {
    let resolveAdmin: () => void = () => {};
    authState.adminSignOut.mockImplementation(
      () =>
        new Promise<{ error: null }>((resolve) => {
          resolveAdmin = () => resolve({ error: null });
        }),
    );

    const first = signOutSession({ accessToken: 'token-a' });
    const second = signOutSession({ accessToken: 'token-a' });
    resolveAdmin();
    await Promise.all([first, second]);

    expect(authState.adminSignOut).toHaveBeenCalledTimes(1);
  });
});
