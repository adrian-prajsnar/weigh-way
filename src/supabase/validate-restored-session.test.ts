import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
}));

const storageState = vi.hoisted(() => ({
  resetSignOutPersistWarning: vi.fn(),
  consumeSignOutPersistWarning: vi.fn(),
}));

vi.mock('./client', () => ({
  supabase: {
    auth: {
      getUser: authState.getUser,
      signOut: authState.signOut,
    },
  },
}));

vi.mock('./auth-session-storage', () => ({
  getSupabaseAuthStorage: () => storageState,
}));

/* eslint-disable import/first -- after vi.mock */
import { validateRestoredSessionInBackground } from './validate-restored-session';
/* eslint-enable import/first */

describe('validateRestoredSessionInBackground', () => {
  beforeEach(() => {
    authState.getUser.mockReset();
    authState.signOut.mockReset();
    storageState.resetSignOutPersistWarning.mockReset();
    storageState.consumeSignOutPersistWarning.mockReset();
    authState.signOut.mockResolvedValue({ error: null });
  });

  it('clears a rejected session', async () => {
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid', status: 401 },
    });

    await validateRestoredSessionInBackground();

    expect(storageState.resetSignOutPersistWarning).toHaveBeenCalled();
    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('does not sign out when offline', async () => {
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Network request failed' },
    });

    await validateRestoredSessionInBackground();

    expect(authState.signOut).not.toHaveBeenCalled();
  });
});
