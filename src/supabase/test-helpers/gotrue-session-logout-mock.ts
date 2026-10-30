import { parseSessionIdFromAccessToken } from '../auth-session-id';

/** In-memory GoTrue sessions for tests (session_id per user). */
export type GotrueSessionRegistry = {
  register: (userId: string, sessionId: string) => void;
  isAlive: (sessionId: string) => boolean;
  handleLogout: (accessToken: string, scopeFromUrl: string | null) => void;
};

export function createGotrueSessionRegistry(): GotrueSessionRegistry {
  const alive = new Set<string>();
  const sessionToUser = new Map<string, string>();

  return {
    register(userId: string, sessionId: string) {
      if (!sessionId) {
        return;
      }
      sessionToUser.set(sessionId, userId);
      alive.add(sessionId);
    },
    isAlive(sessionId: string) {
      return alive.has(sessionId);
    },
    handleLogout(accessToken: string, scopeFromUrl: string | null) {
      const sessionId = parseSessionIdFromAccessToken(accessToken);
      if (!sessionId) {
        for (const sid of [...alive]) {
          alive.delete(sid);
        }
        return;
      }
      const userId = sessionToUser.get(sessionId);
      if (!userId) {
        return;
      }
      const scope = scopeFromUrl ?? '';
      if (scope === 'local') {
        alive.delete(sessionId);
        return;
      }
      if (scope === 'global' || scope === '') {
        for (const [sid, uid] of sessionToUser) {
          if (uid === userId) {
            alive.delete(sid);
          }
        }
      }
    },
  };
}

export function parseLogoutScopeFromUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get('scope');
  } catch {
    return null;
  }
}

export function parseBearerAccessToken(init?: RequestInit): string | null {
  const headers = new Headers(init?.headers);
  const auth = headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return null;
  }
  return auth.slice('Bearer '.length);
}

export async function gotrueLogoutFetchHandler(
  registry: GotrueSessionRegistry,
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { delayMs?: number },
): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  if (!url.includes('/logout')) {
    return new Response(JSON.stringify({}), { status: 404 });
  }
  if (options?.delayMs) {
    await new Promise((resolve) => {
      setTimeout(resolve, options.delayMs);
    });
  }
  const token = parseBearerAccessToken(init);
  if (token) {
    registry.handleLogout(token, parseLogoutScopeFromUrl(url));
  }
  return new Response(null, { status: 204 });
}
