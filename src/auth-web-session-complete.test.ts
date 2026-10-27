import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
}));

/* eslint-disable import/first -- after vi.mock */
import * as WebBrowser from 'expo-web-browser';
import { safeMaybeCompleteAuthSession } from './auth-web-session-complete';
/* eslint-enable import/first */

describe('safeMaybeCompleteAuthSession', () => {
  it('swallows errors from maybeCompleteAuthSession', () => {
    vi.mocked(WebBrowser.maybeCompleteAuthSession).mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    expect(() => safeMaybeCompleteAuthSession()).not.toThrow();
  });
});
