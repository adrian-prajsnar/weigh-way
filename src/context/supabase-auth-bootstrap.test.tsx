/** @vitest-environment happy-dom */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

const validateState = vi.hoisted(() => ({
  validateRestoredSessionInBackground: vi.fn(),
}));

const storageState = vi.hoisted(() => ({
  readPersistedAuthSession: vi.fn(),
}));

const weightSyncState = vi.hoisted(() => ({
  getEntries: vi.fn(),
}));

let authStateChangeListener: ((event: string, session: unknown) => void) | null = null;

vi.mock('../supabase/client', () => ({
  isSupabaseConfigured: () => true,
  supabaseAuthHttpConfig: {
    url: 'https://example.supabase.co',
    anonKey: 'public-anon-key',
  },
  supabase: {
    auth: {
      getSession: authState.getSession,
      onAuthStateChange: authState.onAuthStateChange,
      signOut: vi.fn(),
    },
  },
}));

vi.mock('../supabase/app-lifecycle', () => ({
  registerSupabaseAppLifecycle: vi.fn(),
  refreshSessionOnForeground: vi.fn(),
}));

vi.mock('../supabase/validate-restored-session', () => ({
  validateRestoredSessionInBackground: validateState.validateRestoredSessionInBackground,
}));

vi.mock('../supabase/auth-storage-key', () => ({
  readPersistedAuthSession: storageState.readPersistedAuthSession,
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
import {
  BOOTSTRAP_SESSION_DEADLINE_MS,
  SupabaseAuthProvider,
  useSupabaseAuth,
} from './supabase-auth-context';
/* eslint-enable import/first */

const sampleSession = {
  access_token: 'token-a',
  refresh_token: 'refresh-a',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-a', email: 'a@example.com' },
};

const signedInSession = {
  ...sampleSession,
  access_token: 'token-b',
  user: { id: 'user-b', email: 'b@example.com' },
};

function AuthAndWeightProbe() {
  const { isAuthenticated, isLoading, session } = useSupabaseAuth();
  useEffect(() => {
    if (isAuthenticated) {
      void getEntries();
    }
  }, [isAuthenticated]);
  return (
    <>
      <span data-testid="auth-loading">{isLoading ? 'yes' : 'no'}</span>
      <span data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="token">{session?.access_token ?? 'none'}</span>
    </>
  );
}

function setupAuthListener() {
  authState.onAuthStateChange.mockImplementation((listener) => {
    authStateChangeListener = listener;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
}

describe('SupabaseAuthProvider bootstrap', () => {
  beforeEach(() => {
    authState.getSession.mockReset();
    authState.onAuthStateChange.mockReset();
    validateState.validateRestoredSessionInBackground.mockReset();
    storageState.readPersistedAuthSession.mockReset();
    weightSyncState.getEntries.mockReset();
    authStateChangeListener = null;
    setupAuthListener();
  });

  afterEach(() => {
    cleanup();
  });

  it('authenticates after getSession returns a session and validates in the background', async () => {
    authState.getSession.mockResolvedValue({ data: { session: sampleSession } });
    validateState.validateRestoredSessionInBackground.mockResolvedValue(undefined);
    weightSyncState.getEntries.mockResolvedValue([]);

    render(
      <SupabaseAuthProvider>
        <AuthAndWeightProbe />
      </SupabaseAuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
      expect(validateState.validateRestoredSessionInBackground).toHaveBeenCalled();
      expect(weightSyncState.getEntries).toHaveBeenCalled();
    });
  });

  it('restores the persisted session when getSession hangs past the bootstrap deadline', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    authState.getSession.mockImplementation(() => new Promise(() => {}));
    storageState.readPersistedAuthSession.mockResolvedValue(sampleSession);
    validateState.validateRestoredSessionInBackground.mockResolvedValue(undefined);
    weightSyncState.getEntries.mockResolvedValue([]);

    render(
      <SupabaseAuthProvider>
        <AuthAndWeightProbe />
      </SupabaseAuthProvider>,
    );

    await vi.advanceTimersByTimeAsync(BOOTSTRAP_SESSION_DEADLINE_MS);

    await waitFor(() => {
      expect(screen.getByTestId('auth-loading').textContent).toBe('no');
      expect(screen.getByTestId('authenticated').textContent).toBe('yes');
      expect(screen.getByTestId('token').textContent).toBe('token-a');
    });
    expect(storageState.readPersistedAuthSession).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('ends loading within the bootstrap deadline when getSession hangs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    authState.getSession.mockImplementation(() => new Promise(() => {}));
    storageState.readPersistedAuthSession.mockResolvedValue(null);

    render(
      <SupabaseAuthProvider>
        <AuthAndWeightProbe />
      </SupabaseAuthProvider>,
    );

    await vi.advanceTimersByTimeAsync(BOOTSTRAP_SESSION_DEADLINE_MS);

    await waitFor(() => {
      expect(screen.getByTestId('auth-loading').textContent).toBe('no');
    });
    vi.useRealTimers();
  });

  it('applies bootstrap session after INITIAL_SESSION without ignoring generation', async () => {
    let resolveGetSession: (value: { data: { session: typeof sampleSession } }) => void = () => {};
    authState.getSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetSession = resolve;
        }),
    );
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
    authState.getSession.mockResolvedValue({ data: { session: sampleSession } });

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
});
