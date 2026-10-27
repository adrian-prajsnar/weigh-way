import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSupabaseAuthAwareFetch,
  registerFatalRefreshTokenHandler,
} from './supabase-auth-fetch';

describe('createSupabaseAuthAwareFetch', () => {
  afterEach(() => {
    registerFatalRefreshTokenHandler(null);
    vi.restoreAllMocks();
  });

  it('invokes the fatal refresh handler on refresh_token_not_found token responses', async () => {
    const handler = vi.fn();
    registerFatalRefreshTokenHandler(handler);

    const baseFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error_code: 'refresh_token_not_found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const fetch = createSupabaseAuthAwareFetch(baseFetch);
    await fetch('https://example.supabase.co/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
