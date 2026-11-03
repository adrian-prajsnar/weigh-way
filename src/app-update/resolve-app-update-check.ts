import { getMockLatestVersion, isAppUpdateMockEnabled } from './app-update-mock';
import { fetchLatestRelease } from './fetch-latest-release';

export type AppUpdateCheckResult = {
  mode: 'mock' | 'github';
  latestVersion: string;
  downloadUrl: string | null;
};

export async function resolveAppUpdateCheck(): Promise<AppUpdateCheckResult | null> {
  if (isAppUpdateMockEnabled()) {
    return {
      mode: 'mock',
      latestVersion: getMockLatestVersion(),
      downloadUrl: null,
    };
  }

  if (__DEV__) {
    return null;
  }

  const release = await fetchLatestRelease();
  if (!release) {
    return null;
  }

  return {
    mode: 'github',
    ...release,
  };
}
