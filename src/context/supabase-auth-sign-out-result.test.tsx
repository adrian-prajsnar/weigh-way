/** @vitest-environment happy-dom */
import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

const signOutSessionMock = vi.hoisted(() => vi.fn());

vi.mock('../supabase/sign-out-session', () => ({
  signOutSession: signOutSessionMock,
  signOutSessionBestEffort: vi.fn(),
}));

vi.mock('../supabase/auth-session-storage', () => ({
  getSupabaseAuthStorage: () => ({
    consumeSignOutPersistWarning: () => false,
    resetSignOutPersistWarning: vi.fn(),
  }),
  registerAuthStoragePersistenceRecovery: vi.fn(() => vi.fn()),
}));

vi.mock('../auth-redirect', () => ({
  clearAuthPendingFlows: vi.fn(),
  resetOAuthRedirectState: vi.fn(),
  createSessionFromUrl: vi.fn(),
  getAuthRedirectUrl: vi.fn(),
  isOAuthFlowActive: vi.fn(() => false),
}));

vi.mock('../storage/pkce-verifier-backup', () => ({
  clearPkceVerifierBackups: vi.fn(),
}));

vi.mock('../storage/auth-pending-flow', () => ({
  getAuthLinkErrorContext: vi.fn().mockResolvedValue({}),
}));

vi.mock('../demo/is-demo-mode', () => ({
  isDemoMode: () => false,
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
  supabaseAuthHttpConfig: { url: 'https://example.supabase.co', anonKey: 'key' },
}));

vi.mock('../supabase/validate-restored-session', () => ({
  validateRestoredSessionInBackground: vi.fn(),
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

describe('supabase auth signOut result handling', () => {
  beforeEach(() => {
    signOutSessionMock.mockReset();
    authState.getSession.mockResolvedValue({ data: { session: sampleSession } });
    authState.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    }));
  });

  it('throws storage persist copy instead of resolving when local clear is incomplete', async () => {
    signOutSessionMock.mockResolvedValue({
      serverSignOutUnreachable: false,
      localClearIncomplete: true,
    });

    const { result } = renderHook(() => useSupabaseAuth(), {
      wrapper: ({ children }) => <SupabaseAuthProvider>{children}</SupabaseAuthProvider>,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.signOut()).rejects.toThrow(/storage/i);
    });
  });
});
