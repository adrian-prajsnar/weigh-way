/** @vitest-environment happy-dom */
import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../i18n', () => ({
  t: (key: string) =>
    key === 'profile.signOutPersistFailedOffline'
      ? "You're signed out on this device. We couldn't reach the server."
      : key,
}));

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
}));

const redirectState = vi.hoisted(() => ({
  clearAuthPendingFlows: vi.fn(),
  resetOAuthRedirectState: vi.fn(),
}));

const pkceState = vi.hoisted(() => ({
  clearPkceVerifierBackups: vi.fn(),
}));

vi.mock('../auth-redirect', () => ({
  clearAuthPendingFlows: redirectState.clearAuthPendingFlows,
  resetOAuthRedirectState: redirectState.resetOAuthRedirectState,
  createSessionFromUrl: vi.fn(),
  getAuthRedirectUrl: vi.fn(),
  isOAuthFlowActive: vi.fn(() => false),
}));

vi.mock('../storage/pkce-verifier-backup', () => ({
  clearPkceVerifierBackups: pkceState.clearPkceVerifierBackups,
}));

vi.mock('../storage/auth-pending-flow', () => ({
  getAuthLinkErrorContext: vi.fn().mockResolvedValue({}),
}));

vi.mock('../demo/is-demo-mode', () => ({
  isDemoMode: () => false,
}));

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
      signOut: authState.signOut,
    },
  },
}));

vi.mock('../supabase/validate-restored-session', () => ({
  validateRestoredSessionInBackground: vi.fn(),
}));

vi.mock('../supabase/auth-storage-key', () => ({
  readPersistedAuthSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('../supabase/weight-sync', () => ({
  getEntries: vi.fn(),
}));

vi.mock('../supabase/app-lifecycle', () => ({
  registerSupabaseAppLifecycle: vi.fn(),
  refreshSessionOnForeground: vi.fn(),
}));

vi.mock('expo-linking', () => ({
  getInitialURL: vi.fn().mockResolvedValue(null),
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
}));

/* eslint-disable import/first -- after vi.mock */
import { SupabaseAuthProvider, useSupabaseAuth } from './supabase-auth-context';
/* eslint-enable import/first */

const sampleSession = {
  access_token: 'token-a',
  refresh_token: 'refresh-a',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-a', email: 'a@example.com' },
};

const offlineCopy = "You're signed out on this device. We couldn't reach the server.";

describe('supabase auth signOut result handling', () => {
  beforeEach(() => {
    redirectState.clearAuthPendingFlows.mockReset();
    pkceState.clearPkceVerifierBackups.mockReset();
    authState.signOut.mockReset();
    redirectState.clearAuthPendingFlows.mockResolvedValue(undefined);
    pkceState.clearPkceVerifierBackups.mockResolvedValue(undefined);
    authState.getSession.mockResolvedValue({ data: { session: sampleSession } });
    authState.signOut.mockResolvedValue({ error: null });
    authState.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
  });

  it('throws offline copy when the server revoke is unreachable and local sign-out hits a network error', async () => {
    authState.signOut.mockResolvedValue({
      error: { message: 'Network request failed' },
    });

    const { result } = renderHook(() => useSupabaseAuth(), {
      wrapper: ({ children }) => <SupabaseAuthProvider>{children}</SupabaseAuthProvider>,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.signOut()).rejects.toThrow(offlineCopy);
    });

    expect(authState.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(redirectState.clearAuthPendingFlows).toHaveBeenCalled();
    expect(pkceState.clearPkceVerifierBackups).toHaveBeenCalled();
  });
});
