import AsyncStorage from '@react-native-async-storage/async-storage';

/** Default Supabase auth persistence (AsyncStorage / localStorage). */
export function getSupabaseAuthStorage() {
  return AsyncStorage;
}
