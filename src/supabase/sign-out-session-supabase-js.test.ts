import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSignedOutMarkerKey } from './resilient-auth-storage';

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

function makeSessionJson(accessToken: string, expiresAtSeconds?: number): string {
  return JSON.stringify({
    access_token: accessToken,
    refresh_token: 'refresh-token',
    expires_in: 3600,
    expires_at: expiresAtSeconds ?? Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: USER_ID,
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
    vi.resetModules();
    diskRef.map.clear();
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

    await createTestClient({ autoRefreshToken: true });
    await clientRef.current!.auth.getSession();

    const { signOutSession } = await import('./sign-out-session');
    await signOutSession({ accessToken: 'user-jwt-a', userId: USER_ID });

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
});
