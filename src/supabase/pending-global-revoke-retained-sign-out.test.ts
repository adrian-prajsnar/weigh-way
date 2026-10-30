import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestAccessToken } from './test-helpers/make-test-access-token';
import {
  createGotrueSessionRegistry,
  gotrueLogoutFetchHandler,
  type GotrueSessionRegistry,
} from './test-helpers/gotrue-session-logout-mock';
import { PENDING_GLOBAL_REVOKE_MARKER_KEY } from './pending-global-revoke-marker';
import { PENDING_SUPERSEDED_REVOKE_STORAGE_KEY } from './pending-superseded-revoke';

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
const SESS_A1 = 'sess-a1-retained';
const SESS_A2 = 'sess-a2-live';

const diskRef = vi.hoisted(() => new Map<string, string>());
const markerDiskRef = vi.hoisted(() => new Map<string, string>());
const supersededDiskRef = vi.hoisted(() => new Map<string, string>());
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

describe('sign-out with retained superseded revoke', () => {
  beforeEach(async () => {
    vi.resetModules();
    diskRef.clear();
    markerDiskRef.clear();
    supersededDiskRef.clear();
    serverRef.registry = createGotrueSessionRegistry();
    diskRef.set('@weigh-way/auth-storage-probe', '1');

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
        return raw ? JSON.parse(raw) : {};
      },
      write: async (map) => {
        supersededDiskRef.set(PENDING_SUPERSEDED_REVOKE_STORAGE_KEY, JSON.stringify(map));
      },
    });

    const localUser = await import('./sign-out-local-user');
    localUser.noteLatestAuthUserIdFromEvent(USER_A);
    localUser.noteLatestAuthSessionIdFromEvent(SESS_A2);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          return gotrueLogoutFetchHandler(serverRef.registry!, input, init);
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );

    diskRef.set(SESSION_KEY, makeSessionJson(USER_A, SESS_A2, 'refresh-a2'));
    markerDiskRef.set(PENDING_GLOBAL_REVOKE_MARKER_KEY, JSON.stringify({ sessionId: SESS_A1 }));
    const tokenA1 = makeTestAccessToken(SESS_A1, { sub: USER_A });
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

    const { createResilientAuthStorage } = await import('./resilient-auth-storage');
    resilientStorageRef.current = createResilientAuthStorage();
    await resilientStorageRef.current.getItem(SESSION_KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resilientStorageRef.current = null;
  });

  it('does not report localClearIncomplete when signing out session A2', async () => {
    const tokenA2 = makeTestAccessToken(SESS_A2, { sub: USER_A });
    const { signOutSession } = await import('./sign-out-session');
    const result = await signOutSession({
      accessToken: tokenA2,
      refreshToken: 'refresh-a2',
      userId: USER_A,
    });

    expect(result.localClearIncomplete).toBe(false);
    expect(resilientStorageRef.current!.consumeSignOutPersistWarning()).toBe(false);
    const markerMod = await import('./pending-global-revoke-marker');
    await expect(markerMod.readPendingGlobalRevokeMarkerSessionId()).resolves.toBeNull();
    expect(supersededDiskRef.get(PENDING_SUPERSEDED_REVOKE_STORAGE_KEY) ?? '{}').toBe('{}');
  });
});
