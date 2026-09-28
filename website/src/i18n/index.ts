import en, { type SiteLocale, type SiteMessages } from './en';
import pl from './pl';

const messages: Record<SiteLocale, SiteMessages> = { en, pl };

export type { SiteLocale, SiteMessages };

export function getMessages(locale: SiteLocale): SiteMessages {
  return messages[locale];
}

export type SitePage = 'home' | 'releases' | 'privacy' | 'terms';

export function localePath(locale: SiteLocale, page: SitePage): string {
  const suffix = page === 'home' ? '/' : `/${page}/`;
  return locale === 'pl' ? `/pl${suffix}` : suffix;
}

export function dateLocale(locale: SiteLocale): string {
  return locale === 'pl' ? 'pl-PL' : 'en-US';
}
