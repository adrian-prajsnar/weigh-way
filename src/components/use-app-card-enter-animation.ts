import { useEffect, useState } from 'react';
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

export type AppCardEnterAnimationResult = {
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
  pointerEvents: 'auto' | 'none';
};

export function useAppCardEnterAnimation(
  delay: number,
  skipEnterAnimation: boolean,
): AppCardEnterAnimationResult {
  const opacity = useSharedValue(skipEnterAnimation ? 1 : 0);
  const translateY = useSharedValue(skipEnterAnimation ? 0 : APP_CARD_ENTER_OFFSET_Y);
  const [pointerEvents, setPointerEvents] = useState<'auto' | 'none'>(
    skipEnterAnimation ? 'auto' : 'none',
  );

  useEffect(() => {
    if (skipEnterAnimation) {
      applyAppCardEnterFallback(opacity, translateY);
      setPointerEvents('auto');
      return;
    }

    setPointerEvents('none');
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

    const enableInteractionMs = delay + APP_CARD_ENTER_DURATION_MS;
    const enableTimer = setTimeout(() => setPointerEvents('auto'), enableInteractionMs);

    const fallbackMs = getAppCardEnterFallbackMs(delay);
    const fallbackTimer = setTimeout(() => {
      applyAppCardEnterFallback(opacity, translateY);
      setPointerEvents('auto');
    }, fallbackMs);

    return () => {
      clearTimeout(enableTimer);
      clearTimeout(fallbackTimer);
    };
  }, [delay, skipEnterAnimation, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return { animatedStyle, pointerEvents };
}
