import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashAuthCode } from '../storage/auth-code-hash';
import { parseSessionIdFromAccessToken, parseSessionIdFromAuthSessionPayload } from './auth-session-id';
import { getInMemoryPendingGlobalRevoke } from './pending-global-revoke-in-memory';
import { getPendingGlobalRevokeMarkerStore } from './pending-global-revoke-marker-store';
import {
  isSignOutDeadlineError,
  PENDING_GLOBAL_REVOKE_MARKER_CLEAR_TIMEOUT_MS,
  PENDING_GLOBAL_REVOKE_MARKER_READ_TIMEOUT_MS,
  PENDING_GLOBAL_REVOKE_MARKER_WRITE_TIMEOUT_MS,
  PENDING_GLOBAL_REVOKE_PRIMARY_SESSION_READ_TIMEOUT_MS,
  withSignOutDeadline,
} from './sign-out-deadlines';

export const PENDING_GLOBAL_REVOKE_MARKER_KEY = '@weigh-way/auth-pending-global-revoke';

export const PENDING_GLOBAL_REVOKE_STARTUP_MAX_ATTEMPTS = 3;

export const PENDING_REVOKE_HASH_PREFIX = 'h:';

export type PendingGlobalRevokeMarkerPayload = {
  sessionId: string;
  startupFailCount?: number;
  /** Server global revoke already succeeded; marker only hides until local disk clear finishes. */
  serverRevokeDone?: boolean;
};

export type PendingGlobalRevokeMarkerReadState =
  | { status: 'absent' }
  | { status: 'timeout' }
  | { status: 'ok'; payload: PendingGlobalRevokeMarkerPayload };

function parseMarkerPayload(raw: string): PendingGlobalRevokeMarkerPayload | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as {
      sessionId?: string;
      userId?: string;
      startupFailCount?: number;
      serverRevokeDone?: boolean;
    };
    if (parsed.sessionId) {
      return {
        sessionId: parsed.sessionId,
        startupFailCount: parsed.startupFailCount,
        serverRevokeDone: parsed.serverRevokeDone,
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

/** Marker key: JWT `session_id`, or `h:<access-token-hash>` when the JWT has no session id. */
export function pendingRevokeMarkerKeyForAccessToken(accessToken: string): string {
  const sessionId = parseSessionIdFromAccessToken(accessToken);
  if (sessionId) {
    return sessionId;
  }
  return `${PENDING_REVOKE_HASH_PREFIX}${hashAuthCode(accessToken)}`;
}

export function sessionPayloadMatchesPendingRevokeMarker(
  markerSessionId: string,
  rawSession: string,
): boolean {
  const diskSessionId = parseSessionIdFromAuthSessionPayload(rawSession);
  if (diskSessionId && diskSessionId === markerSessionId) {
    return true;
  }
  if (!markerSessionId.startsWith(PENDING_REVOKE_HASH_PREFIX)) {
    return false;
  }
  const expectedHash = markerSessionId.slice(PENDING_REVOKE_HASH_PREFIX.length);
  try {
    const parsed = JSON.parse(rawSession) as { access_token?: string };
    const accessToken = parsed.access_token;
    return Boolean(accessToken && hashAuthCode(accessToken) === expectedHash);
  } catch {
    return false;
  }
}

function pendingIdForMarkerReadTimeoutFailClosed(): string | null {
  return getInMemoryPendingGlobalRevoke()?.sessionId ?? null;
}

function markerReadTimeoutBlocksRestore(rawSession: string | null): boolean {
  if (!rawSession) {
    return false;
  }
  const pendingId = pendingIdForMarkerReadTimeoutFailClosed();
  if (!pendingId) {
    return false;
  }
  return sessionPayloadMatchesPendingRevokeMarker(pendingId, rawSession);
}

async function readAuthSessionRawBounded(sessionKey: string): Promise<string | null> {
  try {
    return await withSignOutDeadline(PENDING_GLOBAL_REVOKE_PRIMARY_SESSION_READ_TIMEOUT_MS, () =>
      AsyncStorage.getItem(sessionKey),
    );
  } catch (error) {
    if (isSignOutDeadlineError(error)) {
      return null;
    }
    throw error;
  }
}

async function readMarkerRawBounded(): Promise<{ raw: string | null; timedOut: boolean }> {
  try {
    const raw = await withSignOutDeadline(PENDING_GLOBAL_REVOKE_MARKER_READ_TIMEOUT_MS, () =>
      getPendingGlobalRevokeMarkerStore().read(),
    );
    return { raw, timedOut: false };
  } catch (error) {
    if (isSignOutDeadlineError(error)) {
      return { raw: null, timedOut: true };
    }
    throw error;
  }
}

export async function readPendingGlobalRevokeMarkerState(): Promise<PendingGlobalRevokeMarkerReadState> {
  const { raw, timedOut } = await readMarkerRawBounded();
  if (timedOut) {
    return { status: 'timeout' };
  }
  if (!raw) {
    return { status: 'absent' };
  }
  const payload = parseMarkerPayload(raw);
  if (!payload) {
    return { status: 'absent' };
  }
  return { status: 'ok', payload };
}

export async function readPendingGlobalRevokeMarkerPayload(): Promise<PendingGlobalRevokeMarkerPayload | null> {
  const state = await readPendingGlobalRevokeMarkerState();
  return state.status === 'ok' ? state.payload : null;
}

export async function readPendingGlobalRevokeMarkerSessionId(): Promise<string | null> {
  const payload = await readPendingGlobalRevokeMarkerPayload();
  return payload?.sessionId ?? null;
}

export async function readPendingGlobalRevokeMarkerServerRevokeDone(): Promise<boolean> {
  const payload = await readPendingGlobalRevokeMarkerPayload();
  return payload?.serverRevokeDone === true;
}

export async function clearPendingGlobalRevokeMarkerIfServerRevokeDoneOnly(): Promise<void> {
  const payload = await readPendingGlobalRevokeMarkerPayload();
  if (payload?.serverRevokeDone) {
    await clearPendingGlobalRevokeMarker();
  }
}

export async function clearPendingGlobalRevokeMarker(
  timeoutMs: number = PENDING_GLOBAL_REVOKE_MARKER_CLEAR_TIMEOUT_MS,
): Promise<void> {
  try {
    await withSignOutDeadline(timeoutMs, () => getPendingGlobalRevokeMarkerStore().clear());
  } catch (error) {
    if (isSignOutDeadlineError(error)) {
      return;
    }
    throw error;
  }
}

export async function writePendingGlobalRevokeMarker(
  sessionId: string,
  startupFailCount?: number,
  timeoutMs: number = PENDING_GLOBAL_REVOKE_MARKER_WRITE_TIMEOUT_MS,
  options?: { serverRevokeDone?: boolean },
): Promise<boolean> {
  const payload: PendingGlobalRevokeMarkerPayload = { sessionId };
  if (startupFailCount !== undefined) {
    payload.startupFailCount = startupFailCount;
  }
  if (options?.serverRevokeDone) {
    payload.serverRevokeDone = true;
  }
  try {
    return await withSignOutDeadline(timeoutMs, () =>
      getPendingGlobalRevokeMarkerStore().write(serializeMarker(payload)),
    );
  } catch (error) {
    if (isSignOutDeadlineError(error)) {
      return false;
    }
    throw error;
  }
}

export async function incrementPendingGlobalRevokeStartupFailCount(
  current: PendingGlobalRevokeMarkerPayload,
): Promise<void> {
  const next = (current.startupFailCount ?? 0) + 1;
  const capped = Math.min(next, PENDING_GLOBAL_REVOKE_STARTUP_MAX_ATTEMPTS);
  await writePendingGlobalRevokeMarker(current.sessionId, capped);
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

async function markerDefersPrimaryAuthSessionRemoval(raw: string | null): Promise<boolean> {
  const state = await readPendingGlobalRevokeMarkerState();
  if (state.status === 'ok' && state.payload.serverRevokeDone) {
    return false;
  }
  if (state.status === 'timeout') {
    if (!raw || isSignedOutSessionPayload(raw)) {
      return Boolean(pendingIdForMarkerReadTimeoutFailClosed());
    }
    return markerReadTimeoutBlocksRestore(raw);
  }
  if (state.status === 'absent') {
    return false;
  }
  if (!raw || isSignedOutSessionPayload(raw)) {
    return true;
  }
  return sessionPayloadMatchesPendingRevokeMarker(state.payload.sessionId, raw);
}

/**
 * While a session-scoped pending global revoke is outstanding, keep the auth session
 * payload on disk (reads stay hidden via the marker) until revoke completes.
 */
export async function shouldDeferPrimaryAuthSessionRemoval(sessionKey: string): Promise<boolean> {
  try {
    const raw = await readAuthSessionRawBounded(sessionKey);
    return markerDefersPrimaryAuthSessionRemoval(raw);
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
  const state = await readPendingGlobalRevokeMarkerState();
  if (state.status === 'timeout') {
    return markerReadTimeoutBlocksRestore(rawSession);
  }
  if (state.status === 'absent') {
    return false;
  }
  return sessionPayloadMatchesPendingRevokeMarker(state.payload.sessionId, rawSession);
}
