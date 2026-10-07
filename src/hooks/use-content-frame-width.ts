import { layoutBreakpoint, layoutWidth, spacing } from '../theme/tokens';
import { useAppWindowDimensions } from './use-app-window-dimensions';

/** Width of the main content column: full bleed on phones, padded and capped on wide tablets. */
export function getContentFrameWidth(windowWidth: number): number | '100%' {
  if (windowWidth < layoutBreakpoint.wide) {
    return '100%';
  }

  return Math.min(windowWidth - spacing.xl * 2, layoutWidth.content);
}

export function useContentFrameWidth(): number | '100%' {
  const { width } = useAppWindowDimensions();
  return getContentFrameWidth(width);
}
