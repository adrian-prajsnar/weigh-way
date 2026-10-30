let latestAuthUserIdFromEvents: string | null = null;

/** Updated from auth state change events (no network). */
export function noteLatestAuthUserIdFromEvent(userId: string | null): void {
  latestAuthUserIdFromEvents = userId;
}

export function getLatestAuthUserIdFromEvents(): string | null {
  return latestAuthUserIdFromEvents;
}
