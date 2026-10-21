import { isVersionNewer } from './compare-versions';
import { getInstalledAppVersion } from './get-installed-app-version';
import { resolveAppUpdateCheck } from './resolve-app-update-check';
import { shouldRunAppUpdateCheck } from './should-run-app-update-check';

export type AvailableAppUpdate = {
  mode: 'mock' | 'github';
  currentVersion: string;
  latestVersion: string;
};

export async function getAvailableAppUpdate(): Promise<AvailableAppUpdate | null> {
  if (!shouldRunAppUpdateCheck()) {
    return null;
  }

  const currentVersion = getInstalledAppVersion();
  if (!currentVersion) {
    return null;
  }

  const check = await resolveAppUpdateCheck();
  if (!check || !isVersionNewer(check.latestVersion, currentVersion)) {
    return null;
  }

  return {
    mode: check.mode,
    currentVersion,
    latestVersion: check.latestVersion,
  };
}
