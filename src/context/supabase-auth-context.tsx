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
  createSessionFromUrl,
  getAuthRedirectUrl,
  isOAuthFlowActive,
  isPasswordRecoveryUrl,
  performOAuthSignIn,
  resetOAuthRedirectState,
} from '../auth-redirect';
import { assertDevAllowedEmail, assertDevAllowedSession, isDevAllowedSession } from '../dev-auth-guard';
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
      if (isRecovery) {
        setAuthLinkError(formatAuthLinkError(error));
      }
    }
  }, []);

  const acceptSession = useCallback(async (activeSession: Session | null): Promise<Session | null> => {
    if (activeSession && !isDevAllowedSession(activeSession)) {
      await supabase.auth.signOut();
      return null;
    }

    return activeSession;
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

    void supabase.auth
      .getSession()
      .then(({ data: { session: activeSession } }) => acceptSession(activeSession))
      .then((activeSession) => {
        setSession(activeSession);
      })
      .finally(() => {
        setIsLoading(false);
        void refreshSessionOnForeground();
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, activeSession) => {
      void acceptSession(activeSession).then((resolvedSession) => {
        setSession(resolvedSession);
        if (event === 'PASSWORD_RECOVERY' && resolvedSession) {
          setIsPasswordRecovery(true);
        }
        if (event === 'SIGNED_OUT') {
          setIsPasswordRecovery(false);
        }
      });
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
      subscription.subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, [handleAuthUrl, acceptSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    assertDevAllowedEmail(email);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(formatSignInError(error));
    }
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

      try {
        assertDevAllowedSession(activeSession);
      } catch (devError) {
        await supabase.auth.signOut();
        throw devError;
      }

      const resolvedSession = await acceptSession(activeSession);
      if (!resolvedSession) {
        throw new Error('missing_oauth_session');
      }

      setSession(resolvedSession);
      return true;
    } catch (error) {
      throw new Error(formatGoogleSignInError(error));
    } finally {
      setIsCompletingOAuth(false);
    }
  }, [acceptSession]);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    assertDevAllowedEmail(email);
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

      // Supabase may auto-login when email confirmation is disabled — sign out so the user logs in manually.
      await supabase.auth.signOut();

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
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl(),
    });

    if (error) {
      throw new Error(formatResetPasswordError(error));
    }
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
