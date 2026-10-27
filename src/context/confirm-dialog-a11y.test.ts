import { describe, expect, it } from 'vitest';
import { getConfirmDialogPressableA11y } from './confirm-dialog-a11y';

describe('getConfirmDialogPressableA11y', () => {
  it('exposes dialog actions as labeled buttons for assistive tech', () => {
    expect(getConfirmDialogPressableA11y('Cancel')).toEqual({
      accessible: true,
      accessibilityRole: 'button',
      accessibilityLabel: 'Cancel',
    });
    expect(getConfirmDialogPressableA11y('Replace')).toEqual({
      accessible: true,
      accessibilityRole: 'button',
      accessibilityLabel: 'Replace',
    });
  });
});
