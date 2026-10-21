import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@weigh-way/app-update-dismissed-version';

export async function getDismissedAppUpdateVersion(): Promise<string | null> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  return value && value.length > 0 ? value : null;
}

export async function setDismissedAppUpdateVersion(version: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, version);
}
