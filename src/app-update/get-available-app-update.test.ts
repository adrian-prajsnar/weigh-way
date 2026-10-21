import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAvailableAppUpdate } from './get-available-app-update';
import { resolveAppUpdateCheck } from './resolve-app-update-check';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.4.0' } },
}));

vi.mock('./should-run-app-update-check', () => ({
  shouldRunAppUpdateCheck: vi.fn(() => true),
}));

vi.mock('./resolve-app-update-check', () => ({
  resolveAppUpdateCheck: vi.fn(),
}));

describe('getAvailableAppUpdate', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the latest version is not newer', async () => {
    vi.mocked(resolveAppUpdateCheck).mockResolvedValue({
      mode: 'github',
      latestVersion: '1.4.0',
    });

    await expect(getAvailableAppUpdate()).resolves.toBeNull();
  });

  it('returns the latest version when it is newer', async () => {
    vi.mocked(resolveAppUpdateCheck).mockResolvedValue({
      mode: 'mock',
      latestVersion: '99.0.0',
    });

    await expect(getAvailableAppUpdate()).resolves.toEqual({
      mode: 'mock',
      currentVersion: '1.4.0',
      latestVersion: '99.0.0',
    });
  });

  it('returns null when the update check is unavailable', async () => {
    vi.mocked(resolveAppUpdateCheck).mockResolvedValue(null);

    await expect(getAvailableAppUpdate()).resolves.toBeNull();
  });
});
