import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FLAGGED_RESTORED_SESSION_VALIDATION_MS,
  runFailClosedLocalSignOut,
  shouldRunFailClosedSignOut,
  validateFlaggedRestoredSession,
} from './bootstrap-session-validation';

describe('validateFlaggedRestoredSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('signs out locally when validation does not finish within the time limit', async () => {
    const signOutLocal = vi.fn().mockResolvedValue(undefined);
    const validate = vi.fn(
      () =>
        new Promise<void>(() => {
          /* hang */
        }),
    );

    const resultPromise = validateFlaggedRestoredSession(validate, signOutLocal);
    await vi.advanceTimersByTimeAsync(FLAGGED_RESTORED_SESSION_VALIDATION_MS);

    await expect(resultPromise).resolves.toBe('timed_out');
    expect(signOutLocal).toHaveBeenCalledTimes(1);
  });

  it('skips sign-out when shouldSignOut returns false', async () => {
    const signOutLocal = vi.fn().mockResolvedValue(undefined);
    const validate = vi.fn(
      () =>
        new Promise<void>(() => {
          /* hang */
        }),
    );

    const resultPromise = validateFlaggedRestoredSession(
      validate,
      signOutLocal,
      async () => false,
    );
    await vi.advanceTimersByTimeAsync(FLAGGED_RESTORED_SESSION_VALIDATION_MS);

    await expect(resultPromise).resolves.toBe('timed_out');
    expect(signOutLocal).not.toHaveBeenCalled();
  });
});

describe('runFailClosedLocalSignOut', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('forces local sign-out when supabase sign-out and disk remove both hang', async () => {
    const clearReactSession = vi.fn();
    const forcePersistSignedOutOnDisk = vi.fn().mockResolvedValue(undefined);

    const runPromise = runFailClosedLocalSignOut(
      {
        bootstrapAuthGeneration: 0,
        accessTokenAtStart: 'token-a',
        getAuthEventGeneration: () => 0,
        getCurrentAccessToken: async () => 'token-a',
      },
      {
        signOutViaSupabase: () => new Promise(() => {}),
        clearReactSession,
        forcePersistSignedOutOnDisk,
      },
    );

    await vi.advanceTimersByTimeAsync(2500);
    await runPromise;

    expect(clearReactSession).toHaveBeenCalledTimes(1);
    expect(forcePersistSignedOutOnDisk).toHaveBeenCalledTimes(1);
  });
});

describe('shouldRunFailClosedSignOut', () => {
  it('returns false when the access token changed', async () => {
    await expect(
      shouldRunFailClosedSignOut({
        bootstrapAuthGeneration: 0,
        accessTokenAtStart: 'token-a',
        getAuthEventGeneration: () => 0,
        getCurrentAccessToken: async () => 'token-b',
      }),
    ).resolves.toBe(false);
  });
});
