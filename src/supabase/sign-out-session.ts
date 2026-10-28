import { isNetworkError } from '../auth-errors';
import { getSupabaseAuthStorage } from './auth-session-storage';
import { supabase } from './client';
import { revokeSessionOnServer } from './revoke-session-on-server';

let signOutSessionInFlight = false;

export type SignOutSessionOptions = {
  accessToken: string | null;
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
async function clearLocalAuthSession(capturedUserId: string | null): Promise<void> {
  if (!(await shouldClearLocalSession(capturedUserId))) {
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

function isRefreshUnreachable(error: unknown): boolean {
  if (isNetworkError(error)) {
    return true;
  }
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const authError = error as { status?: number; name?: string };
  if (authError.name === 'AuthRetryableFetchError') {
    return true;
  }
  const status = authError.status;
  return status === 0 || (typeof status === 'number' && status >= 500);
}

async function revokeOnServerForSignOut(
  capturedAccessToken: string,
  capturedUserId: string | null,
): Promise<{ serverSignOutUnreachable: boolean }> {
  let serverSignOutUnreachable = false;
  let revoke = await revokeSessionOnServer(capturedAccessToken, 'global');

  if (revoke.result === 'token_expired') {
    const { data, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !data.session) {
      if (refreshError && isRefreshUnreachable(refreshError)) {
        serverSignOutUnreachable = true;
      } else if (refreshError) {
        throw refreshError instanceof Error ? refreshError : new Error('sign_out_failed');
      }
      return { serverSignOutUnreachable };
    }
    if (capturedUserId && data.session.user.id !== capturedUserId) {
      return { serverSignOutUnreachable: false };
    }
    revoke = await revokeSessionOnServer(data.session.access_token, 'global');
  }

  if (revoke.result === 'unreachable') {
    serverSignOutUnreachable = true;
  } else if (revoke.result === 'failed') {
    throw revoke.error instanceof Error ? revoke.error : new Error('sign_out_failed');
  }

  return { serverSignOutUnreachable };
}

async function runSignOutSession(options: SignOutSessionOptions): Promise<SignOutSessionResult> {
  const capturedUserId = options.userId ?? null;
  let serverSignOutUnreachable = false;

  if (options.accessToken && !options.localOnly) {
    const revokeResult = await revokeOnServerForSignOut(options.accessToken, capturedUserId);
    serverSignOutUnreachable = revokeResult.serverSignOutUnreachable;
  }

  await clearLocalAuthSession(options.localOnly ? null : capturedUserId);

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
    try {
      if (accessToken) {
        await revokeOnServerForSignOut(accessToken, capturedUserId);
      }
      await clearLocalAuthSession(capturedUserId);
    } finally {
      signOutSessionInFlight = false;
    }
  })();
  if (extra?.forcePersistSignedOut) {
    void getSupabaseAuthStorage().forcePersistSignedOutStateForLastKnownSessionKey();
  }
}
