import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSessionIdFromAuthSessionPayload } from './auth-session-id';
import { makeTestAccessToken } from './test-helpers/make-test-access-token';
import { setPendingGlobalRevokeMarkerStoreForTests } from './pending-global-revoke-marker-store';

vi.mock('./sign-out-deadlines', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sign-out-deadlines')>();
  return { ...actual, PENDING_GLOBAL_REVOKE_MARKER_READ_TIMEOUT_MS: 50 };
});

const diskRef = vi.hoisted(() => new Map<string, string>());
const storageBroken = vi.hoisted(() => ({ current: false }));

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

describe('native pending global revoke storage gap', () => {
  const sessionKey = 'sb-localhost-auth-token';
  const SESS_A1 = 'sess-native-a1';

  beforeEach(() => {
    vi.resetModules();
    diskRef.clear();
    storageBroken.current = false;
    setPendingGlobalRevokeMarkerStoreForTests(null);
    diskRef.set(sessionKey, JSON.stringify({ access_token: makeTestAccessToken(SESS_A1) }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setPendingGlobalRevokeMarkerStoreForTests(null);
  });

  it('cannot persist a marker when every AsyncStorage write fails (native triple fault remains)', async () => {
    const { createResilientAuthStorage } = await import('./resilient-auth-storage');
    const storageA = createResilientAuthStorage();
    await storageA.getItem(sessionKey);

    storageBroken.current = true;
    const { setPendingGlobalRevokeMarkerStoreForTests } = await import(
      './pending-global-revoke-marker-store'
    );
    setPendingGlobalRevokeMarkerStoreForTests({
      read: async () => null,
      write: async () => false,
      clear: async () => undefined,
    });
    const { writePendingGlobalRevokeMarker } = await import('./pending-global-revoke-marker');
    await expect(writePendingGlobalRevokeMarker(SESS_A1)).resolves.toBe(false);

    vi.resetModules();
    storageBroken.current = false;
    const { readPendingGlobalRevokeMarkerSessionId } = await import('./pending-global-revoke-marker');
    await expect(readPendingGlobalRevokeMarkerSessionId()).resolves.toBeNull();

    const storageB = createResilientAuthStorage();
    const raw = await storageB.getItem(sessionKey);
    expect(parseSessionIdFromAuthSessionPayload(raw)).toBe(SESS_A1);
  });
});
