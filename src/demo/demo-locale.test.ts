import { describe, expect, it } from 'vitest';
import { getDemoLocaleFromUrl } from './demo-locale';

describe('getDemoLocaleFromUrl', () => {
  it('reads the lang query param', () => {
    expect(getDemoLocaleFromUrl('?embed=1&lang=en')).toBe('en');
    expect(getDemoLocaleFromUrl('?embed=1&lang=pl')).toBe('pl');
    expect(getDemoLocaleFromUrl('?embed=1')).toBeNull();
    expect(getDemoLocaleFromUrl('?embed=1&lang=de')).toBeNull();
  });
});
