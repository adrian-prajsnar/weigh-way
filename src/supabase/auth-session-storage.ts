import { createResilientAuthStorage, ResilientAuthStorage } from './resilient-auth-storage';

let authStorage: ResilientAuthStorage | null = null;
let activeRecoveryRegistrationId = 0;
let activeVisibilityListener: ((event: Event) => void) | null = null;

export function getSupabaseAuthStorage(): ResilientAuthStorage {
  authStorage ??= createResilientAuthStorage();
  return authStorage;
}

export function retryAuthStorageDiskPersistence(): void {
  void getSupabaseAuthStorage().retryPendingDiskPersistence();
}

export function registerAuthStoragePersistenceRecovery(): () => void {
  const registrationId = activeRecoveryRegistrationId + 1;
  activeRecoveryRegistrationId = registrationId;

  if (typeof document !== 'undefined' && activeVisibilityListener) {
    document.removeEventListener('visibilitychange', activeVisibilityListener);
    activeVisibilityListener = null;
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      retryAuthStorageDiskPersistence();
    }
  };

  if (typeof document !== 'undefined') {
    activeVisibilityListener = onVisibilityChange;
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (registrationId !== activeRecoveryRegistrationId) {
        return;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (activeVisibilityListener === onVisibilityChange) {
        activeVisibilityListener = null;
      }
    };
  }

  return () => {
    if (registrationId !== activeRecoveryRegistrationId) {
      return;
    }
  };
}
