import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '../i18n';
import { refreshSessionOnForeground } from './app-lifecycle';
import { withAuthRetry } from './with-auth-retry';

vi.mock('./app-lifecycle', () => ({
  refreshSessionOnForeground: vi.fn(),
}));

describe('withAuthRetry', () => {
  beforeEach(() => {
    vi.stubGlobal('__DEV__', false);
    vi.useFakeTimers();
    vi.mocked(refreshSessionOnForeground).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.mocked(refreshSessionOnForeground).mockReset();
  });

  it('throws a mapped error once for non clock-skew failures without refreshing', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ code: '42501', message: 'permission denied' });

    const promise = withAuthRetry(operation);

    await expect(promise).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(t('errors.databasePermission'));
      expect((error as Error).message).not.toBe('permission denied');
      return true;
    });

    expect(operation).toHaveBeenCalledTimes(1);
    expect(refreshSessionOnForeground).not.toHaveBeenCalled();
  });

  it('refreshes once and retries after jwt clock skew, then returns success', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ code: 'PGRST303', message: 'JWT issued at future' })
      .mockResolvedValueOnce('ok');

    const promise = withAuthRetry(operation);

    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');

    expect(refreshSessionOnForeground).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('retries clock skew up to three attempts then throws a mapped jwt error', async () => {
    const clockSkew = { code: 'PGRST303', message: 'JWT issued at future' };
    const operation = vi.fn().mockRejectedValue(clockSkew);

    const promise = withAuthRetry(operation);
    const rejected = expect(promise).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(t('errors.jwtClockSkew'));
      return true;
    });

    await vi.runAllTimersAsync();
    await rejected;

    expect(operation).toHaveBeenCalledTimes(3);
    expect(refreshSessionOnForeground).toHaveBeenCalledTimes(2);
  });
});
