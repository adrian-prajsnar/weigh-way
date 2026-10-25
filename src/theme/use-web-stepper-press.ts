import { useMemo, useRef } from 'react';
import {
  createInitialWebStepperGestureState,
  createWebStepperPressHandlers,
  type StepperPressProps,
} from './web-stepper-gesture';

/** Keeps +/- stepper taps working while a nearby TextInput still has focus on web. */
export function useWebStepperPress(onPress: () => void): StepperPressProps {
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const gestureRef = useRef(createInitialWebStepperGestureState());

  return useMemo(
    () => createWebStepperPressHandlers(() => onPressRef.current(), gestureRef.current),
    [],
  );
}
