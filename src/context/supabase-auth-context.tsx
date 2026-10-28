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
import { signOutSession, signOutSessionBestEffort } from '../supabase/sign-out-session';
import { validateRestoredSessionInBackground } from '../supabase/validate-restored-session';
import { createDemoSession } from '../demo/demo-session';
import { isDemoMode } from '../demo/is-demo-mode';
import { demoReadOnlyError } from '../demo/read-only';

export const BOOTSTRAP_SESSION_DEADLINE_MS = 6000;

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
  const [isRestoredSessionValidationPending, setIsRestoredSessionValidationPending] =
    useState(false);
  const completingSignUpRef = useRef(false);
  const authEventGenerationRef = useRef(0);

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

    const bootstrapGeneration = authEventGenerationRef.current;
    let accessTokenAtStart: string | null = null;
    let userIdAtStart: string | null = null;
    let refreshTokenAtStart: string | null = null;
    let flagged = false;
    let storageFlagged = false;
    let sessionApplied = false;
    let bootstrapFinished = false;
    let flaggedDeadlineHandled = false;
    let deadlineTimer: ReturnType<typeof setTimeout> | null = null;

    const clearBootstrapDeadline = () => {
      if (deadlineTimer) {
        clearTimeout(deadlineTimer);
        deadlineTimer = null;
      }
    };

    const finishBootstrapLoading = () => {
      setIsRestoredSessionValidationPending(false);
      setIsLoading(false);
    };

    const shouldRunFailClosedSignOut = async (): Promise<boolean> => {
      if (authEventGenerationRef.current !== bootstrapGeneration) {
        return false;
      }
      if (!accessTokenAtStart && !userIdAtStart) {
        return true;
      }
      const { data } = await supabase.auth.getSession().catch(() => ({
        data: { session: null as Session | null },
      }));
      const currentUserId = data.session?.user?.id ?? null;
      if (!currentUserId) {
        return true;
      }
      if (!userIdAtStart) {
        return true;
      }
      return currentUserId === userIdAtStart;
    };

    const runFailClosedSignOutBestEffort = () => {
      void (async () => {
        if (!(await shouldRunFailClosedSignOut())) {
          return;
        }
        signOutSessionBestEffort(accessTokenAtStart, {
          forcePersistSignedOut: true,
          userId: userIdAtStart,
          refreshToken: refreshTokenAtStart,
        });
      })();
    };

    const hydrateSessionFromAuthStorage = async () => {
      const key = getSupabaseAuthStorage().getLastSeenPrimaryAuthSessionKey();
      if (!key) {
        return;
      }
      const raw = await getSupabaseAuthStorage().getItem(key);
      if (!raw) {
        return;
      }
      try {
        const restored = JSON.parse(raw) as Session;
        if (
          restored.access_token &&
          authEventGenerationRef.current === bootstrapGeneration
        ) {
          setSession(restored);
          sessionApplied = true;
        }
      } catch {
        // Ignore corrupt session payloads.
      }
    };

    const failClosedAfterFlaggedDeadline = () => {
      setSession(null);
      finishBootstrapLoading();
      runFailClosedSignOutBestEffort();
    };

    deadlineTimer = setTimeout(() => {
      if (bootstrapFinished) {
        return;
      }
      if (flagged || storageFlagged) {
        flaggedDeadlineHandled = true;
        failClosedAfterFlaggedDeadline();
        return;
      }
      finishBootstrapLoading();
      if (!sessionApplied) {
        void hydrateSessionFromAuthStorage();
      }
    }, BOOTSTRAP_SESSION_DEADLINE_MS);

    const { data: subscription } = supabase.auth.onAuthStateChange((event, activeSession) => {
      if (event !== 'INITIAL_SESSION') {
        authEventGenerationRef.current += 1;
      }
      setSession(activeSession);
      if (event === 'PASSWORD_RECOVERY' && activeSession) {
        setIsPasswordRecovery(true);
      }
      if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
        setIsRestoredSessionValidationPending(false);
        void clearAuthPendingFlows();
        resetOAuthRedirectState();
      }
      if (
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') &&
        activeSession
      ) {
        setIsRestoredSessionValidationPending(false);
        setIsLoading(false);
        clearBootstrapDeadline();
        void clearAuthPendingFlows();
      }
    });

    void (async () => {
      try {
        storageFlagged = await getSupabaseAuthStorage().restoredSessionNeedsServerValidation();
        const sessionResult = await supabase.auth.getSession().catch(() => ({
          data: { session: null as Session | null },
        }));
        const activeSession = sessionResult.data.session;
        if (!activeSession) {
          if (authEventGenerationRef.current === bootstrapGeneration) {
            setSession(null);
          }
          sessionApplied = true;
          return;
        }

        accessTokenAtStart = activeSession.access_token;
        userIdAtStart = activeSession.user?.id ?? null;
        refreshTokenAtStart = activeSession.refresh_token ?? null;
        flagged = await getSupabaseAuthStorage().restoredSessionNeedsServerValidation();
        if (!flagged) {
          if (authEventGenerationRef.current === bootstrapGeneration) {
            setSession(activeSession);
          }
          sessionApplied = true;
          void validateRestoredSessionInBackground();
          return;
        }

        setIsRestoredSessionValidationPending(true);
        await validateRestoredSessionInBackground();
        if (!flaggedDeadlineHandled && authEventGenerationRef.current === bootstrapGeneration) {
          const afterSession = await supabase.auth.getSession().catch(() => ({
            data: { session: null as Session | null },
          }));
          setSession(afterSession.data.session);
        }
        sessionApplied = true;
      } catch {
        if (authEventGenerationRef.current === bootstrapGeneration) {
          setSession(null);
        }
        sessionApplied = true;
      } finally {
        bootstrapFinished = true;
        clearBootstrapDeadline();
        finishBootstrapLoading();
        void refreshSessionOnForeground();
      }
    })();

    void Linking.getInitialURL().then((url) => {
      if (url) {
        void handleAuthUrl(url);
      }
    });

    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleAuthUrl(url);
    });

    return () => {
      clearBootstrapDeadline();
      unregisterStorageRecovery();
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
        await signOutSession({
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token ?? null,
          userId: data.session.user?.id ?? null,
        });
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

    const accessToken = session?.access_token ?? null;
    let persistWarning = false;
    let serverSignOutUnreachable = false;
    try {
      const result = await signOutSession({
        accessToken,
        refreshToken: session?.refresh_token ?? null,
        userId: session?.user?.id ?? null,
      });
      serverSignOutUnreachable = result.serverSignOutUnreachable;
    } catch (error) {
      throw new Error(formatSignOutError(error));
    } finally {
      resetOAuthRedirectState();
      await clearAuthPendingFlows();
      await clearPkceVerifierBackups();
      persistWarning = getSupabaseAuthStorage().consumeSignOutPersistWarning();
    }
    if (persistWarning) {
      throw new Error(
        formatSignOutPersistWarning({
          localPersistFailed: true,
          serverSignOutUnreachable,
        }),
      );
    }
    if (serverSignOutUnreachable) {
      throw new Error(formatSignOutPersistWarning({ serverSignOutUnreachable: true }));
    }
  }, [session]);

  const deleteAccount = useCallback(async () => {
    if (isDemoMode()) {
      throw demoReadOnlyError();
    }

    const { error } = await supabase.rpc('delete_own_account');
    if (error) {
      throw new Error(formatDeleteAccountError(error));
    }

    const accessToken = session?.access_token ?? null;
    let persistWarning = false;
    try {
      await signOutSession({
        accessToken,
        refreshToken: session?.refresh_token ?? null,
        userId: session?.user?.id ?? null,
      });
    } finally {
      resetOAuthRedirectState();
      await clearAuthPendingFlows();
      await clearPkceVerifierBackups();
      persistWarning = getSupabaseAuthStorage().consumeSignOutPersistWarning();
    }
    if (persistWarning) {
      throw new Error(formatSignOutPersistWarning({ localPersistFailed: true }));
    }
  }, [session]);

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
