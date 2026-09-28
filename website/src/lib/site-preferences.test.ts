import { describe, expect, it } from 'vitest';
import {
  localeHref,
  normalizeLanguagePreference,
  normalizeThemePreference,
  resolveLanguagePreference,
  resolveThemePreference,
} from './site-preferences';

describe('site-preferences', () => {
  it('defaults missing preferences to system', () => {
    expect(normalizeThemePreference(null)).toBe('system');
    expect(normalizeLanguagePreference(null)).toBe('system');
  });

  it('resolves system theme from prefers-color-scheme', () => {
    expect(resolveThemePreference('system', true)).toBe('dark');
    expect(resolveThemePreference('system', false)).toBe('light');
    expect(resolveThemePreference('light', true)).toBe('light');
    expect(resolveThemePreference('dark', false)).toBe('dark');
  });

  it('resolves system language from navigator language', () => {
    expect(resolveLanguagePreference('system', 'pl-PL')).toBe('pl');
    expect(resolveLanguagePreference('system', 'en-US')).toBe('en');
    expect(resolveLanguagePreference('en', 'pl-PL')).toBe('en');
    expect(resolveLanguagePreference('pl', 'en-US')).toBe('pl');
  });

  it('builds locale-aware hrefs', () => {
    expect(localeHref('pl', '/weigh-way', '/weigh-way/releases/')).toBe('/weigh-way/pl/releases/');
    expect(localeHref('en', '/weigh-way', '/weigh-way/pl/releases/')).toBe('/weigh-way/releases/');
  });
});
