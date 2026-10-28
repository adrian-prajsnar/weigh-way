import { isNetworkError } from '../auth-errors';

/** Network, timeout, or retryable server errors during auth HTTP calls. */
export function isAuthServerUnreachableError(error: unknown): boolean {
  if (isNetworkError(error)) {
    return true;
  }
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const authError = error as { status?: number; name?: string; code?: string };
  if (authError.name === 'AuthRetryableFetchError') {
    return true;
  }
  const status = authError.status;
  return status === 0 || (typeof status === 'number' && status >= 500);
}

export function isRefreshInvalidGrantError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const authError = error as {
    status?: number;
    code?: string;
    message?: string;
    error?: string;
  };
  if (authError.status !== 400) {
    return false;
  }
  const code = authError.code ?? authError.error ?? '';
  if (
    code === 'invalid_grant' ||
    code === 'refresh_token_not_found' ||
    code === 'refresh_token_already_used'
  ) {
    return true;
  }
  const message = (authError.message ?? '').toLowerCase();
  if (message.includes('invalid_grant') || message.includes('refresh_token')) {
    return true;
  }
  if (message.includes('refresh') && message.includes('invalid')) {
    return true;
  }
  return false;
}

export function isRefreshRateLimitedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  return (error as { status?: number }).status === 429;
}
