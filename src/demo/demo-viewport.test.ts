import { describe, expect, it } from 'vitest';
import { getDemoFrameSize, shouldUseDemoPhoneFrame } from './demo-viewport';

describe('demo viewport', () => {
  it('uses the phone frame only on wider screens', () => {
    expect(shouldUseDemoPhoneFrame(390)).toBe(false);
    expect(shouldUseDemoPhoneFrame(768)).toBe(true);
  });

  it('caps the frame to a phone size with outer padding', () => {
    expect(getDemoFrameSize(1440, 900)).toEqual({ width: 390, height: 844 });
    expect(getDemoFrameSize(360, 780)).toEqual({ width: 320, height: 732 });
  });
});
