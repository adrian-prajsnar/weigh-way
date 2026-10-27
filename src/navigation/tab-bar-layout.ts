import { spacing } from '../theme/tokens';

/** Icon, label, and padding; keep in sync with tab-bar styles. */
export const TAB_BAR_HEIGHT = 72;

export function getTabBarBottomOffset(bottomInset: number): number {
  return bottomInset + spacing.sm;
}

/** Space reserved below the scroll viewport so content is not drawn under the floating tab bar. */
export function getTabBarViewportInset(bottomInset: number): number {
  return getTabBarBottomOffset(bottomInset) + TAB_BAR_HEIGHT + spacing.sm;
}

export function getScrollBottomPadding(bottomInset: number): number {
  return getTabBarViewportInset(bottomInset) + spacing.xxl + spacing.lg;
}
