import { normalizeVersion } from './compare-versions';

const DEFAULT_MOCK_LATEST_VERSION = '99.0.0';

export function isAppUpdateMockEnabled(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_APP_UPDATE_MOCK === 'true';
}

export function getMockLatestVersion(): string {
  const override = process.env.EXPO_PUBLIC_APP_UPDATE_MOCK_LATEST?.trim();
  if (override) {
    return normalizeVersion(override);
  }

  return DEFAULT_MOCK_LATEST_VERSION;
}
