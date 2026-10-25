import { Platform, type GestureResponderEvent, type NativeSyntheticEvent } from 'react-native';

type KeyPressEvent = NativeSyntheticEvent<{ key: string }>;

export type StepperPressProps = {
  onPress?: () => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  onTouchCancel?: () => void;
  onKeyDown?: (event: KeyPressEvent) => void;
  onKeyUp?: (event: KeyPressEvent) => void;
};

const SCROLL_CANCEL_MOVE_PX = 10;
const SCROLL_CANCEL_MOVE_PX_SQ = SCROLL_CANCEL_MOVE_PX * SCROLL_CANCEL_MOVE_PX;
const SYNTHETIC_POINTER_PRESS_MS = 50;
const SYNTHETIC_KEYBOARD_CLICK_MS = 50;

type GesturePhase = 'idle' | 'armed' | 'activated' | 'cancelled';

export type WebStepperGestureState = {
  phase: GesturePhase;
  pressInX: number;
  pressInY: number;
  skipNextSyntheticPointerPress: boolean;
  ignorePointerPressUntilMs: number;
  ignoreIdlePressUntilMs: number;
  suppressSpaceClickUntilKeyUp: boolean;
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
    skipNextSyntheticPointerPress: false,
    ignorePointerPressUntilMs: 0,
    ignoreIdlePressUntilMs: 0,
    suppressSpaceClickUntilKeyUp: false,
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
    gesture.skipNextSyntheticPointerPress = true;
    gesture.ignorePointerPressUntilMs = Date.now() + SYNTHETIC_POINTER_PRESS_MS;
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

      gesture.skipNextSyntheticPointerPress = false;
      gesture.ignorePointerPressUntilMs = 0;
      gesture.ignoreIdlePressUntilMs = 0;
      gesture.suppressSpaceClickUntilKeyUp = false;
      gesture.phase = 'armed';
      gesture.pressInX = event.nativeEvent.pageX;
      gesture.pressInY = event.nativeEvent.pageY;
    },
    onPress: () => {
      if (gesture.suppressSpaceClickUntilKeyUp) {
        return;
      }

      if (gesture.skipNextSyntheticPointerPress) {
        gesture.skipNextSyntheticPointerPress = false;
        return;
      }

      if (
        Date.now() < gesture.ignorePointerPressUntilMs &&
        gesture.phase === 'idle'
      ) {
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
      gesture.skipNextSyntheticPointerPress = false;
      gesture.ignorePointerPressUntilMs = 0;
      gesture.ignoreIdlePressUntilMs = 0;
      gesture.suppressSpaceClickUntilKeyUp = false;
    },
    onKeyDown: (event: KeyPressEvent) => {
      const key = event.nativeEvent.key;
      if (key !== 'Enter' && key !== ' ') {
        return;
      }
      event.preventDefault?.();
      if (key === ' ') {
        activateFromKeyboard();
        gesture.suppressSpaceClickUntilKeyUp = true;
        resetGesture();
        return;
      }
      activateFromKeyboard();
      gesture.ignoreIdlePressUntilMs = Date.now() + SYNTHETIC_KEYBOARD_CLICK_MS;
      resetGesture();
    },
    onKeyUp: (event: KeyPressEvent) => {
      if (event.nativeEvent.key !== ' ') {
        return;
      }
      event.preventDefault?.();
      if (gesture.suppressSpaceClickUntilKeyUp) {
        gesture.suppressSpaceClickUntilKeyUp = false;
        gesture.ignoreIdlePressUntilMs = Date.now() + SYNTHETIC_KEYBOARD_CLICK_MS;
      }
    },
  };
}
