/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTodayKey } from './use-today-key';

const appState = vi.hoisted(() => ({ listener: (_state: string) => {}, remove: vi.fn() }));
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn((_event, listener) => {
      appState.listener = listener;
      return { remove: appState.remove };
    }),
  },
}));

describe('useTodayKey', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('advances at local midnight without remounting', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 3, 23, 59, 59));
    const { result } = renderHook(useTodayKey);
    expect(result.current).toBe('2026-11-03');
    act(() => vi.advanceTimersByTime(1100));
    expect(result.current).toBe('2026-11-04');
  });

  it('refreshes after suspension and removes its listener', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 3));
    const { result, unmount } = renderHook(useTodayKey);
    vi.setSystemTime(new Date(2026, 10, 5));
    act(() => appState.listener('active'));
    expect(result.current).toBe('2026-11-05');
    unmount();
    expect(appState.remove).toHaveBeenCalled();
  });
});
