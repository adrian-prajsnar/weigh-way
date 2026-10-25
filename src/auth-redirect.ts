import * as Linking from 'expo-linking';
import { getAuthCallbackErrorMessage, getAuthQueryParams } from './auth-query-params';
import { isAuthCallbackUrl } from './auth-callback-url';
import {
  clearAuthPendingFlows,
  clearEmailConfirmationPending,
  clearPasswordResetPending,
  isEmailConfirmationPending,
  isPasswordResetPending,
  markEmailConfirmationPending,
  markPasswordResetPending,
} from './storage/auth-pending-flow';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase/client';

WebBrowser.maybeCompleteAuthSession();

const PKCE_FLOW_ID_PARAM = 'sb_flow_id';
const OAUTH_FLOW_TIMEOUT_MS = 15 * 60 * 1000;

let oauthFlowActive = false;
let oauthFlowExpectedUntil = 0;
let expectedOAuthFlowId: string | null = null;
let activeOAuthExchange: Promise<void> | null = null;
let activeOAuthUrl: string | null = null;
let lastExchangedCode: string | null = null;

export function getAuthRedirectUrl(): string {
  return Linking.createURL('auth/callback');
}

export function isOAuthFlowActive(): boolean {
  return oauthFlowActive;
}

export {
  markEmailConfirmationPending,
  markPasswordResetPending,
  clearAuthPendingFlows,
};

export function beginOAuthFlowExpectation(flowId: string | null | undefined): void {
  oauthFlowExpectedUntil = Date.now() + OAUTH_FLOW_TIMEOUT_MS;
  expectedOAuthFlowId = flowId ?? null;
}

function isOAuthFlowExpectationActive(): boolean {
  if (Date.now() > oauthFlowExpectedUntil) {
    oauthFlowExpectedUntil = 0;
    expectedOAuthFlowId = null;
    return false;
  }
  return oauthFlowExpectedUntil > 0;
}

function clearOAuthFlowExpectation(): void {
  oauthFlowExpectedUntil = 0;
  expectedOAuthFlowId = null;
}

export function resetOAuthRedirectState(): void {
  oauthFlowActive = false;
  clearOAuthFlowExpectation();
  activeOAuthExchange = null;
  activeOAuthUrl = null;
  lastExchangedCode = null;
}

export async function shouldHandleAuthDeepLink(url: string): Promise<boolean> {
  if (!isAuthCallbackUrl(url)) {
    return false;
  }

  if (getAuthCallbackErrorMessage(url)) {
    return true;
  }

  const { params } = getAuthQueryParams(url);
  if (params.code) {
    return (
      oauthFlowActive ||
      isOAuthFlowExpectationActive() ||
      (await isEmailConfirmationPending()) ||
      (await isPasswordResetPending())
    );
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  if (accessToken && refreshToken) {
    return (await isEmailConfirmationPending()) || (await isPasswordResetPending());
  }

  return false;
}

export type OAuthSignInResult = 'success' | 'cancelled';

export async function performOAuthSignIn(provider: 'google'): Promise<OAuthSignInResult> {
  const redirectTo = getAuthRedirectUrl();
  oauthFlowActive = true;

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      throw error;
    }

    if (!data.url) {
      throw new Error('missing_oauth_url');
    }

    beginOAuthFlowExpectation(data.flowId);

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
      createTask: true,
      useProxyActivity: false,
      showInRecents: false,
    });
    if (result.type !== 'success') {
      clearOAuthFlowExpectation();
      return 'cancelled';
    }

    await createSessionFromUrl(result.url);
    return 'success';
  } finally {
    oauthFlowActive = false;
  }
}

export function isPasswordRecoveryUrl(url: string): boolean {
  if (!isAuthCallbackUrl(url)) {
    return false;
  }
  const { params } = getAuthQueryParams(url);
  return params.type === 'recovery';
}

async function assertPkceCodeExchangeAllowed(params: Record<string, string>): Promise<void> {
  if (oauthFlowActive || isOAuthFlowExpectationActive()) {
    const callbackFlowId = params[PKCE_FLOW_ID_PARAM] ?? null;
    if (expectedOAuthFlowId && callbackFlowId && callbackFlowId !== expectedOAuthFlowId) {
      throw new Error('auth_oauth_flow_mismatch');
    }
    return;
  }

  if (await isEmailConfirmationPending()) {
    return;
  }

  if (await isPasswordResetPending()) {
    return;
  }

  throw new Error('auth_callback_not_expected');
}

async function clearPendingFlowsForCallback(params: Record<string, string>): Promise<void> {
  if (params.type === 'recovery' || (await isPasswordResetPending())) {
    await clearPasswordResetPending();
    return;
  }
  await clearEmailConfirmationPending();
}

async function handleAuthCallbackUrl(url: string): Promise<void> {
  const callbackError = getAuthCallbackErrorMessage(url);
  if (callbackError) {
    throw new Error(callbackError);
  }

  const { params, errorCode } = getAuthQueryParams(url);
  if (errorCode) {
    throw new Error(errorCode);
  }

  const authCode = params.code;
  if (authCode) {
    if (authCode === lastExchangedCode) {
      return;
    }

    await assertPkceCodeExchangeAllowed(params);

    const flowId = params[PKCE_FLOW_ID_PARAM] ?? expectedOAuthFlowId ?? undefined;
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      authCode,
      flowId ? { flowId } : undefined,
    );
    if (exchangeError) {
      await clearAuthPendingFlows();
      throw exchangeError;
    }

    lastExchangedCode = authCode;
    await clearPendingFlowsForCallback(params);
    return;
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  if (accessToken && refreshToken) {
    const emailPending = await isEmailConfirmationPending();
    const resetPending = await isPasswordResetPending();
    if (!emailPending && !resetPending) {
      return;
    }

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      await clearAuthPendingFlows();
      throw error;
    }

    await clearPendingFlowsForCallback(params);
    return;
  }

  throw new Error('missing_auth_callback_params');
}

export async function createSessionFromUrl(url: string): Promise<void> {
  if (!(await shouldHandleAuthDeepLink(url))) {
    return;
  }

  if (activeOAuthUrl === url && activeOAuthExchange) {
    return activeOAuthExchange;
  }

  activeOAuthUrl = url;
  activeOAuthExchange = handleAuthCallbackUrl(url)
    .catch((error) => {
      clearOAuthFlowExpectation();
      throw error;
    })
    .finally(() => {
      clearOAuthFlowExpectation();
      if (activeOAuthUrl === url) {
        activeOAuthUrl = null;
        activeOAuthExchange = null;
      }
    });

  return activeOAuthExchange;
}
