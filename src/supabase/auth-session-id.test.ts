import { describe, expect, it } from 'vitest';
import { parseSessionIdFromAccessToken } from './auth-session-id';
import { makeTestAccessToken } from './test-helpers/make-test-access-token';

describe('auth session id', () => {
  it('reads session_id from a JWT-shaped access token', () => {
    const token = makeTestAccessToken('sess-a1');
    expect(parseSessionIdFromAccessToken(token)).toBe('sess-a1');
  });
});
