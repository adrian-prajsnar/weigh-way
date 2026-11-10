import { isNetworkError } from '../auth-errors';
import { t } from '../i18n';
import { reportSupabaseFailure } from '../report-error';
import { FetchAllRowsLimitError } from './fetch-all-rows';

type SupabaseRequestError = {
  message: string;
  code?: string;
};

function isSessionExpiredError(error: SupabaseRequestError): boolean {
  return error.code === 'PGRST301' || error.message.toLowerCase().includes('jwt expired');
}

/** No usable session: the user has to sign in again. */
export class SignedOutError extends Error {
  constructor() {
    super(t('errors.mustBeSignedIn'));
    this.name = 'SignedOutError';
  }
}

type ErrorFields = {
  message?: string;
  code?: string;
  name?: string;
};

function readErrorFields(error: unknown): ErrorFields {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const value = error as ErrorFields;
  return {
    message: typeof value.message === 'string' ? value.message : undefined,
    code: typeof value.code === 'string' ? value.code : undefined,
    name: typeof value.name === 'string' ? value.name : undefined,
  };
}

/** A read that can succeed if tried again after a cold start. */
export function isTransientLoadError(error: unknown): boolean {
  if (isNetworkError(error)) {
    return true;
  }

  const { message, code, name } = readErrorFields(error);
  if (name === 'AuthRetryableFetchError') {
    return true;
  }

  // PGRST303: a just-refreshed token is briefly "issued at future".
  // PGRST301: the read used an expired token before refresh finished.
  // PGRST000: PostgREST cannot reach the database yet.
  if (code === 'PGRST303' || code === 'PGRST301' || code === 'PGRST000') {
    return true;
  }

  const normalized = message?.toLowerCase() ?? '';
  return (
    normalized.includes('jwt expired') ||
    normalized.includes('jwt issued at future') ||
    normalized.includes('database connection error')
  );
}

export function isJwtExpiredError(error: unknown): boolean {
  const fields = readErrorFields(error);
  return isSessionExpiredError({
    message: fields.message ?? '',
    code: fields.code,
  });
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
    error.code ?? (isSessionExpiredError(error) ? 'session_expired' : undefined) ?? 'unknown';

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
    return new Error(__DEV__ ? t('errors.databasePermissionDev') : t('errors.databasePermission'));
  }

  if (isSessionExpiredError(requestError)) {
    return new Error(t('errors.sessionExpired'));
  }

  return new Error(t('errors.couldNotLoadData'));
}

export function toSupabaseErrorFromUnknown(error: unknown): Error {
  if (error instanceof SignedOutError) {
    return error;
  }

  if (error instanceof FetchAllRowsLimitError) {
    return toSupabaseError(error);
  }

  if (error instanceof Error) {
    if (isNetworkError(error)) {
      return new Error(t('errors.noConnection'));
    }
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return toSupabaseError(error as SupabaseRequestError);
  }

  return new Error(t('errors.couldNotLoadData'));
}
