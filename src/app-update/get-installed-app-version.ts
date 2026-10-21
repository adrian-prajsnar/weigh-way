import Constants from 'expo-constants';

export function getInstalledAppVersion(): string | null {
  const version = Constants.expoConfig?.version?.trim();
  return version && version.length > 0 ? version : null;
}
