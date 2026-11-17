import { describe, expect, it } from 'vitest';
import { shouldRevertSelection } from './segmented-selection';

describe('shouldRevertSelection', () => {
  it('reverts a failed current change', () => {
    expect(shouldRevertSelection(false, 2, 2)).toBe(true);
  });

  it('does not let an older failure revert a newer selection', () => {
    expect(shouldRevertSelection(false, 1, 2)).toBe(false);
  });

  it.each([true, undefined])('keeps the selection when the result is %s', (result) => {
    expect(shouldRevertSelection(result, 2, 2)).toBe(false);
  });
});
