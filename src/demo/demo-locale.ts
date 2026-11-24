import { AppLocale } from '../i18n/resolve-locale';

export function getDemoLocaleFromUrl(search: string, pathname = ''): AppLocale | null {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const lang = new URLSearchParams(query).get('lang');
  if (lang === 'en' || lang === 'pl') {
    return lang;
  }
  return /\/demo\/pl(?:\/index\.html|\/)?$/.test(pathname) ? 'pl' : null;
}
