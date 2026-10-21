import { getMockLatestVersion, isAppUpdateMockEnabled } from './app-update-mock';
import { fetchLatestReleaseVersion } from './fetch-latest-release-version';

export type AppUpdateCheckResult = {
  mode: 'mock' | 'github';
  latestVersion: string;
};

export async function resolveAppUpdateCheck(): Promise<AppUpdateCheckResult | null> {
  if (isAppUpdateMockEnabled()) {
    return {
      mode: 'mock',
      latestVersion: getMockLatestVersion(),
    };
  }

  if (__DEV__) {
    return null;
  }

  const latestVersion = await fetchLatestReleaseVersion();
  if (!latestVersion) {
    return null;
  }

  return {
    mode: 'github',
    latestVersion,
  };
}
