import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
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
      getSession: authState.getSession,
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

const sessionA = { access_token: 'token-a' };
const sessionB = { access_token: 'token-b' };

function mockSessionAtStartAndEnd(
  start: { access_token: string } | null,
  end: { access_token: string } | null,
) {
  authState.getSession
    .mockResolvedValueOnce({ data: { session: start } })
    .mockResolvedValueOnce({ data: { session: end } });
}

describe('validateRestoredSessionInBackground', () => {
  beforeEach(() => {
    authState.getUser.mockReset();
    authState.getSession.mockReset();
    authState.signOut.mockReset();
    storageState.resetSignOutPersistWarning.mockReset();
    storageState.consumeSignOutPersistWarning.mockReset();
    authState.signOut.mockResolvedValue({ error: null });
  });

  it('clears a session rejected with 401', async () => {
    mockSessionAtStartAndEnd(sessionA, sessionA);
    authState.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid', status: 401 },
    });

    await validateRestoredSessionInBackground();

    expect(storageState.resetSignOutPersistWarning).toHaveBeenCalled();
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

    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
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
