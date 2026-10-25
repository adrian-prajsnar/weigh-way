import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock('../supabase/auth-storage-key', () => ({
  getSupabaseLegacyPkceVerifierKey: () => 'sb-test-auth-token-code-verifier',
}));

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

// eslint-disable-next-line import/first -- load after vi.mock
import {
  backupLegacyVerifierForRollback,
  restoreLegacyVerifierForFlow,
  snapshotLegacyVerifierForFlow,
} from './pkce-verifier-backup';

describe('pkce verifier backup', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('removes a stale backup when there is no legacy verifier to snapshot', async () => {
    const backupKey = '@weigh-way/pkce-verifier-backup/signup';
    storage.set(backupKey, 'stale-verifier/challenge');

    await snapshotLegacyVerifierForFlow('signup');

    expect(storage.has(backupKey)).toBe(false);
  });

  it('restores the signup verifier after a reset overwrote the legacy key', async () => {
    const legacyKey = 'sb-test-auth-token-code-verifier';
    storage.set(legacyKey, 'signup-verifier/challenge');
    await snapshotLegacyVerifierForFlow('signup');

    storage.set(legacyKey, 'reset-verifier/challenge');
    await snapshotLegacyVerifierForFlow('recovery');

    await restoreLegacyVerifierForFlow('signup');
    expect(storage.get(legacyKey)).toBe('signup-verifier/challenge');
  });

  it('rolls back the legacy verifier after a failed exchange attempt', async () => {
    const legacyKey = 'sb-test-auth-token-code-verifier';
    storage.set(legacyKey, 'before-exchange/challenge');
    const rollback = await backupLegacyVerifierForRollback();

    storage.set(legacyKey, 'after-failed-exchange/challenge');
    await rollback?.();

    expect(storage.get(legacyKey)).toBe('before-exchange/challenge');
  });
});
