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

export function countReleaseChanges(notes: string): number {
  const matches = notes.match(/^\s*[*-]\s+/gm);
  return matches?.length ?? 0;
}

export function formatChangesCount(count: number, locale: SiteLocale): string {
  if (locale === 'pl') {
    if (count === 1) return '1 zmiana';
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return `${count} zmiany`;
    }
    return `${count} zmian`;
  }

  return count === 1 ? '1 change' : `${count} changes`;
}
