import { describe, expect, it } from 'vitest';
import { setI18nLocale, t as translate } from './index';
import { TranslationKey } from './translation-keys';

/** Mirrors LanguageProvider's useCallback(..., [locale]). */
function createTranslationForLocale(locale: 'en' | 'pl') {
  setI18nLocale(locale);
  return (scope: TranslationKey) => translate(scope);
}

function buildLanguageOptions(t: (scope: TranslationKey) => string) {
  return [
    { value: 'system', label: t('profile.languageSystem') },
    { value: 'en', label: t('profile.languageEnglish') },
    { value: 'pl', label: t('profile.languagePolish') },
  ];
}

describe('language picker memos', () => {
  it('recomputes labels when t changes after an en to pl switch', () => {
    const enT = createTranslationForLocale('en');
    const enOptions = buildLanguageOptions(enT);

    const plT = createTranslationForLocale('pl');
    const plOptions = buildLanguageOptions(plT);

    expect(enOptions[1].label).toBe('English');
    expect(plOptions[1].label).toBe('Angielski');
    expect(enOptions[0].label).not.toBe(plOptions[0].label);
  });

  it('keeps stale labels when useMemo does not rerun after a locale switch', () => {
    setI18nLocale('en');
    const stableT = (scope: TranslationKey) => translate(scope);
    const memoized = buildLanguageOptions(stableT);

    setI18nLocale('pl');
    expect(memoized[1].label).toBe('English');

    const reboundT = createTranslationForLocale('pl');
    expect(buildLanguageOptions(reboundT)[1].label).toBe('Angielski');
  });
});
