import { ScaledSize, useWindowDimensions } from 'react-native';
import { useDemoViewport } from '../demo/demo-viewport-context';

export function useAppWindowDimensions(): ScaledSize {
  const window = useWindowDimensions();
  const demoViewport = useDemoViewport();

  if (!demoViewport) {
    return window;
  }

  return {
    width: demoViewport.width,
    height: demoViewport.height,
    scale: window.scale,
    fontScale: window.fontScale,
  };
}
