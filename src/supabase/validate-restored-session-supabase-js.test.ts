import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createResilientAuthStorage } from './resilient-auth-storage';

const SUPABASE_URL = 'https://example.supabase.co/';
const ANON_KEY = 'public-anon-key';
const SESSION_KEY = 'sb-example-auth-token';
const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

const diskRef = vi.hoisted(() => ({
  map: new Map<string, string>(),
}));

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

const signOutSessionMock = vi.hoisted(() => vi.fn());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorage,
}));

vi.mock('./sign-out-session', () => ({
  signOutSession: signOutSessionMock,
}));

function makeSession(accessToken: string, userId: string, refreshToken: string) {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'user@example.com',
    },
  };
}

function setupStorage(sessionJson: string) {
  diskRef.map.set(SESSION_KEY, sessionJson);
  asyncStorage.getItem.mockImplementation(async (key: string) => {
    if (key === '@weigh-way/auth-storage-probe') {
      return '1';
    }
    return diskRef.map.get(key) ?? null;
  });
  asyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
    if (key !== '@weigh-way/auth-storage-probe') {
      diskRef.map.set(key, value);
    }
  });
  asyncStorage.removeItem.mockImplementation(async (key: string) => {
    diskRef.map.delete(key);
  });
}

describe('validateRestoredSessionInBackground with real auth-js', () => {
  beforeEach(() => {
    diskRef.map.clear();
    signOutSessionMock.mockReset();
    signOutSessionMock.mockResolvedValue({ serverSignOutUnreachable: false, localClearIncomplete: false });
    authState.getSession.mockReset();
    authState.refreshSession.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('does not clear auth-js session B when GET /user rejects stale token A', async () => {
    setupStorage(JSON.stringify(makeSession('token-b', USER_B, 'refresh-b')));

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const headers = new Headers(init?.headers);
        if (url.includes('/auth/v1/user') && headers.get('Authorization') === 'Bearer token-a') {
          return new Response(JSON.stringify({ code: 'session_not_found', message: 'not found' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );

    const resilient = createResilientAuthStorage();
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        storage: resilient,
        storageKey: SESSION_KEY,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    vi.doMock('./client', () => ({
      isSupabaseConfigured: () => true,
      supabaseAuthHttpConfig: { url: SUPABASE_URL, anonKey: ANON_KEY },
      supabase: client,
    }));

    const { fetchAuthUserForAccessToken } = await import('./fetch-auth-user');
    await fetchAuthUserForAccessToken('token-a');

    const session = (await client.auth.getSession()).data.session;
    expect(session?.user?.id).toBe(USER_B);
    expect(diskRef.map.get(SESSION_KEY)).toContain('token-b');
  });

  it('does not sign out when validation for A completes after B signed in', async () => {
    const sessionA = makeSession('token-a', USER_A, 'refresh-a');
    const sessionB = makeSession('token-b', USER_B, 'refresh-b');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const headers = new Headers(init?.headers);
        if (url.includes('/auth/v1/user') && headers.get('Authorization') === 'Bearer token-a') {
          return new Response(JSON.stringify({ code: 'session_not_found', message: 'not found' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('/logout')) {
          throw new Error('unexpected logout');
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );

    authState.getSession
      .mockResolvedValueOnce({ data: { session: sessionA } })
      .mockResolvedValueOnce({ data: { session: sessionB } })
      .mockResolvedValue({ data: { session: sessionB } });

    vi.doMock('./client', () => ({
      isSupabaseConfigured: () => true,
      supabaseAuthHttpConfig: { url: SUPABASE_URL, anonKey: ANON_KEY },
      supabase: {
        auth: {
          getSession: authState.getSession,
          refreshSession: authState.refreshSession,
        },
      },
    }));

    const { validateRestoredSessionInBackground } = await import('./validate-restored-session');
    await validateRestoredSessionInBackground();

    expect(signOutSessionMock).not.toHaveBeenCalled();
  });
});
