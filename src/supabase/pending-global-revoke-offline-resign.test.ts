import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSessionIdFromAuthSessionPayload } from './auth-session-id';
import { makeTestAccessToken } from './test-helpers/make-test-access-token';
import {
  PENDING_GLOBAL_REVOKE_MARKER_KEY,
  readPendingGlobalRevokeMarkerSessionId,
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
const SESS_A1 = 'sess-a1-offline';
const SESS_A2 = 'sess-a2-resign';

const diskRef = vi.hoisted(() => new Map<string, string>());
const markerDiskRef = vi.hoisted(() => new Map<string, string>());

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(async (key: string) => diskRef.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => {
    diskRef.set(key, value);
  }),
  removeItem: vi.fn(async (key: string) => {
    diskRef.delete(key);
  }),
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
  retryAuthStorageDiskPersistence: () => {
    void resilientStorageRef.current?.retryPendingDiskPersistence();
  },
}));

vi.mock('./auth-storage-key', () => ({
  getSupabaseAuthStorageKey: () => SESSION_KEY,
  getSupabaseLegacyPkceVerifierKey: () => `${SESSION_KEY}-code-verifier`,
}));

function makeSessionJson(userId: string, sessionId: string, refreshToken: string): string {
  return JSON.stringify({
    access_token: makeTestAccessToken(sessionId),
    refresh_token: refreshToken,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'a@example.com' },
  });
}

function mockProbe() {
  diskRef.set('@weigh-way/auth-storage-probe', '1');
}

describe('offline sign-out then sign-in keeps the new session', () => {
  let logoutCalls: { url: string; authorization: string | null }[];
  let networkOnline: boolean;

  beforeEach(async () => {
    vi.resetModules();
    diskRef.clear();
    markerDiskRef.clear();
    networkOnline = false;
    logoutCalls = [];
    resetInMemoryPendingGlobalRevokeForTests();
    resetPendingGlobalRevokeStateForTests();
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
    await resetAuthEvents(null, null);
    mockProbe();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          const headers = new Headers(init?.headers);
          logoutCalls.push({
            url,
            authorization: headers.get('Authorization'),
          });
          if (!networkOnline) {
            return new Response(JSON.stringify({ msg: 'offline' }), { status: 503 });
          }
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );
  });

  afterEach(async () => {
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

  it('does not hide or globally revoke session A2 after offline sign-out of A1', async () => {
    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A1, 'refresh-a1'));
    const storage = await initStorage();
    await storage.getItem(SESSION_KEY);
    await resetAuthEvents(USER_A, SESS_A1);

    const { signOutSession } = await import('./sign-out-session');
    const result = await signOutSession({
      accessToken: makeTestAccessToken(SESS_A1),
      refreshToken: 'refresh-a1',
      userId: USER_A,
    });

    expect(result.serverSignOutUnreachable).toBe(true);
    expect(result.localClearIncomplete).toBe(false);
    await expect(readPendingGlobalRevokeMarkerSessionId()).resolves.toBeNull();
    const pendingRevoke = await import('./pending-global-revoke');
    expect(pendingRevoke.getInMemoryPendingGlobalRevoke()?.revokeScope).toBe('local');

    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A2, 'refresh-a2'));
    networkOnline = true;
    await resetAuthEvents(USER_A, SESS_A2);
    await pendingRevoke.clearPendingGlobalRevokeIfSupersededByAuthEvent();
    expect(pendingRevoke.getInMemoryPendingGlobalRevoke()).toBeNull();

    const raw = await storage.getItem(SESSION_KEY);
    expect(parseSessionIdFromAuthSessionPayload(raw)).toBe(SESS_A2);

    const { retryAuthStorageDiskPersistence } = await import('./auth-session-storage');
    retryAuthStorageDiskPersistence();
    const pendingAfterSignIn = await import('./pending-global-revoke');
    await pendingAfterSignIn.retryPendingGlobalRevokeBeforeDiskPersistence(SESSION_KEY);
    await pendingAfterSignIn.runPendingGlobalRevokeBeforeSessionRestore();

    vi.resetModules();
    await resetAuthEvents(USER_A, SESS_A2);
    const storageReloaded = await initStorage();
    expect(await storageReloaded.getItem(SESSION_KEY)).not.toBeNull();
    expect(parseSessionIdFromAuthSessionPayload(await storageReloaded.getItem(SESSION_KEY))).toBe(
      SESS_A2,
    );

    expect(logoutCalls.filter((c) => c.url.includes('scope=global'))).toHaveLength(2);
    expect(logoutCalls).toHaveLength(2);
    expect(logoutCalls[1]?.authorization).toContain(makeTestAccessToken(SESS_A1));
  });

  it('revokes the old session globally before dropping pending revoke on same-account re-sign-in', async () => {
    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A1, 'refresh-a1'));
    const storage = await initStorage();
    await storage.getItem(SESSION_KEY);
    await resetAuthEvents(USER_A, SESS_A1);

    const { signOutSession } = await import('./sign-out-session');
    await signOutSession({
      accessToken: makeTestAccessToken(SESS_A1),
      refreshToken: 'refresh-a1',
      userId: USER_A,
    });

    expect(logoutCalls).toHaveLength(1);
    const pendingRevoke = await import('./pending-global-revoke');
    expect(pendingRevoke.getInMemoryPendingGlobalRevoke()?.sessionId).toBe(SESS_A1);

    networkOnline = true;
    await resetAuthEvents(USER_A, SESS_A2);
    await pendingRevoke.clearPendingGlobalRevokeIfSupersededByAuthEvent();

    expect(logoutCalls.filter((c) => c.url.includes('scope=global'))).toHaveLength(2);
    expect(logoutCalls[1]?.authorization).toContain(makeTestAccessToken(SESS_A1));
    expect(pendingRevoke.getInMemoryPendingGlobalRevoke()).toBeNull();
  });
});
