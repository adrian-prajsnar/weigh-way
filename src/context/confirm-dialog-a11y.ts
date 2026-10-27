import { PressableProps } from 'react-native';

export function getConfirmDialogPressableA11y(label: string): Pick<
  PressableProps,
  'accessibilityRole' | 'accessibilityLabel' | 'accessible'
> {
  return {
    accessible: true,
    accessibilityRole: 'button',
    accessibilityLabel: label,
  };
}
