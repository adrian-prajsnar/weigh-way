import { getAuthCallbackErrorMessage, getAuthQueryParams } from './auth-query-params';
import { isAuthCallbackUrl } from './auth-callback-url';

export { isAuthCallbackUrl } from './auth-callback-url';

export function isOAuthCallbackUrl(url: string): boolean {
  if (!isAuthCallbackUrl(url)) {
    return false;
  }

  if (getAuthCallbackErrorMessage(url)) {
    return true;
  }

  const { params } = getAuthQueryParams(url);
  return Boolean(params.code);
}

export function isPasswordRecoveryCallback(url: string): boolean {
  if (!isAuthCallbackUrl(url)) {
    return false;
  }
  const { params } = getAuthQueryParams(url);
  return params.type === 'recovery';
}
