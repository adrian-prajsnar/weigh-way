import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { isAppUpdateMockEnabled } from './app-update-mock';
import { getAppUpdateDownloadUrl } from './get-app-update-download-url';

export type OpenAppUpdateDownloadResult = 'opened' | 'mocked' | 'unsupported';

export async function openAppUpdateDownload(): Promise<OpenAppUpdateDownloadResult> {
  if (isAppUpdateMockEnabled()) {
    return 'mocked';
  }

  const downloadUrl = getAppUpdateDownloadUrl(Platform.OS);
  if (!downloadUrl) {
    return 'unsupported';
  }

  try {
    await WebBrowser.openBrowserAsync(downloadUrl);
  } catch {
    return 'unsupported';
  }

  return 'opened';
}
