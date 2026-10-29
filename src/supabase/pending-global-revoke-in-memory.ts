import type { PendingGlobalRevokeTokens } from './pending-global-revoke-types';

let inMemoryPending: PendingGlobalRevokeTokens | null = null;

export function getInMemoryPendingGlobalRevoke(): PendingGlobalRevokeTokens | null {
  return inMemoryPending;
}

export function setInMemoryPendingGlobalRevoke(tokens: PendingGlobalRevokeTokens | null): void {
  inMemoryPending = tokens;
}

export function resetInMemoryPendingGlobalRevokeForTests(): void {
  inMemoryPending = null;
}
