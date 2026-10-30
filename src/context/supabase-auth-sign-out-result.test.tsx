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

const storageClearState = vi.hoisted(() => ({
  clearPersistedAuthSession: vi.fn(),
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

vi.mock('../supabase/sign-out-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../supabase/sign-out-session')>();
  return {
    ...actual,
    signOutSession: vi.fn(),
  };
});

vi.mock('../supabase/validate-restored-session', () => ({
  validateRestoredSessionInBackground: vi.fn(),
}));

vi.mock('../supabase/auth-storage-key', () => ({
  readPersistedAuthSession: vi.fn().mockResolvedValue(null),
  clearPersistedAuthSession: storageClearState.clearPersistedAuthSession,
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
import { signOutSession } from '../supabase/sign-out-session';
import { SupabaseAuthProvider, useSupabaseAuth } from './supabase-auth-context';
/* eslint-enable import/first */

const signOutSessionMock = vi.mocked(signOutSession);

const sampleSession = {
  access_token: 'token-a',
  refresh_token: 'refresh-a',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-a', email: 'a@example.com' },
};

describe('supabase auth signOut result handling', () => {
  beforeEach(() => {
    signOutSessionMock.mockReset();
    redirectState.clearAuthPendingFlows.mockReset();
    pkceState.clearPkceVerifierBackups.mockReset();
    redirectState.clearAuthPendingFlows.mockResolvedValue(undefined);
    pkceState.clearPkceVerifierBackups.mockResolvedValue(undefined);
    authState.getSession.mockResolvedValue({ data: { session: sampleSession } });
    authState.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    }));
  });

  it('returns offlineNotice when the server revoke is unreachable', async () => {
    signOutSessionMock.mockResolvedValue({ serverSignOutUnreachable: true });

    const { result } = renderHook(() => useSupabaseAuth(), {
      wrapper: ({ children }) => <SupabaseAuthProvider>{children}</SupabaseAuthProvider>,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let offlineNotice = false;
    await act(async () => {
      ({ offlineNotice } = await result.current.signOut());
    });

    expect(offlineNotice).toBe(true);
    expect(redirectState.clearAuthPendingFlows).toHaveBeenCalled();
    expect(pkceState.clearPkceVerifierBackups).toHaveBeenCalled();
  });
});
