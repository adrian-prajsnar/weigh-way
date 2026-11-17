import { describe, expect, it } from 'vitest';
import { createDemoSession } from './demo/demo-session';
import {
  formatAuthLinkError,
  formatSignInError,
  formatSignOutError,
  formatSignOutOfflineNotice,
  formatSignUpError,
  formatUpdatePasswordError,
  isEmailNotConfirmedError,
  isNetworkError,
  isObfuscatedSignUpResponse,
} from './auth-errors';

describe('isObfuscatedSignUpResponse', () => {
  it('detects an empty identities array without a session', () => {
    expect(isObfuscatedSignUpResponse({ user: { identities: [] }, session: null })).toBe(true);
  });

  it('accepts a user with an identity', () => {
    expect(
      isObfuscatedSignUpResponse({
        user: {
          identities: [{ id: 'user-1', user_id: 'user-1', identity_id: 'identity-1', provider: 'email' }],
        },
        session: null,
      }),
    ).toBe(false);
  });

  it.each([{}, { identities: undefined }])('accepts missing identities: %j', (user) => {
    expect(isObfuscatedSignUpResponse({ user, session: null })).toBe(false);
  });

  it('accepts an authenticated session even with empty identities', () => {
    expect(
      isObfuscatedSignUpResponse({ user: { identities: [] }, session: createDemoSession() }),
    ).toBe(false);
  });

  it('does not treat a missing user as an existing account', () => {
    expect(isObfuscatedSignUpResponse({ user: null, session: null })).toBe(false);
  });
});

describe('isNetworkError', () => {
  it('detects common network failure messages', () => {
    expect(isNetworkError(new Error('Network request failed'))).toBe(true);
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('Invalid login credentials'))).toBe(false);
  });
});

describe('isEmailNotConfirmedError', () => {
  it('detects unconfirmed email errors', () => {
    expect(isEmailNotConfirmedError(new Error('Email not confirmed'))).toBe(true);
    expect(isEmailNotConfirmedError(new Error('email_not_confirmed'))).toBe(true);
  });
});

describe('formatSignInError', () => {
  it('maps invalid credentials to a generic message', () => {
    expect(formatSignInError(new Error('Invalid login credentials'))).toBe(
      'Invalid email or password.',
    );
  });

  it('maps network failures to the offline message', () => {
    expect(formatSignInError(new Error('Network request failed'))).toBe(
      'No internet connection. Check your network and try again.',
    );
  });
});

describe('formatSignUpError', () => {
  it('maps duplicate registration to a friendly message', () => {
    expect(formatSignUpError(new Error('User already registered'))).toBe(
      'An account with this email already exists.',
    );
  });
});

describe('formatAuthLinkError', () => {
  it('maps overlapping email flows to a dedicated message', () => {
    expect(
      formatAuthLinkError(new Error('auth_overlapping_email_flows'), {
        hasOverlappingEmailFlows: true,
        isPasswordRecovery: false,
      }),
    ).toContain('sign-up confirmation and a password reset');
  });

  it('maps failed signup exchange errors to confirmation wording', () => {
    expect(
      formatAuthLinkError(new Error('auth_signup_link_exchange_failed'), {
        isPasswordRecovery: false,
        hasOverlappingEmailFlows: false,
      }),
    ).toContain('confirmation link');
  });

  it('maps expired OAuth exchange errors to OAuth wording', () => {
    expect(
      formatAuthLinkError(new Error('auth_oauth_link_exchange_failed'), {
        isPasswordRecovery: false,
      }),
    ).toContain('Google');
  });

  it('maps network exchange failures to the offline message', () => {
    expect(
      formatAuthLinkError(new Error('Network request failed'), {
        isPasswordRecovery: false,
      }),
    ).toContain('internet connection');
  });
});

describe('formatSignOutError', () => {
  it('maps unrecognised sign-out failures to the generic message', () => {
    expect(formatSignOutError(new Error('sign_out_rate_limited'))).toBe('Could not sign out.');
  });
});

describe('formatSignOutOfflineNotice', () => {
  it('uses offline copy when the server revoke was unreachable', () => {
    expect(formatSignOutOfflineNotice()).toBe(
      "You're signed out on this device. We couldn't reach the server.",
    );
  });
});

describe('formatUpdatePasswordError', () => {
  it('explains password reuse before considering weak-password wording', () => {
    expect(
      formatUpdatePasswordError({
        code: 'same_password',
        message: 'New password should be different from the old password.',
      }),
    ).toBe('Choose a password different from your current password.');
  });
});
