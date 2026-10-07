import { describe, expect, it } from 'vitest';
import { getScrollBottomPadding, getTabBarBottomOffset } from './tab-bar-layout';

describe('tab-bar-layout', () => {
  it('positions the tab bar above the safe area', () => {
    expect(getTabBarBottomOffset(0)).toBe(8);
    expect(getTabBarBottomOffset(34)).toBe(42);
  });

  it('clears the floating tab bar in scroll content', () => {
    expect(getScrollBottomPadding(0)).toBe(108);
    expect(getScrollBottomPadding(34)).toBe(142);
  });
});
