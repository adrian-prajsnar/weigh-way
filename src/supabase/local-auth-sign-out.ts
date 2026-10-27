import { getSupabaseAuthStorage } from './auth-session-storage';
import { supabase } from './client';

let localAuthSignOutInFlight = false;

/** Best-effort local sign-out; at most one in flight for the whole app. */
export function beginLocalAuthSignOutBestEffort(): void {
  if (localAuthSignOutInFlight) {
    return;
  }
  localAuthSignOutInFlight = true;
  getSupabaseAuthStorage().resetSignOutPersistWarning();
  void supabase.auth.signOut({ scope: 'local' }).finally(() => {
    getSupabaseAuthStorage().consumeSignOutPersistWarning();
    localAuthSignOutInFlight = false;
  });
  void getSupabaseAuthStorage().forcePersistSignedOutStateForLastKnownSessionKey();
}

/** Awaitable local sign-out; skips when another sign-out is already in flight. */
export async function signOutLocallyOnce(): Promise<void> {
  if (localAuthSignOutInFlight) {
    return;
  }
  localAuthSignOutInFlight = true;
  getSupabaseAuthStorage().resetSignOutPersistWarning();
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } finally {
    getSupabaseAuthStorage().consumeSignOutPersistWarning();
    localAuthSignOutInFlight = false;
  }
}
