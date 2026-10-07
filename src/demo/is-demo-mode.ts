import { Platform } from 'react-native';
import { isDemoLocation } from './demo-location';

export function isDemoMode(): boolean {
  if (process.env.EXPO_PUBLIC_DEMO === 'true') {
    return true;
  }

  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  return isDemoLocation(window.location.pathname, window.location.search);
}
