import { isJwtExpiredError, isTransientLoadError, toSupabaseErrorFromUnknown } from './errors';
import { supabase } from './client';

/** Waits before each retry; the read runs once more than there are delays. */
const RETRY_DELAYS_MS = [400, 800, 1600];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Opening the app after the access token has expired refreshes it immediately.
 * PostgREST sometimes rejects that new token once ("JWT issued at future") or the
 * read still runs with the expired token. Those failures are one-off; retrying
 * the read avoids leaving Profile on "Could not load data".
 */
export async function withTransientRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const delayMs = RETRY_DELAYS_MS[attempt];
      if (delayMs === undefined || !isTransientLoadError(error)) {
        throw toSupabaseErrorFromUnknown(error);
      }

      if (isJwtExpiredError(error)) {
        await supabase.auth.refreshSession().catch(() => undefined);
      }

      await delay(delayMs);
    }
  }
}
