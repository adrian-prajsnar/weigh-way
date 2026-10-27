import { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  formatAuthLinkError,
  formatDeleteAccountError,
  formatResetPasswordError,
  formatResendConfirmationError,
  formatGoogleSignInError,
  formatSignInError,
  formatSignOutError,
  formatSignOutPersistWarning,
  formatSignUpError,
  formatUpdatePasswordError,
  isNetworkError,
} from '../auth-errors';
import { isOAuthCallbackUrl } from '../auth-oauth-callback';
import {
  clearAuthPendingFlows,
  createSessionFromUrl,
  getAuthRedirectUrl,
  isOAuthFlowActive,
  markEmailConfirmationPending,
  markPasswordResetPending,
  performOAuthSignIn,
  resetOAuthRedirectState,
} from '../auth-redirect';
import { getAuthLinkErrorContext } from '../storage/auth-pending-flow';
import { clearPkceVerifierBackups } from '../storage/pkce-verifier-backup';
import { registerSupabaseAppLifecycle, refreshSessionOnForeground } from '../supabase/app-lifecycle';
import {
  getSupabaseAuthStorage,
  registerAuthStoragePersistenceRecovery,
} from '../supabase/auth-session-storage';
import { isSupabaseConfigured, supabase } from '../supabase/client';
import { runBootstrapAuthSession } from '../supabase/bootstrap-auth-session';
import { runFailClosedLocalSignOut } from '../supabase/bootstrap-session-validation';
import { registerFatalRefreshTokenHandler } from '../supabase/supabase-auth-fetch';
import {
  createRestoredSessionDataFetchGate,
  RESTORED_SESSION_DATA_FETCH_CAP_MS,
} from '../supabase/restored-session-data-fetch-gate';
import { validateRestoredSessionInBackground } from '../supabase/validate-restored-session';
import { createDemoSession } from '../demo/demo-session';
import { isDemoMode } from '../demo/is-demo-mode';
import { demoReadOnlyError } from '../demo/read-only';

type SignUpResult = {
  needsEmailConfirmation: boolean;
};

type SupabaseAuthContextValue = {
  session: Session | null;
  isAuthenticated: boolean;
  isPasswordRecovery: boolean;
  isLoading: boolean;
  isProtectedDataFetchReady: boolean;
  isCompletingOAuth: boolean;
  isConfigured: boolean;
  authLinkError: string | null;
  clearAuthLinkError: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompletingOAuth, setIsCompletingOAuth] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);
  const [isRestoredSessionValidationPending, setIsRestoredSessionValidationPending] =
    useState(false);
  const [isProtectedDataFetchGated, setIsProtectedDataFetchGated] = useState(false);
  const restoredSessionDataFetchGateRef = useRef(createRestoredSessionDataFetchGate());
  const dataFetchCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completingSignUpRef = useRef(false);
  const authEventGenerationRef = useRef(0);

  const clearProtectedDataFetchCapTimer = useCallback(() => {
    if (dataFetchCapTimerRef.current) {
      clearTimeout(dataFetchCapTimerRef.current);
      dataFetchCapTimerRef.current = null;
    }
  }, []);

  const beginProtectedDataFetchGate = useCallback(() => {
    restoredSessionDataFetchGateRef.current.begin();
    setIsProtectedDataFetchGated(true);
    clearProtectedDataFetchCapTimer();
    dataFetchCapTimerRef.current = setTimeout(() => {
      dataFetchCapTimerRef.current = null;
      restoredSessionDataFetchGateRef.current.end();
      setIsProtectedDataFetchGated(false);
    }, RESTORED_SESSION_DATA_FETCH_CAP_MS);
  }, [clearProtectedDataFetchCapTimer]);

  const endProtectedDataFetchGate = useCallback(() => {
    restoredSessionDataFetchGateRef.current.end();
    clearProtectedDataFetchCapTimer();
    setIsProtectedDataFetchGated(false);
  }, [clearProtectedDataFetchCapTimer]);

  const signOutLocallyAfterFatalRefresh = useCallback(async () => {
    getSupabaseAuthStorage().resetSignOutPersistWarning();
    getSupabaseAuthStorage().consumeSignOutPersistWarning();
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const isProtectedDataFetchReady = !isProtectedDataFetchGated;

  const isAuthenticated =
    Boolean(session) &&
    !isRestoredSessionValidationPending &&
    !completingSignUpRef.current &&
    !isPasswordRecovery;

  const clearAuthLinkError = useCallback(() => {
    setAuthLinkError(null);
  }, []);

  const handleAuthUrl = useCallback(async (url: string) => {
    if (isOAuthFlowActive() && isOAuthCallbackUrl(url)) {
      return;
    }

    const linkContext = await getAuthLinkErrorContext();
    try {
      await createSessionFromUrl(url);
      if (linkContext.isPasswordRecovery) {
        setIsPasswordRecovery(true);
      }
    } catch (error) {
      setAuthLinkError(formatAuthLinkError(error, linkContext));
    }
  }, []);

  useEffect(() => {
    if (isDemoMode()) {
      setSession(createDemoSession());
      setIsLoading(false);
      return;
    }

    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    registerSupabaseAppLifecycle();
    const unregisterStorageRecovery = registerAuthStoragePersistenceRecovery();

    registerFatalRefreshTokenHandler(() => {
      void signOutLocallyAfterFatalRefresh();
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, activeSession) => {
      if (event !== 'INITIAL_SESSION') {
        authEventGenerationRef.current += 1;
      }
      setSession(activeSession);
      if (event === 'TOKEN_REFRESHED' && activeSession) {
        endProtectedDataFetchGate();
      }
      if (event === 'PASSWORD_RECOVERY' && activeSession) {
        setIsPasswordRecovery(true);
      }
      if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
        setIsRestoredSessionValidationPending(false);
        getSupabaseAuthStorage().clearLastKnownAuthSessions();
        void clearAuthPendingFlows();
        resetOAuthRedirectState();
      }
      if (event === 'SIGNED_IN' && activeSession) {
        setIsRestoredSessionValidationPending(false);
        endProtectedDataFetchGate();
        void clearAuthPendingFlows();
      }
    });

    void runBootstrapAuthSession({
      getAuthEventGeneration: () => authEventGenerationRef.current,
      getSession: () => supabase.auth.getSession(),
      restoredSessionNeedsServerValidation: () =>
        getSupabaseAuthStorage().restoredSessionNeedsServerValidation(),
      validateRestoredSessionInBackground: () => validateRestoredSessionInBackground(),
      applyBootstrapSessionIfGeneration: (bootstrapAuthGeneration, nextSession) => {
        if (authEventGenerationRef.current === bootstrapAuthGeneration) {
          setSession(nextSession);
        }
      },
      setRestoredSessionValidationPending: setIsRestoredSessionValidationPending,
      setLoading: setIsLoading,
      onBootstrapComplete: () => {
        void refreshSessionOnForeground();
      },
      onRestoredSessionBackgroundValidationBegin: beginProtectedDataFetchGate,
      onRestoredSessionBackgroundValidationEnd: endProtectedDataFetchGate,
      runFailClosedLocalSignOut: async (context) => {
        await runFailClosedLocalSignOut(context, {
          signOutViaSupabase: async () => {
            await supabase.auth.signOut({ scope: 'local' });
          },
          clearReactSession: () => {
            setSession(null);
          },
          forcePersistSignedOutOnDisk: async () => {
            await getSupabaseAuthStorage().forcePersistSignedOutStateForLastKnownSessionKey();
          },
        });
      },
    });

    void Linking.getInitialURL().then((url) => {
      if (url) {
        void handleAuthUrl(url);
      }
    });

    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleAuthUrl(url);
    });

    return () => {
      registerFatalRefreshTokenHandler(null);
      unregisterStorageRecovery();
      subscription.subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, [beginProtectedDataFetchGate, endProtectedDataFetchGate, handleAuthUrl, signOutLocallyAfterFatalRefresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(formatSignInError(error));
    }
    await clearAuthPendingFlows();
    resetOAuthRedirectState();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    setIsCompletingOAuth(true);
    try {
      const result = await performOAuthSignIn('google');
      if (result === 'cancelled') {
        return false;
      }

      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();

      if (!activeSession) {
        throw new Error('missing_oauth_session');
      }

      setSession(activeSession);
      return true;
    } catch (error) {
      throw new Error(formatGoogleSignInError(error));
    } finally {
      setIsCompletingOAuth(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    completingSignUpRef.current = true;
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });
      if (error) {
        throw new Error(formatSignUpError(error));
      }

      const needsEmailConfirmation = Boolean(data.user && !data.session);
      if (needsEmailConfirmation) {
        await markEmailConfirmationPending(email);
      }

      // Supabase may auto-login when email confirmation is disabled — sign out so the user logs in manually.
      if (data.session) {
        getSupabaseAuthStorage().resetSignOutPersistWarning();
        await supabase.auth.signOut();
        getSupabaseAuthStorage().consumeSignOutPersistWarning();
      }

      return { needsEmailConfirmation };
    } finally {
      completingSignUpRef.current = false;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (isDemoMode()) {
      throw demoReadOnlyError();
    }

    getSupabaseAuthStorage().resetSignOutPersistWarning();
    let persistWarning = false;
    let serverSignOutUnreachable = false;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        if (isNetworkError(error)) {
          serverSignOutUnreachable = true;
        } else {
          throw new Error(formatSignOutError(error));
        }
      }
    } finally {
      resetOAuthRedirectState();
      await clearAuthPendingFlows();
      await clearPkceVerifierBackups();
      persistWarning = getSupabaseAuthStorage().consumeSignOutPersistWarning();
    }
    if (persistWarning) {
      throw new Error(formatSignOutPersistWarning({ serverSignOutUnreachable }));
    }
    if (serverSignOutUnreachable) {
      throw new Error(formatSignOutError(new Error('Network request failed')));
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    if (isDemoMode()) {
      throw demoReadOnlyError();
    }

    const { error } = await supabase.rpc('delete_own_account');
    if (error) {
      throw new Error(formatDeleteAccountError(error));
    }

    getSupabaseAuthStorage().resetSignOutPersistWarning();
    let persistWarning = false;
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      resetOAuthRedirectState();
      await clearAuthPendingFlows();
      await clearPkceVerifierBackups();
      persistWarning = getSupabaseAuthStorage().consumeSignOutPersistWarning();
    }
    if (persistWarning) {
      throw new Error(formatSignOutPersistWarning());
    }
  }, []);

  const resendConfirmationEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });

    if (error) {
      throw new Error(formatResendConfirmationError(error));
    }

    await markEmailConfirmationPending(email);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl(),
    });

    if (error) {
      throw new Error(formatResetPasswordError(error));
    }

    await markPasswordResetPending(email);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      throw new Error(formatUpdatePasswordError(error));
    }

    setIsPasswordRecovery(false);
  }, []);

  return (
    <SupabaseAuthContext.Provider
      value={{
        session,
        isAuthenticated,
        isPasswordRecovery,
        isLoading: isLoading || isRestoredSessionValidationPending,
        isProtectedDataFetchReady,
        isCompletingOAuth,
        isConfigured: isDemoMode() || isSupabaseConfigured(),
        authLinkError,
        clearAuthLinkError,
        signIn,
        signInWithGoogle,
        signUp,
        signOut,
        deleteAccount,
        resendConfirmationEmail,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth(): SupabaseAuthContextValue {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  }
  return context;
}
