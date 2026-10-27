import { Platform, ViewProps } from 'react-native';

/** Keeps dialog layout wrappers out of the tab order on web. */
export function getConfirmDialogChromeWebProps(): Pick<ViewProps, 'focusable'> & {
  tabIndex?: -1;
} {
  if (Platform.OS !== 'web') {
    return {};
  }
  return { focusable: false, tabIndex: -1 };
}
