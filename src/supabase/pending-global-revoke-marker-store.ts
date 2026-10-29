import AsyncStorage from '@react-native-async-storage/async-storage';
import { PENDING_GLOBAL_REVOKE_MARKER_KEY } from './pending-global-revoke-marker';

export type PendingGlobalRevokeMarkerStore = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<boolean>;
  clear: () => Promise<void>;
};

function canUseWebSessionMarker(): boolean {
  return typeof sessionStorage !== 'undefined';
}

function createDefaultMarkerStore(): PendingGlobalRevokeMarkerStore {
  return {
    async read() {
      if (canUseWebSessionMarker()) {
        try {
          const fromWeb = sessionStorage.getItem(PENDING_GLOBAL_REVOKE_MARKER_KEY);
          if (fromWeb) {
            return fromWeb;
          }
        } catch {
          // fall through to AsyncStorage
        }
      }
      try {
        return await AsyncStorage.getItem(PENDING_GLOBAL_REVOKE_MARKER_KEY);
      } catch {
        return null;
      }
    },
    async write(value) {
      let webOk = false;
      if (canUseWebSessionMarker()) {
        try {
          sessionStorage.setItem(PENDING_GLOBAL_REVOKE_MARKER_KEY, value);
          webOk = true;
        } catch {
          webOk = false;
        }
      }
      try {
        await AsyncStorage.setItem(PENDING_GLOBAL_REVOKE_MARKER_KEY, value);
        return true;
      } catch {
        return webOk;
      }
    },
    async clear() {
      if (canUseWebSessionMarker()) {
        try {
          sessionStorage.removeItem(PENDING_GLOBAL_REVOKE_MARKER_KEY);
        } catch {
          // ignore
        }
      }
      try {
        await AsyncStorage.removeItem(PENDING_GLOBAL_REVOKE_MARKER_KEY);
      } catch {
        // ignore
      }
    },
  };
}

let markerStore: PendingGlobalRevokeMarkerStore = createDefaultMarkerStore();

export function getPendingGlobalRevokeMarkerStore(): PendingGlobalRevokeMarkerStore {
  return markerStore;
}

export function setPendingGlobalRevokeMarkerStoreForTests(
  store: PendingGlobalRevokeMarkerStore | null,
): void {
  markerStore = store ?? createDefaultMarkerStore();
}
