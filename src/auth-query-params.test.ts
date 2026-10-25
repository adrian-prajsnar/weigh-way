import { describe, expect, it } from 'vitest';
import { getAuthCallbackErrorMessage } from './auth-query-params';

describe('getAuthCallbackErrorMessage', () => {
  it('reads standard OAuth error fields from callback URLs', () => {
    expect(
      getAuthCallbackErrorMessage(
        'weigh-way://auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toBe('Email link is invalid or has expired');
  });
});
