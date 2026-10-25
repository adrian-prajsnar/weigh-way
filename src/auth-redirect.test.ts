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
  clearEmailConfirmationPending: vi.fn(),
  clearPasswordResetPending: vi.fn(),
}));

const pkceState = vi.hoisted(() => ({
  backupLegacyVerifierForRollback: vi.fn(),
  restoreLegacyVerifierForFlow: vi.fn(),
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
  clearAuthPendingFlows: vi.fn(),
  clearEmailConfirmationPending: pendingState.clearEmailConfirmationPending,
  clearPasswordResetPending: pendingState.clearPasswordResetPending,
  isEmailConfirmationPending: pendingState.isEmailConfirmationPending,
  isPasswordResetPending: pendingState.isPasswordResetPending,
  hasOverlappingEmailFlows: pendingState.hasOverlappingEmailFlows,
  resolveEmailCallbackFlowKind: pendingState.resolveEmailCallbackFlowKind,
}));

vi.mock('./storage/pkce-verifier-backup', () => ({
  backupLegacyVerifierForRollback: pkceState.backupLegacyVerifierForRollback,
  restoreLegacyVerifierForFlow: pkceState.restoreLegacyVerifierForFlow,
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

const exchangedCodeState = vi.hoisted(() => ({
  remembered: new Set<string>(),
}));

vi.mock('./storage/auth-last-exchanged-code', () => ({
  isAuthCodeAlreadyExchanged: vi.fn(async (code: string) => exchangedCodeState.remembered.has(code)),
  rememberExchangedAuthCode: vi.fn(async (code: string) => {
    exchangedCodeState.remembered.add(code);
  }),
  clearRememberedAuthCode: vi.fn(async () => {
    exchangedCodeState.remembered.clear();
  }),
}));

// eslint-disable-next-line import/first -- load after vi.mock
import { formatAuthLinkError } from './auth-errors';
import {
  beginOAuthFlowExpectation,
  createSessionFromUrl,
  resetOAuthRedirectState,
} from './auth-redirect';

const PKCE_VERIFIER_MISMATCH = {
  code: 'bad_code_verifier',
  message: 'code challenge does not match previously saved code verifier',
};

describe('auth deep link handling', () => {
  beforeEach(() => {
    exchangedCodeState.remembered.clear();
    resetOAuthRedirectState();
    authState.exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
    pendingState.isEmailConfirmationPending.mockResolvedValue(false);
    pendingState.isPasswordResetPending.mockResolvedValue(false);
    pendingState.hasOverlappingEmailFlows.mockResolvedValue(false);
    pendingState.resolveEmailCallbackFlowKind.mockResolvedValue(null);
    pendingState.clearEmailConfirmationPending.mockResolvedValue(undefined);
    pendingState.clearPasswordResetPending.mockResolvedValue(undefined);
    pkceState.backupLegacyVerifierForRollback.mockResolvedValue(null);
    pkceState.restoreLegacyVerifierForFlow.mockResolvedValue(true);
    oauthStorageState.readOAuthFlowExpectation.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetOAuthRedirectState();
  });

  it('dedupes in-flight exchange for the same code across callback URLs', async () => {
    pendingState.resolveEmailCallbackFlowKind.mockResolvedValue('signup');
    authState.exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });

    await Promise.all([
      createSessionFromUrl('weigh-way://auth/callback?code=shared-code'),
      createSessionFromUrl('weigh-way://auth/callback?code=shared-code&state=x'),
    ]);

    expect(authState.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('treats duplicate codes as a no-op before pending checks', async () => {
    pendingState.resolveEmailCallbackFlowKind.mockResolvedValue('signup');

    await createSessionFromUrl('weigh-way://auth/callback?code=duplicate');
    await createSessionFromUrl('weigh-way://auth/callback?code=duplicate');

    expect(authState.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('clears only the signup pending flag after a successful confirmation exchange', async () => {
    pendingState.resolveEmailCallbackFlowKind.mockResolvedValue('signup');

    await createSessionFromUrl('weigh-way://auth/callback?code=confirm-code');

    expect(pkceState.restoreLegacyVerifierForFlow).toHaveBeenCalledWith('signup');
    expect(pendingState.clearEmailConfirmationPending).toHaveBeenCalled();
    expect(pendingState.clearPasswordResetPending).not.toHaveBeenCalled();
  });

  it('prefers OAuth when an expectation is active and email is also pending', async () => {
    beginOAuthFlowExpectation('oauth-flow');
    pendingState.resolveEmailCallbackFlowKind.mockResolvedValue('signup');

    await createSessionFromUrl('weigh-way://auth/callback?code=oauth-code');

    expect(authState.exchangeCodeForSession).toHaveBeenCalledWith('oauth-code', {
      flowId: 'oauth-flow',
    });
    expect(pkceState.restoreLegacyVerifierForFlow).not.toHaveBeenCalled();
    expect(oauthStorageState.clearOAuthFlowExpectationStorage).toHaveBeenCalled();
    expect(pendingState.clearEmailConfirmationPending).not.toHaveBeenCalled();
  });

  it('falls back to the email verifier when OAuth exchange fails with a verifier error', async () => {
    beginOAuthFlowExpectation('oauth-flow');
    pendingState.resolveEmailCallbackFlowKind.mockResolvedValue('signup');
    authState.exchangeCodeForSession
      .mockResolvedValueOnce({
        data: { session: null },
        error: PKCE_VERIFIER_MISMATCH,
      })
      .mockResolvedValueOnce({ data: { session: {} }, error: null });

    await createSessionFromUrl('weigh-way://auth/callback?code=email-code');

    expect(authState.exchangeCodeForSession).toHaveBeenNthCalledWith(1, 'email-code', {
      flowId: 'oauth-flow',
    });
    expect(authState.exchangeCodeForSession).toHaveBeenNthCalledWith(2, 'email-code', undefined);
    expect(pkceState.restoreLegacyVerifierForFlow).toHaveBeenCalledWith('signup');
    expect(pendingState.clearEmailConfirmationPending).toHaveBeenCalled();
  });

  it('completes an email link when OAuth is active but the code belongs to email', async () => {
    beginOAuthFlowExpectation('oauth-flow');
    pendingState.resolveEmailCallbackFlowKind.mockResolvedValue('recovery');
    authState.exchangeCodeForSession
      .mockResolvedValueOnce({
        data: { session: null },
        error: PKCE_VERIFIER_MISMATCH,
      })
      .mockResolvedValueOnce({ data: { session: {} }, error: null });

    await createSessionFromUrl('weigh-way://auth/callback?code=reset-code');

    expect(pkceState.restoreLegacyVerifierForFlow).toHaveBeenCalledWith('recovery');
    expect(pendingState.clearPasswordResetPending).toHaveBeenCalled();
  });

  it('does not fall back when OAuth returns an expired flow state', async () => {
    beginOAuthFlowExpectation('oauth-flow');
    pendingState.resolveEmailCallbackFlowKind.mockResolvedValue('signup');
    authState.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: {
        code: 'flow_state_expired',
        message: 'invalid flow state, no valid flow state found',
      },
    });

    await expect(
      createSessionFromUrl('weigh-way://auth/callback?code=expired-code'),
    ).rejects.toThrow('auth_oauth_link_exchange_failed');

    expect(authState.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(pkceState.restoreLegacyVerifierForFlow).not.toHaveBeenCalled();
  });

  it('surfaces network failures without mapping them to an expired link message', async () => {
    pendingState.resolveEmailCallbackFlowKind.mockResolvedValue('signup');
    authState.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Network request failed' },
    });

    let thrown: unknown;
    try {
      await createSessionFromUrl('weigh-way://auth/callback?code=offline-code');
    } catch (error) {
      thrown = error;
    }

    expect(formatAuthLinkError(thrown, { isPasswordRecovery: false })).toContain(
      'internet connection',
    );
  });
});
