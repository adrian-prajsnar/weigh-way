import * as Linking from 'expo-linking';
import { getAuthCallbackErrorMessage, getAuthQueryParams } from './auth-query-params';
import { isAuthCallbackUrl } from './auth-callback-url';
import {
  clearAuthPendingFlows,
  clearEmailConfirmationPending,
  clearPasswordResetPending,
  hasOverlappingEmailFlows,
  markEmailConfirmationPending,
  markPasswordResetPending,
  resolveEmailCallbackFlowKind,
} from './storage/auth-pending-flow';
import {
  backupLegacyVerifierForRollback,
  restoreLegacyVerifierForFlow,
  type PkceBackupKind,
} from './storage/pkce-verifier-backup';
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

type CallbackFlowKind = 'oauth' | 'signup' | 'recovery';

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

async function isOAuthExpectationActive(): Promise<boolean> {
  return oauthFlowActive || (await isOAuthFlowExpectationActive());
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

async function buildExchangeCandidates(params: Record<string, string>): Promise<CallbackFlowKind[]> {
  if (params[PKCE_FLOW_ID_PARAM]) {
    return ['oauth'];
  }

  const candidates: CallbackFlowKind[] = [];
  if (await isOAuthExpectationActive()) {
    candidates.push('oauth');
  }

  const emailKind = await resolveEmailCallbackFlowKind();
  if (emailKind) {
    candidates.push(emailKind);
  }

  return candidates;
}

async function isCodeExchangeAllowed(params: Record<string, string>): Promise<boolean> {
  return (await buildExchangeCandidates(params)).length > 0;
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
    return await isCodeExchangeAllowed(params);
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

function isVerifierExchangeError(error: unknown): boolean {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message).toLowerCase()
      : error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();

  return (
    message.includes('code verifier') ||
    message.includes('pkce') ||
    message.includes('flow state') ||
    message.includes('invalid flow state')
  );
}

function mapExchangeError(
  error: unknown,
  context: { flowKind: CallbackFlowKind; overlappingEmailFlows: boolean },
): Error {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message).toLowerCase()
      : error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();

  const isVerifierIssue = isVerifierExchangeError(error);

  if (context.overlappingEmailFlows && isVerifierIssue) {
    return new Error('auth_overlapping_email_flows');
  }

  if (isVerifierIssue) {
    return new Error('auth_pkce_verifier_missing');
  }

  if (context.flowKind === 'recovery') {
    return new Error('auth_recovery_link_exchange_failed');
  }
  if (context.flowKind === 'signup') {
    return new Error('auth_signup_link_exchange_failed');
  }

  return error instanceof Error ? error : new Error(String(error));
}

async function prepareEmailVerifier(kind: PkceBackupKind): Promise<void> {
  if (await restoreLegacyVerifierForFlow(kind)) {
    return;
  }

  if (await hasOverlappingEmailFlows()) {
    const alternate: PkceBackupKind = kind === 'signup' ? 'recovery' : 'signup';
    if (await restoreLegacyVerifierForFlow(alternate)) {
      return;
    }
  }

  throw new Error('auth_pkce_verifier_missing');
}

async function exchangeForFlowKind(
  kind: CallbackFlowKind,
  authCode: string,
  params: Record<string, string>,
): Promise<void> {
  if (kind === 'oauth') {
    const callbackFlowId = params[PKCE_FLOW_ID_PARAM] ?? null;
    if (expectedOAuthFlowId && callbackFlowId && callbackFlowId !== expectedOAuthFlowId) {
      throw new Error('auth_oauth_flow_mismatch');
    }
  }

  if (kind === 'signup' || kind === 'recovery') {
    await prepareEmailVerifier(kind);
  }

  const flowId =
    kind === 'oauth'
      ? params[PKCE_FLOW_ID_PARAM] ?? expectedOAuthFlowId ?? undefined
      : undefined;

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    authCode,
    flowId ? { flowId } : undefined,
  );

  if (exchangeError) {
    throw exchangeError;
  }
}

async function clearPendingForSuccessfulKind(kind: CallbackFlowKind): Promise<void> {
  if (kind === 'oauth') {
    await clearOAuthFlowExpectationStorage();
    clearInMemoryOAuthFlowExpectation();
    return;
  }

  if (kind === 'signup') {
    await clearEmailConfirmationPending();
    return;
  }

  await clearPasswordResetPending();
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

  const candidates = await buildExchangeCandidates(params);
  if (candidates.length === 0) {
    throw new Error('auth_callback_not_expected');
  }

  const overlappingEmailFlows = await hasOverlappingEmailFlows();
  let lastError: unknown = new Error('auth_callback_not_expected');

  for (let index = 0; index < candidates.length; index += 1) {
    const flowKind = candidates[index]!;
    const rollback = await backupLegacyVerifierForRollback();

    try {
      await exchangeForFlowKind(flowKind, authCode, params);
      lastExchangedCode = authCode;
      await clearPendingForSuccessfulKind(flowKind);
      return;
    } catch (error) {
      if (rollback) {
        await rollback();
      }
      lastError = error;

      const canTryNextCandidate =
        index < candidates.length - 1 && isVerifierExchangeError(error);
      if (canTryNextCandidate) {
        continue;
      }

      throw mapExchangeError(error, { flowKind, overlappingEmailFlows });
    }
  }

  throw mapExchangeError(lastError, {
    flowKind: candidates[candidates.length - 1]!,
    overlappingEmailFlows,
  });
}

export async function createSessionFromUrl(url: string): Promise<void> {
  if (!isAuthCallbackUrl(url)) {
    return;
  }

  const { params } = getAuthQueryParams(url);
  const authCode = params.code;
  const hasCallbackError = Boolean(getAuthCallbackErrorMessage(url));

  if (authCode && authCode === lastExchangedCode) {
    return;
  }

  if (authCode && !(await isCodeExchangeAllowed(params))) {
    throw new Error('auth_callback_not_expected');
  }

  if (!hasCallbackError && !authCode) {
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
