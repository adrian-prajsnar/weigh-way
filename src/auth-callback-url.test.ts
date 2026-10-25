import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isAuthCallbackUrl } from './auth-callback-url';

describe('isAuthCallbackUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('__DEV__', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts production callback URLs and rejects lookalikes', () => {
    expect(isAuthCallbackUrl('weigh-way://auth/callback')).toBe(true);
    expect(isAuthCallbackUrl('weigh-way://auth/callback?code=abc')).toBe(true);
    expect(isAuthCallbackUrl('weigh-way://auth/callback-extra')).toBe(false);
    expect(isAuthCallbackUrl('weigh-way://other/auth/callback')).toBe(false);
    expect(isAuthCallbackUrl('exp://127.0.0.1:8081/--/auth/callback?code=abc')).toBe(true);
    expect(isAuthCallbackUrl('exp://127.0.0.1:8081/--/evil/auth/callback?code=abc')).toBe(
      false,
    );
  });
});
