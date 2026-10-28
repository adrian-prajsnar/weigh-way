import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SUPABASE_URL = 'https://example.supabase.co';
const ANON_KEY = 'public-anon-key';
const SERVICE_ROLE_KEY = 'service-role-secret';
const SESSION_KEY = 'sb-example-auth-token';

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
    return null;
  });
  asyncStorage.removeItem.mockImplementation(async () => {});
}

function makeSessionJson(accessToken: string): string {
  return JSON.stringify({
    access_token: accessToken,
    refresh_token: 'refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: '11111111-1111-1111-1111-111111111111',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'user@example.com',
    },
  });
}

describe('signOutSession with real Supabase auth-js', () => {
  beforeEach(() => {
    vi.resetModules();
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

    asyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        return '1';
      }
      if (key === SESSION_KEY) {
        return makeSessionJson('user-jwt-a');
      }
      if (key.endsWith('-signed-out')) {
        if (diskThrows) {
          throw new DOMException('blocked', 'SecurityError');
        }
        return null;
      }
      return null;
    });

    asyncStorage.setItem.mockImplementation(async (key: string) => {
      if (key === '@weigh-way/auth-storage-probe') {
        return;
      }
      if (diskThrows) {
        throw new DOMException('blocked', 'SecurityError');
      }
    });

    asyncStorage.removeItem.mockImplementation(async () => {
      if (diskThrows) {
        throw new DOMException('blocked', 'SecurityError');
      }
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

    const { createResilientAuthStorage } = await import('./resilient-auth-storage');
    const resilient = createResilientAuthStorage();
    resilientStorageRef.current = resilient;

    clientRef.current = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        storage: resilient,
        storageKey: SESSION_KEY,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    await clientRef.current.auth.getSession();

    diskThrows = true;
    const { signOutSession } = await import('./sign-out-session');
    await signOutSession({ accessToken: 'user-jwt-a' });

    expect(logoutCalls).toHaveLength(1);
    expect(logoutCalls[0]?.url).toContain('/logout?scope=global');
    expect(logoutCalls[0]?.authorization).toBe('Bearer user-jwt-a');
    expect(logoutCalls[0]?.apikey).toBe(ANON_KEY);
    expect(logoutCalls[0]?.apikey).not.toBe(SERVICE_ROLE_KEY);
  });
});
