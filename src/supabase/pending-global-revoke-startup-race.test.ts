import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSessionIdFromAccessToken, parseSessionIdFromAuthSessionPayload } from './auth-session-id';
import { makeTestAccessToken } from './test-helpers/make-test-access-token';
import {
  createGotrueSessionRegistry,
  gotrueLogoutFetchHandler,
  type GotrueSessionRegistry,
} from './test-helpers/gotrue-session-logout-mock';
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

vi.mock('./sign-out-deadlines', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sign-out-deadlines')>();
  return {
    ...actual,
    SIGN_OUT_FLOW_CAP_MS: 500,
    SIGN_OUT_LOCAL_CLEAR_TIMEOUT_MS: 100,
    SIGN_OUT_SESSION_USER_CHECK_TIMEOUT_MS: 50,
    PENDING_GLOBAL_REVOKE_STARTUP_REVOKE_TIMEOUT_MS: 500,
  };
});

const configRef = vi.hoisted(() => ({
  url: 'https://example.supabase.co',
  anonKey: 'public-anon-key',
}));
const SESSION_KEY = 'sb-example-auth-token';
const USER_A = 'user-a-id';
const SESS_A1 = 'sess-a1-startup-race';
const SESS_A2 = 'sess-a2-startup-race';

const diskRef = vi.hoisted(() => new Map<string, string>());
const markerDiskRef = vi.hoisted(() => new Map<string, string>());
const serverRef = vi.hoisted(() => ({
  registry: null as GotrueSessionRegistry | null,
}));

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
}));

vi.mock('./auth-storage-key', () => ({
  getSupabaseAuthStorageKey: () => SESSION_KEY,
  getSupabaseLegacyPkceVerifierKey: () => `${SESSION_KEY}-code-verifier`,
}));

function makeSessionJson(userId: string, sessionId: string, refreshToken: string): string {
  serverRef.registry?.register(userId, sessionId);
  return JSON.stringify({
    access_token: makeTestAccessToken(sessionId),
    refresh_token: refreshToken,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'a@example.com' },
  });
}

describe('startup pending local revoke vs re-sign-in', () => {
  beforeEach(async () => {
    vi.resetModules();
    diskRef.clear();
    markerDiskRef.clear();
    serverRef.registry = createGotrueSessionRegistry();
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
    diskRef.set('@weigh-way/auth-storage-probe', '1');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout') && url.includes('scope=local')) {
          return gotrueLogoutFetchHandler(serverRef.registry!, input, init, { delayMs: 624 });
        }
        return gotrueLogoutFetchHandler(serverRef.registry!, input, init);
      }),
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    resilientStorageRef.current = null;
    serverRef.registry = null;
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

  it('revokes only A1 on the server and keeps A2 locally when re-sign-in overlaps startup revoke', async () => {
    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A1, 'refresh-a1'));
    markerDiskRef.set(PENDING_GLOBAL_REVOKE_MARKER_KEY, JSON.stringify({ sessionId: SESS_A1 }));
    const storage = await initStorage();
    await storage.getItem(SESSION_KEY);
    await resetAuthEvents(USER_A, SESS_A1);

    const pendingRevoke = await import('./pending-global-revoke');
    const startupPromise = pendingRevoke.runPendingGlobalRevokeBeforeSessionRestore();

    await delay(100);
    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A2, 'refresh-a2'));
    await resetAuthEvents(USER_A, SESS_A2);
    await pendingRevoke.clearPendingGlobalRevokeIfSupersededByAuthEvent();

    await startupPromise;

    expect(serverRef.registry!.isAlive(SESS_A1)).toBe(false);
    expect(serverRef.registry!.isAlive(SESS_A2)).toBe(true);

    const raw = await storage.getItem(SESSION_KEY);
    expect(parseSessionIdFromAuthSessionPayload(raw)).toBe(SESS_A2);
    expect(diskRef.has(SESSION_KEY)).toBe(true);
    await expect(readPendingGlobalRevokeMarkerSessionId()).resolves.toBeNull();
  });

  it('keeps a cold-start session on disk when the marker targets an older session id', async () => {
    serverRef.registry!.register(USER_A, SESS_A2);
    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A2, 'refresh-a2'));
    markerDiskRef.set(PENDING_GLOBAL_REVOKE_MARKER_KEY, JSON.stringify({ sessionId: SESS_A1 }));
    serverRef.registry!.register(USER_A, SESS_A1);

    const storage = await initStorage();
    await storage.getItem(SESSION_KEY);
    await resetAuthEvents(USER_A, SESS_A2);

    const pendingRevoke = await import('./pending-global-revoke');
    await pendingRevoke.runPendingGlobalRevokeBeforeSessionRestore();

    expect(serverRef.registry!.isAlive(SESS_A2)).toBe(true);
    expect(parseSessionIdFromAuthSessionPayload(await storage.getItem(SESSION_KEY))).toBe(SESS_A2);
    await expect(readPendingGlobalRevokeMarkerSessionId()).resolves.toBeNull();
  });

  it('drops the marker without /logout when the pending token has no JWT session_id', async () => {
    const plainToken = makeTestAccessToken('');
    expect(parseSessionIdFromAccessToken(plainToken)).toBeNull();
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
    markerDiskRef.set(
      PENDING_GLOBAL_REVOKE_MARKER_KEY,
      JSON.stringify({ sessionId: 'h:deadbeef' }),
    );

    const storage = await initStorage();
    await storage.getItem(SESSION_KEY);

    const pendingRevoke = await import('./pending-global-revoke');
    await pendingRevoke.runPendingGlobalRevokeBeforeSessionRestore();

    await expect(readPendingGlobalRevokeMarkerSessionId()).resolves.toBeNull();
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });
});
