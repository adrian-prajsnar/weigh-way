import { Platform, type GestureResponderEvent } from 'react-native';

type StepperPressProps = {
  onPress?: () => void;
  onPressIn?: (event: GestureResponderEvent) => void;
};

/** Ignores the follow-up onPress that RN Web emits after onPressIn on the same click. */
const PRESS_IN_SUPPRESS_MS = 50;
let suppressFollowUpPressUntil = 0;

export function resetWebStepperPressDedupeForTests(): void {
  suppressFollowUpPressUntil = 0;
}

/** Keeps +/- stepper taps working while a nearby TextInput still has focus on web. */
export function webStepperPressProps(onPress: () => void): StepperPressProps {
  if (Platform.OS !== 'web') {
    return { onPress };
  }

  return {
    onPressIn: (event) => {
      event.preventDefault();
      suppressFollowUpPressUntil = Date.now() + PRESS_IN_SUPPRESS_MS;
      onPress();
    },
    onPress: () => {
      if (Date.now() < suppressFollowUpPressUntil) {
        return;
      }
      onPress();
    },
  };
}
