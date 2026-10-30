import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseSessionIdFromAccessToken } from './auth-session-id';
import {
  isAuthRateLimitedError,
  isAuthServerUnreachableError,
  isRefreshInvalidGrantError,
  isRefreshRateLimitedError,
} from './auth-reachability-error';
import {
  clearPendingGlobalRevokeMarker,
  incrementPendingGlobalRevokeStartupFailCount,
  pendingRevokeMarkerKeyForAccessToken,
  readPendingGlobalRevokeMarkerServerRevokeDone,
  readPendingGlobalRevokeMarkerSessionId,
  readPendingGlobalRevokeMarkerState,
  sessionPayloadMatchesPendingRevokeMarker,
  writePendingGlobalRevokeMarker,
} from './pending-global-revoke-marker';
import { revokeSessionOnServer } from './revoke-session-on-server';
import {
  isSignOutDeadlineError,
  PENDING_GLOBAL_REVOKE_PRIMARY_SESSION_READ_TIMEOUT_MS,
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

let dedupedGlobalRevokeWork: Promise<void> | null = null;

async function runDedupedGlobalRevokeWork(work: () => Promise<void>): Promise<void> {
  if (dedupedGlobalRevokeWork) {
    return dedupedGlobalRevokeWork;
  }
  dedupedGlobalRevokeWork = work().finally(() => {
    dedupedGlobalRevokeWork = null;
  });
  return dedupedGlobalRevokeWork;
}

async function revokeSupersededSessionBestEffort(tokens: PendingGlobalRevokeTokens): Promise<void> {
  const jwtSessionId = parseSessionIdFromAccessToken(tokens.accessToken);
  if (!jwtSessionId) {
    return;
  }
  await runPendingRevokeAttempt({
    ...tokens,
    sessionId: jwtSessionId,
    revokeScope: 'local',
  }).catch(() => undefined);
}

async function revokeOldSessionIfSameUserResignedIn(): Promise<void> {
  const pending = readInMemoryPending();
  const eventSessionId = getLatestAuthSessionIdFromEvents();
  const eventUserId = getLatestAuthUserIdFromEvents();
  if (!pending || !eventSessionId || eventSessionId === pending.sessionId) {
    return;
  }
  if (eventUserId && eventUserId !== pending.userId) {
    return;
  }
  await revokeSupersededSessionBestEffort(pending);
}

function clearInMemoryPendingIfSupersededByAuthEvent(): void {
  const eventSessionId = getLatestAuthSessionIdFromEvents();
  const eventUserId = getLatestAuthUserIdFromEvents();
  const pending = readInMemoryPending();
  if (!pending) {
    return;
  }
  if (eventSessionId && eventSessionId !== pending.sessionId) {
    setInMemoryPendingGlobalRevoke(null);
    return;
  }
  if (eventUserId && eventUserId !== pending.userId) {
    setInMemoryPendingGlobalRevoke(null);
  }
}

async function clearMarkerIfSupersededByAuthEvent(): Promise<void> {
  const pendingBefore = readInMemoryPending();
  const pendingUserId = pendingBefore?.userId ?? null;
  clearInMemoryPendingIfSupersededByAuthEvent();
  const markerSessionId = await readPendingGlobalRevokeMarkerSessionId();
  if (!markerSessionId) {
    return;
  }
  const eventSessionId = getLatestAuthSessionIdFromEvents();
  const eventUserId = getLatestAuthUserIdFromEvents();
  if (eventSessionId && eventSessionId !== markerSessionId) {
    if (pendingBefore && (!eventUserId || eventUserId === pendingBefore.userId)) {
      await revokeSupersededSessionBestEffort(pendingBefore);
    }
    await clearPendingGlobalRevokeMarker();
    setInMemoryPendingGlobalRevoke(null);
    return;
  }
  if (eventUserId && pendingUserId && eventUserId !== pendingUserId) {
    await clearPendingGlobalRevokeMarker();
    setInMemoryPendingGlobalRevoke(null);
  }
}

/** Call after auth SIGNED_IN / TOKEN_REFRESHED so a new session is not hidden or revoked. */
export async function clearPendingGlobalRevokeIfSupersededByAuthEvent(): Promise<void> {
  await revokeOldSessionIfSameUserResignedIn();
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
  markerWriteTimeoutMs?: number,
  serverRevokeDone?: boolean,
): Promise<void> {
  setInMemoryPendingGlobalRevoke({
    ...tokens,
    revokeScope: serverRevokeDone ? 'local' : 'global',
  });
  const markerKey = pendingRevokeMarkerKeyForAccessToken(tokens.accessToken);
  await writePendingGlobalRevokeMarker(markerKey, undefined, markerWriteTimeoutMs, {
    serverRevokeDone,
  });
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
  const markerState = await readPendingGlobalRevokeMarkerState();
  if (markerState.status === 'absent') {
    return;
  }
  const markerSessionId =
    markerState.status === 'ok' ? markerState.payload.sessionId : null;
  if (!markerSessionId) {
    return;
  }
  let raw: string | null = null;
  if (sessionKeyHint) {
    try {
      raw = await withSignOutDeadline(PENDING_GLOBAL_REVOKE_PRIMARY_SESSION_READ_TIMEOUT_MS, () =>
        AsyncStorage.getItem(sessionKeyHint),
      );
    } catch (error) {
      if (isSignOutDeadlineError(error)) {
        raw = null;
      } else {
        throw error;
      }
    }
  } else {
    raw = await readPrimarySessionPayloadDirect();
  }
  if (!raw || isSignedOutSessionPayload(raw)) {
    return;
  }
  if (!sessionPayloadMatchesPendingRevokeMarker(markerSessionId, raw)) {
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
  const jwtSessionId = parseSessionIdFromAccessToken(accessToken);
  setInMemoryPendingGlobalRevoke({
    sessionId: jwtSessionId ?? markerSessionId,
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
  return runDedupedGlobalRevokeWork(() =>
    retryPendingGlobalRevokeBeforeDiskPersistenceBody(sessionKeyHint),
  );
}

async function retryPendingGlobalRevokeBeforeDiskPersistenceBody(
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

  if (await readPendingGlobalRevokeMarkerServerRevokeDone()) {
    return;
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
    if (!getLatestAuthUserIdFromEvents() || getLatestAuthUserIdFromEvents() === pendingAfterDrop.userId) {
      await revokeSupersededSessionBestEffort(pendingAfterDrop);
    }
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

/**
 * Before Supabase restores a session at startup: revoke on the server when a marker matches
 * the same session id on disk, then clear local auth storage.
 */
export async function runPendingGlobalRevokeBeforeSessionRestore(): Promise<void> {
  return runDedupedGlobalRevokeWork(() => runPendingGlobalRevokeBeforeSessionRestoreBody());
}

async function runPendingGlobalRevokeBeforeSessionRestoreBody(): Promise<void> {
  await clearPendingGlobalRevokeIfSupersededByAuthEvent();

  const markerState = await readPendingGlobalRevokeMarkerState();
  if (markerState.status !== 'ok') {
    return;
  }
  const markerPayload = markerState.payload;

  if (markerPayload.serverRevokeDone) {
    const rawAfterServerRevoke = await readPrimarySessionPayloadDirect();
    if (
      rawAfterServerRevoke &&
      !isSignedOutSessionPayload(rawAfterServerRevoke) &&
      sessionPayloadMatchesPendingRevokeMarker(markerPayload.sessionId, rawAfterServerRevoke)
    ) {
      const userId = parseUserIdFromAuthSessionPayload(rawAfterServerRevoke);
      if (userId) {
        await clearLocalAuthAfterPendingGlobalRevoke(userId, null);
      }
    }
    await clearPendingGlobalRevokeMarker();
    setInMemoryPendingGlobalRevoke(null);
    return;
  }

  const raw = await readPrimarySessionPayloadDirect();
  if (!raw || isSignedOutSessionPayload(raw)) {
    return;
  }

  if (!sessionPayloadMatchesPendingRevokeMarker(markerPayload.sessionId, raw)) {
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

  const jwtSessionId = parseSessionIdFromAccessToken(accessToken);
  const tokens: PendingGlobalRevokeTokens = {
    sessionId: jwtSessionId ?? markerPayload.sessionId,
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
  markerWriteTimeoutMs?: number;
}): Promise<void> {
  if (
    options.localOnly ||
    options.keepLocalSession ||
    !options.accessToken ||
    !options.userId
  ) {
    return;
  }

  const jwtSessionId = parseSessionIdFromAccessToken(options.accessToken);
  const markerKey = pendingRevokeMarkerKeyForAccessToken(options.accessToken);

  const base = {
    sessionId: jwtSessionId ?? markerKey,
    userId: options.userId,
    accessToken: options.accessToken,
    refreshToken: options.refreshToken,
  };

  if (options.localClearIncomplete) {
    await armPendingGlobalRevokeMarker(
      base,
      options.markerWriteTimeoutMs,
      options.serverRevokeSucceeded,
    );
    return;
  }

  if (!options.serverSignOutUnreachable || options.serverRevokeSucceeded) {
    return;
  }

  armInMemoryPendingRevokeOnly(base);
}

export {
  readPendingGlobalRevokeMarkerSessionId,
  readPendingGlobalRevokeMarkerPayload,
} from './pending-global-revoke-marker';
