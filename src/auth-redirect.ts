import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase/client';

WebBrowser.maybeCompleteAuthSession();

let oauthFlowActive = false;
let activeOAuthExchange: Promise<void> | null = null;
let activeOAuthUrl: string | null = null;
let lastExchangedCode: string | null = null;

export function getAuthRedirectUrl(): string {
  return Linking.createURL('auth/callback');
}

export function isOAuthFlowActive(): boolean {
  return oauthFlowActive;
}

export function resetOAuthRedirectState(): void {
  oauthFlowActive = false;
  activeOAuthExchange = null;
  activeOAuthUrl = null;
  lastExchangedCode = null;
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

    // Android defaults to BrowserProxyActivity (singleTop). It ignores the next
    // launch, so Google stays on a spinner until the process is killed.
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
      createTask: true,
      useProxyActivity: false,
      showInRecents: false,
    });
    if (result.type !== 'success') {
      return 'cancelled';
    }

    await createSessionFromUrl(result.url);
    return 'success';
  } finally {
    oauthFlowActive = false;
  }
}

export function isPasswordRecoveryUrl(url: string): boolean {
  const { params } = QueryParams.getQueryParams(url);
  return params.type === 'recovery';
}

async function exchangeSessionFromUrl(url: string): Promise<void> {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    throw new Error(errorCode);
  }

  const authCode = params.code;
  if (authCode) {
    if (authCode === lastExchangedCode) {
      return;
    }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
    if (exchangeError) {
      throw exchangeError;
    }

    lastExchangedCode = authCode;
    return;
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  if (!accessToken || !refreshToken) {
    throw new Error('missing_oauth_tokens');
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }
}

export async function createSessionFromUrl(url: string): Promise<void> {
  if (activeOAuthUrl === url && activeOAuthExchange) {
    return activeOAuthExchange;
  }

  activeOAuthUrl = url;
  activeOAuthExchange = exchangeSessionFromUrl(url).finally(() => {
    if (activeOAuthUrl === url) {
      activeOAuthUrl = null;
      activeOAuthExchange = null;
    }
  });

  return activeOAuthExchange;
}
