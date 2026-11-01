import { LanguagePreference } from '../storage/language-preference';

export type AppLocale = 'en' | 'pl';

export function resolveAppLocale(
  preference: LanguagePreference,
  locales: { languageCode?: string | null }[],
  demoLocale: AppLocale | null = null,
): AppLocale {
  if (demoLocale) {
    return demoLocale;
  }
  if (preference === 'en' || preference === 'pl') {
    return preference;
  }
  const languageCode = locales[0]?.languageCode?.toLowerCase();
  return languageCode === 'pl' ? 'pl' : 'en';
}

export function getDateLocale(locale: AppLocale): string {
  return locale === 'pl' ? 'pl-PL' : 'en-US';
}
