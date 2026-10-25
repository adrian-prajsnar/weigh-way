import { describe, expect, it } from 'vitest';
import { isValidEmail } from './email';

describe('isValidEmail', () => {
  it('accepts common addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('  user@example.co.uk  ')).toBe(true);
  });

  it('rejects missing or malformed addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
  });
});
