import { createResilientAuthStorage, ResilientAuthStorage } from './resilient-auth-storage';

let authStorage: ResilientAuthStorage | null = null;

export function getSupabaseAuthStorage(): ResilientAuthStorage {
  authStorage ??= createResilientAuthStorage();
  return authStorage;
}
