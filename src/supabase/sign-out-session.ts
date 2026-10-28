import {
  isAuthRateLimitedError,
  isAuthServerUnreachableError,
  isRefreshInvalidGrantError,
  isRefreshRateLimitedError,
} from './auth-reachability-error';
import { getSupabaseAuthStorage } from './auth-session-storage';
import { supabase } from './client';
import { revokeSessionOnServer } from './revoke-session-on-server';
import {
  isSignOutDeadlineError,
  SIGN_OUT_FLOW_CAP_MS,
  SIGN_OUT_LOCAL_CLEAR_TIMEOUT_MS,
  SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS,
  SIGN_OUT_SESSION_USER_CHECK_TIMEOUT_MS,
  withSignOutDeadline,
} from './sign-out-deadlines';
import { refreshAccessTokenForSignOut } from './sign-out-token-refresh';

let signOutSessionInFlight = false;

export type SignOutSessionOptions = {
  accessToken: string | null;
  refreshToken?: string | null;
  userId?: string | null;
  localOnly?: boolean;
};

export type SignOutSessionResult = {
  serverSignOutUnreachable: boolean;
};

export type SignOutSessionBestEffortExtra = {
  forcePersistSignedOut?: boolean;
  userId?: string | null;
  refreshToken?: string | null;
};

function flowBudgetMs(deadlineMs: number, stepMs: number): number {
  return Math.min(stepMs, Math.max(0, deadlineMs - Date.now()));
}

function isPastSignOutFlowDeadline(deadlineMs: number): boolean {
  return Date.now() >= deadlineMs;
}

async function shouldClearLocalSession(
  capturedUserId: string | null,
  deadlineMs: number,
): Promise<boolean> {
  if (isPastSignOutFlowDeadline(deadlineMs)) {
    return false;
  }
  try {
    const { data } = await withSignOutDeadline(
      flowBudgetMs(deadlineMs, SIGN_OUT_SESSION_USER_CHECK_TIMEOUT_MS),
      () => supabase.auth.getSession(),
    );
    const currentUserId = data.session?.user?.id ?? null;
    if (!currentUserId) {
      return true;
    }
    if (!capturedUserId) {
      return true;
    }
    return currentUserId === capturedUserId;
  } catch (error) {
    if (isSignOutDeadlineError(error)) {
      return false;
    }
    throw error;
  }
}

async function clearLocalAuthSession(
  capturedUserId: string | null,
  deadlineMs: number,
): Promise<void> {
  if (isPastSignOutFlowDeadline(deadlineMs)) {
    return;
  }
  if (!(await shouldClearLocalSession(capturedUserId, deadlineMs))) {
    return;
  }

  await withSignOutDeadline(flowBudgetMs(deadlineMs, SIGN_OUT_LOCAL_CLEAR_TIMEOUT_MS), async () => {
    if (isPastSignOutFlowDeadline(deadlineMs)) {
      return;
    }
    const storageKey = getSupabaseAuthStorage().getLastSeenPrimaryAuthSessionKey();
    if (storageKey) {
      await getSupabaseAuthStorage().removeItem(storageKey);
    }
    if (isPastSignOutFlowDeadline(deadlineMs)) {
      return;
    }
    if (!(await shouldClearLocalSession(capturedUserId, deadlineMs))) {
      return;
    }
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      throw error;
    }
  });
}

function scheduleLocalSignOutPersistFailureNote(deadlineMs: number): void {
  void withSignOutDeadline(flowBudgetMs(deadlineMs, SIGN_OUT_LOCAL_CLEAR_TIMEOUT_MS), () =>
    getSupabaseAuthStorage().noteLocalSignOutPersistFailure(),
  ).catch(() => undefined);
}

async function resolveAccessTokenSafely(deadlineMs: number): Promise<string | null> {
  try {
    const { data } = await withSignOutDeadline(
      flowBudgetMs(deadlineMs, SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS),
      () => supabase.auth.getSession(),
    );
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

type RevokeOnServerResult = {
  serverSignOutUnreachable: boolean;
  keepLocalSession: boolean;
  serverRevokeSucceeded: boolean;
};

async function revokeOnServerForSignOut(
  capturedAccessToken: string,
  capturedUserId: string | null,
  capturedRefreshToken: string | null,
  deadlineMs: number,
): Promise<RevokeOnServerResult> {
  let serverSignOutUnreachable = false;
  let serverRevokeSucceeded = false;
  let revoke = await revokeSessionOnServer(
    capturedAccessToken,
    'global',
    flowBudgetMs(deadlineMs, SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS),
  );

  if (revoke.result === 'rate_limited') {
    return { serverSignOutUnreachable: false, keepLocalSession: true, serverRevokeSucceeded: false };
  }

  if (revoke.result === 'revoked' || revoke.result === 'already_revoked') {
    serverRevokeSucceeded = true;
  }

  if (revoke.result === 'token_expired') {
    if (!capturedRefreshToken) {
      return {
        serverSignOutUnreachable: true,
        keepLocalSession: false,
        serverRevokeSucceeded: false,
      };
    }
    try {
      const refreshed = await refreshAccessTokenForSignOut(
        capturedRefreshToken,
        flowBudgetMs(deadlineMs, SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS),
      );
      if (capturedUserId && refreshed.userId !== capturedUserId) {
        return {
          serverSignOutUnreachable: false,
          keepLocalSession: false,
          serverRevokeSucceeded: false,
        };
      }
      revoke = await revokeSessionOnServer(
        refreshed.accessToken,
        'global',
        flowBudgetMs(deadlineMs, SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS),
      );
      if (revoke.result === 'revoked' || revoke.result === 'already_revoked') {
        serverRevokeSucceeded = true;
      }
      if (revoke.result === 'token_expired') {
        serverSignOutUnreachable = true;
      }
      if (revoke.result === 'rate_limited') {
        return { serverSignOutUnreachable: false, keepLocalSession: true, serverRevokeSucceeded };
      }
    } catch (error) {
      if (isRefreshRateLimitedError(error) || isAuthRateLimitedError(error)) {
        return { serverSignOutUnreachable: false, keepLocalSession: true, serverRevokeSucceeded };
      }
      if (isRefreshInvalidGrantError(error)) {
        return {
          serverSignOutUnreachable: false,
          keepLocalSession: false,
          serverRevokeSucceeded,
        };
      }
      if (isSignOutDeadlineError(error) || isAuthServerUnreachableError(error)) {
        return {
          serverSignOutUnreachable: true,
          keepLocalSession: false,
          serverRevokeSucceeded,
        };
      }
      throw error instanceof Error ? error : new Error('sign_out_failed');
    }
  }

  if (revoke.result === 'unreachable') {
    serverSignOutUnreachable = true;
  } else if (revoke.result === 'failed') {
    throw revoke.error instanceof Error ? revoke.error : new Error('sign_out_failed');
  }

  return { serverSignOutUnreachable, keepLocalSession: false, serverRevokeSucceeded };
}

async function runSignOutSession(options: SignOutSessionOptions): Promise<SignOutSessionResult> {
  const deadlineMs = Date.now() + SIGN_OUT_FLOW_CAP_MS;
  const capturedUserId = options.localOnly ? null : (options.userId ?? null);
  let serverSignOutUnreachable = false;
  let keepLocalSession = false;
  let serverRevokeSucceeded = false;

  try {
    if (!options.localOnly) {
      let accessToken = options.accessToken;
      if (!accessToken) {
        accessToken = await resolveAccessTokenSafely(deadlineMs);
      }
      if (accessToken) {
        const revokeResult = await revokeOnServerForSignOut(
          accessToken,
          capturedUserId,
          options.refreshToken ?? null,
          deadlineMs,
        );
        serverSignOutUnreachable = revokeResult.serverSignOutUnreachable;
        keepLocalSession = revokeResult.keepLocalSession;
        serverRevokeSucceeded = revokeResult.serverRevokeSucceeded;
        if (keepLocalSession) {
          throw new Error('sign_out_rate_limited');
        }
      }
    }
  } catch (error) {
    if (keepLocalSession) {
      throw error;
    }
    if (isSignOutDeadlineError(error) || isAuthServerUnreachableError(error)) {
      serverSignOutUnreachable = true;
    } else if (!isRefreshInvalidGrantError(error)) {
      throw error;
    }
  } finally {
    if (!keepLocalSession) {
      try {
        await clearLocalAuthSession(capturedUserId, deadlineMs);
      } catch (error) {
        if (isSignOutDeadlineError(error) || isAuthServerUnreachableError(error)) {
          if (!serverRevokeSucceeded) {
            serverSignOutUnreachable = true;
          }
          scheduleLocalSignOutPersistFailureNote(deadlineMs);
        } else {
          throw error;
        }
      }
    }
  }

  return { serverSignOutUnreachable };
}

export async function signOutSession(options: SignOutSessionOptions): Promise<SignOutSessionResult> {
  if (signOutSessionInFlight) {
    return { serverSignOutUnreachable: false };
  }
  signOutSessionInFlight = true;
  getSupabaseAuthStorage().resetSignOutPersistWarning();
  try {
    return await runSignOutSession(options);
  } finally {
    signOutSessionInFlight = false;
  }
}

export function signOutSessionBestEffort(
  accessToken: string | null,
  extra?: SignOutSessionBestEffortExtra,
): void {
  if (signOutSessionInFlight) {
    return;
  }
  signOutSessionInFlight = true;
  getSupabaseAuthStorage().resetSignOutPersistWarning();
  void runSignOutSession({
    accessToken,
    refreshToken: extra?.refreshToken ?? null,
    userId: extra?.userId ?? null,
  })
    .catch(() => undefined)
    .finally(() => {
      signOutSessionInFlight = false;
    });
  if (extra?.forcePersistSignedOut) {
    void getSupabaseAuthStorage().forcePersistSignedOutStateForLastKnownSessionKey();
  }
}
