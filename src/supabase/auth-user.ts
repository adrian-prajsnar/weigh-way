import { isTransientLoadError, SignedOutError } from './errors';
import { supabase } from './client';

export async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (data.session?.user) {
    return data.session.user.id;
  }

  // Keep temporary refresh failures (network, clock skew) so the read can be retried.
  // Replacing them with "must be signed in" made a day-old open look like a hard data error.
  // A dead refresh token still means the user is signed out.
  if (error && isTransientLoadError(error)) {
    throw error;
  }

  throw new SignedOutError();
}
