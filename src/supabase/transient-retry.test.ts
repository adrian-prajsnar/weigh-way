import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';

const refreshSession = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));

vi.mock('./client', () => ({
  supabase: { auth: { refreshSession } },
}));

// eslint-disable-next-line import/first -- load after vi.mock
import { SignedOutError, toSupabaseErrorFromUnknown } from './errors';
// eslint-disable-next-line import/first -- load after vi.mock
import { withTransientRetry } from './transient-retry';

describe('withTransientRetry', () => {
  afterEach(() => {
    vi.useRealTimers();
    refreshSession.mockClear();
  });

  it('reads again after a freshly refreshed token is rejected once', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ code: 'PGRST303', message: 'JWT issued at future' })
      .mockResolvedValueOnce('profile');

    const pending = withTransientRetry(operation);
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toBe('profile');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes the session when the read still has the expired token', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ code: 'PGRST301', message: 'JWT expired' })
      .mockResolvedValueOnce('entries');

    const pending = withTransientRetry(operation);
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toBe('entries');
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('does not retry a permanent database failure', async () => {
    const operation = vi
      .fn()
      .mockRejectedValue({ message: 'private database detail', code: '42501' });

    await expect(withTransientRetry(operation)).rejects.toThrow(t('errors.couldNotLoadData'));
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('stops retrying a token that stays in the future', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn()
      .mockRejectedValue({ code: 'PGRST303', message: 'JWT issued at future' });

    const pending = withTransientRetry(operation);
    const assertion = expect(pending).rejects.toThrow(t('errors.couldNotLoadData'));
    await vi.runAllTimersAsync();
    await assertion;
    expect(operation).toHaveBeenCalledTimes(4);
  });
});

describe('signed-out session errors', () => {
  it('keeps the signed-out message', () => {
    const signedOut = new SignedOutError();
    const error = toSupabaseErrorFromUnknown(signedOut);
    expect(error).toBe(signedOut);
    expect(error.message).toBe(t('errors.mustBeSignedIn'));
  });
});
