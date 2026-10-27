import { describe, expect, it } from 'vitest';
import { resolveWeightPrefillUpdate, WeightPrefillAnchor } from './weight-entry-prefill';

const base: WeightPrefillAnchor = {
  selectedDateKey: '2024-10-27',
  units: 'metric',
  locale: 'en',
  existingEntryWeightKg: undefined,
};

describe('resolveWeightPrefillUpdate', () => {
  it('fills when an entry arrives after mount', () => {
    const result = resolveWeightPrefillUpdate(
      base,
      { ...base, existingEntryWeightKg: 80.5 },
      false,
      '',
    );
    expect(result.resetTouched).toBe(true);
    expect(result.nextInput).toBe('80.50');
  });

  it('fills when an entry arrives after the user cleared the field', () => {
    const result = resolveWeightPrefillUpdate(
      base,
      { ...base, existingEntryWeightKg: 80.5 },
      true,
      '',
    );
    expect(result.resetTouched).toBe(true);
    expect(result.nextInput).toBe('80.50');
  });

  it('clears when the entry is removed', () => {
    const result = resolveWeightPrefillUpdate(
      { ...base, existingEntryWeightKg: 80.5 },
      { ...base, existingEntryWeightKg: undefined },
      false,
      '80.50',
    );
    expect(result.resetTouched).toBe(true);
    expect(result.nextInput).toBe('');
  });

  it('reformats an untouched value when only locale changes', () => {
    const anchored = { ...base, existingEntryWeightKg: 82 };
    const result = resolveWeightPrefillUpdate(
      anchored,
      { ...anchored, locale: 'pl' },
      false,
      '82.00',
    );
    expect(result.resetTouched).toBe(false);
    expect(result.nextInput).toBe('82,00');
  });

  it('keeps a touched value when only the stored weight changes', () => {
    const anchored = { ...base, existingEntryWeightKg: 80 };
    const result = resolveWeightPrefillUpdate(
      anchored,
      { ...anchored, existingEntryWeightKg: 82 },
      true,
      '79.00',
    );
    expect(result.resetTouched).toBe(false);
    expect(result.nextInput).toBeNull();
    expect(result.nextAnchor.existingEntryWeightKg).toBe(82);
  });

  it('keeps typed text when stored weight and locale change together', () => {
    const anchored = { ...base, existingEntryWeightKg: 80 };
    const result = resolveWeightPrefillUpdate(
      anchored,
      { ...anchored, existingEntryWeightKg: 82, locale: 'pl' },
      true,
      '79.00',
    );
    expect(result.resetTouched).toBe(false);
    expect(result.nextInput).toBeNull();
    expect(result.nextAnchor.locale).toBe('pl');
  });

  it('does not clobber a touched value on locale change', () => {
    const anchored = { ...base, existingEntryWeightKg: 82 };
    const result = resolveWeightPrefillUpdate(
      anchored,
      { ...anchored, locale: 'pl' },
      true,
      '81.00',
    );
    expect(result.nextInput).toBeNull();
  });
});
