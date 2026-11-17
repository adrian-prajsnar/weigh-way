import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { FetchAllRowsLimitError } from './fetch-all-rows';

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

  it.each(['errors.couldNotLoadEntries', 'errors.couldNotLoadProfile'] as const)(
    'uses the supplied read fallback %s for generic failures',
    async (fallback) => {
      const operation = vi.fn().mockRejectedValue(new Error('private database detail'));
      await expect(withTransientRetry(operation, fallback)).rejects.toThrow(t(fallback));
      expect(operation).toHaveBeenCalledTimes(1);
    },
  );

  it('defaults generic failures to the data load message', async () => {
    await expect(
      withTransientRetry(vi.fn().mockRejectedValue(new Error('private database detail'))),
    ).rejects.toThrow(t('errors.couldNotLoadData'));
  });

  it('preserves network errors after all retries with a read fallback', async () => {
    vi.useFakeTimers();
    const operation = vi.fn().mockRejectedValue(new Error('Network request failed'));
    const assertion = expect(
      withTransientRetry(operation, 'errors.couldNotLoadEntries'),
    ).rejects.toThrow(t('errors.noConnection'));
    await vi.runAllTimersAsync();
    await assertion;
    expect(operation).toHaveBeenCalledTimes(4);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('preserves expired-session errors after all retries with a read fallback', async () => {
    vi.useFakeTimers();
    const operation = vi.fn().mockRejectedValue({ code: 'PGRST301', message: 'JWT expired' });
    const assertion = expect(
      withTransientRetry(operation, 'errors.couldNotLoadProfile'),
    ).rejects.toThrow(t('errors.sessionExpired'));
    await vi.runAllTimersAsync();
    await assertion;
    expect(operation).toHaveBeenCalledTimes(4);
    expect(refreshSession).toHaveBeenCalledTimes(3);
  });

  it.each([
    { error: new SignedOutError(), key: 'errors.mustBeSignedIn' },
    { error: new FetchAllRowsLimitError(), key: 'errors.dataTooLarge' },
  ] as const)('preserves $key with a read fallback', async ({ error, key }) => {
    const operation = vi.fn().mockRejectedValue(error);
    await expect(withTransientRetry(operation, 'errors.couldNotLoadProfile')).rejects.toThrow(t(key));
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
