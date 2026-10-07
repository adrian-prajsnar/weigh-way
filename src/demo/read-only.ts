import { t } from '../i18n';

export function demoReadOnlyError(): Error {
  return new Error(t('demo.authUnavailable'));
}
