import AsyncStorage from '@react-native-async-storage/async-storage';
import { warnPreferenceStorageFallback } from './preference-storage-fallback';

const STORAGE_KEY = '@weigh-way/language';

export type LanguagePreference = 'system' | 'en' | 'pl';

function isLanguagePreference(value: string | null): value is LanguagePreference {
  return value === 'system' || value === 'en' || value === 'pl';
}

export async function getLanguagePreference(): Promise<LanguagePreference> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return isLanguagePreference(value) ? value : 'system';
  } catch {
    warnPreferenceStorageFallback('language');
    return 'system';
  }
}

export async function setStoredLanguagePreference(
  preference: LanguagePreference,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, preference);
}
