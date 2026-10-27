import { describe, expect, it } from 'vitest';
import { applyAppCardEnterFallback, getAppCardEnterFallbackMs } from './app-card-enter-animation';

describe('getAppCardEnterFallbackMs', () => {
  it('covers delay, animation duration, and buffer', () => {
    expect(getAppCardEnterFallbackMs(0)).toBe(520);
    expect(getAppCardEnterFallbackMs(180)).toBe(700);
  });
});

describe('applyAppCardEnterFallback', () => {
  it('forces visible state without a remount generation bump', () => {
    const state = {
      opacity: { value: 0 },
      translateY: { value: 12 },
      mountGeneration: 0,
    };

    applyAppCardEnterFallback(state.opacity, state.translateY);

    expect(state.opacity.value).toBe(1);
    expect(state.translateY.value).toBe(0);
    expect(state.mountGeneration).toBe(0);
  });
});
