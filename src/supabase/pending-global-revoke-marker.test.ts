import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashAuthCode } from '../storage/auth-code-hash';
import { makeTestAccessToken } from './auth-session-id';
import {
  PENDING_GLOBAL_REVOKE_MARKER_KEY,
  sessionPayloadMatchesPendingRevokeMarker,
} from './pending-global-revoke-marker';

vi.mock('./sign-out-deadlines', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sign-out-deadlines')>();
  return {
    ...actual,
    PENDING_GLOBAL_REVOKE_MARKER_READ_TIMEOUT_MS: 30,
  };
});

describe('pending global revoke marker matching', () => {
  afterEach(async () => {
    const { setPendingGlobalRevokeMarkerStoreForTests } = await import(
      './pending-global-revoke-marker-store'
    );
    setPendingGlobalRevokeMarkerStoreForTests(null);
  });

  it('blocks session restore when marker read times out (fail closed)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { setPendingGlobalRevokeMarkerStoreForTests } = await import(
      './pending-global-revoke-marker-store'
    );
    setPendingGlobalRevokeMarkerStoreForTests({
      read: () => new Promise(() => {}),
      write: async () => true,
      clear: async () => undefined,
    });

    const marker = await import('./pending-global-revoke-marker');
    const sessionJson = JSON.stringify({
      access_token: makeTestAccessToken('sess-a'),
      user: { id: 'u1' },
    });
    const blockedPromise = marker.pendingGlobalRevokeBlocksSessionRestore(sessionJson);
    await vi.advanceTimersByTimeAsync(50);
    await expect(blockedPromise).resolves.toBe(true);
    vi.useRealTimers();
  });

  it('matches sessions without JWT session_id via access-token hash', async () => {
    const token = 'plain-access-token-no-jwt-session';
    const { setPendingGlobalRevokeMarkerStoreForTests } = await import(
      './pending-global-revoke-marker-store'
    );
    setPendingGlobalRevokeMarkerStoreForTests({
      read: async () => JSON.stringify({ sessionId: `h:${hashAuthCode(token)}` }),
      write: async () => true,
      clear: async () => undefined,
    });

    const marker = await import('./pending-global-revoke-marker');
    const raw = JSON.stringify({
      access_token: token,
      user: { id: 'u1' },
    });
    await expect(marker.pendingGlobalRevokeBlocksSessionRestore(raw)).resolves.toBe(true);
    await expect(marker.readPendingGlobalRevokeMarkerSessionId()).resolves.toBe(
      `h:${hashAuthCode(token)}`,
    );
    expect(sessionPayloadMatchesPendingRevokeMarker(`h:${hashAuthCode(token)}`, raw)).toBe(true);
  });
});

describe('pending global revoke startup fail cap', () => {
  afterEach(async () => {
    const { setPendingGlobalRevokeMarkerStoreForTests } = await import(
      './pending-global-revoke-marker-store'
    );
    setPendingGlobalRevokeMarkerStoreForTests(null);
  });

  it('keeps the marker after startup fail cap so the session stays hidden', async () => {
    const markerDisk = new Map<string, string>();
    const { setPendingGlobalRevokeMarkerStoreForTests } = await import(
      './pending-global-revoke-marker-store'
    );
    setPendingGlobalRevokeMarkerStoreForTests({
      read: async () => markerDisk.get(PENDING_GLOBAL_REVOKE_MARKER_KEY) ?? null,
      write: async (value) => {
        markerDisk.set(PENDING_GLOBAL_REVOKE_MARKER_KEY, value);
        return true;
      },
      clear: async () => {
        markerDisk.delete(PENDING_GLOBAL_REVOKE_MARKER_KEY);
      },
    });

    const marker = await import('./pending-global-revoke-marker');
    const sessionId = 'sess-cap-test';
    await marker.writePendingGlobalRevokeMarker(sessionId, 2);
    await marker.incrementPendingGlobalRevokeStartupFailCount({
      sessionId,
      startupFailCount: 2,
    });

    const raw = markerDisk.get(PENDING_GLOBAL_REVOKE_MARKER_KEY) ?? '';
    expect(JSON.parse(raw).startupFailCount).toBe(3);
    await expect(marker.readPendingGlobalRevokeMarkerSessionId()).resolves.toBe(sessionId);

    const sessionJson = JSON.stringify({
      access_token: makeTestAccessToken(sessionId),
      user: { id: 'u1' },
    });
    await expect(marker.pendingGlobalRevokeBlocksSessionRestore(sessionJson)).resolves.toBe(true);
  });

  it('times out marker writes under the write deadline', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { setPendingGlobalRevokeMarkerStoreForTests } = await import(
      './pending-global-revoke-marker-store'
    );
    setPendingGlobalRevokeMarkerStoreForTests({
      read: async () => null,
      write: () => new Promise<boolean>(() => {}),
      clear: async () => undefined,
    });

    const marker = await import('./pending-global-revoke-marker');
    const writePromise = marker.writePendingGlobalRevokeMarker('sess-write-timeout', undefined, 30);
    await vi.advanceTimersByTimeAsync(50);
    await expect(writePromise).resolves.toBe(false);
    vi.useRealTimers();
  });
});
