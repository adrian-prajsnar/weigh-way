/** @vitest-environment happy-dom */
import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

const storageState = vi.hoisted(() => ({
  restoredSessionNeedsServerValidation: vi.fn(),
  clearLastKnownAuthSessions: vi.fn(),
  resetSignOutPersistWarning: vi.fn(),
  consumeSignOutPersistWarning: vi.fn(),
}));

const validateState = vi.hoisted(() => ({
  validateRestoredSessionInBackground: vi.fn(),
}));

const weightSyncState = vi.hoisted(() => ({
  getEntries: vi.fn(),
}));

vi.mock('../supabase/client', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: authState.getSession,
      onAuthStateChange: authState.onAuthStateChange,
      signOut: vi.fn(),
    },
  },
}));

vi.mock('../supabase/auth-session-storage', () => ({
  getSupabaseAuthStorage: () => storageState,
  registerAuthStoragePersistenceRecovery: vi.fn(),
}));

vi.mock('../supabase/app-lifecycle', () => ({
  registerSupabaseAppLifecycle: vi.fn(),
  refreshSessionOnForeground: vi.fn(),
}));

vi.mock('../supabase/validate-restored-session', () => ({
  validateRestoredSessionInBackground: validateState.validateRestoredSessionInBackground,
}));

vi.mock('../supabase/weight-sync', () => ({
  getEntries: weightSyncState.getEntries,
}));

vi.mock('../demo/is-demo-mode', () => ({
  isDemoMode: () => false,
}));

vi.mock('../auth-redirect', () => ({
  clearAuthPendingFlows: vi.fn(),
  createSessionFromUrl: vi.fn(),
  getAuthRedirectUrl: vi.fn(),
  isOAuthFlowActive: vi.fn(() => false),
  markEmailConfirmationPending: vi.fn(),
  markPasswordResetPending: vi.fn(),
  performOAuthSignIn: vi.fn(),
  resetOAuthRedirectState: vi.fn(),
}));

vi.mock('expo-linking', () => ({
  getInitialURL: vi.fn().mockResolvedValue(null),
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
}));

vi.mock('../storage/pkce-verifier-backup', () => ({
  clearPkceVerifierBackups: vi.fn(),
}));

vi.mock('../storage/auth-pending-flow', () => ({
  getAuthLinkErrorContext: vi.fn().mockResolvedValue({}),
}));

/* eslint-disable import/first -- after vi.mock */
import { getEntries } from '../supabase/weight-sync';
import { SupabaseAuthProvider, useSupabaseAuth } from './supabase-auth-context';
/* eslint-enable import/first */

const sampleSession = {
  access_token: 'token-a',
  refresh_token: 'refresh-a',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-1', email: 'a@example.com' },
};

function AuthAndWeightProbe() {
  const { isAuthenticated, isLoading } = useSupabaseAuth();
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void getEntries();
    }
  }, [isAuthenticated, isLoading]);
  return (
    <div>
      <span data-testid="auth-loading">{isLoading ? 'yes' : 'no'}</span>
      <span data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('SupabaseAuthProvider bootstrap', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch weight entries until restored-session validation finishes', async () => {
    const session = sampleSession;
    authState.getSession.mockResolvedValue({ data: { session } });
    authState.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    storageState.restoredSessionNeedsServerValidation.mockResolvedValue(true);

    let resolveValidation: () => void = () => {};
    validateState.validateRestoredSessionInBackground.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveValidation = resolve;
        }),
    );

    weightSyncState.getEntries.mockResolvedValue([]);

    render(
      <SupabaseAuthProvider>
        <AuthAndWeightProbe />
      </SupabaseAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-loading').textContent).toBe('yes');
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('no');
    expect(weightSyncState.getEntries).not.toHaveBeenCalled();

    resolveValidation();
    await waitFor(() => {
      expect(screen.getByTestId('auth-loading').textContent).toBe('no');
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });
    expect(weightSyncState.getEntries).toHaveBeenCalledTimes(1);
  });
});
