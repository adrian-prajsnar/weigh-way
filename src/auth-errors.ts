import { t } from './i18n';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
}

export function isNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('fetch failed') ||
    message.includes('timeout')
  );
}

function mapNetworkError(error: unknown): string | null {
  if (isNetworkError(error)) {
    return t('errors.noConnection');
  }
  return null;
}

export function isEmailNotConfirmedError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.includes('email not confirmed') || message.includes('email_not_confirmed');
}

function isInvalidCredentialsError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.includes('invalid login credentials') || message.includes('invalid credentials');
}

function isUserAlreadyRegisteredError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.includes('user already registered') || message.includes('already been registered');
}

function isRateLimitError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return message.includes('rate limit') || message.includes('too many requests');
}

function isWeakPasswordError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: string; reasons?: unknown };
    if (candidate.code === 'weak_password' || Array.isArray(candidate.reasons)) {
      return true;
    }
  }

  const message = getErrorMessage(error);
  return (
    message.includes('password should') ||
    message.includes('password is known to be weak') ||
    message.includes('weak password')
  );
}

function isInvalidResetLinkError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes('otp_expired') ||
    message.includes('access_denied') ||
    message.includes('invalid') ||
    message.includes('expired')
  );
}

function getAuthErrorMessage(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message: unknown }).message).trim();
    return message.length > 0 ? message : null;
  }

  return null;
}

export function formatGoogleSignInError(error: unknown): string {
  const message = getAuthErrorMessage(error);
  if (message === t('auth.devEmailRequired')) {
    return message;
  }

  const network = mapNetworkError(error);
  if (network) {
    return network;
  }

  if (isRateLimitError(error)) {
    return t('auth.rateLimited');
  }

  if (__DEV__ && message) {
    return message;
  }

  return t('auth.googleSignInFailed');
}

export function formatSignInError(error: unknown): string {
  const network = mapNetworkError(error);
  if (network) {
    return network;
  }

  if (isEmailNotConfirmedError(error)) {
    return t('auth.confirmEmailFirst');
  }

  if (isInvalidCredentialsError(error)) {
    return t('auth.invalidCredentials');
  }

  if (isRateLimitError(error)) {
    return t('auth.rateLimited');
  }

  return t('auth.signInFailed');
}

export function formatSignUpError(error: unknown): string {
  const network = mapNetworkError(error);
  if (network) {
    return network;
  }

  if (isUserAlreadyRegisteredError(error)) {
    return t('auth.emailAlreadyRegistered');
  }

  if (isRateLimitError(error)) {
    return t('auth.rateLimited');
  }

  if (isWeakPasswordError(error)) {
    return t('auth.passwordRequirements');
  }

  return t('auth.signUpFailed');
}

export function formatResetPasswordError(error: unknown): string {
  const network = mapNetworkError(error);
  if (network) {
    return network;
  }

  if (isRateLimitError(error)) {
    return t('auth.rateLimited');
  }

  return t('auth.couldNotSendReset');
}

export function formatUpdatePasswordError(error: unknown): string {
  const network = mapNetworkError(error);
  if (network) {
    return network;
  }

  if (isWeakPasswordError(error)) {
    return t('auth.passwordRequirements');
  }

  return t('auth.couldNotUpdatePassword');
}

export function formatResendConfirmationError(error: unknown): string {
  const network = mapNetworkError(error);
  if (network) {
    return network;
  }

  if (isRateLimitError(error)) {
    return t('auth.rateLimited');
  }

  return t('auth.couldNotResend');
}

export function formatSignOutError(error: unknown): string {
  const network = mapNetworkError(error);
  if (network) {
    return network;
  }

  return t('profile.signOutFailed');
}

export function formatDeleteAccountError(error: unknown): string {
  const network = mapNetworkError(error);
  if (network) {
    return network;
  }

  return t('profile.deleteFailed');
}

export function formatAuthLinkError(error: unknown): string {
  const network = mapNetworkError(error);
  if (network) {
    return network;
  }

  if (isInvalidResetLinkError(error)) {
    return t('auth.resetLinkInvalid');
  }

  return t('auth.resetLinkInvalid');
}
