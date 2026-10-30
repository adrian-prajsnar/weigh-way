import { parseSessionIdFromAccessToken, parseSubFromAccessToken } from '../auth-session-id';
export type GotrueSessionRegistry = {
  register: (userId: string, sessionId: string, accessToken?: string) => void;
  isAlive: (sessionId: string) => boolean;
  handleLogout: (accessToken: string, scopeFromUrl: string | null) => number;
};

export function createGotrueSessionRegistry(): GotrueSessionRegistry {
  const alive = new Set<string>();
  const sessionToUser = new Map<string, string>();
  const accessTokenToUser = new Map<string, string>();

  return {
    register(userId: string, sessionId: string, accessToken?: string) {
      if (!sessionId) {
        return;
      }
      sessionToUser.set(sessionId, userId);
      alive.add(sessionId);
      if (accessToken) {
        accessTokenToUser.set(accessToken, userId);
      }
    },
    isAlive(sessionId: string) {
      return alive.has(sessionId);
    },
    handleLogout(accessToken: string, scopeFromUrl: string | null): number {
      const sessionId = parseSessionIdFromAccessToken(accessToken);
      const scope = scopeFromUrl ?? '';

      if (!sessionId) {
        const sub = parseSubFromAccessToken(accessToken) ?? accessTokenToUser.get(accessToken);
        if (!sub) {
          return 403;
        }
        for (const [sid, uid] of sessionToUser) {
          if (uid === sub) {
            alive.delete(sid);
          }
        }
        return 204;
      }

      const userId = sessionToUser.get(sessionId);
      if (!userId) {
        return 403;
      }

      if (scope === 'local') {
        alive.delete(sessionId);
        return 204;
      }
      if (scope === 'others') {
        for (const [sid, uid] of sessionToUser) {
          if (uid === userId && sid !== sessionId) {
            alive.delete(sid);
          }
        }
        return 204;
      }
      if (scope === 'global' || scope === '') {
        for (const [sid, uid] of sessionToUser) {
          if (uid === userId) {
            alive.delete(sid);
          }
        }
        return 204;
      }
      return 400;
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
  options?: { delayMs?: number; forceStatus?: number },
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
  if (options?.forceStatus === 401) {
    return new Response(JSON.stringify({ msg: 'jwt expired' }), { status: 401 });
  }
  const token = parseBearerAccessToken(init);
  if (!token) {
    return new Response(JSON.stringify({ msg: 'missing token' }), { status: 401 });
  }
  const status = registry.handleLogout(token, parseLogoutScopeFromUrl(url));
  if (status === 204) {
    return new Response(null, { status: 204 });
  }
  return new Response(JSON.stringify({ msg: 'session_not_found' }), { status });
}
