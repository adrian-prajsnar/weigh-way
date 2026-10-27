import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  signOut: vi.fn(),
  adminSignOut: vi.fn(),
}));

const storageState = vi.hoisted(() => ({
  resetSignOutPersistWarning: vi.fn(),
  consumeSignOutPersistWarning: vi.fn(),
  forcePersistSignedOutStateForLastKnownSessionKey: vi.fn(),
}));

vi.mock('./client', () => ({
  supabase: {
    auth: {
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
    authState.signOut.mockReset();
    authState.adminSignOut.mockReset();
    storageState.resetSignOutPersistWarning.mockReset();
    storageState.consumeSignOutPersistWarning.mockReset();
    authState.signOut.mockResolvedValue({ error: null });
    authState.adminSignOut.mockResolvedValue({ error: null });
    storageState.consumeSignOutPersistWarning.mockReturnValue(false);
  });

  it('revokes on the server before local sign-out when a token is provided', async () => {
    await signOutSession({ accessToken: 'token-a' });

    expect(authState.adminSignOut).toHaveBeenCalledWith('token-a', 'global');
    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('still revokes on the server when local auth-js has no session in storage', async () => {
    authState.signOut.mockResolvedValue({ error: null });

    await signOutSession({ accessToken: 'token-a' });

    expect(authState.adminSignOut).toHaveBeenCalledTimes(1);
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
