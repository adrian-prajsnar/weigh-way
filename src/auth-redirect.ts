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
import {
  clearOAuthFlowExpectationStorage,
  OAUTH_FLOW_EXPECTATION_TTL_MS,
  persistOAuthFlowExpectation,
  readOAuthFlowExpectation,
} from './storage/oauth-flow-expectation';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase/client';

WebBrowser.maybeCompleteAuthSession();

const PKCE_FLOW_ID_PARAM = 'sb_flow_id';

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
  oauthFlowExpectedUntil = Date.now() + OAUTH_FLOW_EXPECTATION_TTL_MS;
  expectedOAuthFlowId = flowId ?? null;
  void persistOAuthFlowExpectation(flowId, oauthFlowExpectedUntil);
}

async function hydrateOAuthFlowExpectationFromStorage(): Promise<boolean> {
  if (Date.now() <= oauthFlowExpectedUntil) {
    return oauthFlowExpectedUntil > 0;
  }

  const stored = await readOAuthFlowExpectation();
  if (!stored) {
    oauthFlowExpectedUntil = 0;
    expectedOAuthFlowId = null;
    return false;
  }

  oauthFlowExpectedUntil = stored.expiresAt;
  expectedOAuthFlowId = stored.flowId;
  return true;
}

async function isOAuthFlowExpectationActive(): Promise<boolean> {
  if (Date.now() > oauthFlowExpectedUntil) {
    return hydrateOAuthFlowExpectationFromStorage();
  }
  return oauthFlowExpectedUntil > 0;
}

function clearInMemoryOAuthFlowExpectation(): void {
  oauthFlowExpectedUntil = 0;
  expectedOAuthFlowId = null;
}

export function resetOAuthRedirectState(): void {
  oauthFlowActive = false;
  clearInMemoryOAuthFlowExpectation();
  activeOAuthExchange = null;
  activeOAuthUrl = null;
  lastExchangedCode = null;
  void clearOAuthFlowExpectationStorage();
}

async function isCodeExchangeAllowed(): Promise<boolean> {
  if (oauthFlowActive) {
    return true;
  }
  if (await isOAuthFlowExpectationActive()) {
    return true;
  }
  if (await isEmailConfirmationPending()) {
    return true;
  }
  if (await isPasswordResetPending()) {
    return true;
  }
  return false;
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
    return await isCodeExchangeAllowed();
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
      clearInMemoryOAuthFlowExpectation();
      await clearOAuthFlowExpectationStorage();
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
  if (oauthFlowActive || (await isOAuthFlowExpectationActive())) {
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
  if (params.type === 'recovery') {
    await clearPasswordResetPending();
    return;
  }
  if (await isPasswordResetPending()) {
    await clearPasswordResetPending();
    return;
  }
  await clearEmailConfirmationPending();
}

function mapExchangeError(error: unknown): Error {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message).toLowerCase()
      : error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();
  if (
    message.includes('code verifier') ||
    message.includes('pkce') ||
    message.includes('flow state') ||
    message.includes('invalid flow state')
  ) {
    return new Error('auth_pkce_verifier_missing');
  }
  return error instanceof Error ? error : new Error(String(error));
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
  if (!authCode) {
    throw new Error('missing_auth_callback_params');
  }

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
    throw mapExchangeError(exchangeError);
  }

  lastExchangedCode = authCode;
  await clearPendingFlowsForCallback(params);
  await clearOAuthFlowExpectationStorage();
  clearInMemoryOAuthFlowExpectation();
}

export async function createSessionFromUrl(url: string): Promise<void> {
  if (!isAuthCallbackUrl(url)) {
    return;
  }

  const { params } = getAuthQueryParams(url);
  const hasCode = Boolean(params.code);
  const hasCallbackError = Boolean(getAuthCallbackErrorMessage(url));

  if (hasCode && !(await isCodeExchangeAllowed())) {
    throw new Error('auth_callback_not_expected');
  }

  if (!hasCallbackError && !hasCode) {
    return;
  }

  if (!(await shouldHandleAuthDeepLink(url))) {
    return;
  }

  if (activeOAuthUrl === url && activeOAuthExchange) {
    return activeOAuthExchange;
  }

  activeOAuthUrl = url;
  activeOAuthExchange = handleAuthCallbackUrl(url).finally(() => {
    if (activeOAuthUrl === url) {
      activeOAuthUrl = null;
      activeOAuthExchange = null;
    }
  });

  return activeOAuthExchange;
}
