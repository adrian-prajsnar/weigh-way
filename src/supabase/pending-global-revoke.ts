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
  PENDING_GLOBAL_REVOKE_STARTUP_REVOKE_TIMEOUT_MS,
  SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS,
  withSignOutDeadline,
} from './sign-out-deadlines';
import {
  getLatestAuthSessionIdFromEvents,
  getLatestAuthUserIdFromEvents,
  parseUserIdFromAuthSessionPayload,
} from './sign-out-local-user';
import {
  clearPersistedSupersededRevoke,
  clearPersistedSupersededRevokesForUserExceptSession,
  incrementPersistedSupersededRevokeAttempt,
  isPersistedSupersededRevokeExpired,
  persistSupersededRevokeForRetry,
  persistedSupersededRevokeToTokens,
  readPersistedSupersededRevoke,
  resetPendingSupersededRevokeStoreForTests,
} from './pending-superseded-revoke';
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
  resetPendingSupersededRevokeStoreForTests();
}

let supersededFinalizeInFlight = new Map<string, Promise<void>>();

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

async function revokeSupersededSessionBestEffort(
  tokens: PendingGlobalRevokeTokens,
): Promise<RevokeAttemptOutcome> {
  const jwtSessionId = parseSessionIdFromAccessToken(tokens.accessToken);
  if (!jwtSessionId) {
    return 'failed_non_retryable';
  }
  return runPendingRevokeAttempt({
    ...tokens,
    sessionId: jwtSessionId,
    revokeScope: 'local',
  }).catch(() => 'unreachable' as RevokeAttemptOutcome);
}

async function retainSupersededPendingRevokeForRetry(
  tokens: PendingGlobalRevokeTokens,
): Promise<void> {
  const markerKey =
    parseSessionIdFromAccessToken(tokens.accessToken) ??
    pendingRevokeMarkerKeyForAccessToken(tokens.accessToken);
  const stored = {
    sessionId: markerKey,
    userId: tokens.userId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
  setInMemoryPendingGlobalRevoke({
    ...stored,
    revokeScope: 'local',
  });
  await persistSupersededRevokeForRetry(stored);
  await writePendingGlobalRevokeMarker(markerKey);
}

async function clearSupersededRevokeStateAfterNonRetryable(
  sessionId: string,
): Promise<void> {
  await clearPersistedSupersededRevoke(sessionId);
  const markerSessionId = await readPendingGlobalRevokeMarkerSessionId();
  if (markerSessionId === sessionId) {
    await clearPendingGlobalRevokeMarker();
  }
  const pending = readInMemoryPending();
  if (pending?.sessionId === sessionId) {
    setInMemoryPendingGlobalRevoke(null);
  }
}

async function finalizeSupersededPendingRevokeBody(
  tokens: PendingGlobalRevokeTokens,
): Promise<void> {
  if (!parseSessionIdFromAccessToken(tokens.accessToken)) {
    const markerKey = pendingRevokeMarkerKeyForAccessToken(tokens.accessToken);
    await abandonPendingRevokeWhenAccessTokenHasNoSessionId(
      tokens.accessToken,
      markerKey,
      tokens.userId,
      null,
    );
    return;
  }
  const outcome = await revokeSupersededSessionBestEffort(tokens);
  if (outcome === 'succeeded' || outcome === 'already_revoked') {
    await clearPersistedSupersededRevoke(tokens.sessionId);
    await clearPendingGlobalRevokeMarker();
    setInMemoryPendingGlobalRevoke(null);
    return;
  }
  if (outcome === 'failed_non_retryable') {
    await clearSupersededRevokeStateAfterNonRetryable(tokens.sessionId);
    return;
  }
  await retainSupersededPendingRevokeForRetry(tokens);
}

async function finalizeSupersededPendingRevoke(
  tokens: PendingGlobalRevokeTokens,
): Promise<void> {
  const key = tokens.sessionId;
  const inFlight = supersededFinalizeInFlight.get(key);
  if (inFlight) {
    return inFlight;
  }
  const work = finalizeSupersededPendingRevokeBody(tokens).finally(() => {
    supersededFinalizeInFlight.delete(key);
  });
  supersededFinalizeInFlight.set(key, work);
  return work;
}

/** Call after auth SIGNED_IN / TOKEN_REFRESHED so a new session is not hidden or revoked. */
export async function clearPendingGlobalRevokeIfSupersededByAuthEvent(): Promise<void> {
  const markerSessionId = await readPendingGlobalRevokeMarkerSessionId();
  const eventSessionId = getLatestAuthSessionIdFromEvents();
  const eventUserId = getLatestAuthUserIdFromEvents();
  const pending = readInMemoryPending();

  if (markerSessionId && eventSessionId && eventSessionId !== markerSessionId) {
    if (pending && (!eventUserId || eventUserId === pending.userId)) {
      await finalizeSupersededPendingRevoke(pending);
    } else {
      const persisted = await readPersistedSupersededRevoke(markerSessionId);
      if (persisted) {
        await attemptPersistedSupersededRevoke(markerSessionId);
      } else {
        await clearPendingGlobalRevokeMarker();
        setInMemoryPendingGlobalRevoke(null);
      }
    }
    return;
  }

  if (pending && eventSessionId && eventSessionId !== pending.sessionId) {
    if (!eventUserId || eventUserId === pending.userId) {
      await finalizeSupersededPendingRevoke(pending);
    } else {
      setInMemoryPendingGlobalRevoke(null);
      void clearPendingGlobalRevokeMarker();
    }
    return;
  }

  if (pending && eventUserId && eventUserId !== pending.userId) {
    setInMemoryPendingGlobalRevoke(null);
    void clearPendingGlobalRevokeMarker();
  }
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
    revokeScope: 'local',
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
    const persisted = await readPersistedSupersededRevoke(markerSessionId);
    if (persisted && !isPersistedSupersededRevokeExpired(persisted)) {
      setInMemoryPendingGlobalRevoke(persistedSupersededRevokeToTokens(persisted));
      return;
    }
    const inMemory = readInMemoryPending();
    if (inMemory?.sessionId === markerSessionId) {
      return;
    }
    if (!persisted) {
      await clearPendingGlobalRevokeMarker();
      setInMemoryPendingGlobalRevoke(null);
    }
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
    revokeScope: 'local',
  });
}

/** GoTrue treats logout without JWT `session_id` as global regardless of scope — skip server revoke. */
async function abandonPendingRevokeWhenAccessTokenHasNoSessionId(
  accessToken: string,
  markerSessionId: string,
  userId: string,
  sessionKeyHint: string | null,
): Promise<boolean> {
  if (parseSessionIdFromAccessToken(accessToken)) {
    return false;
  }
  await clearLocalAuthAfterPendingGlobalRevokeIfStillPending(
    markerSessionId,
    userId,
    sessionKeyHint,
  );
  await clearPendingGlobalRevokeMarker();
  setInMemoryPendingGlobalRevoke(null);
  return true;
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
  markerSessionId: string,
): Promise<void> {
  const { getSupabaseAuthStorage } = await import('./auth-session-storage');
  const sessionKey = sessionKeyHint ?? (await resolvePrimaryAuthSessionKey());
  if (!sessionKey) {
    return;
  }
  getSupabaseAuthStorage().beginLocalClearForUser(userId, markerSessionId);
  await getSupabaseAuthStorage().removePrimaryAuthSessionIfSessionIdMatches(
    sessionKey,
    markerSessionId,
  );
}

function authEventsAllowPendingRevokeLocalClear(
  markerSessionId: string,
  expectedUserId: string,
): boolean {
  const eventSessionId = getLatestAuthSessionIdFromEvents();
  if (eventSessionId && eventSessionId !== markerSessionId) {
    return false;
  }
  const eventUserId = getLatestAuthUserIdFromEvents();
  if (eventUserId && eventUserId !== expectedUserId) {
    return false;
  }
  return true;
}

async function sessionStillMatchesPendingGlobalRevokeMarker(
  markerSessionId: string,
  expectedUserId: string,
): Promise<boolean> {
  if (!authEventsAllowPendingRevokeLocalClear(markerSessionId, expectedUserId)) {
    return false;
  }
  const eventSessionId = getLatestAuthSessionIdFromEvents();
  if (eventSessionId && eventSessionId === markerSessionId) {
    return true;
  }
  const raw = await readPrimarySessionPayloadDirect();
  if (!raw || isSignedOutSessionPayload(raw)) {
    return false;
  }
  if (!sessionPayloadMatchesPendingRevokeMarker(markerSessionId, raw)) {
    return false;
  }
  const diskUserId = parseUserIdFromAuthSessionPayload(raw);
  return !diskUserId || diskUserId === expectedUserId;
}

async function clearLocalAuthAfterPendingGlobalRevokeIfStillPending(
  markerSessionId: string,
  userId: string,
  sessionKeyHint: string | null,
): Promise<void> {
  if (!(await sessionStillMatchesPendingGlobalRevokeMarker(markerSessionId, userId))) {
    return;
  }
  await clearLocalAuthAfterPendingGlobalRevoke(userId, sessionKeyHint, markerSessionId);
}

type PendingRevokeAttemptOptions = {
  timeoutMs?: number;
};

async function runPendingRevokeAttempt(
  tokens: PendingGlobalRevokeTokens,
  options?: PendingRevokeAttemptOptions,
): Promise<RevokeAttemptOutcome> {
  const timeoutMs = options?.timeoutMs ?? SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS;
  return withSignOutDeadline(timeoutMs, () => attemptRevoke(tokens, timeoutMs)).catch(
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
    const pending = readInMemoryPending();
    if (pending) {
      await finalizeSupersededPendingRevoke(pending);
    } else {
      await attemptPersistedSupersededRevoke(
        markerSessionId,
        SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS,
      );
    }
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
      await finalizeSupersededPendingRevoke(pendingAfterDrop);
    } else {
      setInMemoryPendingGlobalRevoke(null);
      await clearPendingGlobalRevokeMarker();
    }
    return;
  }

  const tokens = pendingAfterDrop;
  if (
    await abandonPendingRevokeWhenAccessTokenHasNoSessionId(
      tokens.accessToken,
      tokens.sessionId,
      tokens.userId,
      sessionKeyHint,
    )
  ) {
    return;
  }
  const outcome = await runPendingRevokeAttempt(tokens);
  if (outcome === 'failed_non_retryable') {
    await clearSupersededRevokeStateAfterNonRetryable(tokens.sessionId);
    return;
  }
  if (
    outcome === 'rate_limited' ||
    outcome === 'unreachable'
  ) {
    return;
  }

  setInMemoryPendingGlobalRevoke(null);
  await clearPendingGlobalRevokeMarker();
  await clearLocalAuthAfterPendingGlobalRevokeIfStillPending(
    tokens.sessionId,
    tokens.userId,
    sessionKeyHint,
  );
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

async function attemptPersistedSupersededRevoke(
  markerSessionId: string,
  timeoutMs: number = PENDING_GLOBAL_REVOKE_STARTUP_REVOKE_TIMEOUT_MS,
): Promise<boolean> {
  const persisted = await readPersistedSupersededRevoke(markerSessionId);
  if (!persisted) {
    return false;
  }
  const tokens = persistedSupersededRevokeToTokens(persisted);
  setInMemoryPendingGlobalRevoke(tokens);
  if (
    await abandonPendingRevokeWhenAccessTokenHasNoSessionId(
      tokens.accessToken,
      markerSessionId,
      tokens.userId,
      null,
    )
  ) {
    return true;
  }
  const outcome = await runPendingRevokeAttempt(tokens, { timeoutMs });
  if (outcome === 'failed_non_retryable') {
    await clearSupersededRevokeStateAfterNonRetryable(markerSessionId);
    return true;
  }
  if (outcome === 'rate_limited' || outcome === 'unreachable') {
    await incrementPersistedSupersededRevokeAttempt(markerSessionId);
    return true;
  }
  await clearPersistedSupersededRevoke(markerSessionId);
  setInMemoryPendingGlobalRevoke(null);
  await clearPendingGlobalRevokeMarker();
  return true;
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
        await clearLocalAuthAfterPendingGlobalRevokeIfStillPending(
          markerPayload.sessionId,
          userId,
          null,
        );
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
    if (await attemptPersistedSupersededRevoke(markerPayload.sessionId)) {
      return;
    }
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
    revokeScope: 'local',
  };
  setInMemoryPendingGlobalRevoke(tokens);

  if (await abandonPendingRevokeWhenAccessTokenHasNoSessionId(accessToken, markerPayload.sessionId, userId, null)) {
    return;
  }

  const outcome = await runPendingRevokeAttempt(tokens, {
    timeoutMs: PENDING_GLOBAL_REVOKE_STARTUP_REVOKE_TIMEOUT_MS,
  });

  if (outcome === 'failed_non_retryable') {
    await incrementPendingGlobalRevokeStartupFailCount(markerPayload);
    await clearSupersededRevokeStateAfterNonRetryable(markerPayload.sessionId);
    return;
  }

  if (outcome === 'rate_limited' || outcome === 'unreachable') {
    return;
  }

  if (!(await sessionStillMatchesPendingGlobalRevokeMarker(markerPayload.sessionId, userId))) {
    setInMemoryPendingGlobalRevoke(null);
    await clearPendingGlobalRevokeMarker();
    return;
  }

  setInMemoryPendingGlobalRevoke(null);
  await clearPendingGlobalRevokeMarker();
  await clearLocalAuthAfterPendingGlobalRevokeIfStillPending(
    markerPayload.sessionId,
    userId,
    null,
  );
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

/** Drop retained superseded revokes for other sessions when the user signs out the live session. */
export async function clearRetainedSupersededRevokesAfterSignOut(
  userId: string | null,
  accessToken: string | null,
): Promise<void> {
  if (!userId || !accessToken) {
    return;
  }
  const liveSessionId =
    parseSessionIdFromAccessToken(accessToken) ??
    pendingRevokeMarkerKeyForAccessToken(accessToken);
  await clearPersistedSupersededRevokesForUserExceptSession(userId, liveSessionId);
  const markerSessionId = await readPendingGlobalRevokeMarkerSessionId();
  if (markerSessionId && markerSessionId !== liveSessionId) {
    await clearPendingGlobalRevokeMarker();
  }
  const pending = readInMemoryPending();
  if (pending && pending.userId === userId && pending.sessionId !== liveSessionId) {
    setInMemoryPendingGlobalRevoke(null);
  }
}

export {
  readPendingGlobalRevokeMarkerSessionId,
  readPendingGlobalRevokeMarkerPayload,
} from './pending-global-revoke-marker';
