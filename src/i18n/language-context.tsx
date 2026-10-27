import { useLocales } from 'expo-localization';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { getDemoLocaleFromUrl } from '../demo/demo-locale';
import { isDemoMode } from '../demo/is-demo-mode';
import {
  getLanguagePreference,
  LanguagePreference,
  setStoredLanguagePreference,
} from '../storage/language-preference';
import {
  setI18nLocale,
  translateForLocale,
  TranslationKey,
  TranslateOptions,
} from './index';
import { AppLocale } from './resolve-locale';

type LanguageContextValue = {
  locale: AppLocale;
  preference: LanguagePreference;
  setPreference: (next: LanguagePreference) => Promise<void>;
  t: (scope: TranslationKey, options?: TranslateOptions) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readDemoLocale(): AppLocale | null {
  if (!isDemoMode() || typeof window === 'undefined') {
    return null;
  }
  return getDemoLocaleFromUrl(window.location.search);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const locales = useLocales();
  const demoLocale = readDemoLocale();
  const [preference, setPreferenceState] = useState<LanguagePreference>(
    demoLocale ?? 'system',
  );
  const [preferenceReady, setPreferenceReady] = useState(Boolean(demoLocale));

  useEffect(() => {
    if (demoLocale) {
      setPreferenceState(demoLocale);
      setPreferenceReady(true);
      return;
    }
    void getLanguagePreference().then((stored) => {
      setPreferenceState(stored);
      setPreferenceReady(true);
    });
  }, [demoLocale]);

  const locale = useMemo(() => {
    if (demoLocale) {
      return demoLocale;
    }
    if (preference === 'system') {
      const languageCode = locales[0]?.languageCode?.toLowerCase();
      return languageCode === 'pl' ? 'pl' : 'en';
    }
    return preference;
  }, [demoLocale, preference, locales]);

  useLayoutEffect(() => {
    setI18nLocale(locale);
  }, [locale]);

  const setPreference = useCallback(
    async (next: LanguagePreference) => {
      const nextLocale: AppLocale =
        next === 'system'
          ? locales[0]?.languageCode?.toLowerCase() === 'pl'
            ? 'pl'
            : 'en'
          : next;

      setI18nLocale(nextLocale);
      setPreferenceState(next);
      await setStoredLanguagePreference(next);
    },
    [locales],
  );

  const t = useCallback(
    (scope: TranslationKey, options?: TranslateOptions) =>
      translateForLocale(scope, locale, options),
    [locale],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      preference,
      setPreference,
      t,
    }),
    [locale, preference, setPreference, t],
  );

  if (!preferenceReady) {
    return null;
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

export function useTranslation() {
  const { t, locale, preference, setPreference } = useLanguage();
  return { t, locale, preference, setPreference };
}
