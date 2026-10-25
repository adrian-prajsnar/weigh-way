import { describe, expect, it } from 'vitest';
import { hashAuthCode } from './auth-code-hash';

describe('hashAuthCode', () => {
  it('is stable and does not echo the raw code', () => {
    const hash = hashAuthCode('secret-auth-code-123');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
    expect(hash).not.toContain('secret');
  });
});
