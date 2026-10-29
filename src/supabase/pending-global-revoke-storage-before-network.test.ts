import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestAccessToken, parseSessionIdFromAuthSessionPayload } from './auth-session-id';
import { PENDING_GLOBAL_REVOKE_MARKER_KEY } from './pending-global-revoke-marker';
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
const SESS_A1 = 'sess-a1-storage-first';

const diskRef = vi.hoisted(() => new Map<string, string>());
const markerDiskRef = vi.hoisted(() => new Map<string, string>());

const storageGate = vi.hoisted(() => ({
  blockPrimaryAuthWrites: false,
}));

const networkGate = vi.hoisted(() => ({
  offline: true,
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

describe('pending global revoke when storage recovers before network', () => {
  let logoutCalls: { url: string; authorization: string | null }[];

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.resetModules();
    authSignOut.mockReset();
    authSignOut.mockResolvedValue({ error: null });
    diskRef.clear();
    markerDiskRef.clear();
    storageGate.blockPrimaryAuthWrites = false;
    networkGate.offline = true;
    logoutCalls = [];
    resetInMemoryPendingGlobalRevokeForTests();
    resetPendingGlobalRevokeStateForTests();
    await installIndependentMarkerStore();
    await resetAuthEvents(null, null);
    mockProbe();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          const headers = init?.headers;
          let authorization: string | null = null;
          if (headers instanceof Headers) {
            authorization = headers.get('Authorization');
          } else if (headers && typeof headers === 'object') {
            authorization =
              (headers as Record<string, string>).Authorization ??
              (headers as Record<string, string>).authorization ??
              null;
          }
          logoutCalls.push({ url, authorization });
          if (networkGate.offline) {
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

  it('keeps session on disk through backoff while offline, then revokes globally after reload and going online', async () => {
    const sessionJson = makeSessionJson(USER_A, SESS_A1);
    diskRef.set(SESSION_KEY, sessionJson);
    const storageA = await initStorage();
    await storageA.getItem(SESSION_KEY);
    await resetAuthEvents(USER_A, SESS_A1);

    storageGate.blockPrimaryAuthWrites = true;
    await completeBlockedSignOut();

    expect(logoutCalls).toHaveLength(1);
    expect(logoutCalls[0]?.url).toContain('scope=global');
    expect(storageA.hasPendingDiskPersistence()).toBe(true);
    const markerMod = await import('./pending-global-revoke-marker');
    await expect(markerMod.readPendingGlobalRevokeMarkerSessionId()).resolves.toBe(SESS_A1);
    expect(parseSessionIdFromAuthSessionPayload(diskRef.get(SESSION_KEY) ?? null)).toBe(SESS_A1);

    storageGate.blockPrimaryAuthWrites = false;
    await storageA.retryPendingDiskPersistence();

    expect(logoutCalls).toHaveLength(2);
    expect(parseSessionIdFromAuthSessionPayload(diskRef.get(SESSION_KEY) ?? null)).toBe(SESS_A1);
    expect(markerDiskRef.has(PENDING_GLOBAL_REVOKE_MARKER_KEY)).toBe(true);

    vi.resetModules();
    await installIndependentMarkerStore();
    await resetAuthEvents(USER_A, SESS_A1);
    const storageB = await initStorage();
    await expect(storageB.getItem(SESSION_KEY)).resolves.toBeNull();

    const pendingRevoke = await import('./pending-global-revoke');
    await pendingRevoke.runPendingGlobalRevokeBeforeSessionRestore();
    const logoutsBeforeOnline = logoutCalls.length;

    networkGate.offline = false;
    await pendingRevoke.runPendingGlobalRevokeBeforeSessionRestore();

    expect(logoutCalls.length - logoutsBeforeOnline).toBe(1);
    const lastLogout = logoutCalls[logoutCalls.length - 1];
    expect(lastLogout?.url).toContain('scope=global');
    expect(lastLogout?.authorization).toContain(makeTestAccessToken(SESS_A1));

    await expect(storageB.getItem(SESSION_KEY)).resolves.toBeNull();
    const marker = await import('./pending-global-revoke-marker');
    await expect(marker.readPendingGlobalRevokeMarkerSessionId()).resolves.toBeNull();
    expect(parseSessionIdFromAuthSessionPayload(diskRef.get(SESSION_KEY) ?? null)).toBeNull();
  });
});
