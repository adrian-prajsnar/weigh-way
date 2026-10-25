import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: (key: string) => Promise.resolve(storage.get(key) ?? null),
    setItem: (key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      storage.delete(key);
      return Promise.resolve();
    },
  },
}));

vi.mock('./pkce-verifier-backup', () => ({
  snapshotLegacyVerifierForFlow: vi.fn(),
}));

// eslint-disable-next-line import/first -- load after vi.mock
import {
  AUTH_PENDING_FLOW_TTL_MS,
  clearAuthPendingFlows,
  isEmailConfirmationPending,
  markEmailConfirmationPending,
  markPasswordResetPending,
  resolveEmailCallbackFlowKind,
} from './auth-pending-flow';

describe('auth pending flow storage', () => {
  beforeEach(() => {
    storage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks email confirmation as pending within the TTL', async () => {
    await markEmailConfirmationPending('user@example.com');
    expect(await isEmailConfirmationPending()).toBe(true);
  });

  it('expires pending flows after the TTL', async () => {
    await markEmailConfirmationPending('user@example.com');
    vi.setSystemTime(new Date(Date.now() + AUTH_PENDING_FLOW_TTL_MS + 1));
    expect(await isEmailConfirmationPending()).toBe(false);
  });

  it('clears all pending flows', async () => {
    await markEmailConfirmationPending('user@example.com');
    await markPasswordResetPending('user@example.com');
    await clearAuthPendingFlows();
    expect(await isEmailConfirmationPending()).toBe(false);
  });

  it('prefers the most recently started flow when both are pending', async () => {
    await markEmailConfirmationPending('signup@example.com');
    vi.advanceTimersByTime(1_000);
    await markPasswordResetPending('reset@example.com');

    expect(await resolveEmailCallbackFlowKind()).toBe('recovery');
  });
});
