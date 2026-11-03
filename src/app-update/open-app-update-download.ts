import * as WebBrowser from 'expo-web-browser';
import { isAppUpdateMockEnabled } from './app-update-mock';
import type { AvailableAppUpdate } from './get-available-app-update';

export type OpenAppUpdateDownloadResult = 'opened' | 'mocked' | 'unsupported';

export async function openAppUpdateDownload(
  update: AvailableAppUpdate,
): Promise<OpenAppUpdateDownloadResult> {
  if (isAppUpdateMockEnabled()) {
    return 'mocked';
  }

  const downloadUrl = update.downloadUrl;
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
