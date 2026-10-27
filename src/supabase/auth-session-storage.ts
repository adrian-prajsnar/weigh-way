import { createResilientAuthStorage, ResilientAuthStorage } from './resilient-auth-storage';

let authStorage: ResilientAuthStorage | null = null;
let activeRecoveryRegistrationId = 0;

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

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      retryAuthStorageDiskPersistence();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (registrationId !== activeRecoveryRegistrationId) {
        return;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }

  return () => {
    if (registrationId !== activeRecoveryRegistrationId) {
      return;
    }
  };
}
