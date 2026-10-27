import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOTSTRAP_SESSION_DEADLINE_MS,
  runBootstrapAuthSession,
  type BootstrapAuthSessionDeps,
} from './bootstrap-auth-session';

const SESSION_KEY = 'sb-example-auth-token';

function makeExpiredSessionJson(): string {
  return JSON.stringify({
    access_token: 'expired-access',
    refresh_token: 'valid-refresh',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) - 3600,
    token_type: 'bearer',
    user: {
      id: '11111111-1111-1111-1111-111111111111',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'user@example.com',
    },
  });
}

function createBootstrapDeps(
  getSession: BootstrapAuthSessionDeps['getSession'],
): { deps: BootstrapAuthSessionDeps; setLoading: ReturnType<typeof vi.fn> } {
  const setLoading = vi.fn();
  const deps: BootstrapAuthSessionDeps = {
    getAuthEventGeneration: () => 0,
    getSession,
    restoredSessionNeedsServerValidation: vi.fn().mockResolvedValue(false),
    validateRestoredSessionInBackground: vi.fn().mockResolvedValue(undefined),
    applyBootstrapSessionIfGeneration: vi.fn(),
    setRestoredSessionValidationPending: vi.fn(),
    setLoading,
    onBootstrapComplete: vi.fn(),
    onRestoredSessionBackgroundValidationBegin: vi.fn(),
    onRestoredSessionBackgroundValidationEnd: vi.fn(),
    runFailClosedLocalSignOut: vi.fn().mockResolvedValue(undefined),
  };
  return { deps, setLoading };
}

describe('runBootstrapAuthSession with real Supabase auth-js', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('ends loading within the deadline when auth storage getItem hangs', async () => {
    const storage = {
      getItem: () => new Promise<string | null>(() => {}),
      setItem: async () => {},
      removeItem: async () => {},
    };
    const client = createClient('https://example.supabase.co', 'public-anon-key', {
      auth: {
        storage,
        storageKey: SESSION_KEY,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { deps, setLoading } = createBootstrapDeps(() => client.auth.getSession());

    void runBootstrapAuthSession(deps);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_SESSION_DEADLINE_MS);

    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it('ends loading within the deadline when auth-js initialize refresh hangs', async () => {
    const sessionPayload = makeExpiredSessionJson();
    const storage = {
      getItem: async (key: string) => (key === SESSION_KEY ? sessionPayload : null),
      setItem: async () => {},
      removeItem: async () => {},
    };
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const client = createClient('https://example.supabase.co', 'public-anon-key', {
      auth: {
        storage,
        storageKey: SESSION_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    const { deps, setLoading } = createBootstrapDeps(() => client.auth.getSession());

    void runBootstrapAuthSession(deps);
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_SESSION_DEADLINE_MS);

    expect(setLoading).toHaveBeenCalledWith(false);
  });
});
