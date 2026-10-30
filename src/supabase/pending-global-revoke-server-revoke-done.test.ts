import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSessionIdFromAuthSessionPayload } from './auth-session-id';
import {
  PENDING_GLOBAL_REVOKE_MARKER_KEY,
  readPendingGlobalRevokeMarkerSessionId,
} from './pending-global-revoke-marker';
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
const SESS_A1 = 'sess-a1-server-done';

const diskRef = vi.hoisted(() => new Map<string, string>());
const storageGate = vi.hoisted(() => ({ blockWrites: false }));

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(async (key: string) => {
    if (key === '@weigh-way/auth-storage-probe') {
      return '1';
    }
    return diskRef.get(key) ?? null;
  }),
  setItem: vi.fn(async (key: string, value: string) => {
    if (key === '@weigh-way/auth-storage-probe') {
      return;
    }
    if (storageGate.blockWrites && key !== PENDING_GLOBAL_REVOKE_MARKER_KEY) {
      throw new DOMException('blocked', 'SecurityError');
    }
    diskRef.set(key, value);
  }),
  removeItem: vi.fn(async (key: string) => {
    if (storageGate.blockWrites && key !== PENDING_GLOBAL_REVOKE_MARKER_KEY) {
      throw new DOMException('blocked', 'SecurityError');
    }
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

function makeSessionJson(): string {
  return JSON.stringify({
    access_token: makeTestAccessToken(SESS_A1),
    refresh_token: 'refresh-a1',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: { id: USER_A, aud: 'authenticated', role: 'authenticated', email: 'a@example.com' },
  });
}

describe('serverRevokeDone marker clears after storage recovers', () => {
  beforeEach(() => {
    vi.resetModules();
    diskRef.clear();
    storageGate.blockWrites = false;
    resilientStorageRef.current = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/logout')) {
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resilientStorageRef.current = null;
  });

  it('removes the session JSON and marker after flush when server revoke already succeeded', async () => {
    diskRef.set(SESSION_KEY, makeSessionJson());
    const { createResilientAuthStorage } = await import('./resilient-auth-storage');
    const storage = createResilientAuthStorage();
    resilientStorageRef.current = storage;
    await storage.getItem(SESSION_KEY);

    storageGate.blockWrites = true;
    const { signOutSession } = await import('./sign-out-session');
    const result = await signOutSession({
      accessToken: makeTestAccessToken(SESS_A1),
      refreshToken: 'refresh-a1',
      userId: USER_A,
    });
    expect(result.localClearIncomplete).toBe(true);
    const markerRaw = diskRef.get(PENDING_GLOBAL_REVOKE_MARKER_KEY) ?? '';
    expect(JSON.parse(markerRaw).serverRevokeDone).toBe(true);

    storageGate.blockWrites = false;
    await storage.retryPendingDiskPersistence();

    await expect(readPendingGlobalRevokeMarkerSessionId()).resolves.toBeNull();
    expect(diskRef.has(SESSION_KEY)).toBe(false);

    const reloaded = createResilientAuthStorage();
    await expect(reloaded.getItem(SESSION_KEY)).resolves.toBeNull();
    expect(parseSessionIdFromAuthSessionPayload(diskRef.get(SESSION_KEY) ?? null)).toBeNull();
  });
});
