function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  const parts = accessToken.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json =
      typeof atob !== 'undefined'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Reads Supabase `session_id` from a JWT access token (no logging). */
export function parseSessionIdFromAccessToken(accessToken: string | null | undefined): string | null {
  if (!accessToken) {
    return null;
  }
  const payload = decodeJwtPayload(accessToken);
  const sessionId = payload?.session_id;
  return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
}

export function parseSessionIdFromAuthSessionPayload(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { access_token?: string };
    return parseSessionIdFromAccessToken(parsed.access_token ?? null);
  } catch {
    return null;
  }
}

/** Reads JWT `sub` (auth user id) from an access token. */
export function parseSubFromAccessToken(accessToken: string | null | undefined): string | null {
  if (!accessToken) {
    return null;
  }
  const payload = decodeJwtPayload(accessToken);
  const sub = payload?.sub;
  return typeof sub === 'string' && sub.length > 0 ? sub : null;
}
