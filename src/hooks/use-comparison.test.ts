/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getI18nLocale, setI18nLocale, t, translateForLocale } from '../i18n';
import { toDateKey } from '../format';
import { useComparison } from './use-comparison';

vi.mock('./use-today-key', () => ({ useTodayKey: () => '2026-11-16' }));
vi.mock('../run-when-idle', () => ({
  runWhenIdle: (callback: () => void) => {
    const timer = setTimeout(callback, 0);
    return { cancel: () => clearTimeout(timer) };
  },
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useComparison', () => {
  it('refreshes trend titles when the locale and translation function change', () => {
    vi.useFakeTimers();
    const previousLocale = getI18nLocale();
    setI18nLocale('en');
    try {
      const entries = [
        {
          date: '2026-11-15',
          weightKg: 70,
          createdAt: '2026-11-15T00:00:00.000Z',
          updatedAt: '2026-11-15T00:00:00.000Z',
        },
      ];
      const englishT: typeof t = (scope, options) => translateForLocale(scope, 'en', options);
      const polishT: typeof t = (scope, options) => translateForLocale(scope, 'pl', options);
      const { result, rerender } = renderHook(
        ({ translate }) =>
          useComparison({ entries, isLoading: false, birthDate: null, t: translate }),
        { initialProps: { translate: englishT } },
      );
      act(() => result.current.handleModeChange('month'));
      act(() => vi.runAllTimers());
      expect(result.current.trendRows[0].title).toBe('November 2026');

      setI18nLocale('pl');
      rerender({ translate: polishT });

      expect(result.current.trendRows[0].title).toBe('listopad 2026');
    } finally {
      setI18nLocale(previousLocale);
    }
  });

  it('resets to a valid Days range and restarts loading when the birth date is removed', () => {
    vi.useFakeTimers();
    const entries = ['2020-01-01', '2026-11-15'].map((date) => ({
      date,
      weightKg: 70,
      createdAt: `${date}T00:00:00.000Z`,
      updatedAt: `${date}T00:00:00.000Z`,
    }));
    const { result, rerender } = renderHook(
      ({ birthDate }: { birthDate: string | null }) =>
        useComparison({ entries, isLoading: false, birthDate, t }),
      { initialProps: { birthDate: '1990-01-01' as string | null } },
    );

    act(() => result.current.handleModeChange('ageYear'));
    act(() => vi.runAllTimers());
    expect(result.current.mode).toBe('ageYear');
    expect(toDateKey(result.current.fromDate)).toBe('2020-01-01');
    expect(result.current.showTrendContent).toBe(true);

    rerender({ birthDate: null });

    expect(result.current.mode).toBe('day');
    expect(result.current.isDefaultRange).toBe(true);
    expect(result.current.isInvalidRange).toBe(false);
    expect(result.current.rangeValidationMessage).toBeNull();
    expect(result.current.showTrendContent).toBe(false);

    act(() => vi.runAllTimers());
    expect(result.current.showTrendContent).toBe(true);
    expect(result.current.trendRows.length).toBeGreaterThan(0);
  });
});
