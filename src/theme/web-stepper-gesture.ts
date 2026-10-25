import { Platform, type GestureResponderEvent, type NativeSyntheticEvent } from 'react-native';

type KeyPressEvent = NativeSyntheticEvent<{ key: string }>;

export type StepperPressProps = {
  onPress?: () => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  onTouchCancel?: () => void;
  onKeyDown?: (event: KeyPressEvent) => void;
};

const SCROLL_CANCEL_MOVE_PX = 10;
const SCROLL_CANCEL_MOVE_PX_SQ = SCROLL_CANCEL_MOVE_PX * SCROLL_CANCEL_MOVE_PX;

type GesturePhase = 'idle' | 'armed' | 'activated' | 'cancelled';

export type WebStepperGestureState = {
  phase: GesturePhase;
  pressInX: number;
  pressInY: number;
  awaitingPointerRelease: boolean;
  /** Suppresses the synthetic `onPress` that follows `onPressOut` on React Native Web. */
  skipNextPointerPress: boolean;
};

function isNearbyFieldFocused(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const active = document.activeElement as HTMLElement | null;
  if (!active?.dataset) {
    return false;
  }
  return active.dataset.wwFieldInput === 'true';
}

function hasPointerCoordinates(event: GestureResponderEvent): boolean {
  const { pageX, pageY } = event.nativeEvent;
  return typeof pageX === 'number' && typeof pageY === 'number';
}

export function createInitialWebStepperGestureState(): WebStepperGestureState {
  return {
    phase: 'idle',
    pressInX: 0,
    pressInY: 0,
    awaitingPointerRelease: false,
    skipNextPointerPress: false,
  };
}

export function createWebStepperPressHandlers(
  onPress: () => void,
  gesture: WebStepperGestureState,
): StepperPressProps {
  if (Platform.OS !== 'web') {
    return { onPress };
  }

  const resetGesture = () => {
    gesture.phase = 'idle';
  };

  const activateFromPointer = (awaitPointerRelease: boolean) => {
    if (gesture.phase === 'cancelled' || gesture.awaitingPointerRelease) {
      return;
    }
    gesture.phase = 'activated';
    if (awaitPointerRelease) {
      gesture.awaitingPointerRelease = true;
    }
    onPress();
  };

  const activateFromKeyboard = () => {
    if (gesture.phase === 'cancelled') {
      return;
    }
    gesture.phase = 'activated';
    onPress();
  };

  const movedTooFar = (event: GestureResponderEvent): boolean => {
    const dx = event.nativeEvent.pageX - gesture.pressInX;
    const dy = event.nativeEvent.pageY - gesture.pressInY;
    return dx * dx + dy * dy > SCROLL_CANCEL_MOVE_PX_SQ;
  };

  return {
    onPressIn: (event: GestureResponderEvent) => {
      event.preventDefault();
      if (!hasPointerCoordinates(event) || gesture.awaitingPointerRelease) {
        return;
      }

      gesture.skipNextPointerPress = false;
      gesture.phase = 'armed';
      gesture.pressInX = event.nativeEvent.pageX;
      gesture.pressInY = event.nativeEvent.pageY;
    },
    onPress: () => {
      if (gesture.skipNextPointerPress) {
        gesture.skipNextPointerPress = false;
        return;
      }

      if (gesture.phase === 'cancelled') {
        resetGesture();
        return;
      }

      if (gesture.phase === 'idle') {
        if (gesture.awaitingPointerRelease) {
          return;
        }
        activateFromKeyboard();
        gesture.skipNextPointerPress = true;
        resetGesture();
        return;
      }

      if (gesture.phase !== 'armed') {
        return;
      }

      if (!isNearbyFieldFocused()) {
        activateFromPointer(true);
      }

      resetGesture();
    },
    onPressOut: (event: GestureResponderEvent) => {
      gesture.awaitingPointerRelease = false;

      if (gesture.phase === 'cancelled') {
        resetGesture();
        return;
      }

      if (gesture.phase === 'activated') {
        resetGesture();
        return;
      }

      if (gesture.phase !== 'armed') {
        return;
      }

      if (!hasPointerCoordinates(event)) {
        resetGesture();
        return;
      }

      if (movedTooFar(event)) {
        resetGesture();
        return;
      }

      if (isNearbyFieldFocused()) {
        activateFromPointer(false);
        gesture.skipNextPointerPress = true;
        resetGesture();
      }
    },
    onTouchCancel: () => {
      gesture.phase = 'cancelled';
      gesture.awaitingPointerRelease = false;
      gesture.skipNextPointerPress = false;
    },
    onKeyDown: (event: KeyPressEvent) => {
      const key = event.nativeEvent.key;
      if (key !== 'Enter' && key !== ' ') {
        return;
      }
      event.preventDefault?.();
      if (gesture.awaitingPointerRelease) {
        return;
      }
      activateFromKeyboard();
      gesture.skipNextPointerPress = true;
      resetGesture();
    },
  };
}
