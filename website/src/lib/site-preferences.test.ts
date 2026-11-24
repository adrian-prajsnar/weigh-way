import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeThemePreference,
  readThemePreference,
  resolveThemePreference,
  saveThemePreference,
  THEME_STORAGE_KEY,
} from './site-preferences';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('site-preferences', () => {
  it('defaults missing or invalid theme preferences to system', () => {
    expect(normalizeThemePreference(null)).toBe('system');
    expect(normalizeThemePreference('unknown')).toBe('system');
  });

  it('resolves system theme from prefers-color-scheme', () => {
    expect(resolveThemePreference('system', true)).toBe('dark');
    expect(resolveThemePreference('system', false)).toBe('light');
    expect(resolveThemePreference('light', true)).toBe('light');
    expect(resolveThemePreference('dark', false)).toBe('dark');
  });

  it('reads and saves a theme preference when storage is available', () => {
    const getItem = vi.fn(() => 'light');
    const setItem = vi.fn();
    vi.stubGlobal('window', { localStorage: { getItem, setItem } });

    expect(readThemePreference()).toBe('light');
    saveThemePreference('dark');
    expect(getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark');
  });

  it('falls back to the system theme when storage is disabled or denied', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('window', { localStorage: null });
    expect(readThemePreference()).toBe('system');
    expect(() => saveThemePreference('dark')).not.toThrow();

    vi.stubGlobal('window', {
      get localStorage() {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
    });
    expect(readThemePreference()).toBe('system');
    expect(() => saveThemePreference('dark')).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('falls back when the browser cannot read corrupted storage', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new DOMException('Storage corrupted', 'NS_ERROR_FILE_CORRUPTED');
    vi.stubGlobal('window', {
      localStorage: {
        getItem() {
          throw error;
        },
      },
    });
    expect(readThemePreference()).toBe('system');
    expect(warn).toHaveBeenCalledWith(expect.any(String), error);
  });

  it.each(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'])('allows selecting a theme when storage reports %s', (name) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = new DOMException('Storage full', name);
    vi.stubGlobal('window', {
      localStorage: {
        setItem() {
          throw error;
        },
      },
    });
    expect(() => saveThemePreference('dark')).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.any(String), error);
  });
});
