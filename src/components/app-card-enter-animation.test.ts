import { describe, expect, it } from 'vitest';
import { getAppCardEnterFallbackMs } from './app-card-enter-animation';

describe('getAppCardEnterFallbackMs', () => {
  it('covers delay, animation duration, and buffer', () => {
    expect(getAppCardEnterFallbackMs(0)).toBe(520);
    expect(getAppCardEnterFallbackMs(180)).toBe(700);
  });
});
