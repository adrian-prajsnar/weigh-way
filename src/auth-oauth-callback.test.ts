import { describe, expect, it } from 'vitest';
import { isOAuthCallbackUrl } from './auth-oauth-callback';

describe('isOAuthCallbackUrl', () => {
  it('detects PKCE callback URLs', () => {
    expect(
      isOAuthCallbackUrl('exp://192.168.1.10:8081/--/auth/callback?code=abc123'),
    ).toBe(true);
  });

  it('detects implicit callback URLs', () => {
    expect(
      isOAuthCallbackUrl(
        'weigh-way://auth/callback#access_token=token&refresh_token=refresh',
      ),
    ).toBe(true);
  });

  it('rejects unrelated URLs', () => {
    expect(isOAuthCallbackUrl('weigh-way://auth/callback')).toBe(false);
    expect(isOAuthCallbackUrl('https://example.com')).toBe(false);
  });
});
