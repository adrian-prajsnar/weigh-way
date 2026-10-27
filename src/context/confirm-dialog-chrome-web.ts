import { Platform, ViewProps } from 'react-native';

/** Keeps dialog layout wrappers from receiving focus on web (no tabIndex — that still traps focus). */
export function getConfirmDialogChromeWebProps(): Pick<ViewProps, 'focusable'> {
  if (Platform.OS !== 'web') {
    return {};
  }
  return { focusable: false };
}
