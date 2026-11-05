import { spacing } from '../theme/tokens';

/** Icon, label, and padding; keep in sync with tab-bar styles. */
const TAB_BAR_HEIGHT = 72;

export function getTabBarBottomOffset(bottomInset: number): number {
  return bottomInset + spacing.sm;
}

/** Space reserved below the scroll viewport so content is not drawn under the floating tab bar. */
export function getTabBarViewportInset(bottomInset: number): number {
  return getTabBarBottomOffset(bottomInset) + TAB_BAR_HEIGHT + spacing.sm;
}

/** Together with the viewport's 8px gap, match the 16px gap below screen headers. */
function getScrollContentBottomPadding(): number {
  return spacing.sm;
}

/**
 * @param reserveTabBarInset When false, the scroll view already uses `marginBottom` for the tab bar.
 */
export function getScrollBottomPadding(
  bottomInset: number,
  reserveTabBarInset = true,
): number {
  const base = getScrollContentBottomPadding();
  return reserveTabBarInset ? getTabBarViewportInset(bottomInset) + base : base;
}
