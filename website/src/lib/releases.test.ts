import { describe, expect, it } from 'vitest';
import { isNotesPending } from './releases';

describe('releases', () => {
  it('detects pending notes per locale', () => {
    const release = {
      version: '1.3.0',
      date: '2026-10-01',
      notesEn: 'pending',
      notesPl: 'oczekuje',
      pendingEn: true,
      pendingPl: false,
      apkUrl: null,
      ipaUrl: null,
    };

    expect(isNotesPending(release, 'en')).toBe(true);
    expect(isNotesPending(release, 'pl')).toBe(false);
  });
});
