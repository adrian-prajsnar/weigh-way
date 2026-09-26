import * as QueryParams from 'expo-auth-session/build/QueryParams';

export function isOAuthCallbackUrl(url: string): boolean {
  if (!url.includes('auth/callback')) {
    return false;
  }

  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    return true;
  }

  return Boolean(params.code || (params.access_token && params.refresh_token));
}
