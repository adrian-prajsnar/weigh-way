import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSignedOutMarkerKey } from './resilient-auth-storage';
import { noteLatestAuthUserIdFromEvent } from './sign-out-local-user';
import { createSerializedAsyncStorageQueue } from './serialized-async-storage-queue';

vi.mock('./sign-out-deadlines', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sign-out-deadlines')>();
  return {
    ...actual,
    SIGN_OUT_FLOW_CAP_MS: 500,
    SIGN_OUT_LOCAL_CLEAR_TIMEOUT_MS: 100,
    SIGN_OUT_SESSION_USER_CHECK_TIMEOUT_MS: 50,
    SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS: 100,
    SIGN_OUT_REFRESH_TIMEOUT_MS: 100,
  };
});

const SUPABASE_URL = 'https://example.supabase.co';
const ANON_KEY = 'public-anon-key';
const SERVICE_ROLE_KEY = 'service-role-secret';
const SESSION_KEY = 'sb-example-auth-token';
const USER_ID = '11111111-1111-1111-1111-111111111111';

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

const clientRef = vi.hoisted(() => ({
  current: null as ReturnType<typeof createClient> | null,
}));

const resilientStorageRef = vi.hoisted(() => ({
  current: null as ReturnType<
    typeof import('./resilient-auth-storage').createResilientAuthStorage
  > | null,
}));

const diskRef = vi.hoisted(() => ({
  map: new Map<string, string>(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorage,
}));

vi.mock('./client', () => ({
  isSupabaseConfigured: () => true,
  supabaseAuthHttpConfig: {
    url: SUPABASE_URL,
    anonKey: ANON_KEY,
  },
  get supabase() {
    if (!clientRef.current) {
      throw new Error('test client not initialized');
    }
    return clientRef.current;
  },
}));

vi.mock('./auth-session-storage', () => ({
  getSupabaseAuthStorage: () => {
    if (!resilientStorageRef.current) {
      throw new Error('test storage not initialized');
    }
    return resilientStorageRef.current;
  },
}));

function mockProbeSuccess() {
  asyncStorage.setItem.mockImplementation(async (key: string) => {
    if (key === '@weigh-way/auth-storage-probe') {
      return;
    }
  });
  asyncStorage.getItem.mockImplementation(async (key: string) => {
    if (key === '@weigh-way/auth-storage-probe') {
      return '1';
    }
    return diskRef.map.get(key) ?? null;
  });
  asyncStorage.removeItem.mockImplementation(async (key: string) => {
    diskRef.map.delete(key);
  });
}

function makeSessionJson(
  accessToken: string,
  expiresAtSeconds?: number,
  userId: string = USER_ID,
): string {
  return JSON.stringify({
    access_token: accessToken,
    refresh_token: 'refresh-token',
    expires_in: 3600,
    expires_at: expiresAtSeconds ?? Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'user@example.com',
    },
  });
}

async function createTestClient(options: { autoRefreshToken: boolean }) {
  const { createResilientAuthStorage } = await import('./resilient-auth-storage');
  const resilient = createResilientAuthStorage();
  resilientStorageRef.current = resilient;

  clientRef.current = createClient(SUPABASE_URL, ANON_KEY, {
    auth: {
      storage: resilient,
      storageKey: SESSION_KEY,
      persistSession: true,
      autoRefreshToken: options.autoRefreshToken,
      detectSessionInUrl: false,
    },
  });

  return resilient;
}

describe('signOutSession with real Supabase auth-js', () => {
  beforeEach(() => {
    diskRef.map.clear();
    noteLatestAuthUserIdFromEvent(null);
    mockProbeSuccess();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clientRef.current = null;
    resilientStorageRef.current = null;
  });

  it('sends exactly one POST /logout when auth storage throws during sign-out', async () => {
    const logoutCalls: { url: string; authorization: string | null; apikey: string | null }[] = [];
    let diskThrows = false;
    const signedOutMarkerKey = getSignedOutMarkerKey(SESSION_KEY);

    diskRef.map.set(SESSION_KEY, makeSessionJson('user-jwt-a'));

    asyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        return '1';
      }
      if (diskThrows && key === signedOutMarkerKey) {
        throw new DOMException('blocked', 'SecurityError');
      }
      return diskRef.map.get(key) ?? null;
    });

    asyncStorage.setItem.mockImplementation(async (key: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        return;
      }
      if (diskThrows) {
        throw new DOMException('blocked', 'SecurityError');
      }
      diskRef.map.set(key, '1');
    });

    asyncStorage.removeItem.mockImplementation(async (key: string) => {
      if (diskThrows) {
        throw new DOMException('blocked', 'SecurityError');
      }
      diskRef.map.delete(key);
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          const headers = new Headers(init?.headers);
          logoutCalls.push({
            url,
            authorization: headers.get('Authorization'),
            apikey: headers.get('apikey'),
          });
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );

    await createTestClient({ autoRefreshToken: false });
    await clientRef.current!.auth.getSession();

    diskThrows = true;
    const { signOutSession } = await import('./sign-out-session');
    await signOutSession({ accessToken: 'user-jwt-a', userId: USER_ID });

    expect(logoutCalls).toHaveLength(1);
    expect(logoutCalls[0]?.url).toContain('/logout?scope=global');
    expect(logoutCalls[0]?.authorization).toBe('Bearer user-jwt-a');
    expect(logoutCalls[0]?.apikey).toBe(ANON_KEY);
    expect(logoutCalls[0]?.apikey).not.toBe(SERVICE_ROLE_KEY);
  });

  it('clears the session after reload when the captured access token was expired at sign-out', async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 3600;
    diskRef.map.set(SESSION_KEY, makeSessionJson('user-jwt-a', expiredAt));

    const logoutTokens: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const headers = new Headers(init?.headers);
        if (url.includes('/token')) {
          const body = JSON.stringify({
            access_token: 'user-jwt-a2',
            refresh_token: 'refresh-token',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: 'bearer',
            user: {
              id: USER_ID,
              aud: 'authenticated',
              role: 'authenticated',
              email: 'user@example.com',
            },
          });
          diskRef.map.set(SESSION_KEY, body);
          return new Response(body, { status: 200 });
        }
        if (url.includes('/logout')) {
          const authorization = headers.get('Authorization') ?? '';
          logoutTokens.push(authorization);
          if (authorization === 'Bearer user-jwt-a') {
            return new Response(
              JSON.stringify({
                code: 'bad_jwt',
                message: 'token is expired',
              }),
              { status: 401, headers: { 'Content-Type': 'application/json' } },
            );
          }
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );

    await createTestClient({ autoRefreshToken: false });
    await clientRef.current!.auth.getSession();

    const { signOutSession } = await import('./sign-out-session');
    await signOutSession({
      accessToken: 'user-jwt-a',
      userId: USER_ID,
      refreshToken: 'refresh-token',
    });

    const afterSignOut = await clientRef.current!.auth.getSession();
    expect(afterSignOut.data.session).toBeNull();
    expect(diskRef.map.get(SESSION_KEY)).toBeUndefined();

    expect(logoutTokens.filter((t) => t === 'Bearer user-jwt-a2')).toHaveLength(1);

    const reloadedClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        storage: resilientStorageRef.current!,
        storageKey: SESSION_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });

    const afterReload = await reloadedClient.auth.getSession();
    expect(afterReload.data.session).toBeNull();
    expect(diskRef.map.get(SESSION_KEY)).toBeUndefined();
  });

  it('finishes within the revoke deadline when logout hangs and clears after reload', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    diskRef.map.set(SESSION_KEY, makeSessionJson('user-jwt-a'));

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          return new Promise<Response>(() => {});
        }
        return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
      }),
    );

    await createTestClient({ autoRefreshToken: false });
    await clientRef.current!.auth.getSession();

    const { signOutSession } = await import('./sign-out-session');
    const signOutPromise = signOutSession({
      accessToken: 'user-jwt-a',
      userId: USER_ID,
      refreshToken: 'refresh-token',
    });
    await vi.advanceTimersByTimeAsync(150);
    const result = await signOutPromise;
    expect(result.serverSignOutUnreachable).toBe(true);

    const afterSignOut = await clientRef.current!.auth.getSession();
    expect(afterSignOut.data.session).toBeNull();

    const reloadedClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        storage: resilientStorageRef.current!,
        storageKey: SESSION_KEY,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    expect((await reloadedClient.auth.getSession()).data.session).toBeNull();
    vi.useRealTimers();
  });

  it('clears locally when refresh returns invalid_grant without throwing', async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 3600;
    diskRef.map.set(SESSION_KEY, makeSessionJson('user-jwt-a', expiredAt));

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
        if (url.includes('/token')) {
          return new Response(
            JSON.stringify({
              error: 'invalid_grant',
              error_description: 'Refresh token is invalid',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );

    await createTestClient({ autoRefreshToken: false });
    await clientRef.current!.auth.getSession();

    const { signOutSession } = await import('./sign-out-session');
    await expect(
      signOutSession({
        accessToken: 'user-jwt-a',
        userId: USER_ID,
        refreshToken: 'refresh-token',
      }),
    ).resolves.toEqual({ serverSignOutUnreachable: false, localClearIncomplete: false });

    expect((await clientRef.current!.auth.getSession()).data.session).toBeNull();
  });

  it('clears when the captured token is expired and all storage throws during sign-out', async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 3600;
    diskRef.map.set(SESSION_KEY, makeSessionJson('user-jwt-a', expiredAt));
    let diskThrows = false;
    const signedOutMarkerKey = getSignedOutMarkerKey(SESSION_KEY);

    asyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        return '1';
      }
      if (diskThrows && key === signedOutMarkerKey) {
        throw new DOMException('blocked', 'SecurityError');
      }
      return diskRef.map.get(key) ?? null;
    });
    asyncStorage.setItem.mockImplementation(async (key: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        return;
      }
      if (diskThrows) {
        throw new DOMException('blocked', 'SecurityError');
      }
      diskRef.map.set(key, '1');
    });
    asyncStorage.removeItem.mockImplementation(async (key: string) => {
      if (diskThrows) {
        throw new DOMException('blocked', 'SecurityError');
      }
      diskRef.map.delete(key);
    });

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
        if (url.includes('/token')) {
          const body = JSON.stringify({
            access_token: 'user-jwt-a2',
            refresh_token: 'refresh-token',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: 'bearer',
            user: {
              id: USER_ID,
              aud: 'authenticated',
              role: 'authenticated',
              email: 'user@example.com',
            },
          });
          return new Response(body, { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );

    await createTestClient({ autoRefreshToken: false });
    await clientRef.current!.auth.getSession();
    diskThrows = true;

    const { signOutSession } = await import('./sign-out-session');
    await signOutSession({
      accessToken: 'user-jwt-a',
      userId: USER_ID,
      refreshToken: 'refresh-token',
    });

    expect((await clientRef.current!.auth.getSession()).data.session).toBeNull();
  });

  it('clears an expired session when offline and stays out after reload', async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 3600;
    diskRef.map.set(SESSION_KEY, makeSessionJson('user-jwt-a', expiredAt));
    noteLatestAuthUserIdFromEvent(USER_ID);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await createTestClient({ autoRefreshToken: false });
    await resilientStorageRef.current!.getItem(SESSION_KEY);
    vi.spyOn(clientRef.current!.auth, 'signOut').mockResolvedValue({ error: null });

    const { signOutSession } = await import('./sign-out-session');
    await signOutSession({
      accessToken: 'user-jwt-a',
      userId: USER_ID,
      refreshToken: 'refresh-token',
    });

    const reloaded = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        storage: resilientStorageRef.current!,
        storageKey: SESSION_KEY,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    expect((await reloaded.auth.getSession()).data.session).toBeNull();
    expect(diskRef.map.get(SESSION_KEY)).toBeUndefined();
  });

  it('clears when logout is expired and refresh hangs, then reload stays signed out', async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 3600;
    diskRef.map.set(SESSION_KEY, makeSessionJson('user-jwt-a', expiredAt));
    noteLatestAuthUserIdFromEvent(USER_ID);

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          return Promise.resolve(
            new Response(JSON.stringify({ code: 'bad_jwt', message: 'token is expired' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (url.includes('/token')) {
          return new Promise<Response>(() => {});
        }
        return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
      }),
    );

    await createTestClient({ autoRefreshToken: false });
    await resilientStorageRef.current!.getItem(SESSION_KEY);
    vi.spyOn(clientRef.current!.auth, 'signOut').mockResolvedValue({ error: null });

    const { signOutSession } = await import('./sign-out-session');
    await signOutSession({
      accessToken: 'user-jwt-a',
      userId: USER_ID,
      refreshToken: 'refresh-token',
    });

    const reloaded = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        storage: resilientStorageRef.current!,
        storageKey: SESSION_KEY,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    expect((await reloaded.auth.getSession()).data.session).toBeNull();
    expect(diskRef.map.get(SESSION_KEY)).toBeUndefined();
  });

  it('clears under the 15s flow cap when local clear hangs and reload stays signed out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    diskRef.map.set(SESSION_KEY, makeSessionJson('user-jwt-a'));
    noteLatestAuthUserIdFromEvent(USER_ID);

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

    await createTestClient({ autoRefreshToken: false });
    await clientRef.current!.auth.getSession();

    const { signOutSession } = await import('./sign-out-session');
    vi.spyOn(clientRef.current!.auth, 'signOut').mockImplementation(
      () =>
        new Promise<{ error: null }>(() => {}) as ReturnType<
          NonNullable<typeof clientRef.current>['auth']['signOut']
        >,
    );

    const signOutPromise = signOutSession({
      accessToken: 'user-jwt-a',
      userId: USER_ID,
      refreshToken: 'refresh-token',
    });
    await vi.advanceTimersByTimeAsync(600);
    await signOutPromise;

    const reloaded = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        storage: resilientStorageRef.current!,
        storageKey: SESSION_KEY,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    expect((await reloaded.auth.getSession()).data.session).toBeNull();
    vi.useRealTimers();
  });

  it('keeps user B when B signs in during an abandoned clear with serialized storage', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const USER_B = '22222222-2222-2222-2222-222222222222';
    let releaseSessionRemove!: () => void;
    const sessionRemoveGate = new Promise<void>((resolve) => {
      releaseSessionRemove = resolve;
    });

    diskRef.map.set(SESSION_KEY, makeSessionJson('user-jwt-a'));
    noteLatestAuthUserIdFromEvent(USER_ID);

    const serialized = createSerializedAsyncStorageQueue({
      getItem: async (key: string) => {
        if (key === '@weigh-way/auth-storage-probe') {
          return '1';
        }
        return diskRef.map.get(key) ?? null;
      },
      setItem: async (key: string, value: string) => {
        if (key === '@weigh-way/auth-storage-probe') {
          return;
        }
        diskRef.map.set(key, value);
      },
      removeItem: async (key: string) => {
        if (key === SESSION_KEY) {
          await sessionRemoveGate;
        }
        diskRef.map.delete(key);
      },
    });

    asyncStorage.getItem.mockImplementation((key: string) => serialized.getItem(key));
    asyncStorage.setItem.mockImplementation((key: string, value: string) =>
      serialized.setItem(key, value),
    );
    asyncStorage.removeItem.mockImplementation((key: string) => serialized.removeItem(key));

    const logoutAuths: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          logoutAuths.push(new Headers(init?.headers).get('Authorization') ?? '');
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );

    await createTestClient({ autoRefreshToken: false });
    await resilientStorageRef.current!.getItem(SESSION_KEY);
    const signOutSpy = vi.spyOn(clientRef.current!.auth, 'signOut');

    const { signOutSession } = await import('./sign-out-session');
    const signOutPromise = signOutSession({
      accessToken: 'user-jwt-a',
      userId: USER_ID,
      refreshToken: 'refresh-token',
    });

    await vi.advanceTimersByTimeAsync(150);
    await expect(signOutPromise).resolves.toMatchObject({ localClearIncomplete: true });

    noteLatestAuthUserIdFromEvent(USER_B);
    releaseSessionRemove();
    await resilientStorageRef.current!.setItem(
      SESSION_KEY,
      makeSessionJson('user-jwt-b', undefined, USER_B),
    );

    await vi.runAllTimersAsync();

    expect(signOutSpy).not.toHaveBeenCalled();
    expect(logoutAuths.some((auth) => auth === 'Bearer user-jwt-b')).toBe(false);
    expect(logoutAuths.some((auth) => auth === 'Bearer user-jwt-a')).toBe(true);
    expect(diskRef.map.get(SESSION_KEY)).toContain('user-jwt-b');

    const reloaded = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        storage: resilientStorageRef.current!,
        storageKey: SESSION_KEY,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    expect((await reloaded.auth.getSession()).data.session?.user.id).toBe(USER_B);
    vi.useRealTimers();
  }, 15_000);
});
