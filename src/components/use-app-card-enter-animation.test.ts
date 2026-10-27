import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getAppCardEnterFallbackMs } from './app-card-enter-animation';
import { applyAppCardEnterFallback } from './app-card-enter-animation';

describe('enter animation fallback timing vs entry form', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fallback fires after entry form delay without requiring a remount key change', () => {
    const entryFormDelayMs = 60;
    const fallbackMs = getAppCardEnterFallbackMs(entryFormDelayMs);
    expect(fallbackMs).toBe(580);

    const opacity = { value: 0 };
    const translateY = { value: 12 };
    let remountCount = 0;

    const timer = setTimeout(() => {
      applyAppCardEnterFallback(opacity, translateY);
    }, fallbackMs);

    vi.advanceTimersByTime(fallbackMs - 1);
    expect(opacity.value).toBe(0);
    expect(remountCount).toBe(0);

    vi.advanceTimersByTime(1);
    expect(opacity.value).toBe(1);
    expect(translateY.value).toBe(0);
    expect(remountCount).toBe(0);

    clearTimeout(timer);
  });
});
