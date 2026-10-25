import { getAuthQueryParams } from './auth-query-params';

export function isOAuthCallbackUrl(url: string): boolean {
  if (!url.includes('auth/callback')) {
    return false;
  }

  const { params, errorCode } = getAuthQueryParams(url);
  if (errorCode) {
    return true;
  }

  return Boolean(params.code || (params.access_token && params.refresh_token));
}
