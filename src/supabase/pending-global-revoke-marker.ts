import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseSessionIdFromAuthSessionPayload } from './auth-session-id';
import { getPendingGlobalRevokeMarkerStore } from './pending-global-revoke-marker-store';
import {
  isSignOutDeadlineError,
  PENDING_GLOBAL_REVOKE_MARKER_READ_TIMEOUT_MS,
  withSignOutDeadline,
} from './sign-out-deadlines';

export const PENDING_GLOBAL_REVOKE_MARKER_KEY = '@weigh-way/auth-pending-global-revoke';

export const PENDING_GLOBAL_REVOKE_STARTUP_MAX_ATTEMPTS = 3;

export type PendingGlobalRevokeMarkerPayload = {
  sessionId: string;
  startupFailCount?: number;
};

function parseMarkerPayload(raw: string): PendingGlobalRevokeMarkerPayload | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as {
      sessionId?: string;
      userId?: string;
      startupFailCount?: number;
    };
    if (parsed.sessionId) {
      return {
        sessionId: parsed.sessionId,
        startupFailCount: parsed.startupFailCount,
      };
    }
    if (parsed.userId) {
      return null;
    }
  } catch {
    return null;
  }
  return null;
}

function serializeMarker(payload: PendingGlobalRevokeMarkerPayload): string {
  return JSON.stringify(payload);
}

async function readMarkerRawBounded(): Promise<string | null> {
  try {
    return await withSignOutDeadline(PENDING_GLOBAL_REVOKE_MARKER_READ_TIMEOUT_MS, () =>
      getPendingGlobalRevokeMarkerStore().read(),
    );
  } catch (error) {
    if (isSignOutDeadlineError(error)) {
      return null;
    }
    throw error;
  }
}

export async function readPendingGlobalRevokeMarkerPayload(): Promise<PendingGlobalRevokeMarkerPayload | null> {
  const raw = await readMarkerRawBounded();
  if (!raw) {
    return null;
  }
  return parseMarkerPayload(raw);
}

export async function readPendingGlobalRevokeMarkerSessionId(): Promise<string | null> {
  const payload = await readPendingGlobalRevokeMarkerPayload();
  return payload?.sessionId ?? null;
}

export async function clearPendingGlobalRevokeMarker(): Promise<void> {
  await getPendingGlobalRevokeMarkerStore().clear();
}

export async function writePendingGlobalRevokeMarker(
  sessionId: string,
  startupFailCount?: number,
): Promise<boolean> {
  const payload: PendingGlobalRevokeMarkerPayload = { sessionId };
  if (startupFailCount !== undefined) {
    payload.startupFailCount = startupFailCount;
  }
  return getPendingGlobalRevokeMarkerStore().write(serializeMarker(payload));
}

export async function incrementPendingGlobalRevokeStartupFailCount(
  current: PendingGlobalRevokeMarkerPayload,
): Promise<void> {
  const next = (current.startupFailCount ?? 0) + 1;
  if (next >= PENDING_GLOBAL_REVOKE_STARTUP_MAX_ATTEMPTS) {
    await clearPendingGlobalRevokeMarker();
    return;
  }
  await writePendingGlobalRevokeMarker(current.sessionId, next);
}

function isSignedOutSessionPayload(raw: string | null): boolean {
  if (!raw) {
    return false;
  }
  try {
    const parsed = JSON.parse(raw) as { signedOut?: boolean };
    return parsed.signedOut === true;
  } catch {
    return false;
  }
}

/**
 * While a session-scoped pending global revoke is outstanding, keep the auth session
 * payload on disk (reads stay hidden via the marker) until revoke completes.
 */
export async function shouldDeferPrimaryAuthSessionRemoval(sessionKey: string): Promise<boolean> {
  const markerSessionId = await readPendingGlobalRevokeMarkerSessionId();
  if (!markerSessionId) {
    return false;
  }
  try {
    const raw = await AsyncStorage.getItem(sessionKey);
    if (!raw) {
      return true;
    }
    if (isSignedOutSessionPayload(raw)) {
      return true;
    }
    const diskSessionId = parseSessionIdFromAuthSessionPayload(raw);
    return diskSessionId === markerSessionId;
  } catch {
    return true;
  }
}

/** True when a pending revoke marker matches the same auth session on disk (hide restore). */
export async function pendingGlobalRevokeBlocksSessionRestore(
  rawSession: string | null,
): Promise<boolean> {
  if (!rawSession) {
    return false;
  }
  const markerSessionId = await readPendingGlobalRevokeMarkerSessionId();
  if (!markerSessionId) {
    return false;
  }
  const diskSessionId = parseSessionIdFromAuthSessionPayload(rawSession);
  return Boolean(diskSessionId && diskSessionId === markerSessionId);
}
