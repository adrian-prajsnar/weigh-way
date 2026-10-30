import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  signOut: vi.fn(),
  getSession: vi.fn(),
}));

const localUserState = vi.hoisted(() => ({
  getLatestAuthUserIdFromEvents: vi.fn(),
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
      getSession: authState.getSession,
    },
  },
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

function mockSession(userId: string | null) {
  authState.getSession.mockResolvedValue({
    data: {
      session: userId ? { user: { id: userId }, access_token: 'current' } : null,
    },
  });
}

describe('signOutSession', () => {
  beforeEach(() => {
    mockLogoutSuccess();
    authState.signOut.mockReset();
    authState.getSession.mockReset();
    refreshState.refreshAccessTokenForSignOut.mockReset();
    authState.signOut.mockResolvedValue({ error: null });
    refreshState.refreshAccessTokenForSignOut.mockRejectedValue(new Error('not used'));
    localUserState.getLatestAuthUserIdFromEvents.mockReturnValue(userA.id);
    mockSession(userA.id);
  });

  it('sends exactly one server revoke (no second /logout from auth-js signOut)', async () => {
    await signOutSession({ accessToken: 'token-a', userId: userA.id });

    expect(fetch).toHaveBeenCalledTimes(1);
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
    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('skips local sign-out when another user signed in during server revoke', async () => {
    localUserState.getLatestAuthUserIdFromEvents.mockReturnValue(userB.id);
    mockSession(userB.id);

    await signOutSession({ accessToken: 'token-a', userId: userA.id });

    expect(authState.signOut).not.toHaveBeenCalled();
  });

  it('keeps the local session when revoke returns 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 429 })),
    );

    await expect(
      signOutSession({ accessToken: 'token-a', userId: userA.id }),
    ).rejects.toThrow('sign_out_rate_limited');

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

    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
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
    ).resolves.toEqual({ serverSignOutUnreachable: true });

    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
