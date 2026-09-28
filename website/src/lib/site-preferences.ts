export const THEME_STORAGE_KEY = 'weigh-way-site/theme';
export const LANGUAGE_STORAGE_KEY = 'weigh-way-site/language';
export const SCROLL_STORAGE_KEY = 'weigh-way-site/preserve-scroll';

export type ThemePreference = 'system' | 'light' | 'dark';
export type LanguagePreference = 'system' | 'en' | 'pl';
export type ResolvedTheme = 'light' | 'dark';
export type ResolvedLanguage = 'en' | 'pl';

export function normalizeThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function normalizeLanguagePreference(value: string | null): LanguagePreference {
  return value === 'en' || value === 'pl' || value === 'system' ? value : 'system';
}

export function resolveThemePreference(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  return prefersDark ? 'dark' : 'light';
}

export function resolveLanguagePreference(
  preference: LanguagePreference,
  navigatorLanguage: string,
): ResolvedLanguage {
  if (preference === 'en' || preference === 'pl') {
    return preference;
  }
  const code = navigatorLanguage.toLowerCase();
  return code.startsWith('pl') ? 'pl' : 'en';
}

export function prefersDarkColorScheme(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function buildThemeBootstrapScript(): string {
  return `(function(){var themeKey='${THEME_STORAGE_KEY}';var pref=localStorage.getItem(themeKey);var theme;if(pref==='light'||pref==='dark'){theme=pref;}else{theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.add('js');document.documentElement.setAttribute('data-theme',theme);var meta=document.createElement('meta');meta.name='theme-color';meta.content=theme==='dark'?'#080B12':'#F4F5F8';document.head.appendChild(meta);})();`;
}

export function buildLanguageRedirectScript(pageLocale: string, baseUrl: string): string {
  const escapedLocale = JSON.stringify(pageLocale);
  const escapedBase = JSON.stringify(baseUrl);

  return `(function(){var key='${LANGUAGE_STORAGE_KEY}';var pref=localStorage.getItem(key);var target;if(pref==='en'||pref==='pl'){target=pref;}else{var lang=(navigator.language||'').toLowerCase();target=lang.indexOf('pl')===0?'pl':'en';}var pageLocale=${escapedLocale};if(target===pageLocale)return;var base=String(${escapedBase}).replace(/\\/$/,'');var rest=location.pathname.slice(base.length)||'/';if(rest.indexOf('/pl/')===0||rest==='/pl'){rest=rest.replace(/^\\/pl/,'')||'/';}if(rest.charAt(0)!=='/')rest='/'+rest;var next=base+(target==='pl'?'/pl':'')+rest;if(next.slice(-1)!=='/')next+='/';location.replace(next);})();`;
}

export function localeHref(
  locale: ResolvedLanguage,
  baseUrl: string,
  pathname: string,
): string {
  const base = baseUrl.replace(/\/$/, '');
  let rest = pathname.slice(base.length) || '/';
  if (rest.startsWith('/pl/') || rest === '/pl') {
    rest = rest.replace(/^\/pl/, '') || '/';
  }
  if (!rest.startsWith('/')) {
    rest = `/${rest}`;
  }
  let href = `${base}${locale === 'pl' ? '/pl' : ''}${rest}`;
  if (!href.endsWith('/')) {
    href += '/';
  }
  return href;
}
