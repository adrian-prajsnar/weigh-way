import { Platform } from 'react-native';
import { ANDROID_APK_DOWNLOAD_URL, IOS_IPA_DOWNLOAD_URL } from './github-repo';

export function getAppUpdateDownloadUrl(
  platform: typeof Platform.OS,
): string | null {
  if (platform === 'android') {
    return ANDROID_APK_DOWNLOAD_URL;
  }

  if (platform === 'ios') {
    return IOS_IPA_DOWNLOAD_URL;
  }

  return null;
}
