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
  /** Suppresses the synthetic `onPress` that follows `onPressOut` on React Native Web. */
  skipNextPointerPress: boolean;
  /** Ignores idle `onPress` until this timestamp (synthetic click after keyboard). */
  ignoreIdlePressUntilMs: number;
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
    skipNextPointerPress: false,
    ignoreIdlePressUntilMs: 0,
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

  const activateFromPointer = () => {
    if (gesture.phase === 'cancelled' || gesture.phase === 'activated') {
      return;
    }
    gesture.phase = 'activated';
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

  const completeValidPointerRelease = () => {
    activateFromPointer();
    gesture.skipNextPointerPress = true;
    resetGesture();
  };

  return {
    onPressIn: (event: GestureResponderEvent) => {
      if (isNearbyFieldFocused()) {
        event.preventDefault();
      }
      if (!hasPointerCoordinates(event)) {
        return;
      }

      gesture.skipNextPointerPress = false;
      gesture.ignoreIdlePressUntilMs = 0;
      gesture.phase = 'armed';
      gesture.pressInX = event.nativeEvent.pageX;
      gesture.pressInY = event.nativeEvent.pageY;
    },
    onPress: () => {
      if (gesture.skipNextPointerPress) {
        gesture.skipNextPointerPress = false;
        return;
      }

      if (Date.now() < gesture.ignoreIdlePressUntilMs) {
        return;
      }

      if (gesture.phase === 'cancelled') {
        resetGesture();
        return;
      }

      if (gesture.phase === 'idle') {
        activateFromKeyboard();
        resetGesture();
        return;
      }

      if (gesture.phase !== 'armed') {
        return;
      }

      if (!isNearbyFieldFocused()) {
        completeValidPointerRelease();
        return;
      }

      resetGesture();
    },
    onPressOut: (event: GestureResponderEvent) => {
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

      completeValidPointerRelease();
    },
    onTouchCancel: () => {
      gesture.phase = 'cancelled';
      gesture.skipNextPointerPress = false;
      gesture.ignoreIdlePressUntilMs = 0;
    },
    onKeyDown: (event: KeyPressEvent) => {
      const key = event.nativeEvent.key;
      if (key !== 'Enter' && key !== ' ') {
        return;
      }
      event.preventDefault?.();
      activateFromKeyboard();
      gesture.ignoreIdlePressUntilMs = Date.now() + 50;
      resetGesture();
    },
  };
}
