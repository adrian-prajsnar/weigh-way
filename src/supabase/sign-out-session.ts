import {
  isAuthServerUnreachableError,
  isRefreshInvalidGrantError,
  isRefreshRateLimitedError,
} from './auth-reachability-error';
import { getSupabaseAuthStorage } from './auth-session-storage';
import { supabase } from './client';
import { revokeSessionOnServer } from './revoke-session-on-server';
import {
  isSignOutDeadlineError,
  SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS,
  withSignOutDeadline,
} from './sign-out-deadlines';
import { refreshAccessTokenForSignOut } from './sign-out-token-refresh';

let signOutSessionInFlight = false;

export type SignOutSessionOptions = {
  accessToken: string | null;
  refreshToken?: string | null;
  userId?: string | null;
  /** When true, only clears this device after server revoke. */
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

async function shouldClearLocalSession(capturedUserId: string | null): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const currentUserId = data.session?.user?.id ?? null;
  if (!currentUserId) {
    return true;
  }
  if (!capturedUserId) {
    return true;
  }
  return currentUserId === capturedUserId;
}

/** Clears auth-js + resilient storage without a second POST /logout (storage cleared first). */
async function clearLocalAuthSession(
  capturedUserId: string | null,
  trustedCurrentUserId?: string | null,
): Promise<void> {
  if (trustedCurrentUserId !== undefined) {
    if (
      trustedCurrentUserId &&
      capturedUserId &&
      trustedCurrentUserId !== capturedUserId
    ) {
      return;
    }
  } else if (!(await shouldClearLocalSession(capturedUserId))) {
    return;
  }

  const storageKey = getSupabaseAuthStorage().getLastSeenPrimaryAuthSessionKey();
  if (storageKey) {
    await getSupabaseAuthStorage().removeItem(storageKey);
  }

  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    throw error;
  }
}

async function resolveAccessTokenSafely(): Promise<string | null> {
  try {
    const { data } = await withSignOutDeadline(SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS, () =>
      supabase.auth.getSession(),
    );
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function refreshSessionForSignOut(
  refreshToken: string,
): Promise<{ session: { access_token: string; user: { id: string } } }> {
  const refreshed = await refreshAccessTokenForSignOut(refreshToken);
  return {
    session: {
      access_token: refreshed.accessToken,
      user: { id: refreshed.userId },
    },
  };
}

type RevokeOnServerResult = {
  serverSignOutUnreachable: boolean;
  keepLocalSession: boolean;
  trustedCurrentUserId?: string | null;
};

async function revokeOnServerForSignOut(
  capturedAccessToken: string,
  capturedUserId: string | null,
  capturedRefreshToken: string | null,
): Promise<RevokeOnServerResult> {
  let serverSignOutUnreachable = false;
  let trustedCurrentUserId: string | null | undefined;
  let revoke = await revokeSessionOnServer(capturedAccessToken, 'global');

  if (revoke.result === 'token_expired') {
    if (!capturedRefreshToken) {
      serverSignOutUnreachable = true;
      return { serverSignOutUnreachable, keepLocalSession: false };
    }

    try {
      const refreshed = await refreshSessionForSignOut(capturedRefreshToken);
      if (!refreshed) {
        return { serverSignOutUnreachable, keepLocalSession: false };
      }
      if (capturedUserId && refreshed.session.user.id !== capturedUserId) {
        return { serverSignOutUnreachable: false, keepLocalSession: false };
      }
      trustedCurrentUserId = refreshed.session.user.id;
      revoke = await revokeSessionOnServer(refreshed.session.access_token, 'global');
      if (revoke.result === 'token_expired') {
        serverSignOutUnreachable = true;
      }
    } catch (error) {
      if (isRefreshRateLimitedError(error)) {
        return { serverSignOutUnreachable: false, keepLocalSession: true };
      }
      if (isRefreshInvalidGrantError(error)) {
        return {
          serverSignOutUnreachable: false,
          keepLocalSession: false,
          trustedCurrentUserId: capturedUserId,
        };
      }
      if (
        isSignOutDeadlineError(error) ||
        isAuthServerUnreachableError(error)
      ) {
        serverSignOutUnreachable = true;
        return {
          serverSignOutUnreachable,
          keepLocalSession: false,
          trustedCurrentUserId: capturedUserId,
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

  return { serverSignOutUnreachable, keepLocalSession: false, trustedCurrentUserId };
}

async function runSignOutSession(options: SignOutSessionOptions): Promise<SignOutSessionResult> {
  const capturedUserId = options.localOnly ? null : (options.userId ?? null);
  let serverSignOutUnreachable = false;
  let keepLocalSession = false;
  let trustedCurrentUserId: string | null | undefined;

  try {
    if (!options.localOnly) {
      let accessToken = options.accessToken;
      if (!accessToken) {
        accessToken = await resolveAccessTokenSafely();
      }
      if (accessToken) {
        const revokeResult = await revokeOnServerForSignOut(
          accessToken,
          capturedUserId,
          options.refreshToken ?? null,
        );
        serverSignOutUnreachable = revokeResult.serverSignOutUnreachable;
        keepLocalSession = revokeResult.keepLocalSession;
        trustedCurrentUserId = revokeResult.trustedCurrentUserId;
        if (keepLocalSession) {
          throw new Error('sign_out_rate_limited');
        }
      }
    }
  } catch (error) {
    if (keepLocalSession) {
      throw error;
    }
    if (
      isSignOutDeadlineError(error) ||
      isAuthServerUnreachableError(error)
    ) {
      serverSignOutUnreachable = true;
      trustedCurrentUserId = capturedUserId;
    } else if (!isRefreshInvalidGrantError(error)) {
      throw error;
    }
  } finally {
    if (!keepLocalSession) {
      await clearLocalAuthSession(capturedUserId, trustedCurrentUserId);
    }
  }

  return { serverSignOutUnreachable };
}

/** Server revoke (when token present) then local sign-out; at most one in flight. */
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
  const capturedUserId = extra?.userId ?? null;
  void (async () => {
    let keepLocalSession = false;
    let trustedCurrentUserId: string | null | undefined;
    try {
      let token = accessToken;
      if (!token) {
        token = await resolveAccessTokenSafely();
      }
      if (token) {
        const revokeResult = await revokeOnServerForSignOut(
          token,
          capturedUserId,
          extra?.refreshToken ?? null,
        );
        keepLocalSession = revokeResult.keepLocalSession;
        trustedCurrentUserId = revokeResult.trustedCurrentUserId;
      }
    } catch {
      // Best-effort: still attempt local clear unless rate-limited.
    } finally {
      if (!keepLocalSession) {
        await clearLocalAuthSession(capturedUserId, trustedCurrentUserId).catch(() => undefined);
      }
      signOutSessionInFlight = false;
    }
  })();
  if (extra?.forcePersistSignedOut) {
    void getSupabaseAuthStorage().forcePersistSignedOutStateForLastKnownSessionKey();
  }
}
