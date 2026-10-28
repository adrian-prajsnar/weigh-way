import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const BOOTSTRAP_SESSION_DEADLINE_MS = 6000;

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

async function runBootstrapDeadlineProbe(getSession: () => Promise<unknown>): Promise<{
  setLoading: ReturnType<typeof vi.fn>;
}> {
  const setLoading = vi.fn();
  let bootstrapFinished = false;
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;

  deadlineTimer = setTimeout(() => {
    if (!bootstrapFinished) {
      setLoading(false);
    }
  }, BOOTSTRAP_SESSION_DEADLINE_MS);

  void (async () => {
    try {
      await getSession();
    } finally {
      bootstrapFinished = true;
      if (deadlineTimer) {
        clearTimeout(deadlineTimer);
      }
      setLoading(false);
    }
  })();

  return { setLoading };
}

describe('bootstrap deadline with real Supabase auth-js', () => {
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

    const { setLoading } = await runBootstrapDeadlineProbe(() => client.auth.getSession());
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_SESSION_DEADLINE_MS);
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it('ends loading within the deadline when getSession never resolves', async () => {
    const { setLoading } = await runBootstrapDeadlineProbe(() => new Promise(() => {}));
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

    const { setLoading } = await runBootstrapDeadlineProbe(() => client.auth.getSession());
    await vi.advanceTimersByTimeAsync(BOOTSTRAP_SESSION_DEADLINE_MS);
    expect(setLoading).toHaveBeenCalledWith(false);
  });
});
