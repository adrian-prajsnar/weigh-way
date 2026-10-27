import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forceLocalAuthSignOut, LOCAL_SIGN_OUT_TIMEOUT_MS } from './force-local-auth-sign-out';

describe('forceLocalAuthSignOut', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('forces disk signed-out state when supabase sign-out hangs', async () => {
    const clearReactSession = vi.fn();
    const forcePersistSignedOutOnDisk = vi.fn().mockResolvedValue(undefined);

    const runPromise = forceLocalAuthSignOut({
      signOutViaSupabase: () => new Promise(() => {}),
      clearReactSession,
      forcePersistSignedOutOnDisk,
    });

    await vi.advanceTimersByTimeAsync(LOCAL_SIGN_OUT_TIMEOUT_MS);
    await runPromise;

    expect(clearReactSession).toHaveBeenCalledTimes(1);
    expect(forcePersistSignedOutOnDisk).toHaveBeenCalledTimes(1);
  });
});
