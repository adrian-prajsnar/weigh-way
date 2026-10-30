import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSessionIdFromAuthSessionPayload } from './auth-session-id';
import { makeTestAccessToken } from './test-helpers/make-test-access-token';
import {
  PENDING_GLOBAL_REVOKE_MARKER_KEY,
} from './pending-global-revoke-marker';
import { resetInMemoryPendingGlobalRevokeForTests } from './pending-global-revoke-in-memory';
import { resetPendingGlobalRevokeStateForTests } from './pending-global-revoke';

async function resetAuthEvents(userId: string | null, sessionId: string | null) {
  const localUser = await import('./sign-out-local-user');
  localUser.noteLatestAuthUserIdFromEvent(userId);
  localUser.noteLatestAuthSessionIdFromEvent(sessionId);
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
const SESS_A1 = 'sess-a1-triple';
const SESS_B1 = 'sess-b1-other';

const diskRef = vi.hoisted(() => new Map<string, string>());
const markerDiskRef = vi.hoisted(() => new Map<string, string>());

const storageGate = vi.hoisted(() => ({
  blockPrimaryAuthWrites: false,
}));

const asyncStorageBackend = vi.hoisted(() => ({
  getItem: async (key: string) => diskRef.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    if (storageGate.blockPrimaryAuthWrites && key !== '@weigh-way/auth-storage-probe') {
      throw new DOMException('blocked', 'SecurityError');
    }
    diskRef.set(key, value);
  },
  removeItem: async (key: string) => {
    if (storageGate.blockPrimaryAuthWrites && key !== '@weigh-way/auth-storage-probe') {
      throw new DOMException('blocked', 'SecurityError');
    }
    diskRef.delete(key);
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

const authSignOut = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));

vi.mock('./client', () => ({
  isSupabaseConfigured: () => true,
  supabaseAuthHttpConfig: configRef,
  supabase: {
    auth: {
      signOut: authSignOut,
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

function makeSessionJson(userId: string, sessionId: string): string {
  return JSON.stringify({
    access_token: makeTestAccessToken(sessionId),
    refresh_token: 'refresh-for-user',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'a@example.com' },
  });
}

function mockProbe() {
  diskRef.set('@weigh-way/auth-storage-probe', '1');
}

async function installIndependentMarkerStore() {
  const { setPendingGlobalRevokeMarkerStoreForTests } = await import(
    './pending-global-revoke-marker-store'
  );
  setPendingGlobalRevokeMarkerStoreForTests({
    read: async () => markerDiskRef.get(PENDING_GLOBAL_REVOKE_MARKER_KEY) ?? null,
    write: async (value) => {
      markerDiskRef.set(PENDING_GLOBAL_REVOKE_MARKER_KEY, value);
      return true;
    },
    clear: async () => {
      markerDiskRef.delete(PENDING_GLOBAL_REVOKE_MARKER_KEY);
    },
  });
}

describe('pending global revoke triple fault (session-scoped marker)', () => {
  let logoutCalls: string[];

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.resetModules();
    authSignOut.mockReset();
    authSignOut.mockResolvedValue({ error: null });
    diskRef.clear();
    markerDiskRef.clear();
    storageGate.blockPrimaryAuthWrites = false;
    logoutCalls = [];
    resetInMemoryPendingGlobalRevokeForTests();
    resetPendingGlobalRevokeStateForTests();
    await installIndependentMarkerStore();
    await resetAuthEvents(null, null);
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

  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resilientStorageRef.current = null;
    const { setPendingGlobalRevokeMarkerStoreForTests } = await import(
      './pending-global-revoke-marker-store'
    );
    setPendingGlobalRevokeMarkerStoreForTests(null);
  });

  async function initStorage() {
    const { createResilientAuthStorage } = await import('./resilient-auth-storage');
    const storage = createResilientAuthStorage();
    resilientStorageRef.current = storage;
    return storage;
  }

  async function completeBlockedSignOut() {
    vi.useRealTimers();
    const { SignOutDeadlineError } = await import('./sign-out-deadlines');
    authSignOut.mockImplementation(() => Promise.reject(new SignOutDeadlineError()));
    const { signOutSession } = await import('./sign-out-session');
    return signOutSession({
      accessToken: makeTestAccessToken(SESS_A1),
      refreshToken: 'refresh-for-user',
      userId: USER_A,
    });
  }

  it('reload within backoff hides the same session id and retries global revoke once when storage recovers', async () => {
    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A1));
    const storageA = await initStorage();
    await storageA.getItem(SESSION_KEY);
    await resetAuthEvents(USER_A, SESS_A1);

    storageGate.blockPrimaryAuthWrites = true;
    const result = await completeBlockedSignOut();

    expect(result.serverSignOutUnreachable).toBe(true);
    expect(result.localClearIncomplete).toBe(true);
    expect(storageA.hasPendingDiskPersistence()).toBe(true);
    expect(logoutCalls).toHaveLength(1);
    const marker = await import('./pending-global-revoke-marker');
    await expect(marker.readPendingGlobalRevokeMarkerSessionId()).resolves.toBe(SESS_A1);

    vi.resetModules();
    await installIndependentMarkerStore();
    await resetAuthEvents(USER_A, SESS_A1);
    const storageB = await initStorage();
    await expect(storageB.getItem(SESSION_KEY)).resolves.toBeNull();

    storageGate.blockPrimaryAuthWrites = false;
    await storageB.retryPendingDiskPersistence();

    expect(logoutCalls).toHaveLength(2);
    expect(logoutCalls[1]).toContain('scope=global');
  });

  it('does not hide user B when the pending revoke marker targets session A1 only', async () => {
    diskRef.set(SESSION_KEY, makeSessionJson(USER_B, SESS_B1));
    markerDiskRef.set(
      PENDING_GLOBAL_REVOKE_MARKER_KEY,
      JSON.stringify({ sessionId: SESS_A1 }),
    );

    const storage = await initStorage();
    const raw = await storage.getItem(SESSION_KEY);
    expect(parseSessionIdFromAuthSessionPayload(raw)).toBe(SESS_B1);
  });

  it('keeps the session-scoped marker when retry revoke is rate limited', async () => {
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

    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A1));
    const storageA = await initStorage();
    await storageA.getItem(SESSION_KEY);
    await resetAuthEvents(USER_A, SESS_A1);

    storageGate.blockPrimaryAuthWrites = true;
    await completeBlockedSignOut();

    storageGate.blockPrimaryAuthWrites = false;
    await storageA.retryPendingDiskPersistence();

    expect(logoutCalls).toHaveLength(2);
    const marker = await import('./pending-global-revoke-marker');
    await expect(marker.readPendingGlobalRevokeMarkerSessionId()).resolves.toBe(SESS_A1);
  });

  it('clears a session-scoped marker when auth events confirm a different session id', async () => {
    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A1));
    const storage = await initStorage();
    await storage.getItem(SESSION_KEY);
    await resetAuthEvents(USER_A, SESS_A1);

    storageGate.blockPrimaryAuthWrites = true;
    await completeBlockedSignOut();

    await resetAuthEvents(USER_A, SESS_B1);
    const { clearPendingGlobalRevokeIfSupersededByAuthEvent } = await import(
      './pending-global-revoke'
    );
    await clearPendingGlobalRevokeIfSupersededByAuthEvent();

    storageGate.blockPrimaryAuthWrites = false;
    await storage.retryPendingDiskPersistence();

    expect(logoutCalls).toHaveLength(2);
    expect(logoutCalls[1]).toContain('scope=local');
    const markerMod = await import('./pending-global-revoke-marker');
    await expect(markerMod.readPendingGlobalRevokeMarkerSessionId()).resolves.toBeNull();
  });
});
