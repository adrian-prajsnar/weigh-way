import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDevWarningsEnabled } from '../storage/preference-storage-fallback';

export type AuthSessionStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type ResilientAuthStorage = AuthSessionStorage & {
  consumeSignOutPersistWarning: () => boolean;
};

const PROBE_KEY = '@weigh-way/auth-storage-probe';
const TOMBSTONE = Symbol('auth-storage-tombstone');

type OverlayEntry = string | typeof TOMBSTONE;

export function isPrimaryAuthSessionStorageKey(key: string): boolean {
  return /^sb-.+-auth-token$/.test(key);
}

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

/** Supabase auth storage: tombstones failed removals; disk-first reads with overlay for failed writes. */
export function createResilientAuthStorage(): ResilientAuthStorage {
  const overlay = new Map<string, OverlayEntry>();
  let probeSettled = false;
  let diskBlocked = false;
  let signOutPersistWarning = false;

  const ensureProbe = async () => {
    if (probeSettled) {
      return;
    }
    probeSettled = true;
    diskBlocked = !(await probePersistentAuthStorage());
    if (diskBlocked && isDevWarningsEnabled()) {
      console.warn(
        '[weigh-way] Persistent auth storage probe failed; using in-memory overlay when needed.',
      );
    }
  };

  const readOverlay = (key: string): string | null | undefined => {
    if (!overlay.has(key)) {
      return undefined;
    }
    const entry = overlay.get(key);
    return entry === TOMBSTONE ? null : entry ?? null;
  };

  const markTombstone = (key: string) => {
    overlay.set(key, TOMBSTONE);
  };

  const tryRemoveFromDisk = async (key: string): Promise<boolean> => {
    try {
      await AsyncStorage.removeItem(key);
      diskBlocked = false;
      return true;
    } catch {
      return false;
    }
  };

  const tryReadFromDisk = async (key: string): Promise<string | null> => {
    try {
      const value = await AsyncStorage.getItem(key);
      diskBlocked = false;
      return value;
    } catch {
      return null;
    }
  };

  const tryWriteToDisk = async (key: string, value: string): Promise<boolean> => {
    try {
      await AsyncStorage.setItem(key, value);
      diskBlocked = false;
      return true;
    } catch {
      return false;
    }
  };

  return {
    consumeSignOutPersistWarning() {
      if (!signOutPersistWarning) {
        return false;
      }
      signOutPersistWarning = false;
      return true;
    },
    async getItem(key) {
      await ensureProbe();
      const cached = readOverlay(key);
      if (cached !== undefined) {
        return cached;
      }
      return tryReadFromDisk(key);
    },
    async setItem(key, value) {
      await ensureProbe();
      const wasTombstone = overlay.get(key) === TOMBSTONE;
      overlay.set(key, value);

      if (wasTombstone) {
        await tryRemoveFromDisk(key);
      }

      if (diskBlocked) {
        return;
      }

      const written = await tryWriteToDisk(key, value);
      if (written) {
        overlay.delete(key);
        return;
      }

      await tryRemoveFromDisk(key);
      overlay.set(key, value);
    },
    async removeItem(key) {
      await ensureProbe();
      markTombstone(key);

      const removed = await tryRemoveFromDisk(key);
      if (removed) {
        overlay.delete(key);
        return;
      }

      if (isPrimaryAuthSessionStorageKey(key)) {
        signOutPersistWarning = true;
      }
    },
  };
}
