import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseSessionIdFromAccessToken, parseSessionIdFromAuthSessionPayload } from './auth-session-id';
import {
  isAuthRateLimitedError,
  isAuthServerUnreachableError,
  isRefreshInvalidGrantError,
  isRefreshRateLimitedError,
} from './auth-reachability-error';
import {
  clearPendingGlobalRevokeMarker,
  incrementPendingGlobalRevokeStartupFailCount,
  readPendingGlobalRevokeMarkerPayload,
  readPendingGlobalRevokeMarkerSessionId,
  writePendingGlobalRevokeMarker,
} from './pending-global-revoke-marker';
import { revokeSessionOnServer } from './revoke-session-on-server';
import {
  isSignOutDeadlineError,
  SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS,
  withSignOutDeadline,
} from './sign-out-deadlines';
import {
  getLatestAuthSessionIdFromEvents,
  getLatestAuthUserIdFromEvents,
  parseUserIdFromAuthSessionPayload,
} from './sign-out-local-user';
import { refreshAccessTokenForSignOut } from './sign-out-token-refresh';

import type { PendingGlobalRevokeTokens } from './pending-global-revoke-types';
import {
  getInMemoryPendingGlobalRevoke as readInMemoryPending,
  resetInMemoryPendingGlobalRevokeForTests,
  setInMemoryPendingGlobalRevoke,
} from './pending-global-revoke-in-memory';

type RevokeAttemptOutcome =
  | 'succeeded'
  | 'already_revoked'
  | 'rate_limited'
  | 'unreachable'
  | 'failed_non_retryable';

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

export { getInMemoryPendingGlobalRevoke } from './pending-global-revoke-in-memory';

export function resetPendingGlobalRevokeStateForTests(): void {
  resetInMemoryPendingGlobalRevokeForTests();
}

function clearInMemoryPendingIfSupersededByAuthEvent(): void {
  const eventSessionId = getLatestAuthSessionIdFromEvents();
  if (!eventSessionId) {
    return;
  }
  const pending = readInMemoryPending();
  if (pending && pending.sessionId !== eventSessionId) {
    setInMemoryPendingGlobalRevoke(null);
  }
}

async function clearMarkerIfSupersededByAuthEvent(): Promise<void> {
  const markerSessionId = await readPendingGlobalRevokeMarkerSessionId();
  const eventSessionId = getLatestAuthSessionIdFromEvents();
  if (markerSessionId && eventSessionId && eventSessionId !== markerSessionId) {
    await clearPendingGlobalRevokeMarker();
    setInMemoryPendingGlobalRevoke(null);
  }
}

/** Call after auth SIGNED_IN / TOKEN_REFRESHED so a new session is not hidden or revoked. */
export async function clearPendingGlobalRevokeIfSupersededByAuthEvent(): Promise<void> {
  clearInMemoryPendingIfSupersededByAuthEvent();
  await clearMarkerIfSupersededByAuthEvent();
}

export function dropPendingGlobalRevokeIfDifferentUserConfirmed(
  expectedUserId: string | null,
): void {
  if (!expectedUserId) {
    return;
  }
  const eventUserId = getLatestAuthUserIdFromEvents();
  if (eventUserId && eventUserId !== expectedUserId) {
    setInMemoryPendingGlobalRevoke(null);
    void clearPendingGlobalRevokeMarker();
  }
}

export async function armPendingGlobalRevokeMarker(
  tokens: Omit<PendingGlobalRevokeTokens, 'revokeScope'>,
): Promise<void> {
  setInMemoryPendingGlobalRevoke({ ...tokens, revokeScope: 'global' });
  await writePendingGlobalRevokeMarker(tokens.sessionId);
}

/** Server revoke failed but local sign-out persisted — retry with `local` scope only (in memory). */
export function armInMemoryPendingRevokeOnly(
  tokens: Omit<PendingGlobalRevokeTokens, 'revokeScope'>,
): void {
  setInMemoryPendingGlobalRevoke({ ...tokens, revokeScope: 'local' });
}

async function attemptRevoke(
  tokens: PendingGlobalRevokeTokens,
  timeoutMs: number = SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS,
): Promise<RevokeAttemptOutcome> {
  let accessToken = tokens.accessToken;
  let revoke = await revokeSessionOnServer(accessToken, tokens.revokeScope, timeoutMs);

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
      revoke = await revokeSessionOnServer(accessToken, tokens.revokeScope, timeoutMs);
      if (revoke.result === 'rate_limited') {
        return 'rate_limited';
      }
      if (revoke.result === 'revoked' || revoke.result === 'already_revoked') {
        return revoke.result === 'already_revoked' ? 'already_revoked' : 'succeeded';
      }
      if (revoke.result === 'unreachable' || revoke.result === 'token_expired') {
        return 'unreachable';
      }
      if (revoke.result === 'failed') {
        return 'failed_non_retryable';
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
    return 'failed_non_retryable';
  }

  return 'unreachable';
}

async function hydrateInMemoryPendingFromMarkerAndDisk(
  sessionKeyHint: string | null,
): Promise<void> {
  if (readInMemoryPending()) {
    return;
  }
  const markerSessionId = await readPendingGlobalRevokeMarkerSessionId();
  if (!markerSessionId) {
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
  const diskSessionId = parseSessionIdFromAuthSessionPayload(raw);
  if (!diskSessionId || diskSessionId !== markerSessionId) {
    await clearPendingGlobalRevokeMarker();
    setInMemoryPendingGlobalRevoke(null);
    return;
  }
  const accessToken = parseAccessTokenFromAuthSessionPayload(raw);
  if (!accessToken) {
    return;
  }
  const userId = parseUserIdFromAuthSessionPayload(raw);
  if (!userId) {
    return;
  }
  setInMemoryPendingGlobalRevoke({
    sessionId: markerSessionId,
    userId,
    accessToken,
    refreshToken: parseRefreshTokenFromAuthSessionPayload(raw),
    revokeScope: 'global',
  });
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

async function runPendingRevokeAttempt(
  tokens: PendingGlobalRevokeTokens,
): Promise<RevokeAttemptOutcome> {
  return withSignOutDeadline(SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS, () => attemptRevoke(tokens)).catch(
    (error) => {
      if (isSignOutDeadlineError(error)) {
        return 'unreachable' as RevokeAttemptOutcome;
      }
      throw error;
    },
  );
}

export async function retryPendingGlobalRevokeBeforeDiskPersistence(
  sessionKeyHint: string | null = null,
): Promise<void> {
  await clearPendingGlobalRevokeIfSupersededByAuthEvent();

  const markerSessionId = await readPendingGlobalRevokeMarkerSessionId();
  const eventSessionId = getLatestAuthSessionIdFromEvents();
  if (markerSessionId && eventSessionId && eventSessionId !== markerSessionId) {
    setInMemoryPendingGlobalRevoke(null);
    await clearPendingGlobalRevokeMarker();
    return;
  }

  if (!readInMemoryPending()) {
    await hydrateInMemoryPendingFromMarkerAndDisk(sessionKeyHint);
  }

  const pending = readInMemoryPending();
  if (!pending) {
    return;
  }

  dropPendingGlobalRevokeIfDifferentUserConfirmed(pending.userId);

  if (!readInMemoryPending()) {
    return;
  }

  const eventSid = getLatestAuthSessionIdFromEvents();
  const pendingAfterDrop = readInMemoryPending();
  if (!pendingAfterDrop) {
    return;
  }
  if (eventSid && eventSid !== pendingAfterDrop.sessionId) {
    setInMemoryPendingGlobalRevoke(null);
    await clearPendingGlobalRevokeMarker();
    return;
  }

  const tokens = pendingAfterDrop;
  const outcome = await runPendingRevokeAttempt(tokens);
  if (
    outcome === 'rate_limited' ||
    outcome === 'unreachable' ||
    outcome === 'failed_non_retryable'
  ) {
    return;
  }

  setInMemoryPendingGlobalRevoke(null);
  await clearPendingGlobalRevokeMarker();
  if (tokens.revokeScope === 'global') {
    await clearLocalAuthAfterPendingGlobalRevoke(tokens.userId, sessionKeyHint);
  }
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
 * Before Supabase restores a session at startup: revoke on the server when a marker matches
 * the same session id on disk, then clear local auth storage.
 */
export async function runPendingGlobalRevokeBeforeSessionRestore(): Promise<void> {
  await clearPendingGlobalRevokeIfSupersededByAuthEvent();

  const markerPayload = await readPendingGlobalRevokeMarkerPayload();
  if (!markerPayload) {
    return;
  }

  const raw = await readPrimarySessionPayloadDirect();
  if (!raw || isSignedOutSessionPayload(raw)) {
    return;
  }

  const diskSessionId = parseSessionIdFromAuthSessionPayload(raw);
  if (!diskSessionId || diskSessionId !== markerPayload.sessionId) {
    await clearPendingGlobalRevokeMarker();
    setInMemoryPendingGlobalRevoke(null);
    return;
  }

  const accessToken = parseAccessTokenFromAuthSessionPayload(raw);
  const refreshToken = parseRefreshTokenFromAuthSessionPayload(raw);
  const userId = parseUserIdFromAuthSessionPayload(raw);
  if (!accessToken || !userId) {
    return;
  }

  const tokens: PendingGlobalRevokeTokens = {
    sessionId: markerPayload.sessionId,
    userId,
    accessToken,
    refreshToken,
    revokeScope: 'global',
  };
  setInMemoryPendingGlobalRevoke(tokens);

  const outcome = await runPendingRevokeAttempt(tokens);

  if (outcome === 'failed_non_retryable') {
    await incrementPendingGlobalRevokeStartupFailCount(markerPayload);
    setInMemoryPendingGlobalRevoke(null);
    return;
  }

  if (outcome === 'rate_limited' || outcome === 'unreachable') {
    return;
  }

  setInMemoryPendingGlobalRevoke(null);
  await clearPendingGlobalRevokeMarker();
  await clearLocalAuthAfterPendingGlobalRevoke(userId, null);
}

export async function armPendingGlobalRevokeFromSignOut(options: {
  localClearIncomplete: boolean;
  serverSignOutUnreachable: boolean;
  serverRevokeSucceeded: boolean;
  keepLocalSession: boolean;
  localOnly: boolean;
  userId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
}): Promise<void> {
  if (
    options.localOnly ||
    options.keepLocalSession ||
    !options.serverSignOutUnreachable ||
    options.serverRevokeSucceeded ||
    !options.accessToken ||
    !options.userId
  ) {
    return;
  }

  const sessionId = parseSessionIdFromAccessToken(options.accessToken);
  if (!sessionId) {
    return;
  }

  const base = {
    sessionId,
    userId: options.userId,
    accessToken: options.accessToken,
    refreshToken: options.refreshToken,
  };

  if (options.localClearIncomplete) {
    await armPendingGlobalRevokeMarker(base);
    return;
  }

  armInMemoryPendingRevokeOnly(base);
}

export {
  readPendingGlobalRevokeMarkerSessionId,
  readPendingGlobalRevokeMarkerPayload,
} from './pending-global-revoke-marker';
