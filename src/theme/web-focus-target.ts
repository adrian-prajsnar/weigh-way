import { Platform } from 'react-native';

export type WebFocusTarget = 'text-button' | 'segmented-item' | 'switch';

const DATASET_KEYS: Record<WebFocusTarget, string> = {
  'text-button': 'wwTextButton',
  'segmented-item': 'wwSegmentedItem',
  switch: 'wwSwitch',
};

/** Marks web-only focus-ring targets for desktop demo styles. */
export function webFocusTarget(target: WebFocusTarget): { dataSet?: Record<string, string> } {
  if (Platform.OS !== 'web') {
    return {};
  }

  return { dataSet: { [DATASET_KEYS[target]]: 'true' } };
}
