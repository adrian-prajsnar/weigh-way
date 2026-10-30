import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

const localUserState = vi.hoisted(() => ({
  getLatestAuthUserIdFromEvents: vi.fn(),
}));

const storageState = vi.hoisted(() => ({
  resetSignOutPersistWarning: vi.fn(),
  consumeSignOutPersistWarning: vi.fn(),
  forcePersistSignedOutStateForLastKnownSessionKey: vi.fn(),
  noteLocalSignOutPersistFailure: vi.fn().mockResolvedValue(undefined),
  armSignOutPersistWarning: vi.fn(),
  beginLocalClearForUser: vi.fn(),
  peekStoredPrimaryAuthSessionUserId: vi.fn(),
  removeItem: vi.fn(),
  getLastSeenPrimaryAuthSessionKey: vi.fn(),
  getItem: vi.fn(),
  hasPendingDiskPersistence: vi.fn(),
}));

const refreshState = vi.hoisted(() => ({
  refreshAccessTokenForSignOut: vi.fn(),
}));

vi.mock('./sign-out-local-user', () => ({
  getLatestAuthUserIdFromEvents: localUserState.getLatestAuthUserIdFromEvents,
  noteLatestAuthUserIdFromEvent: vi.fn(),
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
      signOut: authState.signOut,
    },
  },
}));

vi.mock('./auth-session-storage', () => ({
  getSupabaseAuthStorage: () => storageState,
}));

vi.mock('./sign-out-deadlines', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sign-out-deadlines')>();
  return {
    ...actual,
    SIGN_OUT_FLOW_CAP_MS: 500,
    SIGN_OUT_LOCAL_CLEAR_TIMEOUT_MS: 200,
    SIGN_OUT_SESSION_USER_CHECK_TIMEOUT_MS: 50,
  };
});

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
    authState.signOut.mockReset();
    refreshState.refreshAccessTokenForSignOut.mockReset();
    storageState.resetSignOutPersistWarning.mockReset();
    storageState.consumeSignOutPersistWarning.mockReset();
    storageState.removeItem.mockReset();
    storageState.getLastSeenPrimaryAuthSessionKey.mockReset();
    storageState.beginLocalClearForUser.mockReset();
    storageState.peekStoredPrimaryAuthSessionUserId.mockReset();
    storageState.noteLocalSignOutPersistFailure.mockReset();
    storageState.armSignOutPersistWarning.mockReset();
    storageState.getItem.mockReset();
    storageState.hasPendingDiskPersistence.mockReset();
    authState.signOut.mockResolvedValue({ error: null });
    refreshState.refreshAccessTokenForSignOut.mockRejectedValue(new Error('not used'));
    storageState.consumeSignOutPersistWarning.mockReturnValue(false);
    storageState.hasPendingDiskPersistence.mockReturnValue(false);
    storageState.getLastSeenPrimaryAuthSessionKey.mockReturnValue('sb-localhost-auth-token');
    storageState.removeItem.mockResolvedValue(undefined);
    storageState.peekStoredPrimaryAuthSessionUserId.mockResolvedValue(userA.id);
    localUserState.getLatestAuthUserIdFromEvents.mockReturnValue(userA.id);
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

  it('still clears locally when the same user has a refreshed access token on disk', async () => {
    storageState.peekStoredPrimaryAuthSessionUserId.mockResolvedValue(userA.id);
    localUserState.getLatestAuthUserIdFromEvents.mockReturnValue(userA.id);

    await signOutSession({ accessToken: 'token-a', userId: userA.id });

    expect(storageState.removeItem).toHaveBeenCalled();
    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('skips local sign-out when another user signed in during server revoke', async () => {
    storageState.peekStoredPrimaryAuthSessionUserId.mockResolvedValue(userB.id);
    localUserState.getLatestAuthUserIdFromEvents.mockReturnValue(userB.id);

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
    storageState.peekStoredPrimaryAuthSessionUserId.mockResolvedValue(userB.id);
    localUserState.getLatestAuthUserIdFromEvents.mockReturnValue(userB.id);

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
          setTimeout(() => resolve({ accessToken: 'token-a2', userId: userA.id }), 50);
        }),
    );
    storageState.peekStoredPrimaryAuthSessionUserId.mockResolvedValue(userB.id);
    localUserState.getLatestAuthUserIdFromEvents.mockReturnValue(userB.id);

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
    ).resolves.toEqual({ serverSignOutUnreachable: false, localClearIncomplete: false });

    expect(storageState.removeItem).toHaveBeenCalled();
  });

  it('clears locally when the retry logout still sees an expired token', async () => {
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

  it('still clears locally when refresh hits unreachable errors', async () => {
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

    await expect(
      signOutSession({
        accessToken: 'token-a',
        userId: userA.id,
        refreshToken: 'refresh-a',
      }),
    ).resolves.toEqual({ serverSignOutUnreachable: true, localClearIncomplete: false });

    expect(storageState.removeItem).toHaveBeenCalled();
  });

  it('notes local persist failure when auth local sign-out hangs until deadline', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    authState.signOut.mockImplementation(() => new Promise(() => {}));

    const signOutPromise = signOutSession({
      accessToken: 'token-a',
      userId: userA.id,
    });
    await vi.advanceTimersByTimeAsync(600);
    await expect(signOutPromise).resolves.toEqual({
      serverSignOutUnreachable: false,
      localClearIncomplete: true,
    });
    expect(storageState.armSignOutPersistWarning).toHaveBeenCalled();
    expect(storageState.noteLocalSignOutPersistFailure).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('reports localClearIncomplete when storage peek getItem hangs until the clear deadline', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    storageState.peekStoredPrimaryAuthSessionUserId.mockImplementation(
      () =>
        new Promise<string>(() => {
          /* hang */
        }),
    );
    storageState.removeItem.mockImplementation(() => new Promise(() => {}));
    localUserState.getLatestAuthUserIdFromEvents.mockReturnValue(userA.id);

    const signOutPromise = signOutSession({ accessToken: 'token-a', userId: userA.id });
    await vi.advanceTimersByTimeAsync(600);
    await expect(signOutPromise).resolves.toMatchObject({ localClearIncomplete: true });
    expect(storageState.armSignOutPersistWarning).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('reports localClearIncomplete when removeItem hangs until the clear deadline', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    storageState.removeItem.mockImplementation(() => new Promise(() => {}));
    localUserState.getLatestAuthUserIdFromEvents.mockReturnValue(userA.id);
    storageState.peekStoredPrimaryAuthSessionUserId.mockResolvedValue(userA.id);

    const signOutPromise = signOutSession({ accessToken: 'token-a', userId: userA.id });
    await vi.advanceTimersByTimeAsync(600);
    await expect(signOutPromise).resolves.toEqual({
      serverSignOutUnreachable: false,
      localClearIncomplete: true,
    });
    expect(storageState.armSignOutPersistWarning).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('arms persist warning before noteLocalSignOutPersistFailure can finish', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    storageState.removeItem.mockImplementation(() => new Promise(() => {}));
    let noteStarted = false;
    storageState.noteLocalSignOutPersistFailure.mockImplementation(() => {
      noteStarted = true;
      return new Promise(() => {});
    });
    storageState.armSignOutPersistWarning.mockImplementation(() => {
      expect(noteStarted).toBe(false);
    });

    const signOutPromise = signOutSession({ accessToken: 'token-a', userId: userA.id });
    await vi.advanceTimersByTimeAsync(600);
    await expect(signOutPromise).resolves.toMatchObject({ localClearIncomplete: true });
    vi.useRealTimers();
  });

  it('reports localClearIncomplete when removeItem leaves pending disk persistence', async () => {
    storageState.hasPendingDiskPersistence.mockReturnValue(true);

    await expect(
      signOutSession({
        accessToken: 'token-a',
        userId: userA.id,
      }),
    ).resolves.toMatchObject({ localClearIncomplete: true });

    expect(storageState.armSignOutPersistWarning).toHaveBeenCalled();
    expect(storageState.noteLocalSignOutPersistFailure).toHaveBeenCalled();
  });

  it('reports localClearIncomplete when removeItem throws a storage error', async () => {
    storageState.removeItem.mockRejectedValue(new DOMException('blocked', 'SecurityError'));

    await expect(signOutSession({ accessToken: 'token-a', userId: userA.id })).resolves.toMatchObject(
      { localClearIncomplete: true },
    );
    expect(storageState.armSignOutPersistWarning).toHaveBeenCalled();
  });

  it('settles within the cap when storage peek hangs and a second sign-out can run', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    storageState.peekStoredPrimaryAuthSessionUserId.mockImplementation(() => new Promise(() => {}));
    localUserState.getLatestAuthUserIdFromEvents.mockReturnValue(userA.id);

    const first = signOutSession({ accessToken: 'token-a', userId: userA.id });
    await vi.advanceTimersByTimeAsync(600);
    await expect(first).resolves.toEqual({
      serverSignOutUnreachable: false,
      localClearIncomplete: false,
    });
    expect(storageState.removeItem).toHaveBeenCalled();

    storageState.peekStoredPrimaryAuthSessionUserId.mockResolvedValue(userA.id);
    await signOutSession({ accessToken: 'token-a', userId: userA.id });
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does not run auth local signOut after the clear deadline when remove finishes late', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let releaseRemove!: () => void;
    const removeGate = new Promise<void>((resolve) => {
      releaseRemove = resolve;
    });
    storageState.removeItem.mockImplementation(
      async () =>
        new Promise<void>((resolve) => {
          removeGate.then(() => resolve());
        }),
    );
    localUserState.getLatestAuthUserIdFromEvents.mockReturnValue(userA.id);
    storageState.peekStoredPrimaryAuthSessionUserId.mockResolvedValue(userA.id);

    const signOutPromise = signOutSession({ accessToken: 'token-a', userId: userA.id });
    await vi.advanceTimersByTimeAsync(600);
    await expect(signOutPromise).resolves.toEqual({
      serverSignOutUnreachable: false,
      localClearIncomplete: true,
    });

    localUserState.getLatestAuthUserIdFromEvents.mockReturnValue(userB.id);
    storageState.peekStoredPrimaryAuthSessionUserId.mockResolvedValue(userB.id);
    releaseRemove();
    await vi.runAllTimersAsync();

    expect(authState.signOut).not.toHaveBeenCalled();
    expect(storageState.noteLocalSignOutPersistFailure).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
