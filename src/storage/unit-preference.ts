import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@weigh-way/units';

export type UnitPreference = 'system' | 'metric' | 'imperial';

function isUnitPreference(value: string | null): value is UnitPreference {
  return value === 'system' || value === 'metric' || value === 'imperial';
}

export async function getUnitPreference(): Promise<UnitPreference> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  return isUnitPreference(value) ? value : 'system';
}

export async function setStoredUnitPreference(preference: UnitPreference): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, preference);
}
