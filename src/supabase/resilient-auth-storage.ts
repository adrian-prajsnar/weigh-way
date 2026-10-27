import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDevWarningsEnabled } from '../storage/preference-storage-fallback';

export type AuthSessionStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type ResilientAuthStorage = AuthSessionStorage & {
  consumeSignOutPersistWarning: () => boolean;
  resetSignOutPersistWarning: () => void;
};

const PROBE_KEY = '@weigh-way/auth-storage-probe';
const SIGNED_OUT_MARKER_PREFIX = '@weigh-way/auth-signed-out/';
const TOMBSTONE = Symbol('auth-storage-tombstone');
export const SIGNED_OUT_SESSION_PAYLOAD = JSON.stringify({ signedOut: true });

type OverlayEntry = string | typeof TOMBSTONE;

export function isPrimaryAuthSessionStorageKey(key: string): boolean {
  return /^sb-.+-auth-token$/.test(key);
}

export function getSignedOutMarkerKey(sessionKey: string): string {
  return `${SIGNED_OUT_MARKER_PREFIX}${sessionKey}`;
}

export function isSignedOutSessionPayload(raw: string | null): boolean {
  if (!raw) {
    return false;
  }
  try {
    const parsed = JSON.parse(raw) as { signedOut?: boolean };
    return parsed.signedOut === true;
  } catch {
    return false;
  }
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
  const pendingDiskRemoves = new Set<string>();
  let probeSettled = false;
  let probeWarningLogged = false;
  let signOutPersistWarning = false;

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
      return true;
    } catch {
      return false;
    }
  };

  const tryReadFromDisk = async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const tryWriteToDisk = async (key: string, value: string): Promise<boolean> => {
    try {
      await AsyncStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  };

  const flushPendingDiskRemoves = async () => {
    for (const key of [...pendingDiskRemoves]) {
      const removed = await tryRemoveFromDisk(key);
      if (!removed) {
        continue;
      }
      pendingDiskRemoves.delete(key);
      overlay.delete(key);
      await tryRemoveFromDisk(getSignedOutMarkerKey(key));
    }
  };

  const persistSignedOutState = async (sessionKey: string) => {
    pendingDiskRemoves.add(sessionKey);
    await tryWriteToDisk(getSignedOutMarkerKey(sessionKey), '1');
    await tryWriteToDisk(sessionKey, SIGNED_OUT_SESSION_PAYLOAD);
  };

  const clearSignedOutState = async (sessionKey: string) => {
    pendingDiskRemoves.delete(sessionKey);
    await tryRemoveFromDisk(getSignedOutMarkerKey(sessionKey));
  };

  const ensureProbe = async () => {
    if (!probeSettled) {
      probeSettled = true;
      const probeOk = await probePersistentAuthStorage();
      if (!probeOk && isDevWarningsEnabled() && !probeWarningLogged) {
        probeWarningLogged = true;
        console.warn(
          '[weigh-way] Persistent auth storage probe failed; retrying on each access.',
        );
      }
    }
    await flushPendingDiskRemoves();
  };

  const readAuthSessionFromDisk = async (key: string): Promise<string | null> => {
    const marker = await tryReadFromDisk(getSignedOutMarkerKey(key));
    if (marker) {
      pendingDiskRemoves.add(key);
      await flushPendingDiskRemoves();
      return null;
    }

    const disk = await tryReadFromDisk(key);
    if (isSignedOutSessionPayload(disk)) {
      return null;
    }
    return disk;
  };

  return {
    resetSignOutPersistWarning() {
      signOutPersistWarning = false;
    },
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
      if (isPrimaryAuthSessionStorageKey(key)) {
        return readAuthSessionFromDisk(key);
      }
      return tryReadFromDisk(key);
    },
    async setItem(key, value) {
      await ensureProbe();
      const wasTombstone = overlay.get(key) === TOMBSTONE;
      overlay.set(key, value);

      if (isPrimaryAuthSessionStorageKey(key) && !isSignedOutSessionPayload(value)) {
        await clearSignedOutState(key);
      }

      if (wasTombstone) {
        await tryRemoveFromDisk(key);
      }

      const written = await tryWriteToDisk(key, value);
      if (written) {
        overlay.delete(key);
        if (isPrimaryAuthSessionStorageKey(key) && !isSignedOutSessionPayload(value)) {
          pendingDiskRemoves.delete(key);
        }
        return;
      }

      await tryRemoveFromDisk(key);
      overlay.set(key, value);
    },
    async removeItem(key) {
      await ensureProbe();
      markTombstone(key);
      pendingDiskRemoves.add(key);

      const removed = await tryRemoveFromDisk(key);
      if (removed) {
        pendingDiskRemoves.delete(key);
        overlay.delete(key);
        await tryRemoveFromDisk(getSignedOutMarkerKey(key));
        return;
      }

      if (isPrimaryAuthSessionStorageKey(key)) {
        await persistSignedOutState(key);
        signOutPersistWarning = true;
      }
    },
  };
}
