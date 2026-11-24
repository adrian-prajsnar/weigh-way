import { useRef } from 'react';
import { PanResponder, PanResponderInstance, Platform } from 'react-native';

// Matches react-native-swipe-gestures as used by react-native-calendars:
// horizontal swipes only, ignoring drags that drift too far vertically.
const MONTH_SWIPE_MIN_DISTANCE = 40;
const MONTH_SWIPE_MAX_VERTICAL_DRIFT = 80;
const MONTH_SWIPE_AXIS_LOCK_OFFSET = 10;

/** Swiping left shows the next month, right the previous one; `null` when not a swipe. */
export function getMonthSwipeDirection(dx: number, dy: number): -1 | 1 | null {
  if (Math.abs(dx) < MONTH_SWIPE_MIN_DISTANCE || Math.abs(dy) >= MONTH_SWIPE_MAX_VERTICAL_DRIFT) {
    return null;
  }
  return dx < 0 ? 1 : -1;
}

/**
 * Month swipe for the web calendar. The library's own swipe calls into its
 * built-in header via a ref, which it does not pass when `customHeader` is set,
 * so the web header (CalendarWebHeader) needs the gesture handled here.
 */
export function useWebMonthSwipe(
  onSwipe: (direction: -1 | 1) => void,
): PanResponderInstance['panHandlers'] | undefined {
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > MONTH_SWIPE_AXIS_LOCK_OFFSET && Math.abs(dx) > Math.abs(dy),
      onPanResponderRelease: (_, { dx, dy }) => {
        const direction = getMonthSwipeDirection(dx, dy);
        if (direction !== null) {
          onSwipeRef.current(direction);
        }
      },
    }),
  ).current;

  return Platform.OS === 'web' ? panResponder.panHandlers : undefined;
}
