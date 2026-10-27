import { describe, expect, it } from 'vitest';
import { setI18nLocale, t as translate, translateForLocale } from './index';
import { TranslationKey } from './translation-keys';

function buildLanguageOptions(t: (scope: TranslationKey) => string) {
  return [
    { value: 'system', label: t('profile.languageSystem') },
    { value: 'en', label: t('profile.languageEnglish') },
    { value: 'pl', label: t('profile.languagePolish') },
  ];
}

describe('language picker memos', () => {
  it('recomputes labels when t changes after an en to pl switch', () => {
    const enOptions = buildLanguageOptions((scope) => translateForLocale(scope, 'en'));
    const plOptions = buildLanguageOptions((scope) => translateForLocale(scope, 'pl'));

    expect(enOptions[1].label).toBe('English');
    expect(plOptions[1].label).toBe('Angielski');
    expect(enOptions[0].label).not.toBe(plOptions[0].label);
  });

  it('uses the bound locale even when global i18n is still on the previous language', () => {
    setI18nLocale('en');
    const tPl = (scope: TranslationKey) => translateForLocale(scope, 'pl');
    const options = buildLanguageOptions(tPl);
    expect(options[1].label).toBe('Angielski');
  });

  it('keeps stale labels when useMemo does not rerun after a locale switch', () => {
    setI18nLocale('en');
    const stableT = (scope: TranslationKey) => translate(scope);
    const memoized = buildLanguageOptions(stableT);

    setI18nLocale('pl');
    expect(memoized[1].label).toBe('English');

    const reboundT = (scope: TranslationKey) => translateForLocale(scope, 'pl');
    expect(buildLanguageOptions(reboundT)[1].label).toBe('Angielski');
  });
});
