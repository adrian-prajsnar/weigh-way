import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@weigh-way/language';

export type LanguagePreference = 'system' | 'en' | 'pl';

function isLanguagePreference(value: string | null): value is LanguagePreference {
  return value === 'system' || value === 'en' || value === 'pl';
}

export async function getLanguagePreference(): Promise<LanguagePreference> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  return isLanguagePreference(value) ? value : 'system';
}

export async function setStoredLanguagePreference(
  preference: LanguagePreference,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, preference);
}
