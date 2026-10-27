import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDevWarningsEnabled } from '../storage/preference-storage-fallback';

export type AuthSessionStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function createMemoryAuthStorage(): AuthSessionStorage {
  const store: Record<string, string> = {};
  return {
    getItem: async (key) => store[key] ?? null,
    setItem: async (key, value) => {
      store[key] = value;
    },
    removeItem: async (key) => {
      delete store[key];
    },
  };
}

/** Supabase auth storage that falls back to in-memory when persistent storage throws. */
export function createResilientAuthStorage(): AuthSessionStorage {
  const memory = createMemoryAuthStorage();
  let useMemory = false;

  const switchToMemory = () => {
    if (!useMemory && isDevWarningsEnabled()) {
      console.warn(
        '[weigh-way] Supabase auth session storage is unavailable; using in-memory session only.',
      );
    }
    useMemory = true;
  };

  return {
    async getItem(key) {
      if (useMemory) {
        return memory.getItem(key);
      }
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        switchToMemory();
        return memory.getItem(key);
      }
    },
    async setItem(key, value) {
      if (useMemory) {
        await memory.setItem(key, value);
        return;
      }
      try {
        await AsyncStorage.setItem(key, value);
      } catch {
        switchToMemory();
        await memory.setItem(key, value);
      }
    },
    async removeItem(key) {
      if (useMemory) {
        await memory.removeItem(key);
        return;
      }
      try {
        await AsyncStorage.removeItem(key);
      } catch {
        switchToMemory();
        await memory.removeItem(key);
      }
    },
  };
}
