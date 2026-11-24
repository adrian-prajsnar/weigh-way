import { Platform } from 'react-native';

type PlatformOS = typeof Platform.OS;

// react-native-web 0.21 ignores the `accessibilityState` object, so a selected
// state set that way never reaches the DOM. Web gets the ARIA attribute that is
// valid for the element's role instead; native keeps `accessibilityState`.

/** Selection state for a button that toggles one option in a group (period, mode, day). */
export function toggleButtonA11y(
  selected: boolean,
  platform: PlatformOS = Platform.OS,
): { accessibilityState: { selected: boolean } } | { 'aria-pressed': boolean } {
  return platform === 'web' ? { 'aria-pressed': selected } : { accessibilityState: { selected } };
}

/** Marks the navigation item for the screen that is currently shown. */
export function currentPageA11y(
  current: boolean,
  platform: PlatformOS = Platform.OS,
): { accessibilityState: { selected: boolean } } | { 'aria-current'?: 'page' } {
  if (platform !== 'web') {
    return { accessibilityState: { selected: current } };
  }
  return current ? { 'aria-current': 'page' } : {};
}
