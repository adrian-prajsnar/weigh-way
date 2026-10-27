import AsyncStorage from '@react-native-async-storage/async-storage';
import { warnPreferenceStorageFallback } from './preference-storage-fallback';

const STORAGE_KEY = '@weigh-way/show-bmi';

export async function getShowBmiPreference(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    if (value === null) {
      return true;
    }
    return value === 'true';
  } catch {
    warnPreferenceStorageFallback('BMI display');
    return true;
  }
}

export async function setShowBmiPreference(show: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, show ? 'true' : 'false');
}
