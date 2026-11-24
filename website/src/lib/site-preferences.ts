export const THEME_STORAGE_KEY = 'weigh-way-site/theme';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export function normalizeThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
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

export function prefersDarkColorScheme(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function readThemePreference(): ThemePreference {
  let preference: string | null = null;
  try {
    preference = window.localStorage?.getItem(THEME_STORAGE_KEY) ?? null;
  } catch (error) {
    console.warn('Could not read the site theme preference', error);
  }
  return normalizeThemePreference(preference);
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage?.setItem(THEME_STORAGE_KEY, preference);
  } catch (error) {
    console.warn('Could not save the site theme preference', error);
  }
}

export function buildThemeBootstrapScript(): string {
  return `(function(){var pref;try{pref=window.localStorage?.getItem('${THEME_STORAGE_KEY}');}catch(error){console.warn('Could not read the site theme preference',error);}var theme;if(pref==='light'||pref==='dark'){theme=pref;}else{theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.add('js');document.documentElement.setAttribute('data-theme',theme);var meta=document.createElement('meta');meta.name='theme-color';meta.content=theme==='dark'?'#080B12':'#F4F5F8';document.head.appendChild(meta);})();`;
}
