import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

const storageState = vi.hoisted(() => ({
  resetSignOutPersistWarning: vi.fn(),
  consumeSignOutPersistWarning: vi.fn(),
  forcePersistSignedOutStateForLastKnownSessionKey: vi.fn(),
  noteLocalSignOutPersistFailure: vi.fn().mockResolvedValue(undefined),
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
  supabaseAuthHttpConfig: {
    url: 'https://example.supabase.co',
    anonKey: 'public-anon-key',
  },
  supabase: {
    auth: {
      getSession: authState.getSession,
      signOut: authState.signOut,
    },
  },
}));

vi.mock('./auth-session-storage', () => ({
  getSupabaseAuthStorage: () => storageState,
}));

/* eslint-disable import/first -- after vi.mock */
import { SignOutDeadlineError } from './sign-out-deadlines';
import { signOutSession } from './sign-out-session';
/* eslint-enable import/first */

const userA = { id: 'user-a' };
const userB = { id: 'user-b' };

function mockLogoutSuccess() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/logout')) {
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }),
  );
}

describe('signOutSession', () => {
  beforeEach(() => {
    mockLogoutSuccess();
    authState.getSession.mockReset();
    authState.signOut.mockReset();
    refreshState.refreshAccessTokenForSignOut.mockReset();
    storageState.resetSignOutPersistWarning.mockReset();
    storageState.consumeSignOutPersistWarning.mockReset();
    storageState.removeItem.mockReset();
    storageState.getLastSeenPrimaryAuthSessionKey.mockReset();
    authState.signOut.mockResolvedValue({ error: null });
    refreshState.refreshAccessTokenForSignOut.mockRejectedValue(new Error('not used'));
    storageState.consumeSignOutPersistWarning.mockReturnValue(false);
    storageState.getLastSeenPrimaryAuthSessionKey.mockReturnValue('sb-localhost-auth-token');
    storageState.removeItem.mockResolvedValue(undefined);
    storageState.noteLocalSignOutPersistFailure.mockReset();
    authState.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-a', user: userA } },
    });
  });

  it('sends exactly one server revoke (no second /logout from auth-js signOut)', async () => {
    await signOutSession({ accessToken: 'token-a', userId: userA.id });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not consume the storage persist warning (caller reads it after sign-out)', async () => {
    await signOutSession({ accessToken: 'token-a', userId: userA.id });

    expect(storageState.consumeSignOutPersistWarning).not.toHaveBeenCalled();
  });

  it('runs at most one sign-out when invoked concurrently', async () => {
    let resolveLogout: () => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveLogout = () => resolve(new Response(null, { status: 204 }));
          }),
      ),
    );

    const first = signOutSession({ accessToken: 'token-a', userId: userA.id });
    const second = signOutSession({ accessToken: 'token-a', userId: userA.id });
    resolveLogout();
    await Promise.all([first, second]);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('revokes on the server before local sign-out when a token is provided', async () => {
    await signOutSession({ accessToken: 'token-a', userId: userA.id });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/logout?scope=global'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(storageState.removeItem).toHaveBeenCalledWith('sb-localhost-auth-token');
    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('skips local sign-out when another user signed in during server revoke', async () => {
    authState.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-b', user: userB } },
    });

    await signOutSession({ accessToken: 'token-a', userId: userA.id });

    expect(storageState.removeItem).not.toHaveBeenCalled();
    expect(authState.signOut).not.toHaveBeenCalled();
  });

  it('skips local sign-out when user B signed in during a hung refresh', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          return new Response(JSON.stringify({ code: 'bad_jwt', message: 'token is expired' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );
    refreshState.refreshAccessTokenForSignOut.mockRejectedValue(new SignOutDeadlineError());
    authState.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-b', user: userB } },
    });

    const result = await signOutSession({
      accessToken: 'token-a',
      userId: userA.id,
      refreshToken: 'refresh-a',
    });

    expect(result.serverSignOutUnreachable).toBe(true);
    expect(storageState.removeItem).not.toHaveBeenCalled();
  });

  it('skips local sign-out when user B signed in during a slow refresh', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          return new Response(JSON.stringify({ code: 'bad_jwt', message: 'token is expired' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );
    refreshState.refreshAccessTokenForSignOut.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ accessToken: 'token-a2', userId: userA.id }),
            50,
          );
        }),
    );
    authState.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-b', user: userB } },
    });

    await signOutSession({
      accessToken: 'token-a',
      userId: userA.id,
      refreshToken: 'refresh-a',
    });

    expect(storageState.removeItem).not.toHaveBeenCalled();
  });

  it('keeps the local session when revoke returns 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 429 })),
    );

    await expect(
      signOutSession({ accessToken: 'token-a', userId: userA.id }),
    ).rejects.toThrow('sign_out_rate_limited');

    expect(storageState.removeItem).not.toHaveBeenCalled();
    expect(authState.signOut).not.toHaveBeenCalled();
  });

  it('refreshes and retries global revoke once when the captured token is expired on logout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          const auth = new Headers(init?.headers).get('Authorization');
          if (auth === 'Bearer token-a') {
            return new Response(JSON.stringify({ code: 'bad_jwt', message: 'token is expired' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );
    refreshState.refreshAccessTokenForSignOut.mockResolvedValue({
      accessToken: 'token-a2',
      userId: userA.id,
    });

    await signOutSession({ accessToken: 'token-a', userId: userA.id, refreshToken: 'refresh-a' });

    expect(refreshState.refreshAccessTokenForSignOut).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('clears locally when refresh returns refresh_token_not_found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          return new Response(JSON.stringify({ code: 'bad_jwt', message: 'token is expired' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );
    refreshState.refreshAccessTokenForSignOut.mockRejectedValue({
      status: 400,
      error_code: 'refresh_token_not_found',
      msg: 'Invalid Refresh Token: Refresh Token Not Found',
    });

    await expect(
      signOutSession({
        accessToken: 'token-a',
        userId: userA.id,
        refreshToken: 'refresh-a',
      }),
    ).resolves.toEqual({ serverSignOutUnreachable: false });

    expect(storageState.removeItem).toHaveBeenCalled();
  });

  it('notes local persist failure when auth local sign-out hangs until deadline', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    authState.signOut.mockImplementation(() => new Promise(() => {}));

    const signOutPromise = signOutSession({
      accessToken: 'token-a',
      userId: userA.id,
    });
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(signOutPromise).resolves.toEqual({ serverSignOutUnreachable: false });
    expect(storageState.noteLocalSignOutPersistFailure).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not clear user B when removeItem finishes after the flow cap', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolveRemove: (() => void) | undefined;
    storageState.removeItem.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRemove = resolve;
        }),
    );
    authState.getSession
      .mockResolvedValueOnce({
        data: { session: { access_token: 'token-a', user: userA } },
      })
      .mockResolvedValueOnce({
        data: { session: { access_token: 'token-a', user: userA } },
      })
      .mockResolvedValue({
        data: { session: { access_token: 'token-b', user: userB } },
      });

    const signOutPromise = signOutSession({ accessToken: 'token-a', userId: userA.id });
    await vi.advanceTimersByTimeAsync(16_000);
    await signOutPromise;
    resolveRemove?.();
    await Promise.resolve();

    expect(authState.signOut).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('skips local clear when the session user check hits its deadline', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    authState.getSession.mockImplementation(() => new Promise(() => {}));

    const signOutPromise = signOutSession({ accessToken: 'token-a', userId: userA.id });
    await vi.advanceTimersByTimeAsync(20_000);
    await signOutPromise;

    expect(storageState.removeItem).not.toHaveBeenCalled();
    expect(authState.signOut).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
