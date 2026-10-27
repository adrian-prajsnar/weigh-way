import { describe, expect, it } from 'vitest';
import {
  getScrollBottomPadding,
  getTabBarBottomOffset,
  getTabBarViewportInset,
} from './tab-bar-layout';

describe('tab-bar-layout', () => {
  it('positions the tab bar above the safe area', () => {
    expect(getTabBarBottomOffset(0)).toBe(8);
    expect(getTabBarBottomOffset(34)).toBe(42);
  });

  it('reserves viewport space above the floating tab bar', () => {
    expect(getTabBarViewportInset(0)).toBe(88);
    expect(getTabBarViewportInset(34)).toBe(122);
  });

  it('pads scroll content when the tab bar inset is reserved in padding', () => {
    expect(getScrollBottomPadding(0)).toBe(132);
    expect(getScrollBottomPadding(34)).toBe(166);
  });

  it('uses only content breathing room when the tab bar uses marginBottom', () => {
    expect(getScrollBottomPadding(0, false)).toBe(44);
    expect(getScrollBottomPadding(34, false)).toBe(44);
  });
});
