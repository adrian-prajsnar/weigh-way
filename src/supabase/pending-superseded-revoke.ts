import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PendingGlobalRevokeTokens } from './pending-global-revoke-types';

export const PENDING_SUPERSEDED_REVOKE_STORAGE_KEY =
  '@weigh-way/auth-pending-superseded-revoke';

/** Retained superseded revokes expire after this long. */
export const PENDING_SUPERSEDED_REVOKE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export const PENDING_SUPERSEDED_REVOKE_MAX_ATTEMPTS = 3;

export type PersistedSupersededRevoke = {
  sessionId: string;
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  createdAtMs: number;
  attemptCount: number;
};

export type PersistedSupersededRevokeMap = Record<string, PersistedSupersededRevoke>;

export type PendingSupersededRevokeStore = {
  read: () => Promise<PersistedSupersededRevokeMap>;
  write: (map: PersistedSupersededRevokeMap) => Promise<void>;
};

let supersededStore: PendingSupersededRevokeStore = {
  async read() {
    try {
      const raw = await AsyncStorage.getItem(PENDING_SUPERSEDED_REVOKE_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as PersistedSupersededRevokeMap;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  },
  async write(map) {
    await AsyncStorage.setItem(PENDING_SUPERSEDED_REVOKE_STORAGE_KEY, JSON.stringify(map));
  },
};

export function setPendingSupersededRevokeStoreForTests(
  store: PendingSupersededRevokeStore | null,
): void {
  supersededStore = store ?? {
    async read() {
      try {
        const raw = await AsyncStorage.getItem(PENDING_SUPERSEDED_REVOKE_STORAGE_KEY);
        if (!raw) {
          return {};
        }
        const parsed = JSON.parse(raw) as PersistedSupersededRevokeMap;
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    },
    async write(map) {
      await AsyncStorage.setItem(PENDING_SUPERSEDED_REVOKE_STORAGE_KEY, JSON.stringify(map));
    },
  };
}

export function resetPendingSupersededRevokeStoreForTests(): void {
  setPendingSupersededRevokeStoreForTests(null);
}

export function isPersistedSupersededRevokeExpired(record: PersistedSupersededRevoke): boolean {
  return Date.now() - record.createdAtMs > PENDING_SUPERSEDED_REVOKE_TTL_MS;
}

export function isPersistedSupersededRevokeExhausted(record: PersistedSupersededRevoke): boolean {
  return record.attemptCount >= PENDING_SUPERSEDED_REVOKE_MAX_ATTEMPTS;
}

function toTokens(record: PersistedSupersededRevoke): PendingGlobalRevokeTokens {
  return {
    sessionId: record.sessionId,
    userId: record.userId,
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    revokeScope: 'local',
  };
}

export async function readPersistedSupersededRevoke(
  sessionId: string,
): Promise<PersistedSupersededRevoke | null> {
  const map = await supersededStore.read();
  const record = map[sessionId] ?? null;
  if (!record) {
    return null;
  }
  if (isPersistedSupersededRevokeExpired(record) || isPersistedSupersededRevokeExhausted(record)) {
    await clearPersistedSupersededRevoke(sessionId);
    return null;
  }
  return record;
}

export async function persistSupersededRevokeForRetry(
  tokens: Omit<PendingGlobalRevokeTokens, 'revokeScope'>,
): Promise<void> {
  const map = await supersededStore.read();
  const existing = map[tokens.sessionId];
  map[tokens.sessionId] = {
    sessionId: tokens.sessionId,
    userId: tokens.userId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    createdAtMs: existing?.createdAtMs ?? Date.now(),
    attemptCount: existing?.attemptCount ?? 0,
  };
  await supersededStore.write(map);
}

export async function clearPersistedSupersededRevoke(sessionId: string): Promise<void> {
  const map = await supersededStore.read();
  if (!map[sessionId]) {
    return;
  }
  delete map[sessionId];
  await supersededStore.write(map);
}

export async function clearPersistedSupersededRevokesForUserExceptSession(
  userId: string,
  keepSessionId: string,
): Promise<void> {
  const map = await supersededStore.read();
  let changed = false;
  for (const [sessionId, record] of Object.entries(map)) {
    if (record.userId === userId && sessionId !== keepSessionId) {
      delete map[sessionId];
      changed = true;
    }
  }
  if (changed) {
    if (Object.keys(map).length === 0) {
      await supersededStore.write({});
      try {
        await AsyncStorage.removeItem(PENDING_SUPERSEDED_REVOKE_STORAGE_KEY);
      } catch {
        // ignore
      }
    } else {
      await supersededStore.write(map);
    }
  }
}

export async function incrementPersistedSupersededRevokeAttempt(
  sessionId: string,
): Promise<PersistedSupersededRevoke | null> {
  const map = await supersededStore.read();
  const record = map[sessionId];
  if (!record) {
    return null;
  }
  const next: PersistedSupersededRevoke = {
    ...record,
    attemptCount: record.attemptCount + 1,
  };
  if (isPersistedSupersededRevokeExhausted(next)) {
    delete map[sessionId];
    await supersededStore.write(map);
    return null;
  }
  map[sessionId] = next;
  await supersededStore.write(map);
  return next;
}

export function persistedSupersededRevokeToTokens(
  record: PersistedSupersededRevoke,
): PendingGlobalRevokeTokens {
  return toTokens(record);
}
