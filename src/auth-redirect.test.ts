import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

const pendingState = vi.hoisted(() => ({
  isEmailConfirmationPending: vi.fn(),
  isPasswordResetPending: vi.fn(),
  clearEmailConfirmationPending: vi.fn(),
  clearPasswordResetPending: vi.fn(),
  clearAuthPendingFlows: vi.fn(),
}));

const oauthStorageState = vi.hoisted(() => ({
  persistOAuthFlowExpectation: vi.fn(),
  readOAuthFlowExpectation: vi.fn(),
  clearOAuthFlowExpectationStorage: vi.fn(),
}));

vi.mock('./supabase/client', () => ({
  supabase: {
    auth: {
      getSession: authState.getSession,
      exchangeCodeForSession: authState.exchangeCodeForSession,
      signInWithOAuth: authState.signInWithOAuth,
      signOut: vi.fn(),
    },
  },
}));

vi.mock('./storage/auth-pending-flow', () => ({
  markEmailConfirmationPending: vi.fn(),
  markPasswordResetPending: vi.fn(),
  clearAuthPendingFlows: pendingState.clearAuthPendingFlows,
  clearEmailConfirmationPending: pendingState.clearEmailConfirmationPending,
  clearPasswordResetPending: pendingState.clearPasswordResetPending,
  isEmailConfirmationPending: pendingState.isEmailConfirmationPending,
  isPasswordResetPending: pendingState.isPasswordResetPending,
}));

vi.mock('./storage/oauth-flow-expectation', () => ({
  OAUTH_FLOW_EXPECTATION_TTL_MS: 15 * 60 * 1000,
  persistOAuthFlowExpectation: oauthStorageState.persistOAuthFlowExpectation,
  readOAuthFlowExpectation: oauthStorageState.readOAuthFlowExpectation,
  clearOAuthFlowExpectationStorage: oauthStorageState.clearOAuthFlowExpectationStorage,
}));

vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
}));

// eslint-disable-next-line import/first -- load after vi.mock
import {
  beginOAuthFlowExpectation,
  createSessionFromUrl,
  resetOAuthRedirectState,
} from './auth-redirect';

describe('auth deep link handling', () => {
  beforeEach(() => {
    resetOAuthRedirectState();
    authState.exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
    pendingState.isEmailConfirmationPending.mockResolvedValue(false);
    pendingState.isPasswordResetPending.mockResolvedValue(false);
    oauthStorageState.readOAuthFlowExpectation.mockResolvedValue(null);
    oauthStorageState.persistOAuthFlowExpectation.mockResolvedValue(undefined);
    oauthStorageState.clearOAuthFlowExpectationStorage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetOAuthRedirectState();
  });

  it('ignores crafted links on unrelated paths', async () => {
    await createSessionFromUrl('weigh-way://totally/unrelated?code=evil');
    expect(authState.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('rejects PKCE codes without a pending auth flow', async () => {
    await expect(createSessionFromUrl('weigh-way://auth/callback?code=pkce-code')).rejects.toThrow(
      'auth_callback_not_expected',
    );
    expect(authState.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('does not clear pending flows when an unrelated code exchange fails', async () => {
    pendingState.isEmailConfirmationPending.mockResolvedValue(true);
    authState.exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'invalid flow state' },
    });

    await expect(createSessionFromUrl('weigh-way://auth/callback?code=bad-code')).rejects.toThrow(
      'auth_pkce_verifier_missing',
    );
    expect(pendingState.clearAuthPendingFlows).not.toHaveBeenCalled();
  });

  it('exchanges PKCE codes for email confirmation when sign-up is pending', async () => {
    pendingState.isEmailConfirmationPending.mockResolvedValue(true);

    await createSessionFromUrl('weigh-way://auth/callback?code=confirm-code');

    expect(authState.exchangeCodeForSession).toHaveBeenCalledWith('confirm-code', undefined);
    expect(pendingState.clearEmailConfirmationPending).toHaveBeenCalled();
    expect(oauthStorageState.clearOAuthFlowExpectationStorage).toHaveBeenCalled();
  });

  it('exchanges PKCE codes when an OAuth flow is expected', async () => {
    beginOAuthFlowExpectation('flow-123');

    await createSessionFromUrl(
      'weigh-way://auth/callback?code=pkce-code&sb_flow_id=flow-123',
    );

    expect(authState.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code', {
      flowId: 'flow-123',
    });
  });

  it('ignores fragment tokens on the callback URL', async () => {
    await createSessionFromUrl('weigh-way://auth/callback#access_token=at&refresh_token=rt');
    expect(authState.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
