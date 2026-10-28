import { describe, expect, it } from 'vitest';
import { isRefreshInvalidGrantError } from './auth-reachability-error';

describe('isRefreshInvalidGrantError', () => {
  it('recognizes hosted Supabase refresh_token_not_found responses', () => {
    expect(
      isRefreshInvalidGrantError({
        status: 400,
        error_code: 'refresh_token_not_found',
        msg: 'Invalid Refresh Token: Refresh Token Not Found',
      }),
    ).toBe(true);
  });

  it('recognizes OAuth-style invalid_grant bodies', () => {
    expect(
      isRefreshInvalidGrantError({
        status: 400,
        error: 'invalid_grant',
        error_description: 'Refresh token is invalid',
      }),
    ).toBe(true);
  });
});
