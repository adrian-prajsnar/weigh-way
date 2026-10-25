import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

const pendingState = vi.hoisted(() => ({
  isEmailConfirmationPending: vi.fn(),
  isPasswordResetPending: vi.fn(),
  clearEmailConfirmationPending: vi.fn(),
  clearPasswordResetPending: vi.fn(),
  clearAuthPendingFlows: vi.fn(),
}));

vi.mock('./supabase/client', () => ({
  supabase: {
    auth: {
      getSession: authState.getSession,
      exchangeCodeForSession: authState.exchangeCodeForSession,
      setSession: authState.setSession,
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

vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
}));

// eslint-disable-next-line import/first -- load after vi.mock
import {
  beginOAuthFlowExpectation,
  createSessionFromUrl,
  resetOAuthRedirectState,
  shouldHandleAuthDeepLink,
} from './auth-redirect';

describe('auth deep link handling', () => {
  beforeEach(() => {
    resetOAuthRedirectState();
    authState.getSession.mockResolvedValue({ data: { session: null } });
    authState.exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
    authState.setSession.mockResolvedValue({ data: { session: {} }, error: null });
    pendingState.isEmailConfirmationPending.mockResolvedValue(false);
    pendingState.isPasswordResetPending.mockResolvedValue(false);
    pendingState.clearEmailConfirmationPending.mockResolvedValue(undefined);
    pendingState.clearPasswordResetPending.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetOAuthRedirectState();
  });

  it('ignores crafted links on unrelated paths', async () => {
    await createSessionFromUrl(
      'weigh-way://totally/unrelated?code=evil',
    );

    expect(authState.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(authState.setSession).not.toHaveBeenCalled();
  });

  it('does not exchange PKCE codes without a pending auth flow', async () => {
    await createSessionFromUrl('weigh-way://auth/callback?code=pkce-code');

    expect(authState.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(await shouldHandleAuthDeepLink('weigh-way://auth/callback?code=pkce-code')).toBe(
      false,
    );
  });

  it('exchanges PKCE codes for email confirmation when sign-up is pending', async () => {
    pendingState.isEmailConfirmationPending.mockResolvedValue(true);

    await createSessionFromUrl('weigh-way://auth/callback?code=confirm-code');

    expect(authState.exchangeCodeForSession).toHaveBeenCalledWith('confirm-code', undefined);
    expect(pendingState.clearEmailConfirmationPending).toHaveBeenCalled();
  });

  it('exchanges PKCE codes for password recovery when reset is pending', async () => {
    pendingState.isPasswordResetPending.mockResolvedValue(true);

    await createSessionFromUrl(
      'weigh-way://auth/callback?code=recovery-code&type=recovery',
    );

    expect(authState.exchangeCodeForSession).toHaveBeenCalledWith('recovery-code', undefined);
    expect(pendingState.clearPasswordResetPending).toHaveBeenCalled();
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

  it('rejects OAuth callbacks when flow ids do not match', async () => {
    beginOAuthFlowExpectation('flow-expected');

    await expect(
      createSessionFromUrl(
        'weigh-way://auth/callback?code=pkce-code&sb_flow_id=flow-other',
      ),
    ).rejects.toThrow('auth_oauth_flow_mismatch');
  });

  it('accepts implicit tokens only when email confirmation is pending', async () => {
    pendingState.isEmailConfirmationPending.mockResolvedValue(true);

    await createSessionFromUrl(
      'weigh-way://auth/callback#access_token=at&refresh_token=rt',
    );

    expect(authState.setSession).toHaveBeenCalledWith({
      access_token: 'at',
      refresh_token: 'rt',
    });
    expect(authState.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('ignores implicit tokens without a pending email or reset flow', async () => {
    await createSessionFromUrl(
      'weigh-way://auth/callback#access_token=at&refresh_token=rt',
    );

    expect(authState.setSession).not.toHaveBeenCalled();
  });
});
