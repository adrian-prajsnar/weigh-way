import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  signOut: vi.fn(),
  getSession: vi.fn(),
}));

const refreshState = vi.hoisted(() => ({
  refreshAccessTokenForSignOut: vi.fn(),
}));

vi.mock('./sign-out-token-refresh', () => ({
  refreshAccessTokenForSignOut: refreshState.refreshAccessTokenForSignOut,
}));

vi.mock('./auth-storage-key', () => ({
  clearPersistedAuthSession: vi.fn().mockResolvedValue(undefined),
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
import { signOutSession } from './sign-out-session';
/* eslint-enable import/first */

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
    authState.getSession.mockReset();
    refreshState.refreshAccessTokenForSignOut.mockReset();
    authState.signOut.mockResolvedValue({ error: null });
    authState.getSession.mockResolvedValue({ data: { session: null } });
    refreshState.refreshAccessTokenForSignOut.mockRejectedValue(new Error('not used'));
  });

  it('sends exactly one server revoke (no second /logout from auth-js signOut)', async () => {
    await signOutSession({ accessToken: 'token-a', userId: 'user-a' });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('revokes on the server before local sign-out when a token is provided', async () => {
    await signOutSession({ accessToken: 'token-a', userId: 'user-a' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/logout?scope=global'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('returns unreachable when logout fetch fails and still clears locally', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));

    await expect(
      signOutSession({ accessToken: 'token-a', userId: 'user-a' }),
    ).resolves.toEqual({ serverSignOutUnreachable: true });

    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('treats network errors from local sign-out as success when clearing offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    authState.signOut.mockResolvedValue({
      error: { message: 'Network request failed' },
    });

    await expect(
      signOutSession({ accessToken: 'token-a', userId: 'user-a' }),
    ).resolves.toEqual({ serverSignOutUnreachable: true });
  });

  it('keeps the local session when revoke returns 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 429 })),
    );

    await expect(
      signOutSession({ accessToken: 'token-a', userId: 'user-a' }),
    ).rejects.toThrow('sign_out_rate_limited');

    expect(authState.signOut).not.toHaveBeenCalled();
  });
});
