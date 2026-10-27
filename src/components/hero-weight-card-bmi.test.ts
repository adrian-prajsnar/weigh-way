import { describe, expect, it } from 'vitest';
import { shouldShowBmiUnavailableBadge } from './weight-with-bmi-availability';

describe('HeroWeightCard BMI availability', () => {
  it('hides unavailable while profile height is still loading', () => {
    expect(shouldShowBmiUnavailableBadge(true, null)).toBe(false);
  });
});
