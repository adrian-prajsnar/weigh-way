import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@weigh-way/theme';

export type ThemePreference = 'system' | 'light' | 'dark';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export async function getThemePreference(): Promise<ThemePreference> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  return isThemePreference(value) ? value : 'system';
}

export async function setStoredThemePreference(preference: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, preference);
}
