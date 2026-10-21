import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLatestReleaseVersion } from './fetch-latest-release-version';

describe('fetchLatestReleaseVersion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns normalized version from tag_name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tag_name: 'v1.5.0' }),
      }),
    );

    await expect(fetchLatestReleaseVersion()).resolves.toBe('1.5.0');
  });

  it('returns null when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    await expect(fetchLatestReleaseVersion()).resolves.toBeNull();
  });

  it('returns null when tag_name is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );

    await expect(fetchLatestReleaseVersion()).resolves.toBeNull();
  });
});
