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
  retryPendingDiskPersistence: () => Promise<void>;
  hasPendingDiskPersistence: () => boolean;
  restoredSessionNeedsServerValidation: () => Promise<boolean>;
  getLastSeenPrimaryAuthSessionKey: () => string | null;
  forcePersistSignedOutStateForLastKnownSessionKey: () => Promise<void>;
  noteLocalSignOutPersistFailure: () => Promise<void>;
};

const PROBE_KEY = '@weigh-way/auth-storage-probe';
const SIGNED_OUT_MARKER_PREFIX = '@weigh-way/auth-signed-out/';
const SIGNED_OUT_MARKER_VALUE = '1';
const CLEARED_MARKER_VALUE = '';
const PENDING_DISK_RETRY_INITIAL_MS = 4000;
const PENDING_DISK_RETRY_MAX_MS = 60000;
const TOMBSTONE = Symbol('auth-storage-tombstone');
export const SIGNED_OUT_SESSION_PAYLOAD = JSON.stringify({ signedOut: true });

type OverlayEntry = string | typeof TOMBSTONE;

export function isPrimaryAuthSessionStorageKey(key: string): boolean {
  return /^sb-.+-auth-token$/.test(key);
}

export function getSignedOutMarkerKey(sessionKey: string): string {
  return `${SIGNED_OUT_MARKER_PREFIX}${sessionKey}`;
}

export function isSignedOutMarkerValue(raw: string | null): boolean {
  return raw === SIGNED_OUT_MARKER_VALUE;
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
  let pendingRetryTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingRetryBackoffMs = PENDING_DISK_RETRY_INITIAL_MS;
  let pendingDiskSyncInFlight = false;
  const markerReadFailedSessionKeys = new Set<string>();

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

  const tryReadFromDiskOrThrow = async (key: string): Promise<string | null> => {
    return await AsyncStorage.getItem(key);
  };

  const tryWriteToDisk = async (key: string, value: string): Promise<boolean> => {
    try {
      await AsyncStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  };

  const clearSignedOutMarkerOnDisk = async (sessionKey: string) => {
    const markerKey = getSignedOutMarkerKey(sessionKey);
    const removed = await tryRemoveFromDisk(markerKey);
    if (!removed) {
      await tryWriteToDisk(markerKey, CLEARED_MARKER_VALUE);
    }
    markerReadFailedSessionKeys.delete(sessionKey);
  };

  const flushPendingDiskRemoves = async () => {
    for (const key of [...pendingDiskRemoves]) {
      const removed = await tryRemoveFromDisk(key);
      if (!removed) {
        continue;
      }
      pendingDiskRemoves.delete(key);
      overlay.delete(key);
      await clearSignedOutMarkerOnDisk(key);
    }
  };

  const persistSignedOutState = async (sessionKey: string) => {
    pendingDiskRemoves.add(sessionKey);
    await tryWriteToDisk(getSignedOutMarkerKey(sessionKey), SIGNED_OUT_MARKER_VALUE);
    await tryWriteToDisk(sessionKey, SIGNED_OUT_SESSION_PAYLOAD);
  };

  const clearSignedOutState = async (sessionKey: string) => {
    pendingDiskRemoves.delete(sessionKey);
    markerReadFailedSessionKeys.delete(sessionKey);
    await clearSignedOutMarkerOnDisk(sessionKey);
  };

  const syncPendingDiskPersistence = async () => {
    if (pendingDiskRemoves.size === 0) {
      return;
    }

    await probePersistentAuthStorage().catch(() => false);

    for (const key of [...pendingDiskRemoves]) {
      if (isPrimaryAuthSessionStorageKey(key)) {
        await persistSignedOutState(key);
      }
    }
    await flushPendingDiskRemoves();

    if (pendingDiskRemoves.size === 0) {
      pendingRetryBackoffMs = PENDING_DISK_RETRY_INITIAL_MS;
      if (pendingRetryTimeout) {
        clearTimeout(pendingRetryTimeout);
        pendingRetryTimeout = null;
      }
    }
  };

  const runPendingDiskSyncWithBackoff = async () => {
    if (pendingDiskSyncInFlight || pendingDiskRemoves.size === 0) {
      return;
    }
    pendingDiskSyncInFlight = true;
    try {
      await syncPendingDiskPersistence();
    } finally {
      pendingDiskSyncInFlight = false;
      if (pendingDiskRemoves.size > 0) {
        pendingRetryBackoffMs = Math.min(pendingRetryBackoffMs * 2, PENDING_DISK_RETRY_MAX_MS);
        schedulePendingDiskRetries();
      }
    }
  };

  const schedulePendingDiskRetries = () => {
    if (pendingDiskRemoves.size === 0) {
      return;
    }
    if (pendingRetryTimeout || pendingDiskSyncInFlight) {
      return;
    }
    pendingRetryTimeout = setTimeout(() => {
      pendingRetryTimeout = null;
      void runPendingDiskSyncWithBackoff();
    }, pendingRetryBackoffMs);
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
    await syncPendingDiskPersistence();
  };

  let lastSeenPrimaryAuthSessionKey: string | null = null;

  const trackPrimaryAuthKey = (key: string) => {
    if (isPrimaryAuthSessionStorageKey(key)) {
      lastSeenPrimaryAuthSessionKey = key;
    }
  };

  const restoredSessionNeedsServerValidation = async (): Promise<boolean> => {
    if (pendingDiskRemoves.size > 0) {
      return true;
    }
    for (const [key, entry] of overlay.entries()) {
      if (isPrimaryAuthSessionStorageKey(key) && entry === TOMBSTONE) {
        return true;
      }
    }
    const sessionKey = lastSeenPrimaryAuthSessionKey;
    if (!sessionKey) {
      return false;
    }
    if (markerReadFailedSessionKeys.has(sessionKey)) {
      return true;
    }
    try {
      const marker = await tryReadFromDiskOrThrow(getSignedOutMarkerKey(sessionKey));
      markerReadFailedSessionKeys.delete(sessionKey);
      if (isSignedOutMarkerValue(marker)) {
        return true;
      }
    } catch {
      markerReadFailedSessionKeys.add(sessionKey);
      return true;
    }
    const disk = await tryReadFromDisk(sessionKey);
    return isSignedOutSessionPayload(disk);
  };

  const readAuthSessionFromDisk = async (key: string): Promise<string | null> => {
    trackPrimaryAuthKey(key);
    let marker: string | null = null;
    let markerReadFailed = false;
    try {
      marker = await tryReadFromDiskOrThrow(getSignedOutMarkerKey(key));
      markerReadFailedSessionKeys.delete(key);
    } catch {
      markerReadFailed = true;
      markerReadFailedSessionKeys.add(key);
    }
    if (markerReadFailed) {
      return null;
    }
    if (isSignedOutMarkerValue(marker)) {
      pendingDiskRemoves.add(key);
      await syncPendingDiskPersistence();
      return null;
    }

    try {
      const disk = await tryReadFromDiskOrThrow(key);
      if (isSignedOutSessionPayload(disk)) {
        return null;
      }
      return disk;
    } catch {
      return null;
    }
  };

  return {
    hasPendingDiskPersistence() {
      return pendingDiskRemoves.size > 0;
    },
    restoredSessionNeedsServerValidation,
    getLastSeenPrimaryAuthSessionKey() {
      return lastSeenPrimaryAuthSessionKey;
    },
    async forcePersistSignedOutStateForLastKnownSessionKey() {
      if (!lastSeenPrimaryAuthSessionKey) {
        return;
      }
      await persistSignedOutState(lastSeenPrimaryAuthSessionKey);
    },
    async noteLocalSignOutPersistFailure() {
      if (!lastSeenPrimaryAuthSessionKey) {
        return;
      }
      const key = lastSeenPrimaryAuthSessionKey;
      markTombstone(key);
      pendingDiskRemoves.add(key);
      signOutPersistWarning = true;
      await persistSignedOutState(key);
      schedulePendingDiskRetries();
    },
    async retryPendingDiskPersistence() {
      await syncPendingDiskPersistence();
    },
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
      trackPrimaryAuthKey(key);
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
      trackPrimaryAuthKey(key);
      await ensureProbe();
      const wasTombstone = overlay.get(key) === TOMBSTONE;
      overlay.set(key, value);

      if (isPrimaryAuthSessionStorageKey(key) && !isSignedOutSessionPayload(value)) {
        markerReadFailedSessionKeys.delete(key);
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
      trackPrimaryAuthKey(key);
      await ensureProbe();
      markTombstone(key);
      pendingDiskRemoves.add(key);
      schedulePendingDiskRetries();

      const removed = await tryRemoveFromDisk(key);
      if (removed) {
        pendingDiskRemoves.delete(key);
        overlay.delete(key);
        if (isPrimaryAuthSessionStorageKey(key)) {
          await clearSignedOutMarkerOnDisk(key);
        }
        if (pendingDiskRemoves.size === 0 && pendingRetryTimeout) {
          clearTimeout(pendingRetryTimeout);
          pendingRetryTimeout = null;
        }
        return;
      }

      if (isPrimaryAuthSessionStorageKey(key)) {
        // When the server revoke succeeded but storage cannot persist local sign-out, a reload
        // can still show Home until /user rejects the JWT. An offline sign-out that reached the
        // server survives a reload once storage recovers.
        await persistSignedOutState(key);
        signOutPersistWarning = true;
        schedulePendingDiskRetries();
      }
    },
  };
}
