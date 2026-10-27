import { describe, expect, it } from 'vitest';
import { shouldShowBmiUnavailableBadge } from './weight-with-bmi-availability';

describe('shouldShowBmiUnavailableBadge', () => {
  it('hides unavailable while profile height is still loading', () => {
    expect(shouldShowBmiUnavailableBadge(true, null)).toBe(false);
  });

  it('shows unavailable after load when height is missing', () => {
    expect(shouldShowBmiUnavailableBadge(false, null)).toBe(true);
  });

  it('does not show unavailable when height is present', () => {
    expect(shouldShowBmiUnavailableBadge(false, 175)).toBe(false);
  });
});
