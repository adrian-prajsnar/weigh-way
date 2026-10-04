import { describe, expect, it } from 'vitest';
import { countReleaseChanges, formatChangesCount, isNotesPending } from './releases';

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

  it('counts markdown bullet changes', () => {
    const notes = `### What's new

* First item
* Second item

### Bug fixes

- Third item`;

    expect(countReleaseChanges(notes)).toBe(3);
    expect(countReleaseChanges('')).toBe(0);
  });

  it('formats change counts per locale', () => {
    expect(formatChangesCount(1, 'en')).toBe('1 change');
    expect(formatChangesCount(4, 'en')).toBe('4 changes');
    expect(formatChangesCount(1, 'pl')).toBe('1 zmiana');
    expect(formatChangesCount(2, 'pl')).toBe('2 zmiany');
    expect(formatChangesCount(5, 'pl')).toBe('5 zmian');
    expect(formatChangesCount(22, 'pl')).toBe('22 zmiany');
  });
});
