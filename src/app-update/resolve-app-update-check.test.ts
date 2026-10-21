import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAppUpdateCheck } from './resolve-app-update-check';

describe('resolveAppUpdateCheck', () => {
  beforeEach(() => {
    vi.stubGlobal('__DEV__', true);
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns mock result when mock env is enabled in dev', async () => {
    vi.stubEnv('EXPO_PUBLIC_APP_UPDATE_MOCK', 'true');

    await expect(resolveAppUpdateCheck()).resolves.toEqual({
      mode: 'mock',
      latestVersion: '99.0.0',
    });
  });

  it('uses EXPO_PUBLIC_APP_UPDATE_MOCK_LATEST when set', async () => {
    vi.stubEnv('EXPO_PUBLIC_APP_UPDATE_MOCK', 'true');
    vi.stubEnv('EXPO_PUBLIC_APP_UPDATE_MOCK_LATEST', 'v12.1.0');

    await expect(resolveAppUpdateCheck()).resolves.toEqual({
      mode: 'mock',
      latestVersion: '12.1.0',
    });
  });

  it('returns null in dev when mock is off', async () => {
    await expect(resolveAppUpdateCheck()).resolves.toBeNull();
  });

  it('fetches GitHub in production builds', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tag_name: 'v2.0.0' }),
      }),
    );

    await expect(resolveAppUpdateCheck()).resolves.toEqual({
      mode: 'github',
      latestVersion: '2.0.0',
    });
  });

  it('does not use mock when not in dev even if env is set', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.stubEnv('EXPO_PUBLIC_APP_UPDATE_MOCK', 'true');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tag_name: 'v2.0.0' }),
      }),
    );

    await expect(resolveAppUpdateCheck()).resolves.toEqual({
      mode: 'github',
      latestVersion: '2.0.0',
    });
  });
});
