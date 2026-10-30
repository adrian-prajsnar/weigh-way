import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSessionIdFromAuthSessionPayload } from './auth-session-id';
import { makeTestAccessToken } from './test-helpers/make-test-access-token';
import {
  createGotrueSessionRegistry,
  gotrueLogoutFetchHandler,
  type GotrueSessionRegistry,
} from './test-helpers/gotrue-session-logout-mock';
import {
  pendingRevokeMarkerKeyForAccessToken,
  PENDING_GLOBAL_REVOKE_MARKER_KEY,
} from './pending-global-revoke-marker';
import { PENDING_SUPERSEDED_REVOKE_STORAGE_KEY } from './pending-superseded-revoke';

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
const SESS_A1 = 'sess-a1-contract';
const SESS_A2 = 'sess-a2-contract';

const diskRef = vi.hoisted(() => new Map<string, string>());
const markerDiskRef = vi.hoisted(() => new Map<string, string>());
const supersededDiskRef = vi.hoisted(() => new Map<string, string>());
const serverRef = vi.hoisted(() => ({
  registry: null as GotrueSessionRegistry | null,
}));
const networkRef = vi.hoisted(() => ({ online: true, blockLogout: false }));
const signOutLocalCalls = vi.hoisted(() => [] as { scope?: string }[]);

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
      signOut: vi.fn(async (options?: { scope?: string }) => {
        signOutLocalCalls.push({ scope: options?.scope });
        return { error: null };
      }),
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
  const accessToken = makeTestAccessToken(sessionId, { sub: userId });
  serverRef.registry?.register(userId, sessionId, accessToken);
  return JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'a@example.com' },
  });
}

describe('pending revoke contract pins', () => {
  let logoutCalls: { url: string; authorization: string | null }[];

  beforeEach(async () => {
    vi.resetModules();
    diskRef.clear();
    markerDiskRef.clear();
    supersededDiskRef.clear();
    serverRef.registry = createGotrueSessionRegistry();
    networkRef.online = true;
    networkRef.blockLogout = false;
    logoutCalls = [];
    signOutLocalCalls.length = 0;
    const { resetInMemoryPendingGlobalRevokeForTests } = await import(
      './pending-global-revoke-in-memory'
    );
    resetInMemoryPendingGlobalRevokeForTests();
    const { resetPendingGlobalRevokeStateForTests } = await import('./pending-global-revoke');
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
    const { setPendingSupersededRevokeStoreForTests } = await import(
      './pending-superseded-revoke'
    );
    setPendingSupersededRevokeStoreForTests({
      read: async () => {
        const raw = supersededDiskRef.get(PENDING_SUPERSEDED_REVOKE_STORAGE_KEY);
        if (!raw) {
          return {};
        }
        return JSON.parse(raw) as import('./pending-superseded-revoke').PersistedSupersededRevokeMap;
      },
      write: async (map) => {
        supersededDiskRef.set(PENDING_SUPERSEDED_REVOKE_STORAGE_KEY, JSON.stringify(map));
      },
    });
    await resetAuthEvents(null, null);
    diskRef.set('@weigh-way/auth-storage-probe', '1');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          const headers = new Headers(init?.headers);
          logoutCalls.push({ url, authorization: headers.get('Authorization') });
          if (!networkRef.online) {
            return new Response(JSON.stringify({ msg: 'offline' }), { status: 503 });
          }
          if (networkRef.blockLogout) {
            return new Response(JSON.stringify({ msg: 'down' }), { status: 503 });
          }
          return gotrueLogoutFetchHandler(serverRef.registry!, input, init);
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
    const { setPendingSupersededRevokeStoreForTests } = await import(
      './pending-superseded-revoke'
    );
    setPendingSupersededRevokeStoreForTests(null);
  });

  async function initStorage() {
    const { createResilientAuthStorage } = await import('./resilient-auth-storage');
    const storage = createResilientAuthStorage();
    resilientStorageRef.current = storage;
    return storage;
  }

  it('requires delayed marker arm to stay scope=local (regression pin)', async () => {
    const pending = await import('./pending-global-revoke');
    await pending.armPendingGlobalRevokeMarker({
      sessionId: SESS_A1,
      userId: USER_A,
      accessToken: makeTestAccessToken(SESS_A1),
      refreshToken: 'refresh-a1',
    });
    expect(pending.getInMemoryPendingGlobalRevoke()?.revokeScope).toBe('local');
  });

  it('runtime retry uses scope=local on /logout', async () => {
    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A1, 'refresh-a1'));
    markerDiskRef.set(PENDING_GLOBAL_REVOKE_MARKER_KEY, JSON.stringify({ sessionId: SESS_A1 }));
    const storage = await initStorage();
    await storage.getItem(SESSION_KEY);
    await resetAuthEvents(USER_A, SESS_A1);

    const pending = await import('./pending-global-revoke');
    await pending.retryPendingGlobalRevokeBeforeDiskPersistence(SESSION_KEY);

    expect(logoutCalls.some((c) => c.url.includes('scope=local'))).toBe(true);
    expect(logoutCalls.every((c) => !c.url.includes('scope=global'))).toBe(true);
  });

  it('keeps A1 pending revoke when superseded local logout fails, then revokes A1 on retry', async () => {
    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A1, 'refresh-a1'));
    const storage = await initStorage();
    await storage.getItem(SESSION_KEY);
    await resetAuthEvents(USER_A, SESS_A1);

    const { signOutSession } = await import('./sign-out-session');
    networkRef.online = false;
    await signOutSession({
      accessToken: makeTestAccessToken(SESS_A1),
      refreshToken: 'refresh-a1',
      userId: USER_A,
    });

    const pending = await import('./pending-global-revoke');
    expect(pending.getInMemoryPendingGlobalRevoke()?.sessionId).toBe(SESS_A1);

    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A2, 'refresh-a2'));
    networkRef.blockLogout = true;
    networkRef.online = true;
    await resetAuthEvents(USER_A, SESS_A2);
    await pending.clearPendingGlobalRevokeIfSupersededByAuthEvent();

    const markerMod = await import('./pending-global-revoke-marker');
    expect(serverRef.registry!.isAlive(SESS_A2)).toBe(true);
    expect(serverRef.registry!.isAlive(SESS_A1)).toBe(true);
    await expect(markerMod.readPendingGlobalRevokeMarkerSessionId()).resolves.toBe(SESS_A1);
    expect(pending.getInMemoryPendingGlobalRevoke()?.sessionId).toBe(SESS_A1);

    expect(parseSessionIdFromAuthSessionPayload(await storage.getItem(SESSION_KEY))).toBe(SESS_A2);

    networkRef.blockLogout = false;
    await pending.retryPendingGlobalRevokeBeforeDiskPersistence(SESSION_KEY);

    expect(serverRef.registry!.isAlive(SESS_A1)).toBe(false);
    expect(serverRef.registry!.isAlive(SESS_A2)).toBe(true);
    expect(logoutCalls.filter((c) => c.url.includes('scope=local')).length).toBeGreaterThan(0);
    expect(supersededDiskRef.has(PENDING_SUPERSEDED_REVOKE_STORAGE_KEY)).toBe(true);
  });

  it('reload revokes persisted A1 with scope=local while A2 session stays on disk', async () => {
    const tokenA1 = makeTestAccessToken(SESS_A1, { sub: USER_A });
    serverRef.registry!.register(USER_A, SESS_A1, tokenA1);
    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A2, 'refresh-a2'));
    markerDiskRef.set(PENDING_GLOBAL_REVOKE_MARKER_KEY, JSON.stringify({ sessionId: SESS_A1 }));
    supersededDiskRef.set(
      PENDING_SUPERSEDED_REVOKE_STORAGE_KEY,
      JSON.stringify({
        [SESS_A1]: {
          sessionId: SESS_A1,
          userId: USER_A,
          accessToken: tokenA1,
          refreshToken: 'refresh-a1',
          createdAtMs: Date.now(),
          attemptCount: 0,
        },
      }),
    );

    await resetAuthEvents(USER_A, SESS_A2);
    const storage = await initStorage();
    await storage.getItem(SESSION_KEY);

    const pending = await import('./pending-global-revoke');
    await pending.runPendingGlobalRevokeBeforeSessionRestore();

    expect(serverRef.registry!.isAlive(SESS_A1)).toBe(false);
    expect(serverRef.registry!.isAlive(SESS_A2)).toBe(true);
    expect(parseSessionIdFromAuthSessionPayload(await storage.getItem(SESSION_KEY))).toBe(SESS_A2);
    const a1Logout = logoutCalls.find((c) => c.authorization?.includes(tokenA1));
    expect(a1Logout?.url).toContain('scope=local');
    expect(logoutCalls.every((c) => !c.authorization?.includes(makeTestAccessToken(SESS_A2)))).toBe(
      true,
    );
  });

  it('clears local session when abandoning a no-session_id pending revoke', async () => {
    const plainToken = makeTestAccessToken('');
    const markerKey = pendingRevokeMarkerKeyForAccessToken(plainToken);
    diskRef.set(
      SESSION_KEY,
      JSON.stringify({
        access_token: plainToken,
        refresh_token: 'refresh-a1',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: { id: USER_A, aud: 'authenticated', role: 'authenticated', email: 'a@example.com' },
      }),
    );
    markerDiskRef.set(PENDING_GLOBAL_REVOKE_MARKER_KEY, JSON.stringify({ sessionId: markerKey }));
    const storage = await initStorage();
    await storage.getItem(SESSION_KEY);

    const pending = await import('./pending-global-revoke');
    await pending.runPendingGlobalRevokeBeforeSessionRestore();

    const markerMod = await import('./pending-global-revoke-marker');
    await expect(markerMod.readPendingGlobalRevokeMarkerSessionId()).resolves.toBeNull();
    expect(logoutCalls).toHaveLength(0);
    expect(await storage.getItem(SESSION_KEY)).toBeNull();
  });

  it('compare-and-delete skips remove when the live session id no longer matches', async () => {
    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A2, 'refresh-a2'));
    const storage = await initStorage();
    await storage.getItem(SESSION_KEY);
    await resetAuthEvents(USER_A, SESS_A2);

    const removed = await storage.removePrimaryAuthSessionIfSessionIdMatches(
      SESSION_KEY,
      SESS_A1,
    );

    expect(removed).toBe(false);
    expect(parseSessionIdFromAuthSessionPayload(await storage.getItem(SESSION_KEY))).toBe(SESS_A2);
    expect(signOutLocalCalls).toHaveLength(0);
  });

  it('runtime retry keeps A2 when compare-and-delete races A2 sign-in', async () => {
    const tokenA1 = makeTestAccessToken(SESS_A1, { sub: USER_A });
    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A2, 'refresh-a2'));
    markerDiskRef.set(PENDING_GLOBAL_REVOKE_MARKER_KEY, JSON.stringify({ sessionId: SESS_A1 }));
    supersededDiskRef.set(
      PENDING_SUPERSEDED_REVOKE_STORAGE_KEY,
      JSON.stringify({
        [SESS_A1]: {
          sessionId: SESS_A1,
          userId: USER_A,
          accessToken: tokenA1,
          refreshToken: 'refresh-a1',
          createdAtMs: Date.now(),
          attemptCount: 0,
        },
      }),
    );
    const storage = await initStorage();
    await storage.getItem(SESSION_KEY);
    await resetAuthEvents(USER_A, SESS_A2);

    let releaseRemove!: () => void;
    const removeGate = new Promise<void>((resolve) => {
      releaseRemove = resolve;
    });
    asyncStorage.removeItem.mockImplementation(async (key: string) => {
      if (key === SESSION_KEY) {
        await removeGate;
      }
      diskRef.delete(key);
    });

    const pending = await import('./pending-global-revoke');
    const retryPromise = pending.retryPendingGlobalRevokeBeforeDiskPersistence(SESSION_KEY);

    await vi.waitFor(() => {
      expect(logoutCalls.some((c) => c.authorization?.includes(tokenA1))).toBe(true);
    });

    await storage.setItem(SESSION_KEY, makeSessionJson(USER_A, SESS_A2, 'refresh-a2'));
    await resetAuthEvents(USER_A, SESS_A2);
    releaseRemove();
    await retryPromise;

    expect(parseSessionIdFromAuthSessionPayload(await storage.getItem(SESSION_KEY))).toBe(SESS_A2);
    expect(logoutCalls.every((c) => !c.authorization?.includes(makeTestAccessToken(SESS_A2)))).toBe(
      true,
    );
  });
});
