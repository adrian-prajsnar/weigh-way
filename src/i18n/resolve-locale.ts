import { getLocales } from 'expo-localization';
import { LanguagePreference } from '../storage/language-preference';

export type AppLocale = 'en' | 'pl';

export function getDeviceLocale(): AppLocale {
  const languageCode = getLocales()[0]?.languageCode?.toLowerCase();
  return languageCode === 'pl' ? 'pl' : 'en';
}

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

export function resolveLocale(preference: LanguagePreference): AppLocale {
  return resolveAppLocale(preference, getLocales(), null);
}

export function getDateLocale(locale: AppLocale): string {
  return locale === 'pl' ? 'pl-PL' : 'en-US';
}
