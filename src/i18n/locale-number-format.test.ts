import { describe, expect, it } from 'vitest';
import { formatDecimal } from './locale-number-format';

describe('formatDecimal', () => {
  it('formats with locale decimal separators and no grouping', () => {
    expect(formatDecimal(82, 2, 2, 'pl')).toBe('82,00');
    expect(formatDecimal(1234.5, 1, 1, 'en')).toBe('1234.5');
    expect(formatDecimal(1234.5, 1, 1, 'pl')).toBe('1234,5');
  });

  it('reuses cached formatters for the same locale and digit count', () => {
    const first = formatDecimal(1, 2, 2, 'pl');
    const second = formatDecimal(2, 2, 2, 'pl');
    expect(first).toBe('1,00');
    expect(second).toBe('2,00');
  });
});
