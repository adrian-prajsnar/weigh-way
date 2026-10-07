import { layoutBreakpoint } from '../theme/tokens';
import { useAppWindowDimensions } from './use-app-window-dimensions';

export function useWideLayout(): boolean {
  const { width } = useAppWindowDimensions();
  return width >= layoutBreakpoint.wide;
}
