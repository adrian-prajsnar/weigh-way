import { I18n } from 'i18n-js';
import en from './locales/en';
import pl from './locales/pl';
import { AppLocale } from './resolve-locale';
import { TranslateOptions, TranslationKey } from './translation-keys';

export type TranslationTree = typeof en;
export type { TranslationKey, TranslateOptions } from './translation-keys';

function polishPluralKeys(_i18n: I18n, count: number): string[] {
  const absolute = Math.abs(count);
  const mod10 = absolute % 10;
  const mod100 = absolute % 100;

  if (absolute === 1) {
    return ['one', 'other'];
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return ['few', 'other'];
  }

  return ['many', 'other'];
}

const i18n = new I18n({ en, pl });

i18n.defaultLocale = 'en';
i18n.locale = 'en';
i18n.enableFallback = true;
i18n.pluralization.register('pl', polishPluralKeys);

export function setI18nLocale(locale: AppLocale): void {
  i18n.locale = locale;
}

export function getI18nLocale(): AppLocale {
  return i18n.locale === 'pl' ? 'pl' : 'en';
}

export function t(scope: TranslationKey, options?: TranslateOptions): string {
  const localeOverride = options?.locale;
  if (localeOverride === 'en' || localeOverride === 'pl') {
    const { locale: _locale, ...rest } = options ?? {};
    return i18n.t(scope, { ...rest, locale: localeOverride });
  }
  return i18n.t(scope, options);
}

export function translateForLocale(
  scope: TranslationKey,
  locale: AppLocale,
  options?: TranslateOptions,
): string {
  const { locale: _locale, ...rest } = options ?? {};
  return i18n.t(scope, { ...rest, locale });
}

export { i18n };
