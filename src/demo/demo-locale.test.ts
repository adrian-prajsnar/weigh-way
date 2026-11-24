import { describe, expect, it } from 'vitest';
import { getDemoLocaleFromUrl } from './demo-locale';

describe('getDemoLocaleFromUrl', () => {
  it('reads the lang query param', () => {
    expect(getDemoLocaleFromUrl('?embed=1&lang=en')).toBe('en');
    expect(getDemoLocaleFromUrl('?embed=1&lang=pl')).toBe('pl');
    expect(getDemoLocaleFromUrl('?embed=1')).toBeNull();
    expect(getDemoLocaleFromUrl('?embed=1&lang=de')).toBeNull();
  });

  it('defaults the Polish demo route to Polish and preserves explicit language choices', () => {
    expect(getDemoLocaleFromUrl('', '/weigh-way/demo/pl/')).toBe('pl');
    expect(getDemoLocaleFromUrl('?embed=1', '/weigh-way/demo/pl/index.html')).toBe('pl');
    expect(getDemoLocaleFromUrl('?lang=en', '/weigh-way/demo/pl/')).toBe('en');
    expect(getDemoLocaleFromUrl('', '/weigh-way/pl/')).toBeNull();
  });
});
