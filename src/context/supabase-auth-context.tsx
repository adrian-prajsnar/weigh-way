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
  formatSignUpError,
  formatUpdatePasswordError,
} from '../auth-errors';
import { isOAuthCallbackUrl } from '../auth-oauth-callback';
import {
  clearAuthPendingFlows,
  createSessionFromUrl,
  getAuthRedirectUrl,
  isOAuthFlowActive,
  isPasswordRecoveryUrl,
  markEmailConfirmationPending,
  markPasswordResetPending,
  performOAuthSignIn,
  resetOAuthRedirectState,
} from '../auth-redirect';
import { registerSupabaseAppLifecycle, refreshSessionOnForeground } from '../supabase/app-lifecycle';
import { isSupabaseConfigured, supabase } from '../supabase/client';
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

const SESSION_BOOTSTRAP_TIMEOUT_MS = 4000;

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompletingOAuth, setIsCompletingOAuth] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);
  const completingSignUpRef = useRef(false);

  const isAuthenticated = Boolean(session) && !completingSignUpRef.current && !isPasswordRecovery;

  const clearAuthLinkError = useCallback(() => {
    setAuthLinkError(null);
  }, []);

  const handleAuthUrl = useCallback(async (url: string) => {
    if (isOAuthFlowActive() && isOAuthCallbackUrl(url)) {
      return;
    }

    const isRecovery = isPasswordRecoveryUrl(url);
    try {
      await createSessionFromUrl(url);
      if (isRecovery) {
        setIsPasswordRecovery(true);
      }
    } catch (error) {
      setAuthLinkError(formatAuthLinkError(error, { isPasswordRecovery: isRecovery }));
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

    // Never block the splash on a slow or unreachable auth server: `getSession()`
    // retries a token refresh for up to 30s when the network is down.
    let isBootstrapSettled = false;
    const bootstrapTimeout = setTimeout(() => {
      if (!isBootstrapSettled) {
        setIsLoading(false);
      }
    }, SESSION_BOOTSTRAP_TIMEOUT_MS);

    void supabase.auth
      .getSession()
      .then(({ data: { session: activeSession } }) => {
        if (activeSession) {
          setSession(activeSession);
        }
      })
      .finally(() => {
        isBootstrapSettled = true;
        clearTimeout(bootstrapTimeout);
        setIsLoading(false);
        void refreshSessionOnForeground();
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, activeSession) => {
      setSession(activeSession);
      if (event === 'PASSWORD_RECOVERY' && activeSession) {
        setIsPasswordRecovery(true);
      }
      if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
        void clearAuthPendingFlows();
        resetOAuthRedirectState();
      }
      if (event === 'SIGNED_IN' && activeSession) {
        void clearAuthPendingFlows();
      }
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
      clearTimeout(bootstrapTimeout);
      subscription.subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, [handleAuthUrl]);

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
        await supabase.auth.signOut();
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

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(formatSignOutError(error));
    }

    resetOAuthRedirectState();
    await clearAuthPendingFlows();
  }, []);

  const deleteAccount = useCallback(async () => {
    if (isDemoMode()) {
      throw demoReadOnlyError();
    }

    const { error } = await supabase.rpc('delete_own_account');
    if (error) {
      throw new Error(formatDeleteAccountError(error));
    }

    await supabase.auth.signOut({ scope: 'local' });
    resetOAuthRedirectState();
    await clearAuthPendingFlows();
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
        isLoading,
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
