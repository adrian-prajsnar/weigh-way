import AsyncStorage from '@react-native-async-storage/async-storage';
import { warnPreferenceStorageFallback } from './preference-storage-fallback';

const STORAGE_KEY = '@weigh-way/theme';

export type ThemePreference = 'system' | 'light' | 'dark';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export async function getThemePreference(): Promise<ThemePreference> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return isThemePreference(value) ? value : 'system';
  } catch {
    warnPreferenceStorageFallback('theme');
    return 'system';
  }
}

export async function setStoredThemePreference(preference: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, preference);
}
