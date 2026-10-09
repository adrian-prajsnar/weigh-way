import { describe, expect, it } from 'vitest';
import { pxToRem } from './css-rem';

describe('pxToRem', () => {
  it('converts pixel values to rem at a 16px root', () => {
    expect(pxToRem(16)).toBe('1rem');
    expect(pxToRem(8)).toBe('0.5rem');
    expect(pxToRem(2)).toBe('0.125rem');
  });

  it('returns 0 without a unit for zero', () => {
    expect(pxToRem(0)).toBe('0');
  });
});
