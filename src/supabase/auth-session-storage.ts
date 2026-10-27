import { createResilientAuthStorage, ResilientAuthStorage } from './resilient-auth-storage';

let authStorage: ResilientAuthStorage | null = null;
let persistenceRecoveryRegistered = false;

export function getSupabaseAuthStorage(): ResilientAuthStorage {
  authStorage ??= createResilientAuthStorage();
  return authStorage;
}

export function retryAuthStorageDiskPersistence(): void {
  void getSupabaseAuthStorage().retryPendingDiskPersistence();
}

export function registerAuthStoragePersistenceRecovery(): void {
  if (persistenceRecoveryRegistered) {
    return;
  }
  persistenceRecoveryRegistered = true;

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        retryAuthStorageDiskPersistence();
      }
    });
  }
}
