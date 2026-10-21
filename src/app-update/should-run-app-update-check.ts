import { Platform } from 'react-native';
import { isDemoMode } from '../demo/is-demo-mode';
import { isAppUpdateMockEnabled } from './app-update-mock';

export function shouldRunAppUpdateCheck(): boolean {
  if (isDemoMode()) {
    return false;
  }

  if (isAppUpdateMockEnabled()) {
    return true;
  }

  if (__DEV__) {
    return false;
  }

  return Platform.OS === 'android' || Platform.OS === 'ios';
}
