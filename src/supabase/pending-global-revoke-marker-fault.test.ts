import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSessionIdFromAuthSessionPayload } from './auth-session-id';
import { PENDING_GLOBAL_REVOKE_MARKER_KEY } from './pending-global-revoke-marker';
import { noteLatestAuthUserIdFromEvent } from './sign-out-local-user';
import { makeTestAccessToken } from './test-helpers/make-test-access-token';

vi.mock('./sign-out-deadlines', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sign-out-deadlines')>();
  return {
    ...actual,
    SIGN_OUT_FLOW_CAP_MS: 500,
    SIGN_OUT_LOCAL_CLEAR_TIMEOUT_MS: 100,
    SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS: 100,
  };
});

const configRef = vi.hoisted(() => ({
  url: 'https://example.supabase.co',
  anonKey: 'public-anon-key',
}));
const SESSION_KEY = 'sb-example-auth-token';
const USER_A = 'user-a-id';
const SESS_A1 = 'sess-marker-fault';

const diskRef = vi.hoisted(() => new Map<string, string>());
const storageBroken = vi.hoisted(() => ({ current: false }));
const resilientStorageRef = vi.hoisted(() => ({
  current: null as ReturnType<
    typeof import('./resilient-auth-storage').createResilientAuthStorage
  > | null,
}));

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(async (key: string) => {
    if (key === '@weigh-way/auth-storage-probe') {
      return '1';
    }
    if (storageBroken.current) {
      throw new DOMException('blocked', 'SecurityError');
    }
    return diskRef.get(key) ?? null;
  }),
  setItem: vi.fn(async (key: string, value: string) => {
    if (key === '@weigh-way/auth-storage-probe') {
      return;
    }
    if (storageBroken.current) {
      throw new DOMException('blocked', 'SecurityError');
    }
    diskRef.set(key, value);
  }),
  removeItem: vi.fn(async (key: string) => {
    if (storageBroken.current) {
      throw new DOMException('blocked', 'SecurityError');
    }
    diskRef.delete(key);
  }),
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

describe('marker store faults through default persistence (no bypass)', () => {
  beforeEach(() => {
    vi.resetModules();
    diskRef.clear();
    storageBroken.current = false;
    resilientStorageRef.current = null;
    noteLatestAuthUserIdFromEvent(USER_A);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    resilientStorageRef.current = null;
    const { setPendingGlobalRevokeMarkerStoreForTests } = await import(
      './pending-global-revoke-marker-store'
    );
    setPendingGlobalRevokeMarkerStoreForTests(null);
  });

  it('cannot persist a marker when the default marker store AsyncStorage writes fail', async () => {
    storageBroken.current = true;
    const { writePendingGlobalRevokeMarker } = await import('./pending-global-revoke-marker');
    await expect(writePendingGlobalRevokeMarker(SESS_A1)).resolves.toBe(false);
    expect(diskRef.has(PENDING_GLOBAL_REVOKE_MARKER_KEY)).toBe(false);
  });

  it('restores session A after reload when triple-fault cannot persist marker or local clear (native residual)', async () => {
    diskRef.set(
      SESSION_KEY,
      JSON.stringify({
        access_token: makeTestAccessToken(SESS_A1),
        refresh_token: 'refresh-a1',
        user: { id: USER_A },
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          return new Response(JSON.stringify({ msg: 'offline' }), { status: 503 });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );

    const { createResilientAuthStorage } = await import('./resilient-auth-storage');
    const storage = createResilientAuthStorage();
    resilientStorageRef.current = storage;
    await storage.getItem(SESSION_KEY);

    storageBroken.current = true;
    const { signOutSession } = await import('./sign-out-session');
    await signOutSession({
      accessToken: makeTestAccessToken(SESS_A1),
      refreshToken: 'refresh-a1',
      userId: USER_A,
    });

    storageBroken.current = false;
    const reloaded = createResilientAuthStorage();
    const raw = await reloaded.getItem(SESSION_KEY);
    expect(parseSessionIdFromAuthSessionPayload(raw)).toBe(SESS_A1);
  });
});
