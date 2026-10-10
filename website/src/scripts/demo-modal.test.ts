import { describe, expect, it } from 'vitest';
import { formatDemoStatusBarTime, getDemoModalLoadingState, msUntilNextMinute } from './demo-modal';

describe('formatDemoStatusBarTime', () => {
  it('formats hours and minutes for the status bar', () => {
    const formatted = formatDemoStatusBarTime(new Date(2026, 2, 9, 9, 41));
    expect(formatted).toMatch(/9:41/);
  });
});

describe('msUntilNextMinute', () => {
  it('returns the remaining ms in the current minute', () => {
    expect(msUntilNextMinute(new Date(2026, 2, 9, 9, 41, 12, 340))).toBe(47_660);
  });
});

describe('getDemoModalLoadingState', () => {
  it('shows the skeleton while the demo iframe is loading', () => {
    expect(getDemoModalLoadingState(true)).toEqual({
      isLoading: true,
      ariaBusy: 'true',
      skeletonHidden: 'false',
    });
  });

  it('hides the skeleton after the demo iframe has loaded', () => {
    expect(getDemoModalLoadingState(false)).toEqual({
      isLoading: false,
      ariaBusy: 'false',
      skeletonHidden: 'true',
    });
  });
});
