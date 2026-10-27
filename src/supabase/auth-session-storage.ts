import { createResilientAuthStorage, ResilientAuthStorage } from './resilient-auth-storage';

let authStorage: ResilientAuthStorage | null = null;
let unregisterPersistenceRecovery: (() => void) | null = null;

export function getSupabaseAuthStorage(): ResilientAuthStorage {
  authStorage ??= createResilientAuthStorage();
  return authStorage;
}

export function retryAuthStorageDiskPersistence(): void {
  void getSupabaseAuthStorage().retryPendingDiskPersistence();
}

export function registerAuthStoragePersistenceRecovery(): () => void {
  if (unregisterPersistenceRecovery) {
    return unregisterPersistenceRecovery;
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      retryAuthStorageDiskPersistence();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    unregisterPersistenceRecovery = () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unregisterPersistenceRecovery = null;
    };
    return unregisterPersistenceRecovery;
  }

  unregisterPersistenceRecovery = () => {
    unregisterPersistenceRecovery = null;
  };
  return unregisterPersistenceRecovery;
}
