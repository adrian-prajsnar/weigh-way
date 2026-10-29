import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PENDING_GLOBAL_REVOKE_MARKER_KEY,
  readPendingGlobalRevokeMarkerUserId,
} from './pending-global-revoke-marker';
import { resetPendingGlobalRevokeStateForTests } from './pending-global-revoke';

async function resetAuthEventUser(userId: string | null) {
  const { noteLatestAuthUserIdFromEvent } = await import('./sign-out-local-user');
  noteLatestAuthUserIdFromEvent(userId);
}

async function getAuthEventUser() {
  const { getLatestAuthUserIdFromEvents } = await import('./sign-out-local-user');
  return getLatestAuthUserIdFromEvents();
}

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

const configRef = vi.hoisted(() => ({
  url: 'https://example.supabase.co',
  anonKey: 'public-anon-key',
}));
const SESSION_KEY = 'sb-example-auth-token';
const USER_A = 'user-a-id';
const USER_B = 'user-b-id';

const diskRef = vi.hoisted(() => ({
  map: new Map<string, string>(),
}));

const storageGate = vi.hoisted(() => ({
  blockPrimaryAuthWrites: false,
}));

const allowedKeysWhenBlocked = vi.hoisted(
  () => new Set(['@weigh-way/auth-storage-probe', '@weigh-way/auth-pending-global-revoke']),
);

const asyncStorageBackend = vi.hoisted(() => ({
  getItem: async (key: string) => diskRef.map.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    if (storageGate.blockPrimaryAuthWrites && !allowedKeysWhenBlocked.has(key)) {
      throw new DOMException('blocked', 'SecurityError');
    }
    diskRef.map.set(key, value);
  },
  removeItem: async (key: string) => {
    if (storageGate.blockPrimaryAuthWrites && !allowedKeysWhenBlocked.has(key)) {
      throw new DOMException('blocked', 'SecurityError');
    }
    diskRef.map.delete(key);
  },
}));

const asyncStorage = vi.hoisted(() => {
  let chain: Promise<void> = Promise.resolve();
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = chain.then(operation);
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  return {
    getItem: (key: string) => enqueue(() => asyncStorageBackend.getItem(key)),
    setItem: (key: string, value: string) =>
      enqueue(() => asyncStorageBackend.setItem(key, value)),
    removeItem: (key: string) => enqueue(() => asyncStorageBackend.removeItem(key)),
  };
});

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
  supabaseAuthHttpConfig: configRef,
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
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

vi.mock('./auth-storage-key', () => ({
  getSupabaseAuthStorageKey: () => SESSION_KEY,
  getSupabaseLegacyPkceVerifierKey: () => `${SESSION_KEY}-code-verifier`,
}));

function makeSessionJson(userId: string, accessToken: string): string {
  return JSON.stringify({
    access_token: accessToken,
    refresh_token: 'refresh-for-user',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'a@example.com' },
  });
}

function mockProbe() {
  diskRef.map.set('@weigh-way/auth-storage-probe', '1');
}

function assertNoTokensLogged(spies: ReturnType<typeof vi.spyOn>[]) {
  const tokenPattern = /user-jwt|refresh-for-user|Bearer /i;
  for (const spy of spies) {
    for (const call of spy.mock.calls) {
      const text = call.map(String).join(' ');
      expect(text).not.toMatch(tokenPattern);
    }
  }
}

describe('pending global revoke triple fault', () => {
  let logoutCalls: string[];

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    diskRef.map.clear();
    storageGate.blockPrimaryAuthWrites = false;
    logoutCalls = [];
    resetPendingGlobalRevokeStateForTests();
    await resetAuthEventUser(null);
    mockProbe();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          logoutCalls.push(url);
          if (logoutCalls.length === 1) {
            return new Response(JSON.stringify({ msg: 'down' }), { status: 503 });
          }
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resilientStorageRef.current = null;
  });

  async function initStorage() {
    const { createResilientAuthStorage } = await import('./resilient-auth-storage');
    const storage = createResilientAuthStorage();
    resilientStorageRef.current = storage;
    return storage;
  }

  it('reload within backoff hides user A and retries global revoke once when storage recovers', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    diskRef.map.set(SESSION_KEY, makeSessionJson(USER_A, 'user-jwt-a'));
    const storageA = await initStorage();
    await storageA.getItem(SESSION_KEY);
    await resetAuthEventUser(USER_A);

    storageGate.blockPrimaryAuthWrites = true;
    const { signOutSession } = await import('./sign-out-session');
    const result = await signOutSession({
      accessToken: 'user-jwt-a',
      refreshToken: 'refresh-for-user',
      userId: USER_A,
    });

    expect(result.serverSignOutUnreachable).toBe(true);
    expect(storageA.hasPendingDiskPersistence()).toBe(true);
    expect(logoutCalls).toHaveLength(1);
    await expect(readPendingGlobalRevokeMarkerUserId()).resolves.toBe(USER_A);
    expect(diskRef.map.get(SESSION_KEY)).toContain('user-jwt-a');

    vi.resetModules();
    await resetAuthEventUser(USER_A);
    const storageB = await initStorage();
    await expect(storageB.getItem(SESSION_KEY)).resolves.toBeNull();

    storageGate.blockPrimaryAuthWrites = false;
    await storageB.retryPendingDiskPersistence();

    expect(logoutCalls).toHaveLength(2);
    assertNoTokensLogged([logSpy, warnSpy]);
  });

  it('does not hide user B when the pending revoke marker is for user A', async () => {
    diskRef.map.set(SESSION_KEY, makeSessionJson(USER_B, 'user-jwt-b'));
    diskRef.map.set(
      PENDING_GLOBAL_REVOKE_MARKER_KEY,
      JSON.stringify({ userId: USER_A }),
    );

    const storage = await initStorage();
    await expect(storage.getItem(SESSION_KEY)).resolves.toContain('user-jwt-b');
  });

  it('keeps the marker when retry revoke is rate limited', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          logoutCalls.push(url);
          if (logoutCalls.length === 1) {
            return new Response(JSON.stringify({ msg: 'down' }), { status: 503 });
          }
          return new Response(JSON.stringify({ msg: 'slow down' }), {
            status: 429,
            headers: { 'Retry-After': '60' },
          });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );

    diskRef.map.set(SESSION_KEY, makeSessionJson(USER_A, 'user-jwt-a'));
    const storageA = await initStorage();
    await storageA.getItem(SESSION_KEY);
    await resetAuthEventUser(USER_A);

    storageGate.blockPrimaryAuthWrites = true;
    const { signOutSession } = await import('./sign-out-session');
    await signOutSession({
      accessToken: 'user-jwt-a',
      refreshToken: 'refresh-for-user',
      userId: USER_A,
    });

    storageGate.blockPrimaryAuthWrites = false;
    await storageA.retryPendingDiskPersistence();

    expect(logoutCalls).toHaveLength(2);
    await expect(readPendingGlobalRevokeMarkerUserId()).resolves.toBe(USER_A);
  });

  it('drops pending revoke when a different user is confirmed via auth events', async () => {
    diskRef.map.set(SESSION_KEY, makeSessionJson(USER_A, 'user-jwt-a'));
    const storage = await initStorage();
    await storage.getItem(SESSION_KEY);
    await resetAuthEventUser(USER_A);

    storageGate.blockPrimaryAuthWrites = true;
    const { signOutSession } = await import('./sign-out-session');
    await signOutSession({
      accessToken: 'user-jwt-a',
      refreshToken: 'refresh-for-user',
      userId: USER_A,
    });

    await resetAuthEventUser(USER_B);
    resetPendingGlobalRevokeStateForTests();
    await expect(getAuthEventUser()).resolves.toBe(USER_B);
    storageGate.blockPrimaryAuthWrites = false;
    await storage.retryPendingDiskPersistence();

    expect(logoutCalls).toHaveLength(1);
    await expect(readPendingGlobalRevokeMarkerUserId()).resolves.toBeNull();
  });
});
