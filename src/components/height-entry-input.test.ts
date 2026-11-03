import { describe, expect, it } from 'vitest';
import { hasHeightDateCollision, resolveHeightCmForSave } from './height-entry-input';

describe('resolveHeightCmForSave', () => {
  it('preserves the recorded centimeters when imperial inputs are unchanged', () => {
    expect(resolveHeightCmForSave('imperial', '5', '9', 176)).toBe(176);
    expect(resolveHeightCmForSave('imperial', '3', '3', 100)).toBe(100);
  });

  it('converts edited inputs and still validates new records', () => {
    expect(resolveHeightCmForSave('imperial', '5', '10', 176)).toBe(178);
    expect(resolveHeightCmForSave('imperial', '3', '3')).toBeNull();
    expect(resolveHeightCmForSave('metric', '1', '76', 175)).toBe(176);
  });

  it('requires confirmation when adding or moving onto an occupied date', () => {
    const entries = [{ effectiveDate: '2026-11-01', heightCm: 176 }];
    expect(hasHeightDateCollision(entries, '2026-11-01', null)).toBe(true);
    expect(hasHeightDateCollision(entries, '2026-11-01', '2026-10-01')).toBe(true);
    expect(hasHeightDateCollision(entries, '2026-11-01', '2026-11-01')).toBe(false);
    expect(hasHeightDateCollision(entries, '2026-11-02', '2026-11-01')).toBe(false);
  });
});
