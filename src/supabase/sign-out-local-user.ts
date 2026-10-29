import { isSignedOutSessionPayload } from './resilient-auth-storage';

let latestAuthUserIdFromEvents: string | null = null;
let latestAuthSessionIdFromEvents: string | null = null;

/** Updated from auth state change events (no network). */
export function noteLatestAuthUserIdFromEvent(userId: string | null): void {
  latestAuthUserIdFromEvents = userId;
}

export function getLatestAuthUserIdFromEvents(): string | null {
  return latestAuthUserIdFromEvents;
}

export function noteLatestAuthSessionIdFromEvent(sessionId: string | null): void {
  latestAuthSessionIdFromEvents = sessionId;
}

export function getLatestAuthSessionIdFromEvents(): string | null {
  return latestAuthSessionIdFromEvents;
}

export function parseUserIdFromAuthSessionPayload(raw: string | null): string | null {
  if (!raw || isSignedOutSessionPayload(raw)) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { user?: { id?: string } };
    return parsed.user?.id ?? null;
  } catch {
    return null;
  }
}
