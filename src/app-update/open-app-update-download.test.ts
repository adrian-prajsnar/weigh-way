import { describe, expect, it, vi } from 'vitest';
import { openAppUpdateDownload } from './open-app-update-download';
import { getAppUpdateDownloadUrl } from './get-app-update-download-url';

const mocks = vi.hoisted(() => ({ openBrowserAsync: vi.fn() }));
vi.mock('expo-web-browser', () => mocks);
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('./app-update-mock', () => ({ isAppUpdateMockEnabled: () => false }));

describe('update downloads', () => {
  it('opens the exact verified release even if GitHub latest changes later', async () => {
    const downloadUrl = getAppUpdateDownloadUrl('android', 'v2.0.0')!;
    await expect(
      openAppUpdateDownload({
        mode: 'github',
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        downloadUrl,
      }),
    ).resolves.toBe('opened');
    expect(mocks.openBrowserAsync).toHaveBeenCalledWith(
      'https://github.com/adrian-prajsnar/weigh-way/releases/download/v2.0.0/weigh-way.apk',
    );
  });
});
