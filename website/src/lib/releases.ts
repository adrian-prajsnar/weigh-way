import type { SiteLocale } from '../i18n';

export type Release = {
  version: string;
  date: string;
  notesEn: string;
  notesPl: string;
  pendingEn?: boolean;
  pendingPl?: boolean;
  apkUrl: string | null;
  ipaUrl: string | null;
};

import rawReleases from '../data/releases.json';

const releases = rawReleases as Release[];

export function getReleases(): Release[] {
  return releases;
}

export function getLatestRelease(): Release | null {
  return releases[0] ?? null;
}

export function notesFor(release: Release, locale: SiteLocale): string {
  return locale === 'pl' ? release.notesPl : release.notesEn;
}

export function isNotesPending(release: Release, locale: SiteLocale): boolean {
  return locale === 'pl' ? Boolean(release.pendingPl) : Boolean(release.pendingEn);
}
