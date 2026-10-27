import { describe, expect, it } from 'vitest';
import { formatWeightValue, normalizeWeightInputText } from './format';

describe('prefilled weight display on locale change', () => {
  it('reformats the same kg value with a new decimal separator when input still matches', () => {
    const kg = 82;
    const enDisplay = formatWeightValue(kg, 'metric', 'en');
    const plDisplay = formatWeightValue(kg, 'metric', 'pl');

    expect(enDisplay).toBe('82.00');
    expect(plDisplay).toBe('82,00');
    expect(normalizeWeightInputText(enDisplay)).toBe(normalizeWeightInputText(plDisplay));
  });
});
