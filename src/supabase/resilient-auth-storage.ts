import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDevWarningsEnabled } from '../storage/preference-storage-fallback';

export type AuthSessionStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const PROBE_KEY = '@weigh-way/auth-storage-probe';

export async function probePersistentAuthStorage(): Promise<boolean> {
  try {
    await AsyncStorage.setItem(PROBE_KEY, '1');
    const value = await AsyncStorage.getItem(PROBE_KEY);
    if (value !== '1') {
      return false;
    }
    await AsyncStorage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

async function removeFromDisk(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Best-effort: sign-out must still attempt disk even when storage is blocked.
  }
}

/** Supabase auth storage: disk-first with session overlay when writes fail; remove always hits disk. */
export function createResilientAuthStorage(): AuthSessionStorage {
  const sessionOverlay = new Map<string, string>();
  let probeSettled = false;
  let diskBlocked = false;

  const ensureProbe = async () => {
    if (probeSettled) {
      return;
    }
    probeSettled = true;
    diskBlocked = !(await probePersistentAuthStorage());
    if (diskBlocked && isDevWarningsEnabled()) {
      console.warn(
        '[weigh-way] Persistent auth storage is blocked; sessions will not survive reload.',
      );
    }
  };

  return {
    async getItem(key) {
      await ensureProbe();
      if (sessionOverlay.has(key)) {
        return sessionOverlay.get(key) ?? null;
      }
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        // Transient read failure: do not cache; next call retries disk.
        return null;
      }
    },
    async setItem(key, value) {
      await ensureProbe();
      if (diskBlocked) {
        sessionOverlay.set(key, value);
        await removeFromDisk(key);
        return;
      }
      try {
        await AsyncStorage.setItem(key, value);
        sessionOverlay.delete(key);
      } catch {
        await removeFromDisk(key);
        sessionOverlay.set(key, value);
      }
    },
    async removeItem(key) {
      await ensureProbe();
      sessionOverlay.delete(key);
      await removeFromDisk(key);
    },
  };
}
