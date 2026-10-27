import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

const storageState = vi.hoisted(() => ({
  resetSignOutPersistWarning: vi.fn(),
  consumeSignOutPersistWarning: vi.fn(),
  forcePersistSignedOutStateForLastKnownSessionKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./client', () => ({
  supabase: {
    auth: {
      signOut: authState.signOut,
    },
  },
}));

vi.mock('./auth-session-storage', () => ({
  getSupabaseAuthStorage: () => storageState,
}));

/* eslint-disable import/first -- after vi.mock */
import { beginLocalAuthSignOutBestEffort, signOutLocallyOnce } from './local-auth-sign-out';
/* eslint-enable import/first */

describe('local auth sign-out guard', () => {
  beforeEach(() => {
    authState.signOut.mockReset();
    authState.signOut.mockResolvedValue({ error: null });
    storageState.resetSignOutPersistWarning.mockReset();
    storageState.consumeSignOutPersistWarning.mockReset();
  });

  it('allows only one best-effort local sign-out at a time', () => {
    beginLocalAuthSignOutBestEffort();
    beginLocalAuthSignOutBestEffort();
    expect(authState.signOut).toHaveBeenCalledTimes(1);
  });

  it('skips awaitable sign-out when a best-effort sign-out is in flight', async () => {
    authState.signOut.mockImplementation(() => new Promise(() => {}));
    beginLocalAuthSignOutBestEffort();
    await signOutLocallyOnce();
    expect(authState.signOut).toHaveBeenCalledTimes(1);
  });
});
