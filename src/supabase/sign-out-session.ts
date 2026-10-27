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

  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error && !options.localOnly) {
    throw error;
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
    getSupabaseAuthStorage().consumeSignOutPersistWarning();
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
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      getSupabaseAuthStorage().consumeSignOutPersistWarning();
      signOutSessionInFlight = false;
    }
  })();
  if (extra?.forcePersistSignedOut) {
    void getSupabaseAuthStorage().forcePersistSignedOutStateForLastKnownSessionKey();
  }
}
