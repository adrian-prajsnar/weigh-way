import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isAuthCallbackUrl } from './auth-callback-url';
import { isOAuthCallbackUrl } from './auth-oauth-callback';

describe('isOAuthCallbackUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('__DEV__', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects PKCE callback URLs in Expo dev', () => {
    expect(
      isOAuthCallbackUrl('exp://192.168.1.10:8081/--/auth/callback?code=abc123'),
    ).toBe(true);
  });

  it('detects PKCE callback URLs on the app scheme', () => {
    expect(isOAuthCallbackUrl('weigh-way://auth/callback?code=abc123')).toBe(true);
  });

  it('detects implicit token callbacks for guarded handling', () => {
    expect(
      isOAuthCallbackUrl(
        'weigh-way://auth/callback#access_token=token&refresh_token=refresh',
      ),
    ).toBe(true);
  });

  it('rejects unrelated paths even when codes are present', () => {
    expect(
      isOAuthCallbackUrl('weigh-way://totally/unrelated?code=evil'),
    ).toBe(false);
  });

  it('rejects callback paths without auth parameters', () => {
    expect(isOAuthCallbackUrl('weigh-way://auth/callback')).toBe(false);
    expect(isOAuthCallbackUrl('https://example.com')).toBe(false);
  });
});

describe('isAuthCallbackUrl', () => {
  it('accepts only weigh-way://auth/callback in production', () => {
    expect(isAuthCallbackUrl('weigh-way://auth/callback')).toBe(true);
    expect(isAuthCallbackUrl('weigh-way://auth/callback-extra')).toBe(false);
    expect(isAuthCallbackUrl('weigh-way://prefix/auth/callback')).toBe(false);
  });
});
