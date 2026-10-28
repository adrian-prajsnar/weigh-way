import { getSupabaseAuthStorage } from './auth-session-storage';
import { supabase } from './client';
import { revokeSessionOnServer } from './revoke-session-on-server';

let signOutSessionInFlight = false;

export type SignOutSessionOptions = {
  accessToken: string | null;
  /** When true, only clears this device after server revoke. */
  localOnly?: boolean;
};

export type SignOutSessionResult = {
  serverSignOutUnreachable: boolean;
};

async function shouldClearLocalSession(capturedAccessToken: string | null): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const currentToken = data.session?.access_token ?? null;
  if (!currentToken) {
    return true;
  }
  if (!capturedAccessToken) {
    return true;
  }
  return currentToken === capturedAccessToken;
}

/** Clears auth-js + resilient storage without a second POST /logout (storage cleared first). */
async function clearLocalAuthSession(capturedAccessToken: string | null): Promise<void> {
  if (!(await shouldClearLocalSession(capturedAccessToken))) {
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

async function runSignOutSession(options: SignOutSessionOptions): Promise<SignOutSessionResult> {
  let serverSignOutUnreachable = false;

  if (options.accessToken && !options.localOnly) {
    const revoke = await revokeSessionOnServer(options.accessToken, 'global');
    if (revoke.result === 'unreachable') {
      serverSignOutUnreachable = true;
    } else if (revoke.result === 'failed') {
      throw revoke.error instanceof Error ? revoke.error : new Error('sign_out_failed');
    }
  }

  await clearLocalAuthSession(options.localOnly ? null : options.accessToken);

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
  extra?: { forcePersistSignedOut?: boolean },
): void {
  if (signOutSessionInFlight) {
    return;
  }
  signOutSessionInFlight = true;
  getSupabaseAuthStorage().resetSignOutPersistWarning();
  void (async () => {
    try {
      if (accessToken) {
        await revokeSessionOnServer(accessToken, 'global');
      }
      await clearLocalAuthSession(accessToken);
    } finally {
      signOutSessionInFlight = false;
    }
  })();
  if (extra?.forcePersistSignedOut) {
    void getSupabaseAuthStorage().forcePersistSignedOutStateForLastKnownSessionKey();
  }
}
