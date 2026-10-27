/** @vitest-environment happy-dom */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESTORED_SESSION_DATA_FETCH_CAP_MS } from '../supabase/restored-session-data-fetch-gate';

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
}));

const storageState = vi.hoisted(() => ({
  restoredSessionNeedsServerValidation: vi.fn(),
  clearLastKnownAuthSessions: vi.fn(),
  resetSignOutPersistWarning: vi.fn(),
  consumeSignOutPersistWarning: vi.fn(),
  forcePersistSignedOutStateForLastKnownSessionKey: vi.fn().mockResolvedValue(undefined),
}));

const validateState = vi.hoisted(() => ({
  validateRestoredSessionInBackground: vi.fn(),
}));

const weightSyncState = vi.hoisted(() => ({
  getEntries: vi.fn(),
}));

let authStateChangeListener: ((event: string, session: unknown) => void) | null = null;

vi.mock('../supabase/client', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: authState.getSession,
      onAuthStateChange: authState.onAuthStateChange,
      signOut: authState.signOut,
    },
  },
}));

vi.mock('../supabase/auth-session-storage', () => ({
  getSupabaseAuthStorage: () => storageState,
  registerAuthStoragePersistenceRecovery: vi.fn(() => vi.fn()),
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

const signedInSession = {
  access_token: 'token-b',
  refresh_token: 'refresh-b',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-2', email: 'b@example.com' },
};

function AuthAndWeightProbe() {
  const { isAuthenticated, isLoading, session, isProtectedDataFetchReady } = useSupabaseAuth();
  useEffect(() => {
    if (!isLoading && isAuthenticated && isProtectedDataFetchReady) {
      void getEntries();
    }
  }, [isAuthenticated, isLoading, isProtectedDataFetchReady]);
  return (
    <div>
      <span data-testid="auth-loading">{isLoading ? 'yes' : 'no'}</span>
      <span data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="token">{session?.access_token ?? 'none'}</span>
    </div>
  );
}

function setupAuthListener() {
  authStateChangeListener = null;
  authState.onAuthStateChange.mockImplementation((listener) => {
    authStateChangeListener = listener;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
}

describe('SupabaseAuthProvider bootstrap', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('stays signed-in through a 7s background validation delay with no login flash', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupAuthListener();
    authState.getSession.mockResolvedValue({ data: { session: sampleSession } });
    storageState.restoredSessionNeedsServerValidation.mockResolvedValue(false);
    validateState.validateRestoredSessionInBackground.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 7000);
        }),
    );
    weightSyncState.getEntries.mockResolvedValue([]);

    const seenUnauthenticatedWhileLoaded: boolean[] = [];

    function FlashProbe() {
      const { isAuthenticated, isLoading } = useSupabaseAuth();
      if (!isLoading && !isAuthenticated) {
        seenUnauthenticatedWhileLoaded.push(true);
      }
      return (
        <div>
          <span data-testid="auth-loading">{isLoading ? 'yes' : 'no'}</span>
          <span data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</span>
        </div>
      );
    }

    render(
      <SupabaseAuthProvider>
        <FlashProbe />
      </SupabaseAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
      expect(screen.getByTestId('auth-loading').textContent).toBe('no');
    });

    await vi.advanceTimersByTimeAsync(4000);

    expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    expect(seenUnauthenticatedWhileLoaded).toEqual([]);
  });

  it('shows signed-in immediately when validation hangs on an unflagged restored session', async () => {
    vi.useFakeTimers();
    setupAuthListener();
    authState.getSession.mockResolvedValue({ data: { session: sampleSession } });
    storageState.restoredSessionNeedsServerValidation.mockResolvedValue(false);
    validateState.validateRestoredSessionInBackground.mockImplementation(
      () => new Promise<void>(() => {}),
    );
    weightSyncState.getEntries.mockResolvedValue([]);

    render(
      <SupabaseAuthProvider>
        <AuthAndWeightProbe />
      </SupabaseAuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    expect(screen.getByTestId('token').textContent).toBe('token-a');
    expect(weightSyncState.getEntries).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESTORED_SESSION_DATA_FETCH_CAP_MS);
    });
    expect(weightSyncState.getEntries).toHaveBeenCalledTimes(1);
  });

  it('does not fetch weigh-ins when background validation signs out on 403', async () => {
    setupAuthListener();
    authState.getSession.mockResolvedValue({ data: { session: sampleSession } });
    storageState.restoredSessionNeedsServerValidation.mockResolvedValue(false);
    validateState.validateRestoredSessionInBackground.mockImplementation(async () => {
      authStateChangeListener?.('SIGNED_OUT', null);
    });
    weightSyncState.getEntries.mockResolvedValue([]);

    render(
      <SupabaseAuthProvider>
        <AuthAndWeightProbe />
      </SupabaseAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('no');
    });
    expect(weightSyncState.getEntries).not.toHaveBeenCalled();
  });

  it('does not fetch weigh-ins when validation clears the session after 401 and refresh 400', async () => {
    setupAuthListener();
    authState.getSession.mockResolvedValue({ data: { session: sampleSession } });
    storageState.restoredSessionNeedsServerValidation.mockResolvedValue(false);
    validateState.validateRestoredSessionInBackground.mockImplementation(async () => {
      authStateChangeListener?.('SIGNED_OUT', null);
    });
    weightSyncState.getEntries.mockResolvedValue([]);

    render(
      <SupabaseAuthProvider>
        <AuthAndWeightProbe />
      </SupabaseAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe('none');
    });
    expect(weightSyncState.getEntries).not.toHaveBeenCalled();
  });

  it('keeps the splash up past 4s while flagged validation is still running', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupAuthListener();
    authState.getSession.mockResolvedValue({ data: { session: sampleSession } });
    storageState.restoredSessionNeedsServerValidation.mockResolvedValue(true);

    let resolveValidation: () => void = () => {};
    validateState.validateRestoredSessionInBackground.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveValidation = resolve;
        }),
    );

    render(
      <SupabaseAuthProvider>
        <AuthAndWeightProbe />
      </SupabaseAuthProvider>,
    );

    await vi.advanceTimersByTimeAsync(4000);
    expect(screen.getByTestId('auth-loading').textContent).toBe('yes');
    expect(screen.getByTestId('authenticated').textContent).toBe('no');

    resolveValidation();
    await waitFor(() => {
      expect(screen.getByTestId('auth-loading').textContent).toBe('no');
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });
  });

  it('does not fetch weight entries until flagged validation finishes', async () => {
    setupAuthListener();
    authState.getSession.mockResolvedValue({ data: { session: sampleSession } });
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
      expect(weightSyncState.getEntries).toHaveBeenCalledTimes(1);
    });
  });

  it('times out flagged validation and signs out locally', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupAuthListener();
    authState.getSession
      .mockResolvedValueOnce({ data: { session: sampleSession } })
      .mockResolvedValue({ data: { session: null } });
    storageState.restoredSessionNeedsServerValidation.mockResolvedValue(true);
    validateState.validateRestoredSessionInBackground.mockImplementation(
      () => new Promise<void>(() => {}),
    );
    authState.signOut.mockResolvedValue({ error: null });

    render(
      <SupabaseAuthProvider>
        <AuthAndWeightProbe />
      </SupabaseAuthProvider>,
    );

    await vi.advanceTimersByTimeAsync(6000);

    await waitFor(() => {
      expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(screen.getByTestId('authenticated').textContent).toBe('no');
    });
  });

  it('applies bootstrap session after INITIAL_SESSION without ignoring generation', async () => {
    setupAuthListener();
    let resolveGetSession: (value: { data: { session: typeof sampleSession } }) => void = () => {};
    authState.getSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetSession = resolve;
        }),
    );
    storageState.restoredSessionNeedsServerValidation.mockResolvedValue(false);
    validateState.validateRestoredSessionInBackground.mockResolvedValue(undefined);

    render(
      <SupabaseAuthProvider>
        <AuthAndWeightProbe />
      </SupabaseAuthProvider>,
    );

    await waitFor(() => {
      expect(authStateChangeListener).toBeTruthy();
    });

    authStateChangeListener?.('INITIAL_SESSION', null);
    resolveGetSession({ data: { session: sampleSession } });

    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe('token-a');
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    });
  });

  it('honours SIGNED_IN during bootstrap instead of overwriting with the restored session', async () => {
    setupAuthListener();
    authState.getSession.mockResolvedValue({ data: { session: sampleSession } });
    storageState.restoredSessionNeedsServerValidation.mockResolvedValue(true);

    let resolveValidation: () => void = () => {};
    validateState.validateRestoredSessionInBackground.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveValidation = resolve;
        }),
    );

    render(
      <SupabaseAuthProvider>
        <AuthAndWeightProbe />
      </SupabaseAuthProvider>,
    );

    await waitFor(() => {
      expect(authStateChangeListener).toBeTruthy();
    });

    authStateChangeListener?.('SIGNED_IN', signedInSession);

    resolveValidation();
    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe('token-b');
    });
  });

  it('honours SIGNED_OUT during bootstrap', async () => {
    setupAuthListener();
    authState.getSession.mockResolvedValue({ data: { session: sampleSession } });
    storageState.restoredSessionNeedsServerValidation.mockResolvedValue(true);

    let resolveValidation: () => void = () => {};
    validateState.validateRestoredSessionInBackground.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveValidation = resolve;
        }),
    );

    render(
      <SupabaseAuthProvider>
        <AuthAndWeightProbe />
      </SupabaseAuthProvider>,
    );

    await waitFor(() => {
      expect(authStateChangeListener).toBeTruthy();
    });

    authStateChangeListener?.('SIGNED_OUT', null);

    resolveValidation();
    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('no');
      expect(screen.getByTestId('token').textContent).toBe('none');
    });
  });
});
