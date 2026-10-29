import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isAuthRateLimitedError,
  isAuthServerUnreachableError,
  isRefreshInvalidGrantError,
  isRefreshRateLimitedError,
} from './auth-reachability-error';
import {
  clearPendingGlobalRevokeMarker,
  readPendingGlobalRevokeMarkerUserId,
  writePendingGlobalRevokeMarker,
} from './pending-global-revoke-marker';
import { revokeSessionOnServer } from './revoke-session-on-server';
import {
  isSignOutDeadlineError,
  SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS,
  withSignOutDeadline,
} from './sign-out-deadlines';
import { getLatestAuthUserIdFromEvents, parseUserIdFromAuthSessionPayload } from './sign-out-local-user';
import { refreshAccessTokenForSignOut } from './sign-out-token-refresh';

export type PendingGlobalRevokeTokens = {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
};

type RevokeAttemptOutcome = 'succeeded' | 'already_revoked' | 'rate_limited' | 'unreachable';

let inMemoryPending: PendingGlobalRevokeTokens | null = null;

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

function parseAccessTokenFromAuthSessionPayload(raw: string | null): string | null {
  if (!raw || isSignedOutSessionPayload(raw)) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { access_token?: string };
    return parsed.access_token ?? null;
  } catch {
    return null;
  }
}

function parseRefreshTokenFromAuthSessionPayload(raw: string | null): string | null {
  if (!raw || isSignedOutSessionPayload(raw)) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { refresh_token?: string };
    return parsed.refresh_token ?? null;
  } catch {
    return null;
  }
}

export function getInMemoryPendingGlobalRevoke(): PendingGlobalRevokeTokens | null {
  return inMemoryPending;
}

export function resetPendingGlobalRevokeStateForTests(): void {
  inMemoryPending = null;
}

export function dropPendingGlobalRevokeIfDifferentUserConfirmed(
  expectedUserId: string | null,
): void {
  if (!expectedUserId) {
    return;
  }
  const eventUserId = getLatestAuthUserIdFromEvents();
  if (eventUserId && eventUserId !== expectedUserId) {
    inMemoryPending = null;
    void clearPendingGlobalRevokeMarker();
  }
}

export async function armPendingGlobalRevoke(tokens: PendingGlobalRevokeTokens): Promise<void> {
  inMemoryPending = tokens;
  await writePendingGlobalRevokeMarker(tokens.userId);
}

async function attemptGlobalRevoke(
  tokens: PendingGlobalRevokeTokens,
  timeoutMs: number = SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS,
): Promise<RevokeAttemptOutcome> {
  let accessToken = tokens.accessToken;
  let revoke = await revokeSessionOnServer(accessToken, 'global', timeoutMs);

  if (revoke.result === 'rate_limited') {
    return 'rate_limited';
  }
  if (revoke.result === 'revoked' || revoke.result === 'already_revoked') {
    return revoke.result === 'already_revoked' ? 'already_revoked' : 'succeeded';
  }

  if (revoke.result === 'token_expired') {
    if (!tokens.refreshToken) {
      return 'unreachable';
    }
    try {
      const refreshed = await refreshAccessTokenForSignOut(tokens.refreshToken, timeoutMs);
      if (refreshed.userId !== tokens.userId) {
        return 'succeeded';
      }
      accessToken = refreshed.accessToken;
      revoke = await revokeSessionOnServer(accessToken, 'global', timeoutMs);
      if (revoke.result === 'rate_limited') {
        return 'rate_limited';
      }
      if (revoke.result === 'revoked' || revoke.result === 'already_revoked') {
        return revoke.result === 'already_revoked' ? 'already_revoked' : 'succeeded';
      }
      if (revoke.result === 'unreachable' || revoke.result === 'token_expired') {
        return 'unreachable';
      }
    } catch (error) {
      if (isRefreshRateLimitedError(error) || isAuthRateLimitedError(error)) {
        return 'rate_limited';
      }
      if (isRefreshInvalidGrantError(error)) {
        return 'already_revoked';
      }
      if (isSignOutDeadlineError(error) || isAuthServerUnreachableError(error)) {
        return 'unreachable';
      }
      throw error instanceof Error ? error : new Error('sign_out_failed');
    }
  }

  if (revoke.result === 'unreachable') {
    return 'unreachable';
  }
  if (revoke.result === 'failed') {
    throw revoke.error instanceof Error ? revoke.error : new Error('sign_out_failed');
  }

  return 'unreachable';
}

async function hydrateInMemoryPendingFromMarkerAndDisk(
  sessionKeyHint: string | null,
): Promise<void> {
  if (inMemoryPending) {
    return;
  }
  const markerUserId = await readPendingGlobalRevokeMarkerUserId();
  if (!markerUserId) {
    return;
  }
  let raw: string | null = null;
  if (sessionKeyHint) {
    try {
      raw = await AsyncStorage.getItem(sessionKeyHint);
    } catch {
      raw = null;
    }
  } else {
    raw = await readPrimarySessionPayloadDirect();
  }
  if (!raw || isSignedOutSessionPayload(raw)) {
    return;
  }
  const sessionUserId = parseUserIdFromAuthSessionPayload(raw);
  if (sessionUserId !== markerUserId) {
    return;
  }
  const accessToken = parseAccessTokenFromAuthSessionPayload(raw);
  if (!accessToken) {
    return;
  }
  inMemoryPending = {
    userId: markerUserId,
    accessToken,
    refreshToken: parseRefreshTokenFromAuthSessionPayload(raw),
  };
}

async function resolvePrimaryAuthSessionKey(): Promise<string | null> {
  const { getSupabaseAuthStorage } = await import('./auth-session-storage');
  const tracked = getSupabaseAuthStorage().getLastSeenPrimaryAuthSessionKey();
  if (tracked) {
    return tracked;
  }
  const { getSupabaseAuthStorageKey } = await import('./auth-storage-key');
  return getSupabaseAuthStorageKey();
}

async function clearLocalAuthAfterPendingGlobalRevoke(
  userId: string,
  sessionKeyHint: string | null,
): Promise<void> {
  const { getSupabaseAuthStorage } = await import('./auth-session-storage');
  const { supabase } = await import('./client');
  const sessionKey = sessionKeyHint ?? (await resolvePrimaryAuthSessionKey());
  if (!sessionKey) {
    return;
  }
  getSupabaseAuthStorage().beginLocalClearForUser(userId);
  await getSupabaseAuthStorage().removeItem(sessionKey);
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
}

export async function retryPendingGlobalRevokeBeforeDiskPersistence(
  sessionKeyHint: string | null = null,
): Promise<void> {
  const markerUserId = await readPendingGlobalRevokeMarkerUserId();
  const eventUserId = getLatestAuthUserIdFromEvents();
  if (markerUserId && eventUserId && eventUserId !== markerUserId) {
    inMemoryPending = null;
    await clearPendingGlobalRevokeMarker();
    return;
  }

  await hydrateInMemoryPendingFromMarkerAndDisk(sessionKeyHint);

  if (!inMemoryPending) {
    return;
  }

  dropPendingGlobalRevokeIfDifferentUserConfirmed(inMemoryPending.userId);

  if (!inMemoryPending) {
    return;
  }

  const tokens = inMemoryPending;
  const outcome = await attemptGlobalRevoke(tokens);
  if (outcome === 'rate_limited' || outcome === 'unreachable') {
    return;
  }

  inMemoryPending = null;
  await clearPendingGlobalRevokeMarker();
  await clearLocalAuthAfterPendingGlobalRevoke(tokens.userId, sessionKeyHint);
}

async function readPrimarySessionPayloadDirect(): Promise<string | null> {
  const sessionKey = await resolvePrimaryAuthSessionKey();
  if (!sessionKey) {
    return null;
  }
  try {
    return await AsyncStorage.getItem(sessionKey);
  } catch {
    return null;
  }
}

/**
 * Before Supabase restores a session at startup: revoke on the server when a marker matches,
 * then clear local auth storage. Ignores markers for a different user than the stored session.
 */
export async function runPendingGlobalRevokeBeforeSessionRestore(): Promise<void> {
  const markerUserId = await readPendingGlobalRevokeMarkerUserId();
  if (!markerUserId) {
    return;
  }

  const raw = await readPrimarySessionPayloadDirect();
  if (!raw || isSignedOutSessionPayload(raw)) {
    await clearPendingGlobalRevokeMarker();
    inMemoryPending = null;
    return;
  }

  const sessionUserId = parseUserIdFromAuthSessionPayload(raw);
  if (!sessionUserId || sessionUserId !== markerUserId) {
    return;
  }

  const accessToken = parseAccessTokenFromAuthSessionPayload(raw);
  const refreshToken = parseRefreshTokenFromAuthSessionPayload(raw);
  if (!accessToken) {
    return;
  }

  const tokens: PendingGlobalRevokeTokens = {
    userId: markerUserId,
    accessToken,
    refreshToken,
  };
  inMemoryPending = tokens;

  const outcome = await withSignOutDeadline(SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS, () =>
    attemptGlobalRevoke(tokens),
  ).catch((error) => {
    if (isSignOutDeadlineError(error)) {
      return 'unreachable' as RevokeAttemptOutcome;
    }
    throw error;
  });

  if (outcome === 'rate_limited' || outcome === 'unreachable') {
    return;
  }

  inMemoryPending = null;
  await clearPendingGlobalRevokeMarker();
  await clearLocalAuthAfterPendingGlobalRevoke(markerUserId, null);
}

export { readPendingGlobalRevokeMarkerUserId } from './pending-global-revoke-marker';
