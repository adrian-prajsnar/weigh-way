import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(async () => {
      storage.clear();
    }),
  },
}));

// eslint-disable-next-line import/first -- load after vi.mock
import {
  AUTH_LAST_EXCHANGED_CODE_TTL_MS,
  clearRememberedAuthCode,
  isAuthCodeAlreadyExchanged,
  rememberExchangedAuthCode,
} from './auth-last-exchanged-code';

describe('auth-last-exchanged-code', () => {
  beforeEach(() => {
    storage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('remembers a code within the TTL', async () => {
    await rememberExchangedAuthCode('abc');
    expect(await isAuthCodeAlreadyExchanged('abc')).toBe(true);
    expect(await isAuthCodeAlreadyExchanged('other')).toBe(false);
  });

  it('forgets codes after the TTL', async () => {
    await rememberExchangedAuthCode('abc');
    vi.advanceTimersByTime(AUTH_LAST_EXCHANGED_CODE_TTL_MS + 1);
    expect(await isAuthCodeAlreadyExchanged('abc')).toBe(false);
  });

  it('clears stored codes', async () => {
    await rememberExchangedAuthCode('abc');
    await clearRememberedAuthCode();
    expect(await isAuthCodeAlreadyExchanged('abc')).toBe(false);
  });
});
