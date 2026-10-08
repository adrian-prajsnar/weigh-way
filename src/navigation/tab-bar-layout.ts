import { spacing } from '../theme/tokens';

/** Icon, label, and padding; keep in sync with tab-bar styles. */
export const TAB_BAR_HEIGHT = 72;

export function getTabBarBottomOffset(bottomInset: number): number {
  return bottomInset + spacing.sm;
}

export function getScrollBottomPadding(bottomInset: number): number {
  return getTabBarBottomOffset(bottomInset) + TAB_BAR_HEIGHT + spacing.xl;
}
