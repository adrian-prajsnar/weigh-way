import { Session } from '@supabase/supabase-js';
import { t } from './i18n';

const DEV_EMAIL_MARKER = '+dev';
const DEV_FLAG_DEFAULT = true;

function readDevFlag(): boolean {
  const value = process.env.EXPO_PUBLIC_DEV;
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return DEV_FLAG_DEFAULT;
}

/** Dev-mode flag for local restrictions (e.g. +dev emails). Defaults to true; override with EXPO_PUBLIC_DEV. */
export function isDevFlagEnabled(): boolean {
  return readDevFlag();
}

export function isDevAuthGuardActive(): boolean {
  return __DEV__ && isDevFlagEnabled();
}

export function isDevAllowedEmail(email: string): boolean {
  return email.trim().toLowerCase().includes(DEV_EMAIL_MARKER);
}

export function assertDevAllowedEmail(email: string): void {
  if (!isDevAuthGuardActive()) {
    return;
  }

  if (!isDevAllowedEmail(email)) {
    throw new Error(t('auth.devEmailRequired'));
  }
}

export function isDevAllowedSession(session: Session | null): boolean {
  if (!session || !isDevAuthGuardActive()) {
    return true;
  }

  return isDevAllowedEmail(session.user.email ?? '');
}

export function assertDevAllowedSession(session: Session | null): void {
  if (!session || isDevAllowedSession(session)) {
    return;
  }

  throw new Error(t('auth.devEmailRequired'));
}
