import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

const pendingState = vi.hoisted(() => ({
  isEmailConfirmationPending: vi.fn(),
  isPasswordResetPending: vi.fn(),
  hasOverlappingEmailFlows: vi.fn(),
  resolveEmailCallbackFlowKind: vi.fn(),
  clearAuthPendingFlows: vi.fn(),
}));

const pkceState = vi.hoisted(() => ({
  backupLegacyVerifierForRollback: vi.fn(),
  restoreLegacyVerifierForFlow: vi.fn(),
  clearPkceVerifierBackups: vi.fn(),
}));

const oauthStorageState = vi.hoisted(() => ({
  persistOAuthFlowExpectation: vi.fn(),
  readOAuthFlowExpectation: vi.fn(),
  clearOAuthFlowExpectationStorage: vi.fn(),
}));

vi.mock('./supabase/client', () => ({
  supabase: {
    auth: {
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
  isEmailConfirmationPending: pendingState.isEmailConfirmationPending,
  isPasswordResetPending: pendingState.isPasswordResetPending,
  hasOverlappingEmailFlows: pendingState.hasOverlappingEmailFlows,
  resolveEmailCallbackFlowKind: pendingState.resolveEmailCallbackFlowKind,
}));

vi.mock('./storage/pkce-verifier-backup', () => ({
  backupLegacyVerifierForRollback: pkceState.backupLegacyVerifierForRollback,
  restoreLegacyVerifierForFlow: pkceState.restoreLegacyVerifierForFlow,
  clearPkceVerifierBackups: pkceState.clearPkceVerifierBackups,
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
    pendingState.hasOverlappingEmailFlows.mockResolvedValue(false);
    pendingState.resolveEmailCallbackFlowKind.mockResolvedValue(null);
    pendingState.clearAuthPendingFlows.mockResolvedValue(undefined);
    pkceState.backupLegacyVerifierForRollback.mockResolvedValue(null);
    pkceState.restoreLegacyVerifierForFlow.mockResolvedValue(true);
    pkceState.clearPkceVerifierBackups.mockResolvedValue(undefined);
    oauthStorageState.readOAuthFlowExpectation.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetOAuthRedirectState();
  });

  it('rejects PKCE codes without a pending auth flow', async () => {
    await expect(createSessionFromUrl('weigh-way://auth/callback?code=pkce-code')).rejects.toThrow(
      'auth_callback_not_expected',
    );
  });

  it('treats duplicate codes as a no-op before pending checks', async () => {
    pendingState.resolveEmailCallbackFlowKind.mockResolvedValue('signup');
    pendingState.isEmailConfirmationPending.mockResolvedValue(true);

    await createSessionFromUrl('weigh-way://auth/callback?code=duplicate');
    await createSessionFromUrl('weigh-way://auth/callback?code=duplicate');

    expect(authState.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('restores the signup verifier and clears both pending flags on success', async () => {
    pendingState.resolveEmailCallbackFlowKind.mockResolvedValue('signup');

    await createSessionFromUrl('weigh-way://auth/callback?code=confirm-code');

    expect(pkceState.restoreLegacyVerifierForFlow).toHaveBeenCalledWith('signup');
    expect(authState.exchangeCodeForSession).toHaveBeenCalledWith('confirm-code', undefined);
    expect(pendingState.clearAuthPendingFlows).toHaveBeenCalled();
    expect(pkceState.clearPkceVerifierBackups).toHaveBeenCalled();
  });

  it('rolls back the legacy verifier when exchange fails', async () => {
    const rollback = vi.fn();
    pkceState.backupLegacyVerifierForRollback.mockResolvedValue(rollback);
    pendingState.resolveEmailCallbackFlowKind.mockResolvedValue('signup');
    authState.exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'otp_expired' },
    });

    await expect(createSessionFromUrl('weigh-way://auth/callback?code=bad')).rejects.toThrow(
      'auth_signup_link_exchange_failed',
    );
    expect(rollback).toHaveBeenCalled();
    expect(pendingState.clearAuthPendingFlows).not.toHaveBeenCalled();
  });

  it('prefers email flows over a recent OAuth expectation when no flow id is present', async () => {
    beginOAuthFlowExpectation('oauth-flow');
    pendingState.resolveEmailCallbackFlowKind.mockResolvedValue('signup');

    await createSessionFromUrl('weigh-way://auth/callback?code=email-code');

    expect(authState.exchangeCodeForSession).toHaveBeenCalledWith('email-code', undefined);
  });

  it('exchanges OAuth callbacks with an explicit flow id', async () => {
    beginOAuthFlowExpectation('flow-123');

    await createSessionFromUrl(
      'weigh-way://auth/callback?code=pkce-code&sb_flow_id=flow-123',
    );

    expect(authState.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code', {
      flowId: 'flow-123',
    });
  });
});
