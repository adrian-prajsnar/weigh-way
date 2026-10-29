import { describe, expect, it } from 'vitest';
import { makeTestAccessToken, parseSessionIdFromAccessToken } from './auth-session-id';

describe('auth session id', () => {
  it('reads session_id from a JWT-shaped access token', () => {
    const token = makeTestAccessToken('sess-a1');
    expect(parseSessionIdFromAccessToken(token)).toBe('sess-a1');
  });
});
