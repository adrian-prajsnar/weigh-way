import { isNetworkError } from '../auth-errors';
import { t } from '../i18n';
import { reportSupabaseFailure } from '../report-error';
import { FetchAllRowsLimitError } from './fetch-all-rows';

type SupabaseRequestError = {
  message: string;
  code?: string;
};

export function isJwtClockSkewError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as SupabaseRequestError;

  if (candidate.code === 'PGRST303') {
    return true;
  }

  return candidate.message?.toLowerCase().includes('jwt issued at future') ?? false;
}

function isSessionExpiredError(error: SupabaseRequestError): boolean {
  return error.code === 'PGRST301' || error.message.toLowerCase().includes('jwt expired');
}

function isOfflineSupabaseError(error: SupabaseRequestError): boolean {
  if (isNetworkError(error)) {
    return true;
  }

  const message = error.message?.toLowerCase() ?? '';
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('fetch failed') ||
    message.includes('timeout')
  );
}

function reportMappedFailure(error: SupabaseRequestError): void {
  if (isOfflineSupabaseError(error)) {
    return;
  }

  const code =
    error.code ??
    (isJwtClockSkewError(error) ? 'jwt_clock_skew' : undefined) ??
    (isSessionExpiredError(error) ? 'session_expired' : undefined) ??
    'unknown';

  reportSupabaseFailure(code);
}

export function toSupabaseError(error: SupabaseRequestError | unknown): Error {
  if (error instanceof FetchAllRowsLimitError) {
    reportMappedFailure({ message: 'fetch_all_rows_limit_exceeded', code: 'fetch_all_rows_limit' });
    return new Error(t('errors.dataTooLarge'));
  }

  const requestError = error as SupabaseRequestError;
  reportMappedFailure(requestError);

  if (isNetworkError(requestError)) {
    return new Error(t('errors.noConnection'));
  }

  if (requestError.message?.toLowerCase().includes('permission denied')) {
    return new Error(
      __DEV__ ? t('errors.databasePermissionDev') : t('errors.databasePermission'),
    );
  }

  if (isJwtClockSkewError(requestError)) {
    return new Error(t('errors.jwtClockSkew'));
  }

  if (isSessionExpiredError(requestError)) {
    return new Error(t('errors.sessionExpired'));
  }

  return new Error(t('errors.couldNotLoadData'));
}

export function toSupabaseErrorFromUnknown(error: unknown): Error {
  if (error instanceof Error) {
    if (isNetworkError(error)) {
      return new Error(t('errors.noConnection'));
    }

    if (!isJwtClockSkewError(error)) {
      return new Error(t('errors.couldNotLoadData'));
    }
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return toSupabaseError(error as SupabaseRequestError);
  }

  return new Error(t('errors.couldNotLoadData'));
}

