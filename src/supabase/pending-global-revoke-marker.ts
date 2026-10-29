import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseUserIdFromAuthSessionPayload } from './sign-out-local-user';

export const PENDING_GLOBAL_REVOKE_MARKER_KEY = '@weigh-way/auth-pending-global-revoke';

function canUseWebSessionMarker(): boolean {
  return typeof sessionStorage !== 'undefined';
}

function parseMarkerPayload(raw: string): string | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { userId?: string };
    if (parsed.userId) {
      return parsed.userId;
    }
  } catch {
    // legacy plain user id
  }
  return raw.length > 0 ? raw : null;
}

function serializeMarker(userId: string): string {
  return JSON.stringify({ userId });
}

function readWebMarkerUserId(): string | null {
  if (!canUseWebSessionMarker()) {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(PENDING_GLOBAL_REVOKE_MARKER_KEY);
    if (!raw) {
      return null;
    }
    return parseMarkerPayload(raw);
  } catch {
    return null;
  }
}

function writeWebMarker(userId: string): boolean {
  if (!canUseWebSessionMarker()) {
    return true;
  }
  try {
    sessionStorage.setItem(PENDING_GLOBAL_REVOKE_MARKER_KEY, serializeMarker(userId));
    return true;
  } catch {
    return false;
  }
}

function clearWebMarker(): void {
  if (!canUseWebSessionMarker()) {
    return;
  }
  try {
    sessionStorage.removeItem(PENDING_GLOBAL_REVOKE_MARKER_KEY);
  } catch {
    // ignore
  }
}

async function readMarkerFromAsyncStorage(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_GLOBAL_REVOKE_MARKER_KEY);
    if (!raw) {
      return null;
    }
    return parseMarkerPayload(raw);
  } catch {
    return null;
  }
}

async function writeMarkerToAsyncStorage(userId: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(PENDING_GLOBAL_REVOKE_MARKER_KEY, serializeMarker(userId));
    return true;
  } catch {
    return false;
  }
}

async function clearMarkerFromAsyncStorage(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_GLOBAL_REVOKE_MARKER_KEY);
  } catch {
    // ignore
  }
}

/** Reads the pending global revoke user id from storage independent of primary auth adapter. */
export async function readPendingGlobalRevokeMarkerUserId(): Promise<string | null> {
  const fromAsync = await readMarkerFromAsyncStorage();
  if (fromAsync) {
    return fromAsync;
  }
  return readWebMarkerUserId();
}

export async function clearPendingGlobalRevokeMarker(): Promise<void> {
  clearWebMarker();
  await clearMarkerFromAsyncStorage();
}

export async function writePendingGlobalRevokeMarker(userId: string): Promise<boolean> {
  const asyncOk = await writeMarkerToAsyncStorage(userId);
  const webOk = writeWebMarker(userId);
  return asyncOk || webOk;
}

/** True when a pending revoke marker matches the session user on disk (hide restore). */
export async function pendingGlobalRevokeBlocksSessionRestore(
  rawSession: string | null,
): Promise<boolean> {
  const markerUserId = await readPendingGlobalRevokeMarkerUserId();
  if (!markerUserId || !rawSession) {
    return false;
  }
  const sessionUserId = parseUserIdFromAuthSessionPayload(rawSession);
  return Boolean(sessionUserId && sessionUserId === markerUserId);
}
