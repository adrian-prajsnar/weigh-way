import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FLAGGED_RESTORED_SESSION_VALIDATION_MS,
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
});
