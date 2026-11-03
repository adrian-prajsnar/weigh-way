import { Platform } from 'react-native';

export function getAppUpdateDownloadUrl(platform: typeof Platform.OS, tag: string): string | null {
  const releaseUrl = `https://github.com/adrian-prajsnar/weigh-way/releases/download/${encodeURIComponent(tag)}`;
  if (platform === 'android') {
    return `${releaseUrl}/weigh-way.apk`;
  }

  if (platform === 'ios') {
    return `${releaseUrl}/weigh-way.ipa`;
  }

  return null;
}
