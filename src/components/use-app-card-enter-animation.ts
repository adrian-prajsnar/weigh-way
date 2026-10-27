import { useEffect } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  APP_CARD_ENTER_DURATION_MS,
  APP_CARD_ENTER_OFFSET_Y,
  applyAppCardEnterFallback,
  getAppCardEnterFallbackMs,
} from './app-card-enter-animation';

export function useAppCardEnterAnimation(delay: number, skipEnterAnimation: boolean) {
  const opacity = useSharedValue(skipEnterAnimation ? 1 : 0);
  const translateY = useSharedValue(skipEnterAnimation ? 0 : APP_CARD_ENTER_OFFSET_Y);

  useEffect(() => {
    if (skipEnterAnimation) {
      applyAppCardEnterFallback(opacity, translateY);
      return;
    }

    opacity.value = 0;
    translateY.value = APP_CARD_ENTER_OFFSET_Y;

    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: APP_CARD_ENTER_DURATION_MS }),
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: APP_CARD_ENTER_DURATION_MS }),
    );

    const fallbackMs = getAppCardEnterFallbackMs(delay);
    const timer = setTimeout(() => {
      applyAppCardEnterFallback(opacity, translateY);
    }, fallbackMs);

    return () => clearTimeout(timer);
  }, [delay, skipEnterAnimation, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return animatedStyle;
}
