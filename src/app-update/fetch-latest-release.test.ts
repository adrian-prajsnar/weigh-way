import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLatestRelease } from './fetch-latest-release';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

describe('fetchLatestRelease', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns normalized version from tag_name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tag_name: 'v1.5.0',
          assets: [{ name: 'weigh-way.apk', state: 'uploaded' }],
        }),
      }),
    );

    await expect(fetchLatestRelease()).resolves.toEqual({
      latestVersion: '1.5.0',
      downloadUrl:
        'https://github.com/adrian-prajsnar/weigh-way/releases/download/v1.5.0/weigh-way.apk',
    });
  });

  it.each([
    [[], 'android', null],
    [[{ name: 'weigh-way.apk', state: 'new' }], 'android', null],
    [[{ name: 'weigh-way.apk', state: 'uploaded' }], 'ios', null],
    [[{ name: 'weigh-way.ipa', state: 'uploaded' }], 'ios', '1.5.0'],
  ])('requires an uploaded asset for the current platform', async (assets, platform, expected) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tag_name: 'v1.5.0', assets }),
      }),
    );
    const release = await fetchLatestRelease(platform as 'android' | 'ios');
    expect(release?.latestVersion ?? null).toBe(expected);
    if (release)
      expect(release.downloadUrl).toBe(
        'https://github.com/adrian-prajsnar/weigh-way/releases/download/v1.5.0/weigh-way.ipa',
      );
  });

  it('returns null when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    await expect(fetchLatestRelease()).resolves.toBeNull();
  });

  it('returns null when tag_name is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );

    await expect(fetchLatestRelease()).resolves.toBeNull();
  });
});
