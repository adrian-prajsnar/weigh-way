import {
  isAuthRateLimitedError,
  isAuthServerUnreachableError,
  isRefreshInvalidGrantError,
  isRefreshRateLimitedError,
} from './auth-reachability-error';
import { supabase } from './client';
import { revokeSessionOnServer } from './revoke-session-on-server';
import { getLatestAuthUserIdFromEvents } from './sign-out-local-user';
import {
  isSignOutDeadlineError,
  SIGN_OUT_REFRESH_TIMEOUT_MS,
  SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS,
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

async function shouldClearLocalSession(capturedUserId: string | null): Promise<boolean> {
  const eventUserId = getLatestAuthUserIdFromEvents();
  if (eventUserId && capturedUserId && eventUserId !== capturedUserId) {
    return false;
  }

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

async function clearLocalAuthSession(capturedUserId: string | null): Promise<void> {
  if (!(await shouldClearLocalSession(capturedUserId))) {
    return;
  }

  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    throw error;
  }
}

type RevokeOnServerResult = {
  serverSignOutUnreachable: boolean;
  keepLocalSession: boolean;
};

async function revokeOnServerForSignOut(
  capturedAccessToken: string,
  capturedUserId: string | null,
  capturedRefreshToken: string | null,
): Promise<RevokeOnServerResult> {
  let revoke = await revokeSessionOnServer(
    capturedAccessToken,
    'global',
    SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS,
  );

  if (revoke.result === 'rate_limited') {
    return { serverSignOutUnreachable: false, keepLocalSession: true };
  }

  if (revoke.result === 'token_expired') {
    if (!capturedRefreshToken) {
      return { serverSignOutUnreachable: true, keepLocalSession: false };
    }
    try {
      const refreshed = await refreshAccessTokenForSignOut(
        capturedRefreshToken,
        SIGN_OUT_REFRESH_TIMEOUT_MS,
      );
      if (capturedUserId && refreshed.userId !== capturedUserId) {
        return { serverSignOutUnreachable: false, keepLocalSession: false };
      }
      revoke = await revokeSessionOnServer(
        refreshed.accessToken,
        'global',
        SIGN_OUT_SERVER_REVOKE_TIMEOUT_MS,
      );
      if (revoke.result === 'rate_limited') {
        return { serverSignOutUnreachable: false, keepLocalSession: true };
      }
    } catch (error) {
      if (isRefreshRateLimitedError(error) || isAuthRateLimitedError(error)) {
        return { serverSignOutUnreachable: false, keepLocalSession: true };
      }
      if (isRefreshInvalidGrantError(error)) {
        return { serverSignOutUnreachable: false, keepLocalSession: false };
      }
      if (isSignOutDeadlineError(error) || isAuthServerUnreachableError(error)) {
        return { serverSignOutUnreachable: true, keepLocalSession: false };
      }
      throw error instanceof Error ? error : new Error('sign_out_failed');
    }
  }

  if (revoke.result === 'unreachable') {
    return { serverSignOutUnreachable: true, keepLocalSession: false };
  }
  if (revoke.result === 'failed') {
    throw revoke.error instanceof Error ? revoke.error : new Error('sign_out_failed');
  }

  return { serverSignOutUnreachable: false, keepLocalSession: false };
}

async function runSignOutSession(options: SignOutSessionOptions): Promise<SignOutSessionResult> {
  const capturedUserId = options.localOnly ? null : (options.userId ?? null);
  let serverSignOutUnreachable = false;
  let keepLocalSession = false;

  try {
    if (!options.localOnly && options.accessToken) {
      const revokeResult = await revokeOnServerForSignOut(
        options.accessToken,
        capturedUserId,
        options.refreshToken ?? null,
      );
      serverSignOutUnreachable = revokeResult.serverSignOutUnreachable;
      keepLocalSession = revokeResult.keepLocalSession;
      if (keepLocalSession) {
        throw new Error('sign_out_rate_limited');
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
      await clearLocalAuthSession(capturedUserId);
    }
  }

  return { serverSignOutUnreachable };
}

export async function signOutSession(options: SignOutSessionOptions): Promise<SignOutSessionResult> {
  if (signOutSessionInFlight) {
    return { serverSignOutUnreachable: false };
  }
  signOutSessionInFlight = true;
  try {
    return await runSignOutSession(options);
  } finally {
    signOutSessionInFlight = false;
  }
}
